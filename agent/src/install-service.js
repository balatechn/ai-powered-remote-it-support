'use strict';
/**
 * NexusIT Agent — Windows Service Installer
 * ──────────────────────────────────────────
 * Run as Administrator:
 *   node src/install-service.js
 *
 * Optional env overrides via command line:
 *   node src/install-service.js --server=http://host:3080 --secret=abc123
 *
 * The service runs as SYSTEM, starts automatically on boot.
 * Logs: C:\ProgramData\NexusIT Agent\daemon\nexusit-agent.err.log
 *       C:\ProgramData\NexusIT Agent\daemon\nexusit-agent.out.log
 */

const { Service } = require('node-windows');
const path        = require('path');
const fs          = require('fs');

// ── Parse CLI args ────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=')]; })
);

// ── Write .env if args provided ───────────────────────────────
const envPath = path.resolve(__dirname, '../.env');
if (args.server || args.secret) {
  const existing = fs.existsSync(envPath)
    ? Object.fromEntries(
        fs.readFileSync(envPath, 'utf8').split('\n')
          .filter(l => l.includes('='))
          .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
      )
    : {};
  if (args.server) existing['SERVER_URL'] = args.server;
  if (args.secret) existing['AGENT_SECRET'] = args.secret;
  existing['HEARTBEAT_INTERVAL'] = existing['HEARTBEAT_INTERVAL'] || '10000';
  fs.writeFileSync(envPath,
    Object.entries(existing).map(([k, v]) => `${k}=${v}`).join('\n') + '\n',
    'utf8'
  );
  console.log(`[install-service] Config written to ${envPath}`);
}

// ── Define service ────────────────────────────────────────────
const svc = new Service({
  name:        'NexusIT Agent',
  description: 'NexusIT Remote IT Support — Endpoint Agent',
  script:      path.resolve(__dirname, 'agent.js'),
  nodeOptions: [],
  workingDirectory: path.resolve(__dirname, '..'),
  env: [
    { name: 'NODE_ENV', value: 'production' }
  ]
});

svc.on('install', () => {
  console.log('[install-service] Service installed successfully.');
  svc.start();
  console.log('[install-service] Service started. It will now auto-start on every boot.');
  console.log('[install-service] To uninstall: node src/uninstall-service.js');
});

svc.on('alreadyinstalled', () => {
  console.log('[install-service] Service already installed. Restarting with latest config...');
  svc.stop();
  setTimeout(() => svc.start(), 2000);
});

svc.on('start', () => console.log('[install-service] Service running.'));
svc.on('error', err => console.error('[install-service] Error:', err));

console.log('[install-service] Installing NexusIT Agent as Windows Service...');
svc.install();
