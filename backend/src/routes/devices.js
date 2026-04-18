'use strict';
const router = require('express').Router();
const { Op }  = require('sequelize');
const { Device } = require('../models');
const { requireAuth } = require('../middleware/auth');

// GET /api/devices
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, status, os_type } = req.query;
    const where = {};
    if (status)  where.status  = status;
    if (os_type) where.os_type = os_type;
    if (search)  where.hostname = { [Op.iLike]: `%${search}%` };

    const devices = await Device.findAll({
      where,
      attributes: { exclude: ['agent_secret_hash'] },
      order: [['status', 'ASC'], ['hostname', 'ASC']]
    });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/devices/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id, {
      attributes: { exclude: ['agent_secret_hash'] }
    });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/devices/:id  (admin only)
const { requireAdmin } = require('../middleware/auth');
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    await device.destroy();
    res.json({ message: 'Device removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/devices/:id/tags
router.patch('/:id/tags', requireAuth, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    await device.update({ tags: req.body.tags || [] });
    res.json({ tags: device.tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
