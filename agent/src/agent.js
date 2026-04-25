'use strict';
/**
 * NexusIT Endpoint Agent
 * ─────────────────────
 * - Connects to server via WebSocket /agent namespace
 * - Authenticates with AGENT_SECRET
 * - Sends heartbeat every HEARTBEAT_INTERVAL ms
 * - Executes cmd / powershell commands on request
 * - Streams output chunks back in real-time
 * - Auto-reconnects on disconnect
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { io }    = require('socket.io-client');
const { exec, execFileSync, spawn } = require('child_process');
const os        = require('os');
const si        = require('systeminformation');
const winston   = require('winston');
const path      = require('path');
const fs        = require('fs');

// ── Config ────────────────────────────────────────────────────
const SERVER_URL          = process.env.SERVER_URL || 'http://localhost:4000';
const AGENT_SECRET        = process.env.AGENT_SECRET || 'change_this_agent_secret';
const HEARTBEAT_INTERVAL  = parseInt(process.env.HEARTBEAT_INTERVAL || '10000');
const AGENT_VERSION       = '2.0.0';

// ── Logger ────────────────────────────────────────────────────
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}] ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logDir, 'agent.log'), maxsize: 5242880, maxFiles: 3 })
  ]
});

// ── System info ───────────────────────────────────────────────
function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

async function getStats() {
  try {
    const [cpu, mem, disk, users] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.users()
    ]);
    const mainDisk = disk.find(d => d.mount === 'C:' || d.mount === '/') || disk[0];
    return {
      cpu:    Math.round(cpu.currentLoad * 10) / 10,
      memory: Math.round(((mem.total - mem.available) / mem.total) * 1000) / 10,
      disk:   mainDisk ? Math.round((mainDisk.used / mainDisk.size) * 1000) / 10 : null,
      users:  users.map(u => u.user).filter(Boolean)
    };
  } catch {
    return { cpu: null, memory: null, disk: null, users: [] };
  }
}

async function getOsVersion() {
  try {
    const info = await si.osInfo();
    return `${info.distro} ${info.release}`.trim() || os.release();
  } catch {
    return os.release();
  }
}

// ── Command execution ─────────────────────────────────────────
function buildCommand(type, command) {
  if (type === 'powershell') {
    return `powershell -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`;
  }
  // cmd — on Windows use cmd /c, on Linux allow bash
  if (os.platform() === 'win32') return `cmd /c ${command}`;
  return command;
}

function runCommand(socket, commandId, type, command) {
  const shellCmd = buildCommand(type, command);
  logger.info(`Executing [${type}]: ${command}`);

  const startTime = Date.now();
  let fullOutput  = '';

  const child = exec(shellCmd, { timeout: 60000, maxBuffer: 1024 * 1024 * 10 });

  const emit = (chunk) => {
    fullOutput += chunk;
    socket.emit('cmd:output', { commandId, chunk });
  };

  child.stdout?.on('data', chunk => emit(chunk));
  child.stderr?.on('data', chunk => emit(chunk));

  child.on('close', (code) => {
    const durationMs = Date.now() - startTime;
    socket.emit('cmd:output', {
      commandId,
      chunk:      '',
      done:       true,
      exitCode:   code ?? 0,
      output:     fullOutput,
      durationMs
    });
    logger.info(`Command done in ${durationMs}ms, exit=${code}`);
  });

  child.on('error', (err) => {
    const durationMs = Date.now() - startTime;
    socket.emit('cmd:output', {
      commandId,
      chunk:      `\nError: ${err.message}`,
      done:       true,
      exitCode:   1,
      output:     fullOutput + `\nError: ${err.message}`,
      durationMs
    });
    logger.error(`Command error: ${err.message}`);
  });
}

// ── Remote Tools ──────────────────────────────────────────────
// Execute a PowerShell script via -EncodedCommand (avoids quoting issues)
function psExec(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return execFileSync(
    'powershell.exe',
    ['-NonInteractive', '-NoProfile', '-EncodedCommand', encoded],
    { timeout: 30000, maxBuffer: 50 * 1024 * 1024 }
  ).toString('utf8').trim();
}

function parseJsonSafe(str) {
  try {
    const v = JSON.parse(str);
    return Array.isArray(v) ? v : (v ? [v] : []);
  } catch { return []; }
}

function toolScreenshot() {
  if (os.platform() !== 'win32') throw new Error('Screenshot is only supported on Windows');
  const script = `
    Add-Type -AssemblyName System.Windows.Forms,System.Drawing
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
    $ms = New-Object System.IO.MemoryStream
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
      [System.Drawing.Imaging.Encoder]::Quality, 70L)
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
      Where-Object { $_.FormatDescription -eq 'JPEG' }
    $bmp.Save($ms, $codec, $encParams)
    [Convert]::ToBase64String($ms.ToArray())
  `;
  const b64 = psExec(script);
  return { image: b64, timestamp: new Date().toISOString() };
}

function toolProcesses() {
  const script = `
    @(Get-Process | Sort-Object CPU -Descending | Select-Object -First 150 |
      Select-Object Id, Name,
        @{N='CPU';E={[Math]::Round($_.CPU,1)}},
        @{N='MemMB';E={[Math]::Round($_.WorkingSet64/1MB,1)}},
        @{N='Path';E={try{$_.Path}catch{''}}} ) |
    ConvertTo-Json -Compress -Depth 2
  `;
  return { processes: parseJsonSafe(psExec(script)) };
}

function toolKillProcess(pid) {
  const safePid = parseInt(pid);
  if (isNaN(safePid)) throw new Error('Invalid PID');
  psExec(`Stop-Process -Id ${safePid} -Force -ErrorAction Stop`);
  return { ok: true };
}

function toolServices() {
  const script = `
    @(Get-Service | Select-Object Name, DisplayName,
        @{N='Status';E={$_.Status.ToString()}},
        @{N='StartType';E={$_.StartType.ToString()}} |
      Sort-Object DisplayName) |
    ConvertTo-Json -Compress -Depth 2
  `;
  return { services: parseJsonSafe(psExec(script)) };
}

function toolServiceControl(name, action) {
  if (!/^[\w\s\-.]+$/.test(name)) throw new Error('Invalid service name');
  const cmds = { start: 'Start-Service', stop: 'Stop-Service', restart: 'Restart-Service' };
  const cmd = cmds[action];
  if (!cmd) throw new Error(`Unknown action: ${action}`);
  psExec(`${cmd} -Name '${name}' -Force -ErrorAction Stop`);
  return { ok: true };
}

function toolInventory() {
  const script = `
    $paths = @(
      'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
    )
    @(Get-ItemProperty $paths -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName } |
      Select-Object DisplayName, DisplayVersion, Publisher, InstallDate |
      Sort-Object DisplayName) |
    ConvertTo-Json -Compress -Depth 2
  `;
  return { software: parseJsonSafe(psExec(script)) };
}

function toolFileList(dirPath) {
  const target = dirPath || (os.platform() === 'win32' ? 'C:\\' : '/');
  const entries = [];
  const items = fs.readdirSync(target);
  for (const name of items.slice(0, 500)) {
    try {
      const st = fs.statSync(path.join(target, name));
      entries.push({ name, isDir: st.isDirectory(), size: st.size, modified: st.mtime.toISOString() });
    } catch { /* skip inaccessible */ }
  }
  entries.sort((a, b) => (Number(b.isDir) - Number(a.isDir)) || a.name.localeCompare(b.name));
  return { path: target, entries };
}

function toolFileDownload(filePath) {
  const MAX = 100 * 1024 * 1024;
  const st = fs.statSync(filePath);
  if (st.size > MAX) throw new Error('File too large (max 100 MB)');
  const buf = fs.readFileSync(filePath);
  return { name: path.basename(filePath), size: st.size, data: buf.toString('base64') };
}

function toolFileUpload(filePath, b64) {
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(filePath, buf);
  return { ok: true, size: buf.length };
}

function toolFileDelete(filePath) {
  fs.unlinkSync(filePath);
  return { ok: true };
}

// ── Remote Desktop Streaming ──────────────────────────────────
let rdviewProc = null;
let inputProc  = null;

function getInputProc() {
  if (inputProc && !inputProc.killed) return inputProc;
  const script = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32Input {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
    public const uint LDN=0x0002u, LUP=0x0004u, RDN=0x0008u, RUP=0x0010u;
}
"@
\$r = [Console]::In
while (\$true) {
    \$l = \$r.ReadLine()
    if (\$null -eq \$l) { break }
    \$p = \$l.Trim().Split(' ')
    switch (\$p[0]) {
        'MOVE'   { [Win32Input]::SetCursorPos([int]\$p[1], [int]\$p[2]) | Out-Null }
        'LCLICK' {
            [Win32Input]::SetCursorPos([int]\$p[1], [int]\$p[2]) | Out-Null
            [Win32Input]::mouse_event([Win32Input]::LDN, 0, 0, 0, [UIntPtr]::Zero)
            Start-Sleep -Milliseconds 30
            [Win32Input]::mouse_event([Win32Input]::LUP, 0, 0, 0, [UIntPtr]::Zero)
        }
        'RCLICK' {
            [Win32Input]::SetCursorPos([int]\$p[1], [int]\$p[2]) | Out-Null
            [Win32Input]::mouse_event([Win32Input]::RDN, 0, 0, 0, [UIntPtr]::Zero)
            Start-Sleep -Milliseconds 30
            [Win32Input]::mouse_event([Win32Input]::RUP, 0, 0, 0, [UIntPtr]::Zero)
        }
        'KEY'    { if (\$p[1]) { [System.Windows.Forms.SendKeys]::SendWait(\$p[1]) } }
    }
}`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  inputProc = spawn('powershell.exe', ['-NonInteractive', '-NoProfile', '-EncodedCommand', encoded], {
    stdio: ['pipe', 'ignore', 'pipe']
  });
  inputProc.on('close',  ()    => { inputProc = null; });
  inputProc.on('error',  (err) => { logger.error(`inputProc error: ${err.message}`); inputProc = null; });
  return inputProc;
}

// ── Main ──────────────────────────────────────────────────────
(async () => {
  const hostname  = os.hostname();
  const platform  = os.platform();
  const localIp   = getLocalIp();
  const osVersion = await getOsVersion();

  logger.info(`NexusIT Agent v${AGENT_VERSION} starting`);
  logger.info(`Host: ${hostname} | OS: ${platform} | IP: ${localIp}`);
  logger.info(`Server: ${SERVER_URL}`);

  const socket = io(`${SERVER_URL}/agent`, {
    auth:          { secret: AGENT_SECRET, hostname, platform, osVersion, localIp, agentVersion: AGENT_VERSION },
    reconnection:  true,
    reconnectionDelay:    3000,
    reconnectionDelayMax: 30000,
    transports:    ['websocket']
  });

  let heartbeatTimer = null;

  // Clean up streaming processes on exit
  process.on('exit', () => {
    if (rdviewProc) rdviewProc.kill();
    if (inputProc)  inputProc.kill();
  });

  socket.on('connect', async () => {
    logger.info(`Connected to server (socket: ${socket.id})`);

    // Start heartbeat
    const sendHeartbeat = async () => {
      const stats = await getStats();
      socket.emit('heartbeat', stats);
    };
    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
  });

  socket.on('cmd:run', ({ commandId, type, command, runAs }) => {
    runCommand(socket, commandId, type, command);
  });

  // ── Remote Tool Requests ────────────────────────────────
  socket.on('tool:request', async ({ requestId, tool, params }) => {
    logger.info(`Tool request: ${tool}`);
    params = params || {};
    let data, error;
    try {
      switch (tool) {
        case 'screenshot':      data = toolScreenshot();                              break;
        case 'processes':       data = toolProcesses();                               break;
        case 'kill':            data = toolKillProcess(params.pid);                   break;
        case 'services':        data = toolServices();                                break;
        case 'service:control': data = toolServiceControl(params.name, params.action); break;
        case 'inventory':       data = toolInventory();                               break;
        case 'file:list':       data = toolFileList(params.path);                     break;
        case 'file:download':   data = toolFileDownload(params.path);                 break;
        case 'file:upload':     data = toolFileUpload(params.path, params.data);      break;
        case 'file:delete':     data = toolFileDelete(params.path);                   break;
        default: throw new Error(`Unknown tool: ${tool}`);
      }
    } catch (err) {
      logger.error(`Tool error [${tool}]: ${err.message}`);
      error = err.message;
    }
    socket.emit('tool:result', { requestId, tool, data: data ?? null, error: error ?? null });
  });

  // ── Remote Desktop Streaming ────────────────────────────
  socket.on('rdview:start', ({ quality = 50, fps = 2 } = {}) => {
    if (os.platform() !== 'win32') return;
    if (rdviewProc) { rdviewProc.kill(); rdviewProc = null; }
    const intervalMs = Math.max(200, Math.round(1000 / Math.min(fps, 10)));
    const qual = Math.max(10, Math.min(100, quality));
    const script = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, ${qual}L)
while ($true) {
  try {
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $sw = [int]($b.Width / 2); $sh = [int]($b.Height / 2)
    $src = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
    $g0 = [System.Drawing.Graphics]::FromImage($src)
    $g0.CopyFromScreen(0, 0, 0, 0, $src.Size)
    $bmp = New-Object System.Drawing.Bitmap($sw, $sh)
    $g1 = [System.Drawing.Graphics]::FromImage($bmp)
    $g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g1.DrawImage($src, 0, 0, $sw, $sh)
    $ms = New-Object System.IO.MemoryStream
    if ($codec) { $bmp.Save($ms, $codec, $ep) } else { $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg) }
    $b64 = [Convert]::ToBase64String($ms.ToArray())
    $g0.Dispose(); $g1.Dispose(); $src.Dispose(); $bmp.Dispose(); $ms.Dispose()
    [Console]::WriteLine($sw.ToString() + ',' + $sh.ToString() + ',' + $b64)
    [Console]::Out.Flush()
  } catch { [Console]::Error.WriteLine($_.Exception.Message) }
  Start-Sleep -Milliseconds ${intervalMs}
}`;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    rdviewProc = spawn('powershell.exe', ['-NonInteractive', '-NoProfile', '-EncodedCommand', encoded], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let buf = '';
    rdviewProc.stdout.on('data', chunk => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        const c1 = line.indexOf(',');
        const c2 = line.indexOf(',', c1 + 1);
        if (c1 < 0 || c2 < 0) continue;
        const w = parseInt(line.slice(0, c1));
        const h = parseInt(line.slice(c1 + 1, c2));
        const img = line.slice(c2 + 1);
        if (!img || isNaN(w) || isNaN(h)) continue;
        socket.emit('rdview:frame', { image: img, width: w, height: h, ts: Date.now() });
      }
    });
    rdviewProc.stderr?.on('data', d => logger.warn(`rdview: ${d.toString().trim()}`));
    rdviewProc.on('close', () => { rdviewProc = null; logger.info('rdview process exited'); });
    rdviewProc.on('error', err => { logger.error(`rdview spawn error: ${err.message}`); rdviewProc = null; });
    logger.info(`rdview started — ${fps} fps, quality ${qual}%`);
  });

  socket.on('rdview:stop', () => {
    if (rdviewProc) { rdviewProc.kill(); rdviewProc = null; }
    logger.info('rdview stopped');
  });

  socket.on('rdview:input', ({ type, x, y, button, key } = {}) => {
    if (os.platform() !== 'win32') return;
    try {
      const proc = getInputProc();
      if (!proc || proc.killed) return;
      const xi = Math.round(Number(x)), yi = Math.round(Number(y));
      if (type === 'mousemove') {
        proc.stdin.write(`MOVE ${xi} ${yi}\n`);
      } else if (type === 'click') {
        const cmd = button === 'right' ? 'RCLICK' : 'LCLICK';
        proc.stdin.write(`${cmd} ${xi} ${yi}\n`);
      } else if (type === 'key' && key) {
        proc.stdin.write(`KEY ${key}\n`);
      }
    } catch (err) {
      logger.error(`rdview:input error: ${err.message}`);
      inputProc = null;
    }
  });

  socket.on('disconnect', (reason) => {
    logger.warn(`Disconnected: ${reason}`);
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (rdviewProc) { rdviewProc.kill(); rdviewProc = null; }
  });

  socket.on('connect_error', (err) => {
    logger.error(`Connection error: ${err.message}`);
  });

  socket.on('reconnect', (attempt) => {
    logger.info(`Reconnected after ${attempt} attempts`);
  });

  process.on('SIGINT',  () => { logger.info('Shutting down…'); socket.disconnect(); process.exit(0); });
  process.on('SIGTERM', () => { logger.info('Shutting down…'); socket.disconnect(); process.exit(0); });
})();
