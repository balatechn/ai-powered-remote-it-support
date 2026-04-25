'use strict';
/**
 * WebSocket handler — manages agent connections and command routing.
 *
 * Namespaces:
 *   /agent   — CLI agents connect here (authenticated by AGENT_SECRET)
 *   /client  — browser clients connect here (authenticated by JWT)
 */
const jwt    = require('jsonwebtoken');
const logger = require('../utils/logger');
const { Device, CommandLog, SystemLog } = require('../models');
const { JWT_SECRET } = require('../middleware/auth');

const AGENT_SECRET = process.env.AGENT_SECRET || 'change_this_agent_secret';

module.exports = function setupSocket(io) {

  // ── Agent namespace ────────────────────────────────────────
  const agentNS = io.of('/agent');

  agentNS.use((socket, next) => {
    const secret = socket.handshake.auth?.secret || socket.handshake.query?.secret;
    if (secret !== AGENT_SECRET) {
      logger.warn('Agent connection rejected — bad secret', { ip: socket.handshake.address });
      return next(new Error('Unauthorized'));
    }
    next();
  });

  agentNS.on('connection', async (socket) => {
    const info = socket.handshake.auth || {};
    logger.info('Agent connected', { hostname: info.hostname, socketId: socket.id });

    // Register / update device in DB
    const osMap = { win32: 'windows', darwin: 'macos', linux: 'linux' };
    let device;
    let lastHbWrite = 0;   // throttle DB writes — broadcast every beat, persist every 60s
    try {
      const [dev] = await Device.findOrCreate({
        where: { hostname: info.hostname },
        defaults: {
          hostname:      info.hostname,
          ip_address:    info.localIp || null,
          public_ip:     socket.handshake.address,
          os_type:       osMap[info.platform] || 'windows',
          os_version:    info.osVersion || null,
          agent_version: info.agentVersion || '1.0.0',
          status:        'online',
          last_heartbeat: new Date()
        }
      });
      device = dev;
      await device.update({
        status:        'online',
        socket_id:     socket.id,
        ip_address:    info.localIp || device.ip_address,
        public_ip:     socket.handshake.address,
        last_heartbeat: new Date(),
        os_version:    info.osVersion || device.os_version
      });

      await SystemLog.create({ level: 'info', source: 'agent', message: `${info.hostname} came online`, device_id: device.id });

      // Notify all browser clients
      io.of('/client').emit('device:online', { deviceId: device.id, hostname: device.hostname });
    } catch (err) {
      logger.error('Error registering device', { error: err.message });
    }

    // ── Heartbeat ──────────────────────────────────────────
    socket.on('heartbeat', async (data) => {
      if (!device) return;

      // Always broadcast real-time stats to all browser clients
      io.of('/client').emit('device:heartbeat', {
        deviceId:      device.id,
        cpu_usage:     data.cpu,
        memory_usage:  data.memory,
        disk_usage:    data.disk,
        active_users:  data.users,
        last_heartbeat: new Date()
      });

      // Throttle DB writes: persist at most once every 60 seconds
      const now = Date.now();
      if (now - lastHbWrite < 60000) return;
      lastHbWrite = now;

      try {
        await device.update({
          last_heartbeat: new Date(),
          cpu_usage:     data.cpu ?? null,
          memory_usage:  data.memory ?? null,
          disk_usage:    data.disk ?? null,
          active_users:  data.users ?? [],
          status:        'online'
        });
      } catch (err) { /* ignore */ }
    });

    // ── Command output ─────────────────────────────────────
    socket.on('cmd:output', async (data) => {
      // data: { commandId, chunk, done, exitCode, durationMs }
      io.of('/client').emit('cmd:output', data);

      if (data.done && data.commandId) {
        try {
          await CommandLog.update(
            { output: data.output, exit_code: data.exitCode, duration_ms: data.durationMs, status: data.exitCode === 0 ? 'done' : 'error' },
            { where: { id: data.commandId } }
          );
        } catch (err) { /* ignore */ }
      }
    });

    // ── Tool result (forward to all browser clients) ───────
    socket.on('tool:result', (data) => {
      io.of('/client').emit('tool:result', data);
    });
    // ── Remote View frame (forward to all browser clients) ───
    socket.on('rdview:frame', (data) => {
      if (!device) return;
      io.of('/client').emit('rdview:frame', { ...data, deviceId: device.id });
    });
    // ── Disconnect ─────────────────────────────────────────
    socket.on('disconnect', async () => {
      if (!device) return;
      logger.info('Agent disconnected', { hostname: device.hostname });
      try {
        await device.update({ status: 'offline', socket_id: null });
        await SystemLog.create({ level: 'warn', source: 'agent', message: `${device.hostname} went offline`, device_id: device.id });
        io.of('/client').emit('device:offline', { deviceId: device.id });
      } catch (err) { /* ignore */ }
    });
  });

  // ── Client namespace ───────────────────────────────────────
  const clientNS = io.of('/client');

  clientNS.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  clientNS.on('connection', (socket) => {
    logger.info('Client connected', { user: socket.user?.email });

    // Browser sends command → forward to agent
    socket.on('cmd:run', async (data) => {
      // data: { deviceId, type, command, runAs }
      const { deviceId, type, command, runAs } = data;
      try {
        const device = await Device.findByPk(deviceId);
        if (!device || device.status !== 'online') {
          return socket.emit('cmd:error', { error: 'Device offline or not found' });
        }

        // Persist log entry
        const log = await CommandLog.create({
          device_id: deviceId,
          user_id:   socket.user.id,
          type,
          command,
          run_as:    runAs || 'current',
          status:    'running'
        });

        // Forward to agent socket
        const agentSocket = agentNS.sockets.get(device.socket_id);
        if (!agentSocket) {
          return socket.emit('cmd:error', { error: 'Agent not connected' });
        }
        agentSocket.emit('cmd:run', { commandId: log.id, type, command, runAs });
      } catch (err) {
        socket.emit('cmd:error', { error: err.message });
      }
    });

    // Browser requests a remote tool → forward to agent
    socket.on('tool:request', async ({ deviceId, requestId, tool, params }) => {
      try {
        const device = await Device.findByPk(deviceId);
        if (!device || device.status !== 'online') {
          return socket.emit('tool:result', { requestId, tool, error: 'Device offline or not found' });
        }
        const agentSocket = agentNS.sockets.get(device.socket_id);
        if (!agentSocket) {
          return socket.emit('tool:result', { requestId, tool, error: 'Agent not connected' });
        }
        agentSocket.emit('tool:request', { requestId, tool, params: params || {} });
      } catch (err) {
        socket.emit('tool:result', { requestId, tool, error: err.message });
      }
    });

    // Browser controls remote view streaming
    socket.on('rdview:start', async ({ deviceId, quality, fps }) => {
      try {
        const device = await Device.findByPk(deviceId);
        if (!device || device.status !== 'online') return;
        const agentSocket = agentNS.sockets.get(device.socket_id);
        if (!agentSocket) return;
        agentSocket.emit('rdview:start', { quality: quality || 50, fps: fps || 2 });
      } catch (err) { /* ignore */ }
    });

    socket.on('rdview:stop', async ({ deviceId }) => {
      try {
        const device = await Device.findByPk(deviceId);
        if (!device) return;
        const agentSocket = agentNS.sockets.get(device.socket_id);
        if (!agentSocket) return;
        agentSocket.emit('rdview:stop', {});
      } catch (err) { /* ignore */ }
    });

    socket.on('rdview:input', async ({ deviceId, type, x, y, button, key }) => {
      try {
        const device = await Device.findByPk(deviceId);
        if (!device || device.status !== 'online') return;
        const agentSocket = agentNS.sockets.get(device.socket_id);
        if (!agentSocket) return;
        agentSocket.emit('rdview:input', { type, x, y, button, key });
      } catch (err) { /* ignore */ }
    });

    socket.on('disconnect', () => logger.info('Client disconnected', { user: socket.user?.email }));
  });

  logger.info('WebSocket namespaces /agent and /client ready');
};
