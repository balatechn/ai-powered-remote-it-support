/**
 * WebSocket Handler
 * Manages real-time connections for agents, dashboard, and chat.
 */

const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');

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
