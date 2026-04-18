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
const { exec }  = require('child_process');
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

  socket.on('disconnect', (reason) => {
    logger.warn(`Disconnected: ${reason}`);
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
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
/**
 * Endpoint Agent
 * Lightweight background service that registers with the server,
 * sends heartbeats/telemetry, and executes remote scripts.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { io } = require('socket.io-client');
const axios = require('axios');
const os = require('os');
const { exec } = require('child_process');
const si = require('systeminformation');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const AGENT_SECRET = process.env.AGENT_SECRET || 'dev-agent-secret';
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '30000');
const DEVICE_ID_FILE = path.resolve(__dirname, '../.device-id');

// ─── Logger ──────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.resolve(__dirname, '../logs/agent.log'), maxsize: 5242880, maxFiles: 3 })
  ]
});

// ─── Device ID Persistence ───────────────────────────────────
function getDeviceId() {
  try {
    if (fs.existsSync(DEVICE_ID_FILE)) {
      return fs.readFileSync(DEVICE_ID_FILE, 'utf8').trim();
    }
  } catch {}
  return null;
}

function saveDeviceId(id) {
  fs.mkdirSync(path.dirname(DEVICE_ID_FILE), { recursive: true });
  fs.writeFileSync(DEVICE_ID_FILE, id);
}

// ─── System Info Collection ──────────────────────────────────
async function getSystemInfo() {
  const [cpu, mem, disk, osInfo, networkInterfaces] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.osInfo(),
    si.networkInterfaces()
  ]);

  const primaryDisk = disk[0] || {};
  const primaryNet = networkInterfaces.find(n => n.ip4 && !n.internal) || {};

  return {
    hostname: os.hostname(),
    ip_address: primaryNet.ip4 || '0.0.0.0',
    mac_address: primaryNet.mac || '00:00:00:00:00:00',
    os_type: osInfo.platform === 'win32' ? 'windows' : osInfo.platform === 'darwin' ? 'macos' : 'linux',
    os_version: `${osInfo.distro} ${osInfo.release}`,
    cpu_usage: Math.round(cpu.currentLoad * 100) / 100,
    memory_usage: Math.round((mem.used / mem.total) * 10000) / 100,
    disk_usage: Math.round(primaryDisk.use * 100) / 100 || 0,
    agent_version: '1.0.0',
    metadata: {
      cpu_model: os.cpus()[0]?.model,
      cpu_cores: os.cpus().length,
      total_memory: Math.round(mem.total / (1024 * 1024 * 1024) * 100) / 100,
      uptime: os.uptime()
    }
  };
}

// ─── Script Execution (Sandboxed) ────────────────────────────
function executeScript(scriptData) {
  const { scriptId, content, type, requestedBy } = scriptData;
  logger.info(`Executing script ${scriptId} (${type}) requested by ${requestedBy}`);

  const ext = type === 'powershell' ? '.ps1' : type === 'python' ? '.py' : '.sh';
  const tmpFile = path.join(os.tmpdir(), `nexusit-script-${uuidv4()}${ext}`);
  const timeout = 60000; // 60 second timeout

  let cmd;
  if (type === 'powershell') {
    cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`;
  } else if (type === 'python') {
    cmd = `python3 "${tmpFile}"`;
  } else {
    cmd = `bash "${tmpFile}"`;
  }

  return new Promise((resolve) => {
    try {
      fs.writeFileSync(tmpFile, content, { mode: 0o600 });
    } catch (writeErr) {
      resolve({ scriptId, exit_code: 1, output: '', error: `Failed to write script: ${writeErr.message}` });
      return;
    }

    exec(cmd, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      try { fs.unlinkSync(tmpFile); } catch (_) {}

      const result = {
        scriptId,
        exit_code: error ? error.code || 1 : 0,
        output: stdout?.toString() || '',
        error: stderr?.toString() || error?.message || ''
      };

      logger.info(`Script ${scriptId} completed: exit code ${result.exit_code}`);
      resolve(result);
    });
  });
}

// ─── Main Agent Logic ────────────────────────────────────────
async function main() {
  logger.info('🚀 AI Remote IT Support Agent starting...');

  let deviceId = getDeviceId();
  const sysInfo = await getSystemInfo();

  // ── Register with server ─────────────────────────────────
  try {
    const { data } = await axios.post(`${SERVER_URL}/api/agent/register`, sysInfo, {
      headers: { 'X-Agent-Secret': AGENT_SECRET }
    });
    deviceId = data.device_id;
    saveDeviceId(deviceId);
    logger.info(`✅ Registered with server. Device ID: ${deviceId}`);
  } catch (error) {
    logger.error(`❌ Registration failed: ${error.message}`);
    if (!deviceId) {
      logger.error('No device ID available. Retrying in 30s...');
      setTimeout(main, 30000);
      return;
    }
  }

  // ── WebSocket Connection ─────────────────────────────────
  const socket = io(SERVER_URL, {
    auth: { agentSecret: AGENT_SECRET, deviceId },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 5000
  });

  socket.on('connect', () => {
    logger.info('📡 WebSocket connected');
  });

  socket.on('disconnect', (reason) => {
    logger.warn(`📡 WebSocket disconnected: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    logger.error(`📡 Connection error: ${error.message}`);
  });

  // ── Handle Script Execution Commands ─────────────────────
  socket.on('script:execute', async (data) => {
    try {
      const result = await executeScript(data);
      socket.emit('script:result', result);

      // Also report to REST API
      await axios.post(`${SERVER_URL}/api/agent/script-result`, {
        device_id: deviceId, ...result
      }, {
        headers: { 'X-Agent-Secret': AGENT_SECRET }
      });
    } catch (error) {
      logger.error(`Script execution error: ${error.message}`);
    }
  });

  // ── Heartbeat Loop ───────────────────────────────────────
  async function sendHeartbeat() {
    try {
      const info = await getSystemInfo();
      const heartbeatData = {
        device_id: deviceId,
        cpu_usage: info.cpu_usage,
        memory_usage: info.memory_usage,
        disk_usage: info.disk_usage,
        metadata: info.metadata
      };

      // Send via WebSocket
      socket.emit('heartbeat', heartbeatData);

      // Also via REST API as backup
      await axios.post(`${SERVER_URL}/api/agent/heartbeat`, heartbeatData, {
        headers: { 'X-Agent-Secret': AGENT_SECRET }
      });
    } catch (error) {
      logger.error(`Heartbeat error: ${error.message}`);
    }
  }

  // Initial heartbeat + interval
  sendHeartbeat();
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

  logger.info(`💓 Heartbeat interval: ${HEARTBEAT_INTERVAL / 1000}s`);
  logger.info('✅ Agent running. Waiting for commands...');
}

// ─── Start ───────────────────────────────────────────────────
main().catch(err => {
  logger.error('Agent fatal error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Agent shutting down...');
  process.exit(0);
});
