'use strict';
/**
 * Agent registration endpoint — agents call this on startup
 * to verify the server is reachable and get their device ID.
 * The actual real-time communication is via WebSocket /agent namespace.
 */
const router = require('express').Router();
const { Device } = require('../models');

const AGENT_SECRET = process.env.AGENT_SECRET || 'change_this_agent_secret';

// POST /api/agent/register
router.post('/register', async (req, res) => {
  const secret = req.headers['x-agent-secret'];
  if (secret !== AGENT_SECRET)
    return res.status(401).json({ error: 'Invalid agent secret' });

  try {
    const { hostname, platform, osVersion, localIp, agentVersion } = req.body;
    if (!hostname) return res.status(400).json({ error: 'hostname required' });

    const osMap = { win32: 'windows', darwin: 'macos', linux: 'linux' };
    const [device] = await Device.findOrCreate({
      where: { hostname },
      defaults: {
        hostname,
        ip_address:    localIp || null,
        public_ip:     req.ip,
        os_type:       osMap[platform] || 'windows',
        os_version:    osVersion || null,
        agent_version: agentVersion || '1.0.0',
        status:        'offline'
      }
    });

    res.json({ deviceId: device.id, hostname: device.hostname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/ping — agent health check
router.get('/ping', (req, res) => {
  const secret = req.headers['x-agent-secret'];
  if (secret !== AGENT_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ pong: true, time: new Date().toISOString() });
});

module.exports = router;
