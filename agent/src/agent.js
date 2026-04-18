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
