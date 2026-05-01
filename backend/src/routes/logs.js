/**
 * Log Routes
 * System and device log management.
 */

const express = require('express');
const { Log } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

// ΓöÇΓöÇΓöÇ GET /api/logs ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/', async (req, res) => {
  try {
    const { level, source, device_id, search, page = 1, limit = 50 } = req.query;
    const where = {};

    if (level) where.level = level;
    if (source) where.source = source;
    if (device_id) where.device_id = device_id;
    if (search) where.message = { [Op.iLike]: `%${search}%` };

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: logs } = await Log.findAndCountAll({
      where,
      include: [
        { association: 'device', attributes: ['hostname'] },
        { association: 'user', attributes: ['first_name', 'last_name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      logs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ΓöÇΓöÇΓöÇ POST /api/logs ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/', async (req, res) => {
  try {
    const log = await Log.create({
      ...req.body,
      user_id: req.userId
    });

    // Emit real-time log for dashboard
    req.app.get('io')?.emit('log:new', log);

    res.status(201).json({ log });
  } catch (error) {
    logger.error('Create log error:', error);
    res.status(500).json({ error: 'Failed to create log' });
  }
});

// ΓöÇΓöÇΓöÇ GET /api/logs/stats ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/stats', async (req, res) => {
  try {
    const { sequelize } = require('../models');

    const stats = await Log.findAll({
      attributes: [
        'level',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['level']
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await Log.count({
      where: { created_at: { [Op.gte]: today } }
    });

    res.json({
      by_level: stats,
      today: todayCount,
      total: await Log.count()
    });
  } catch (error) {
    logger.error('Log stats error:', error);
    res.status(500).json({ error: 'Failed to fetch log stats' });
  }
});

module.exports = router;
