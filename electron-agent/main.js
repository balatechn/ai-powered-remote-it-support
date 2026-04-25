'use strict';
/**
 * NexusIT Electron Tray Agent — Main Process
 *
 * Runs as a persistent system-tray application.
 * Tray icon: green (connected) / yellow (connecting) / red (disconnected)
 * Left-click  → Status window
 * Right-click → Context menu (Status, Settings, Logs, Reconnect, Exit)
 */

const {
  app, BrowserWindow, Tray, Menu, ipcMain,
  nativeImage, shell
} = require('electron');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const zlib    = require('zlib');
const { io }  = require('socket.io-client');
const { exec, execFileSync, spawn } = require('child_process');
const screenshot = require('screenshot-desktop');
const si       = require('systeminformation');
const winston  = require('winston');

// ── Single instance ────────────────────────────────────────
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// ── Paths ──────────────────────────────────────────────────
const CONFIG_DIR  = app.getPath('userData');
const CONFIG_FILE = path.join(CONFIG_DIR, '.env');
const LOG_DIR     = path.join(CONFIG_DIR, 'logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// ── Logger ─────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) =>
      `${timestamp} [${level.toUpperCase()}] ${message}`)
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'agent.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ]
});

// ── Config ─────────────────────────────────────────────────
function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  const cfg = {};
  for (const line of fs.readFileSync(CONFIG_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) cfg[m[1].trim()] = m[2].trim();
  }
  return cfg;
}

function writeConfig({ serverUrl, agentSecret }) {
  fs.writeFileSync(
    CONFIG_FILE,
    `SERVER_URL=${serverUrl}\nAGENT_SECRET=${agentSecret}\nHEARTBEAT_INTERVAL=10000\n`,
    'utf8'
  );
}

// ── PNG Icon Generator (no external deps) ─────────────────
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c & 1) ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function makePNG(size, r, g, b) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter byte = None
    for (let x = 0; x < size; x++) {
      const cx = (size - 1) / 2, cy = (size - 1) / 2;
      const radius = size / 2 - 1.5;
      const dx = x - cx, dy = y - cy;
      const alpha = (dx * dx + dy * dy <= radius * radius) ? 255 : 0;
      row.push(r, g, b, alpha);
    }
    rows.push(Buffer.from(row));
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows));
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); ihdr.writeUInt8(6, 9); // 8-bit RGBA
  ihdr.writeUInt8(0, 10); ihdr.writeUInt8(0, 11); ihdr.writeUInt8(0, 12);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// ── Remote Tools ──────────────────────────────────────────
function psExec(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return execFileSync(
    'powershell.exe',
    ['-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { timeout: 30000, maxBuffer: 50 * 1024 * 1024 }
  ).toString('utf8').trim();
}

function parseJsonSafe(str) {
  try { const v = JSON.parse(str); return Array.isArray(v) ? v : (v ? [v] : []); }
  catch { return []; }
}

async function toolScreenshot() {
  const buf = await screenshot({ format: 'jpg' });
  return { image: buf.toString('base64'), timestamp: new Date().toISOString() };
}

function toolProcesses() {
  const script = `@(Get-Process | Sort-Object CPU -Descending | Select-Object -First 150 |
    Select-Object Id, Name,
      @{N='CPU';E={[Math]::Round($_.CPU,1)}},
      @{N='MemMB';E={[Math]::Round($_.WorkingSet64/1MB,1)}},
      @{N='Path';E={try{$_.Path}catch{''}}}) | ConvertTo-Json -Compress -Depth 2`;
  return { processes: parseJsonSafe(psExec(script)) };
}

function toolKillProcess(pid) {
  const safePid = parseInt(pid);
  if (isNaN(safePid)) throw new Error('Invalid PID');
  psExec(`Stop-Process -Id ${safePid} -Force -ErrorAction Stop`);
  return { ok: true };
}

function toolServices() {
  const script = `@(Get-Service | Select-Object Name, DisplayName,
    @{N='Status';E={$_.Status.ToString()}},
    @{N='StartType';E={$_.StartType.ToString()}} |
    Sort-Object DisplayName) | ConvertTo-Json -Compress -Depth 2`;
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
  const script = `$p=@('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*');@(Get-ItemProperty $p -EA SilentlyContinue|Where-Object{$_.DisplayName}|Select-Object DisplayName,DisplayVersion,Publisher,InstallDate|Sort-Object DisplayName)|ConvertTo-Json -Compress -Depth 2`;
  return { software: parseJsonSafe(psExec(script)) };
}

function toolFileList(dirPath) {
  const target = dirPath || 'C:\\';
  const entries = [];
  for (const name of fs.readdirSync(target).slice(0, 500)) {
    try {
      const st = fs.statSync(path.join(target, name));
      entries.push({ name, isDir: st.isDirectory(), size: st.size, modified: st.mtime.toISOString() });
    } catch { /* skip */ }
  }
  entries.sort((a, b) => (Number(b.isDir) - Number(a.isDir)) || a.name.localeCompare(b.name));
  return { path: target, entries };
}

function toolFileDownload(filePath) {
  const st = fs.statSync(filePath);
  if (st.size > 100 * 1024 * 1024) throw new Error('File too large (max 100 MB)');
  return { name: path.basename(filePath), size: st.size, data: fs.readFileSync(filePath).toString('base64') };
}

function toolFileUpload(filePath, b64) {
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(filePath, buf);
  return { ok: true, size: buf.length };
}

function toolFileDelete(filePath) { fs.unlinkSync(filePath); return { ok: true }; }

// ── Remote Desktop Streaming ───────────────────────────────
let rdviewInterval = null;
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
        'MOVE'   { [Win32Input]::SetCursorPos([int]\$p[1],[int]\$p[2])|Out-Null }
        'LCLICK' { [Win32Input]::SetCursorPos([int]\$p[1],[int]\$p[2])|Out-Null; [Win32Input]::mouse_event([Win32Input]::LDN,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [Win32Input]::mouse_event([Win32Input]::LUP,0,0,0,[UIntPtr]::Zero) }
        'RCLICK' { [Win32Input]::SetCursorPos([int]\$p[1],[int]\$p[2])|Out-Null; [Win32Input]::mouse_event([Win32Input]::RDN,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [Win32Input]::mouse_event([Win32Input]::RUP,0,0,0,[UIntPtr]::Zero) }
        'KEY'    { if (\$p[1]) { [System.Windows.Forms.SendKeys]::SendWait(\$p[1]) } }
    }
}`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  inputProc = spawn('powershell.exe', ['-NonInteractive', '-NoProfile', '-EncodedCommand', encoded], {
    stdio: ['pipe', 'ignore', 'pipe']
  });
  inputProc.on('close', () => { inputProc = null; });
  inputProc.on('error', () => { inputProc = null; });
  return inputProc;
}

function startRdview(sock, quality, fps) {
  if (rdviewInterval) { clearInterval(rdviewInterval); rdviewInterval = null; }
  const intervalMs = Math.max(200, Math.round(1000 / Math.min(fps || 2, 10)));
  const captureFrame = async () => {
    try {
      const buf = await screenshot({ format: 'jpg' });
      sock.emit('rdview:frame', { image: buf.toString('base64'), ts: Date.now() });
    } catch (err) { logger.warn(`rdview: ${err.message}`); }
  };
  rdviewInterval = setInterval(captureFrame, intervalMs);
  logger.info(`rdview started — ${fps} fps`);
}

// ── App State ──────────────────────────────────────────────
let tray            = null;
let statusWin       = null;
let settingsWin     = null;
let socket          = null;
let agentStatus     = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
let lastStats       = null;
let lastHeartbeat   = null;
let heartbeatTimer  = null;
let iconConnected, iconDisconnected, iconConnecting;

// ── System Info ────────────────────────────────────────────
function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

let _osVersion = os.release();
si.osInfo()
  .then(i => { _osVersion = (`${i.distro} ${i.release}`).trim() || os.release(); })
  .catch(() => {});

async function getStats() {
  try {
    const [cpu, mem, disk] = await Promise.all([
      si.currentLoad(), si.mem(), si.fsSize()
    ]);
    const mainDisk = disk.find(d => d.mount === 'C:' || d.mount === '/') || disk[0];
    return {
      cpu:    Math.round(cpu.currentLoad * 10) / 10,
      memory: Math.round(((mem.total - mem.available) / mem.total) * 1000) / 10,
      disk:   mainDisk ? Math.round((mainDisk.used / mainDisk.size) * 1000) / 10 : 0,
      users:  (await si.users()).map(u => u.user).filter(Boolean)
    };
  } catch {
    return { cpu: 0, memory: 0, disk: 0, users: [] };
  }
}

function getStatusPayload() {
  const config = readConfig();
  return {
    hostname:      os.hostname(),
    platform:      os.platform(),
    osVersion:     _osVersion,
    localIp:       getLocalIp(),
    serverUrl:     config.SERVER_URL || 'Not configured',
    status:        agentStatus,
    lastHeartbeat: lastHeartbeat ? lastHeartbeat.toLocaleTimeString() : null,
    version:       app.getVersion(),
    stats:         lastStats,
    logDir:        LOG_DIR
  };
}

// ── Agent WebSocket ────────────────────────────────────────
function startAgent() {
  const config = readConfig();

  if (!config.SERVER_URL || !config.AGENT_SECRET) {
    logger.warn('No config — opening settings');
    agentStatus = 'disconnected';
    updateTray();
    // Delay to ensure app is fully ready
    setTimeout(openSettings, 500);
    return;
  }

  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }

  agentStatus = 'connecting';
  updateTray();

  logger.info(`Connecting to ${config.SERVER_URL}`);

  socket = io(`${config.SERVER_URL}/agent`, {
    auth: {
      secret:       config.AGENT_SECRET,
      hostname:     os.hostname(),
      platform:     os.platform(),
      osVersion:    _osVersion,
      localIp:      getLocalIp(),
      agentVersion: app.getVersion()
    },
    reconnection:         true,
    reconnectionDelay:    3000,
    reconnectionDelayMax: 30000,
    transports: ['websocket']
  });

  socket.on('connect', async () => {
    logger.info(`Connected (id: ${socket.id})`);
    agentStatus = 'connected';
    updateTray();
    pushStatus();

    const beat = async () => {
      lastStats = await getStats();
      socket.emit('heartbeat', lastStats);
      lastHeartbeat = new Date();
      pushStatus();
    };
    beat();
    heartbeatTimer = setInterval(beat, parseInt(config.HEARTBEAT_INTERVAL || '10000'));
  });

  socket.on('cmd:run', ({ commandId, type, command }) => {
    runCommand(commandId, type, command);
  });

  // ── Remote Tools ──────────────────────────────────────────
  socket.on('tool:request', async ({ requestId, tool, params }) => {
    params = params || {};
    let data, error;
    try {
      switch (tool) {
        case 'screenshot':      data = await toolScreenshot();                              break;
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

  socket.on('rdview:start', ({ quality, fps } = {}) => {
    startRdview(socket, quality, fps);
  });

  socket.on('rdview:stop', () => {
    if (rdviewInterval) { clearInterval(rdviewInterval); rdviewInterval = null; }
  });

  socket.on('rdview:input', ({ type, x, y, button, key } = {}) => {
    try {
      const proc = getInputProc();
      if (!proc || proc.killed) return;
      const xi = Math.round(Number(x)), yi = Math.round(Number(y));
      if (type === 'mousemove')    proc.stdin.write(`MOVE ${xi} ${yi}\n`);
      else if (type === 'click')   proc.stdin.write(`${button === 'right' ? 'RCLICK' : 'LCLICK'} ${xi} ${yi}\n`);
      else if (type === 'key' && key) proc.stdin.write(`KEY ${key}\n`);
    } catch (err) { logger.error(`rdview:input error: ${err.message}`); inputProc = null; }
  });

  socket.on('disconnect', reason => {
    logger.warn(`Disconnected: ${reason}`);
    agentStatus = 'disconnected';
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    updateTray();
    pushStatus();
  });

  socket.on('connect_error', err => {
    logger.error(`Connect error: ${err.message}`);
    agentStatus = 'connecting';
    updateTray();
    pushStatus();
  });

  socket.on('reconnect', n => {
    logger.info(`Reconnected after ${n} attempt(s)`);
    agentStatus = 'connected';
    updateTray();
    pushStatus();
  });
}

function stopAgent() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (rdviewInterval) { clearInterval(rdviewInterval); rdviewInterval = null; }
  if (inputProc)  { inputProc.kill();  inputProc  = null; }
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
  agentStatus = 'disconnected';
  updateTray();
  pushStatus();
}

// ── Command Execution ──────────────────────────────────────
function runCommand(commandId, type, command) {
  const cmd = type === 'powershell'
    ? `powershell -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`
    : process.platform === 'win32' ? `cmd /c ${command}` : command;

  logger.info(`[${type}] ${command}`);
  const t0 = Date.now();
  let out = '';

  const child = exec(cmd, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
  const emit = chunk => {
    out += chunk;
    socket?.emit('cmd:output', { commandId, chunk });
  };
  child.stdout?.on('data', emit);
  child.stderr?.on('data', emit);
  child.on('close', code => {
    socket?.emit('cmd:output', {
      commandId, chunk: '', done: true,
      exitCode: code ?? 0, output: out, durationMs: Date.now() - t0
    });
    logger.info(`Done in ${Date.now() - t0}ms exit=${code}`);
  });
  child.on('error', err => {
    socket?.emit('cmd:output', {
      commandId, chunk: `\nError: ${err.message}`, done: true,
      exitCode: 1, output: out + `\nError: ${err.message}`, durationMs: Date.now() - t0
    });
    logger.error(`Command error: ${err.message}`);
  });
}

// ── Tray ───────────────────────────────────────────────────
function updateTray() {
  if (!tray) return;

  const icons  = { connected: iconConnected, connecting: iconConnecting, disconnected: iconDisconnected };
  const tips   = {
    connected:    'NexusIT Agent — Connected',
    connecting:   'NexusIT Agent — Connecting...',
    disconnected: 'NexusIT Agent — Disconnected'
  };
  const labels = {
    connected:    '● Connected',
    connecting:   '◌ Connecting...',
    disconnected: '○ Disconnected'
  };

  tray.setImage(icons[agentStatus] || iconDisconnected);
  tray.setToolTip(tips[agentStatus] || 'NexusIT Agent');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'NexusIT Agent',          enabled: false },
    { label: labels[agentStatus],      enabled: false },
    { type: 'separator' },
    { label: 'Open Status...',         click: openStatus },
    { label: 'Settings...',            click: openSettings },
    { label: 'View Logs...',           click: () => shell.openPath(LOG_DIR) },
    { label: 'Reconnect',              click: () => { stopAgent(); setTimeout(startAgent, 500); } },
    { type: 'separator' },
    { label: 'Exit',                   click: () => { app.isQuitting = true; app.quit(); } }
  ]));
}

function pushStatus() {
  if (statusWin && !statusWin.isDestroyed()) {
    statusWin.webContents.send('status-update', getStatusPayload());
  }
}

// ── Windows ────────────────────────────────────────────────
function openStatus() {
  if (statusWin && !statusWin.isDestroyed()) { statusWin.focus(); return; }
  statusWin = new BrowserWindow({
    width: 440, height: 530,
    resizable: false,
    backgroundColor: '#0f172a',
    title: 'NexusIT Agent',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  statusWin.setMenuBarVisibility(false);
  statusWin.loadFile(path.join(__dirname, 'renderer', 'status.html'));
  statusWin.on('closed', () => { statusWin = null; });
  statusWin.webContents.on('did-finish-load', () => {
    statusWin.webContents.send('status-update', getStatusPayload());
  });
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 440, height: 290,
    resizable: false,
    backgroundColor: '#0f172a',
    title: 'NexusIT Agent — Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
  settingsWin.webContents.on('did-finish-load', () => {
    const cfg = readConfig();
    settingsWin.webContents.send('settings-data', {
      serverUrl:   cfg.SERVER_URL   || '',
      agentSecret: cfg.AGENT_SECRET || ''
    });
  });
}

// ── IPC Handlers ───────────────────────────────────────────
ipcMain.handle('get-status',    ()        => getStatusPayload());
ipcMain.handle('get-settings',  ()        => {
  const c = readConfig();
  return { serverUrl: c.SERVER_URL || '', agentSecret: c.AGENT_SECRET || '' };
});
ipcMain.handle('open-dashboard', ()       => {
  const c = readConfig();
  if (c.SERVER_URL) shell.openExternal(c.SERVER_URL);
});
ipcMain.handle('open-logs',     ()        => shell.openPath(LOG_DIR));
ipcMain.handle('reconnect',     ()        => { stopAgent(); setTimeout(startAgent, 500); });
ipcMain.handle('save-settings', (_, data) => {
  const { serverUrl, agentSecret } = data;
  if (!serverUrl?.trim())    throw new Error('Server URL is required');
  if (!agentSecret?.trim())  throw new Error('Agent Secret is required');
  writeConfig({ serverUrl: serverUrl.trim(), agentSecret: agentSecret.trim() });
  logger.info(`Config saved — server: ${serverUrl.trim()}`);
  stopAgent();
  setTimeout(startAgent, 500);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close();
  return { ok: true };
});

// ── App Lifecycle ──────────────────────────────────────────
app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.nexusit.agent');
  }

  // Register auto-start at Windows login
  app.setLoginItemSettings({ openAtLogin: true, name: 'NexusIT Agent' });

  // Build tray icons using inline PNG generator
  iconConnected    = nativeImage.createFromBuffer(makePNG(32, 34,  197, 94));  // #22c55e green
  iconDisconnected = nativeImage.createFromBuffer(makePNG(32, 239, 68,  68));  // #ef4444 red
  iconConnecting   = nativeImage.createFromBuffer(makePNG(32, 234, 179, 8));   // #eab308 yellow

  // Create system tray
  tray = new Tray(iconDisconnected);
  tray.on('click',        openStatus);
  tray.on('double-click', openStatus);
  updateTray();

  // Start the agent
  startAgent();
});

app.on('second-instance', () => { openStatus(); });
app.on('window-all-closed', () => { /* stay in tray */ });
app.on('before-quit', () => { stopAgent(); });
