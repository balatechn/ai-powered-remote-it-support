/**
 * Session Management Routes
 * Remote session CRUD and lifecycle management.
 */

const express = require('express');
const { Session, Device, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

// ΓöÇΓöÇΓöÇ GET /api/sessions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/', async (req, res) => {
  try {
    const { status, session_type, page = 1, limit = 20 } = req.query;
    const where = {};

    if (status) where.status = status;
    if (session_type) where.session_type = session_type;

    // Non-admin users only see their own sessions
    if (req.user.role !== 'admin') {
      where.user_id = req.userId;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: sessions } = await Session.findAndCountAll({
      where,
      include: [
        { association: 'device', attributes: ['id', 'hostname', 'ip_address', 'os_type'] },
        { association: 'user', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      sessions,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ΓöÇΓöÇΓöÇ POST /api/sessions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/', authorize('admin', 'technician'), async (req, res) => {
  try {
    const { device_id, session_type = 'rdp', notes } = req.body;

    // Verify device exists and is online
    const device = await Device.findByPk(device_id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const session = await Session.create({
      device_id,
      user_id: req.userId,
      session_type,
      notes,
      status: 'active',
      started_at: new Date()
    });

    // Broadcast session start
    req.app.get('io')?.emit('session:started', {
      sessionId: session.id,
      deviceId: device_id,
      userId: req.userId
    });

    logger.info(`Session started: ${session.id} on ${device.hostname} by ${req.user.email}`);

    res.status(201).json({ session });
  } catch (error) {
    logger.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// ΓöÇΓöÇΓöÇ PUT /api/sessions/:id/end ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.put('/:id/end', async (req, res) => {
  try {
    const session = await Session.findByPk(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt - session.started_at) / 1000);

    await session.update({
      status: 'ended',
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      notes: req.body.notes || session.notes
    });

    req.app.get('io')?.emit('session:ended', { sessionId: session.id });

    logger.info(`Session ended: ${session.id} (${durationSeconds}s)`);
    res.json({ session });
  } catch (error) {
    logger.error('End session error:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// ΓöÇΓöÇΓöÇ GET /api/sessions/active ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/active', async (req, res) => {
  try {
    const sessions = await Session.findAll({
      where: { status: 'active' },
      include: [
        { association: 'device', attributes: ['hostname', 'ip_address'] },
        { association: 'user', attributes: ['first_name', 'last_name'] }
      ],
      order: [['started_at', 'DESC']]
    });

    res.json({ sessions, count: sessions.length });
  } catch (error) {
    logger.error('Active sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

module.exports = router;
