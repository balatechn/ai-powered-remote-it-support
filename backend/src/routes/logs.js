'use strict';
const router = require('express').Router();
const { SystemLog } = require('../models');
const { requireAuth } = require('../middleware/auth');

// GET /api/logs?level=&source=&deviceId=&limit=
router.get('/', requireAuth, async (req, res) => {
  try {
    const { level, source, deviceId, limit = 100 } = req.query;
    const where = {};
    if (level)    where.level     = level;
    if (source)   where.source    = source;
    if (deviceId) where.device_id = deviceId;

    const logs = await SystemLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Math.min(parseInt(limit), 1000)
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
