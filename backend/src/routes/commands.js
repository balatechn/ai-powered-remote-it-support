'use strict';
const router = require('express').Router();
const { CommandLog, Device } = require('../models');
const { requireAuth } = require('../middleware/auth');

// GET /api/commands?deviceId=&limit=
router.get('/', requireAuth, async (req, res) => {
  try {
    const { deviceId, limit = 50 } = req.query;
    const where = {};
    if (deviceId) where.device_id = deviceId;

    const logs = await CommandLog.findAll({
      where,
      include: [{ model: Device, as: 'device', attributes: ['hostname', 'os_type'] }],
      order: [['createdAt', 'DESC']],
      limit: Math.min(parseInt(limit), 500)
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/commands  — REST fallback (WebSocket is preferred)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { deviceId, type, command, runAs } = req.body;
    if (!deviceId || !type || !command)
      return res.status(400).json({ error: 'deviceId, type, and command are required' });

    const device = await Device.findByPk(deviceId);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    if (device.status !== 'online') return res.status(503).json({ error: 'Device is offline' });

    const log = await CommandLog.create({
      device_id: deviceId,
      user_id:   req.user.id,
      type,
      command,
      run_as:    runAs || 'current',
      status:    'running'
    });

    // Forward via WebSocket
    const io = req.app.get('io');
    const agentSocket = io.of('/agent').sockets.get(device.socket_id);
    if (!agentSocket) {
      await log.update({ status: 'error', output: 'Agent socket not found' });
      return res.status(503).json({ error: 'Agent not connected via socket' });
    }

    agentSocket.emit('cmd:run', { commandId: log.id, type, command, runAs });
    res.status(202).json({ commandId: log.id, message: 'Command dispatched' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
