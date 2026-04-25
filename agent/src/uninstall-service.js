'use strict';
/**
 * NexusIT Agent — Windows Service Uninstaller
 * ────────────────────────────────────────────
 * Run as Administrator:
 *   node src/uninstall-service.js
 */

const { Service } = require('node-windows');
const path        = require('path');

const svc = new Service({
  name:   'NexusIT Agent',
  script: path.resolve(__dirname, 'agent.js')
});

svc.on('uninstall', () => {
  console.log('[uninstall-service] Service removed successfully.');
});

svc.on('notinstalled', () => {
  console.log('[uninstall-service] Service is not installed.');
});

console.log('[uninstall-service] Removing NexusIT Agent Windows Service...');
svc.uninstall();
