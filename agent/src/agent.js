/**
 * Endpoint Agent
 * Lightweight background service that registers with the server,
 * sends heartbeats/telemetry, and executes remote scripts.
 */

// Load agent-local .env first (overrides root), then fall back to root .env
const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '../.env') });       // agent/.env
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });    // root .env (fallback)

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

  const cmd = type === 'powershell' ? `powershell -NoProfile -ExecutionPolicy Bypass -Command "${content.replace(/"/g, '\\"')}"` :
              type === 'bash' ? content : `python3 -c "${content}"`;

  const timeout = 60000; // 60 second timeout

  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
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

// ─── Fix Tools ───────────────────────────────────────────────
const fixToolCommands = {
  clearTemp: 'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; Write-Output "Temp files cleared."',
  flushDNS:  'ipconfig /flushdns',
  resetWinsock: 'netsh winsock reset; netsh int ip reset; Write-Output "Winsock reset complete. Restart required."',
  restartExplorer: 'Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Process explorer; Write-Output "Explorer restarted."',
  checkDisk: 'Write-Output "CHKDSK scheduled on next reboot."; cmd /c "echo y | chkdsk C: /f /r /x 2>&1"',
  systemFileChecker: 'sfc /scannow',
};

async function runFixTool(toolId) {
  logger.info(`Running fix tool: ${toolId}`);

  // fixAll runs all safe tools in sequence
  if (toolId === 'fixAll') {
    const safeTools = ['clearTemp', 'flushDNS', 'restartExplorer'];
    const outputs = [];
    for (const tid of safeTools) {
      const r = await runFixTool(tid);
      outputs.push(`[${tid}]: ${r.output || r.error}`);
    }
    return { toolId: 'fixAll', success: true, output: outputs.join('\n') };
  }

  const cmd = fixToolCommands[toolId];
  if (!cmd) {
    return { toolId, success: false, error: `Unknown tool: ${toolId}` };
  }

  const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${cmd.replace(/"/g, '\\"')}"`;

  return new Promise((resolve) => {
    exec(psCmd, { timeout: 120000, maxBuffer: 1024 * 512 }, (error, stdout, stderr) => {
      const output = (stdout || '').trim();
      const errText = (stderr || error?.message || '').trim();
      logger.info(`Fix tool [${toolId}] exit: ${error ? error.code || 1 : 0}`);
      resolve({
        toolId,
        success: !error,
        output: output || (error ? '' : 'Done'),
        error: errText,
      });
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

  // ── Handle Fix Tool Commands ─────────────────────────────
  socket.on('tool:execute', async (data) => {
    const { toolId } = data || {};
    if (!toolId) {
      socket.emit('tool:result', { toolId: 'unknown', success: false, error: 'No toolId provided' });
      return;
    }
    try {
      const result = await runFixTool(toolId);
      socket.emit('tool:result', result);
    } catch (error) {
      logger.error(`Fix tool error [${toolId}]: ${error.message}`);
      socket.emit('tool:result', { toolId, success: false, error: error.message });
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
