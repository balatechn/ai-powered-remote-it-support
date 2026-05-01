/**
 * Dashboard Routes
 * Aggregated statistics and KPI data for the dashboard.
 */

const express = require('express');
const { User, Device, Session, Log, AIInteraction, sequelize } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

// ΓöÇΓöÇΓöÇ GET /api/dashboard/stats ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      totalDevices,
      onlineDevices,
      totalUsers,
      activeSessions,
      totalSessions,
      todayLogs,
      criticalLogs,
      aiInteractions,
      resolvedInteractions
    ] = await Promise.all([
      Device.count(),
      Device.count({ where: { status: 'online' } }),
      User.count({ where: { is_active: true } }),
      Session.count({ where: { status: 'active' } }),
      Session.count(),
      Log.count({ where: { created_at: { [Op.gte]: today } } }),
      Log.count({ where: { level: { [Op.in]: ['error', 'critical'] }, created_at: { [Op.gte]: weekAgo } } }),
      AIInteraction.count({ where: { created_at: { [Op.gte]: weekAgo } } }),
      AIInteraction.count({ where: { resolution_status: 'resolved', created_at: { [Op.gte]: weekAgo } } })
    ]);

    res.json({
      devices: { total: totalDevices, online: onlineDevices, offline: totalDevices - onlineDevices },
      users: { total: totalUsers },
      sessions: { active: activeSessions, total: totalSessions },
      logs: { today: todayLogs, critical_week: criticalLogs },
      ai: {
        interactions_week: aiInteractions,
        resolved: resolvedInteractions,
        success_rate: aiInteractions > 0 ? Math.round((resolvedInteractions / aiInteractions) * 100) : 0
      }
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ΓöÇΓöÇΓöÇ GET /api/dashboard/activity ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/activity', async (req, res) => {
  try {
    const recentSessions = await Session.findAll({
      include: [
        { association: 'device', attributes: ['hostname'] },
        { association: 'user', attributes: ['first_name', 'last_name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    const recentLogs = await Log.findAll({
      include: [
        { association: 'device', attributes: ['hostname'] }
      ],
      order: [['created_at', 'DESC']],
      limit: 20
    });

    res.json({ recentSessions, recentLogs });
  } catch (error) {
    logger.error('Dashboard activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ΓöÇΓöÇΓöÇ GET /api/dashboard/device-health ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/device-health', async (req, res) => {
  try {
    const devices = await Device.findAll({
      where: { status: 'online' },
      attributes: ['id', 'hostname', 'cpu_usage', 'memory_usage', 'disk_usage', 'last_heartbeat'],
      order: [['cpu_usage', 'DESC']],
      limit: 20
    });

    res.json({ devices });
  } catch (error) {
    logger.error('Device health error:', error);
    res.status(500).json({ error: 'Failed to fetch device health' });
  }
});

module.exports = router;
