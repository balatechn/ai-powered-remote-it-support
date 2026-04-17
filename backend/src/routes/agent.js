/**
 * Agent Routes
 * Handles agent registration, heartbeat, and telemetry from endpoint agents.
 */

const express = require('express');
const { Device, Log } = require('../models');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Agent authentication middleware
 * Agents use a shared secret for registration and heartbeats.
 */
const agentAuth = (req, res, next) => {
  const secret = req.headers['x-agent-secret'];
  if (secret !== process.env.AGENT_SECRET && secret !== 'dev-agent-secret') {
    return res.status(401).json({ error: 'Invalid agent credentials' });
  }
  next();
};

router.use(agentAuth);

// ─── POST /api/agent/register ────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { hostname, ip_address, mac_address, os_type, os_version, agent_version } = req.body;

    // Check if device already exists (by MAC address)
    let device = await Device.findOne({ where: { mac_address } });

    if (device) {
      // Update existing device
      await device.update({
        hostname,
        ip_address,
        os_version,
        agent_version,
        status: 'online',
        last_heartbeat: new Date()
      });
    } else {
      // Register new device
      device = await Device.create({
        hostname,
        ip_address,
        mac_address,
        os_type,
        os_version,
        agent_version,
        status: 'online',
        last_heartbeat: new Date()
      });

      await Log.create({
        level: 'info',
        source: 'agent',
        message: `New device registered: ${hostname} (${ip_address})`,
        device_id: device.id
      });
    }

    logger.info(`Agent registered: ${hostname} (${ip_address})`);
    res.json({ device_id: device.id, message: 'Registration successful' });
  } catch (error) {
    logger.error('Agent registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /api/agent/heartbeat ───────────────────────────────
router.post('/heartbeat', async (req, res) => {
  try {
    const { device_id, cpu_usage, memory_usage, disk_usage, metadata } = req.body;

    const device = await Device.findByPk(device_id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await device.update({
      status: 'online',
      cpu_usage,
      memory_usage,
      disk_usage,
      last_heartbeat: new Date(),
      metadata: { ...device.metadata, ...metadata }
    });

    // Check for critical thresholds and create alerts
    if (cpu_usage > 90 || memory_usage > 90 || disk_usage > 95) {
      const alertMsg = [];
      if (cpu_usage > 90) alertMsg.push(`CPU: ${cpu_usage}%`);
      if (memory_usage > 90) alertMsg.push(`Memory: ${memory_usage}%`);
      if (disk_usage > 95) alertMsg.push(`Disk: ${disk_usage}%`);

      await Log.create({
        level: 'warn',
        source: 'agent',
        message: `Resource alert on ${device.hostname}: ${alertMsg.join(', ')}`,
        details: { cpu_usage, memory_usage, disk_usage },
        device_id
      });
    }

    res.json({ status: 'ok', next_heartbeat: parseInt(process.env.HEARTBEAT_INTERVAL || '30000') });
  } catch (error) {
    logger.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// ─── POST /api/agent/telemetry ───────────────────────────────
router.post('/telemetry', async (req, res) => {
  try {
    const { device_id, data } = req.body;

    await Log.create({
      level: 'info',
      source: 'agent',
      message: `Telemetry data from device`,
      details: data,
      device_id
    });

    res.json({ status: 'received' });
  } catch (error) {
    logger.error('Telemetry error:', error);
    res.status(500).json({ error: 'Telemetry failed' });
  }
});

// ─── POST /api/agent/script-result ───────────────────────────
router.post('/script-result', async (req, res) => {
  try {
    const { device_id, script_id, output, exit_code, error: scriptError } = req.body;

    await Log.create({
      level: exit_code === 0 ? 'info' : 'error',
      source: 'agent',
      message: `Script ${script_id} completed with exit code ${exit_code}`,
      details: { output, exit_code, error: scriptError },
      device_id
    });

    res.json({ status: 'received' });
  } catch (error) {
    logger.error('Script result error:', error);
    res.status(500).json({ error: 'Script result failed' });
  }
});

module.exports = router;
