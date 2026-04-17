/**
 * Script Management Routes
 * CRUD for automation scripts and remote execution.
 */

const express = require('express');
const { Script, Log } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { getAgentSocket } = require('../websocket');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);

// ─── GET /api/scripts ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, script_type } = req.query;
    const where = {};
    if (category) where.category = category;
    if (script_type) where.script_type = script_type;

    const scripts = await Script.findAll({
      where,
      include: [{ association: 'creator', attributes: ['first_name', 'last_name'] }],
      order: [['created_at', 'DESC']]
    });

    res.json({ scripts });
  } catch (error) {
    logger.error('Get scripts error:', error);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

// ─── POST /api/scripts ───────────────────────────────────────
router.post('/', authorize('admin', 'technician'), async (req, res) => {
  try {
    const script = await Script.create({
      ...req.body,
      created_by: req.userId
    });

    logger.info(`Script created: ${script.name} by ${req.user.email}`);
    res.status(201).json({ script });
  } catch (error) {
    logger.error('Create script error:', error);
    res.status(500).json({ error: 'Failed to create script' });
  }
});

// ─── PUT /api/scripts/:id ────────────────────────────────────
router.put('/:id', authorize('admin', 'technician'), async (req, res) => {
  try {
    const script = await Script.findByPk(req.params.id);
    if (!script) return res.status(404).json({ error: 'Script not found' });

    await script.update(req.body);
    res.json({ script });
  } catch (error) {
    logger.error('Update script error:', error);
    res.status(500).json({ error: 'Failed to update script' });
  }
});

// ─── DELETE /api/scripts/:id ─────────────────────────────────
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const script = await Script.findByPk(req.params.id);
    if (!script) return res.status(404).json({ error: 'Script not found' });

    await script.destroy();
    res.json({ message: 'Script deleted' });
  } catch (error) {
    logger.error('Delete script error:', error);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

// ─── POST /api/scripts/:id/execute ───────────────────────────
router.post('/:id/execute', authorize('admin', 'technician'), async (req, res) => {
  try {
    const { device_id } = req.body;
    const script = await Script.findByPk(req.params.id);
    
    if (!script) return res.status(404).json({ error: 'Script not found' });

    // Safety check: destructive scripts require admin approval
    if (script.requires_approval && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Script requires admin approval' });
    }

    // Find connected agent
    const agentSocket = getAgentSocket(device_id);
    if (!agentSocket) {
      return res.status(400).json({ error: 'Device agent not connected' });
    }

    // Send script to agent via WebSocket
    agentSocket.emit('script:execute', {
      scriptId: script.id,
      content: script.content,
      type: script.script_type,
      requestedBy: req.userId
    });

    // Update execution count
    await script.update({ execution_count: script.execution_count + 1 });

    // Log execution
    await Log.create({
      level: 'info',
      source: 'user',
      message: `Script "${script.name}" executed on device ${device_id}`,
      details: { scriptId: script.id, deviceId: device_id },
      user_id: req.userId,
      device_id
    });

    logger.info(`Script executed: ${script.name} on ${device_id} by ${req.user.email}`);
    res.json({ message: 'Script sent for execution', scriptId: script.id });
  } catch (error) {
    logger.error('Execute script error:', error);
    res.status(500).json({ error: 'Failed to execute script' });
  }
});

module.exports = router;
