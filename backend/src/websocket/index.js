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
      try {
        await device.update({
          last_heartbeat: new Date(),
          cpu_usage:     data.cpu ?? null,
          memory_usage:  data.memory ?? null,
          disk_usage:    data.disk ?? null,
          active_users:  data.users ?? [],
          status:        'online'
        });
        io.of('/client').emit('device:heartbeat', {
          deviceId:     device.id,
          cpu_usage:    data.cpu,
          memory_usage: data.memory,
          disk_usage:   data.disk,
          active_users: data.users,
          last_heartbeat: new Date()
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

    socket.on('disconnect', () => logger.info('Client disconnected', { user: socket.user?.email }));
  });

  logger.info('WebSocket namespaces /agent and /client ready');
};
/**
 * WebSocket Handler
 * Manages real-time connections for agents, dashboard, and chat.
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Track connected clients
const connectedAgents = new Map();  // deviceId -> socket
const connectedUsers = new Map();   // userId -> socket

function initializeWebSocket(io) {
  // Authentication middleware for WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const agentSecret = socket.handshake.auth?.agentSecret;

    // Agent connection
    if (agentSecret) {
      if (agentSecret === process.env.AGENT_SECRET) {
        socket.isAgent = true;
        socket.deviceId = socket.handshake.auth.deviceId;
        return next();
      }
      return next(new Error('Invalid agent credentials'));
    }

    // User connection
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        return next();
      } catch (err) {
        return next(new Error('Authentication failed'));
      }
    }

    next(new Error('No credentials provided'));
  });

  io.on('connection', (socket) => {
    // ─── Agent Connection ──────────────────────────────
    if (socket.isAgent) {
      const deviceId = socket.deviceId;
      connectedAgents.set(deviceId, socket);
      logger.info(`🔌 Agent connected: ${deviceId}`);

      // Broadcast device online
      io.emit('device:status', { deviceId, status: 'online' });

      socket.on('heartbeat', (data) => {
        io.emit('device:heartbeat', { deviceId, ...data });
      });

      socket.on('telemetry', (data) => {
        io.emit('device:telemetry', { deviceId, ...data });
      });

      socket.on('script:result', (data) => {
        io.emit('script:result', { deviceId, ...data });
      });

      socket.on('alert', (data) => {
        io.emit('device:alert', { deviceId, ...data });
      });

      socket.on('disconnect', () => {
        connectedAgents.delete(deviceId);
        io.emit('device:status', { deviceId, status: 'offline' });
        logger.info(`🔌 Agent disconnected: ${deviceId}`);
      });
    }

    // ─── User Connection ───────────────────────────────
    if (socket.userId) {
      connectedUsers.set(socket.userId, socket);
      logger.info(`👤 User connected: ${socket.userId}`);

      // Join user-specific room
      socket.join(`user:${socket.userId}`);

      socket.on('script:execute', (data) => {
        const agentSocket = connectedAgents.get(data.deviceId);
        if (agentSocket) {
          agentSocket.emit('script:execute', {
            scriptId: data.scriptId,
            content: data.content,
            type: data.type,
            requestedBy: socket.userId
          });
        } else {
          socket.emit('error', { message: `Device ${data.deviceId} not connected` });
        }
      });

      socket.on('disconnect', () => {
        connectedUsers.delete(socket.userId);
        logger.info(`👤 User disconnected: ${socket.userId}`);
      });
    }
  });

  logger.info('📡 WebSocket server initialized');
}

function getConnectedAgents() {
  return Array.from(connectedAgents.keys());
}

function getAgentSocket(deviceId) {
  return connectedAgents.get(deviceId);
}

module.exports = { initializeWebSocket, getConnectedAgents, getAgentSocket };
