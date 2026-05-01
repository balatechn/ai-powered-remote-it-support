/**
 * Device Management Routes
 * CRUD operations for managed devices.
 */

const express = require('express');
const { Device, Session, Log } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ΓöÇΓöÇΓöÇ GET /api/devices ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/', async (req, res) => {
  try {
    const { status, os_type, search, page = 1, limit = 20 } = req.query;
    const where = {};

    if (status) where.status = status;
    if (os_type) where.os_type = os_type;
    if (search) {
      where[Op.or] = [
        { hostname: { [Op.iLike]: `%${search}%` } },
        { ip_address: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: devices } = await Device.findAndCountAll({
      where,
      order: [['last_heartbeat', 'DESC NULLS LAST']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      devices,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get devices error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// ΓöÇΓöÇΓöÇ GET /api/devices/:id ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/:id', async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id, {
      include: [
        { association: 'sessions', limit: 5, order: [['created_at', 'DESC']] },
        { association: 'logs', limit: 10, order: [['created_at', 'DESC']] }
      ]
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ device });
  } catch (error) {
    logger.error('Get device error:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// ΓöÇΓöÇΓöÇ POST /api/devices ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.post('/', authorize('admin', 'technician'), async (req, res) => {
  try {
    const device = await Device.create({
      ...req.body,
      registered_by: req.userId
    });

    // Emit real-time update
    req.app.get('io')?.emit('device:added', device);

    logger.info(`Device created: ${device.hostname} by ${req.user.email}`);
    res.status(201).json({ device });
  } catch (error) {
    logger.error('Create device error:', error);
    res.status(500).json({ error: 'Failed to create device' });
  }
});

// ΓöÇΓöÇΓöÇ PUT /api/devices/:id ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.put('/:id', authorize('admin', 'technician'), async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await device.update(req.body);
    req.app.get('io')?.emit('device:updated', device);

    res.json({ device });
  } catch (error) {
    logger.error('Update device error:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// ΓöÇΓöÇΓöÇ DELETE /api/devices/:id ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await device.destroy();
    req.app.get('io')?.emit('device:removed', { id: req.params.id });

    logger.info(`Device deleted: ${device.hostname} by ${req.user.email}`);
    res.json({ message: 'Device deleted' });
  } catch (error) {
    logger.error('Delete device error:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// ΓöÇΓöÇΓöÇ GET /api/devices/:id/stats ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
router.get('/:id/stats', async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const sessionCount = await Session.count({ where: { device_id: req.params.id } });
    const errorCount = await Log.count({
      where: { device_id: req.params.id, level: 'error' }
    });

    res.json({
      device_id: req.params.id,
      sessions: sessionCount,
      errors: errorCount,
      uptime_status: device.status,
      cpu: device.cpu_usage,
      memory: device.memory_usage,
      disk: device.disk_usage
    });
  } catch (error) {
    logger.error('Device stats error:', error);
    res.status(500).json({ error: 'Failed to fetch device stats' });
  }
});

module.exports = router;
