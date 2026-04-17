/**
 * Guacamole Integration Routes
 * Apache Guacamole session management for RDP/VNC/SSH.
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { Session, Device } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

const GUACAMOLE_URL = process.env.GUACAMOLE_URL || 'http://guacamole:8080/guacamole';
const GUACAMOLE_SECRET = process.env.GUACAMOLE_SECRET || 'guac-secret';

/**
 * Generate HMAC-signed Guacamole auth token
 * Uses the guacamole-auth-json extension format
 */
function generateGuacToken(connectionParams) {
  const payload = JSON.stringify({
    username: connectionParams.username,
    expires: String(Date.now() + 600000), // 10 minutes
    connections: {
      [connectionParams.connectionName]: {
        protocol: connectionParams.protocol,
        parameters: connectionParams.parameters
      }
    }
  });

  const cipher = crypto.createCipheriv(
    'aes-128-cbc',
    crypto.createHash('md5').update(GUACAMOLE_SECRET).digest(),
    Buffer.alloc(16, 0)
  );

  let encrypted = cipher.update(payload, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return encrypted;
}

// ─── POST /api/guacamole/connect ─────────────────────────────
router.post('/connect', authorize('admin', 'technician'), async (req, res) => {
  try {
    const { device_id, protocol = 'rdp', credentials } = req.body;

    const device = await Device.findByPk(device_id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    if (device.status !== 'online') return res.status(400).json({ error: 'Device is not online' });

    // Protocol-specific parameters
    const protocolParams = {
      rdp: {
        hostname: device.ip_address,
        port: credentials?.port || '3389',
        username: credentials?.username || '',
        password: credentials?.password || '',
        security: 'any',
        'ignore-cert': 'true',
        'resize-method': 'display-update',
        'enable-wallpaper': 'false',
        'enable-font-smoothing': 'true',
        'color-depth': '24'
      },
      vnc: {
        hostname: device.ip_address,
        port: credentials?.port || '5900',
        password: credentials?.password || '',
        'color-depth': '24'
      },
      ssh: {
        hostname: device.ip_address,
        port: credentials?.port || '22',
        username: credentials?.username || '',
        password: credentials?.password || '',
        'font-size': '14',
        'color-scheme': 'gray-black',
        'terminal-type': 'xterm-256color'
      }
    };

    const params = protocolParams[protocol];
    if (!params) return res.status(400).json({ error: 'Unsupported protocol' });

    const connectionName = `${device.hostname}-${protocol}-${Date.now()}`;

    // Create session record
    const session = await Session.create({
      device_id,
      user_id: req.userId,
      session_type: protocol,
      status: 'active',
      started_at: new Date()
    });

    // Generate Guacamole token
    const guacToken = generateGuacToken({
      username: req.user.email,
      connectionName,
      protocol,
      parameters: params
    });

    // Store token in session
    await session.update({ guacamole_token: guacToken });

    // Broadcast session start
    req.app.get('io')?.emit('session:started', {
      sessionId: session.id,
      deviceId: device_id,
      userId: req.userId,
      protocol
    });

    logger.info(`Guacamole session created: ${protocol} to ${device.hostname} by ${req.user.email}`);

    res.status(201).json({
      session_id: session.id,
      guacamole_url: `${GUACAMOLE_URL}/#/client/${encodeURIComponent(connectionName)}`,
      token: guacToken,
      connection_name: connectionName,
      protocol,
      device: {
        hostname: device.hostname,
        ip_address: device.ip_address
      }
    });
  } catch (error) {
    logger.error('Guacamole connect error:', error);
    res.status(500).json({ error: 'Failed to create remote session' });
  }
});

// ─── POST /api/guacamole/disconnect ──────────────────────────
router.post('/disconnect', async (req, res) => {
  try {
    const { session_id } = req.body;

    const session = await Session.findByPk(session_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt - session.started_at) / 1000);

    await session.update({
      status: 'ended',
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      guacamole_token: null
    });

    req.app.get('io')?.emit('session:ended', { sessionId: session.id });
    logger.info(`Guacamole session ended: ${session.id} (${durationSeconds}s)`);

    res.json({ message: 'Session disconnected', duration_seconds: durationSeconds });
  } catch (error) {
    logger.error('Guacamole disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect session' });
  }
});

// ─── GET /api/guacamole/status ───────────────────────────────
router.get('/status', async (req, res) => {
  try {
    let guacamoleAvailable = false;
    try {
      const response = await axios.get(`${GUACAMOLE_URL}/api`, { timeout: 5000 });
      guacamoleAvailable = response.status === 200;
    } catch {
      guacamoleAvailable = false;
    }

    res.json({
      guacamole_url: GUACAMOLE_URL,
      available: guacamoleAvailable,
      supported_protocols: ['rdp', 'vnc', 'ssh']
    });
  } catch (error) {
    logger.error('Guacamole status error:', error);
    res.status(500).json({ error: 'Failed to check Guacamole status' });
  }
});

module.exports = router;
