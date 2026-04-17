/**
 * Downloads Route
 * Serves agent installer files for endpoint devices.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const AGENT_DIR = path.resolve(__dirname, '../../../agent');

// ── GET /downloads/install-windows.ps1 ───────────────────────
router.get('/install-windows.ps1', (req, res) => {
  const file = path.join(AGENT_DIR, 'install-windows.ps1');
  if (!fs.existsSync(file)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="install-windows.ps1"');
  res.sendFile(file);
});

// ── GET /downloads/agent.js ───────────────────────────────────
router.get('/agent.js', (req, res) => {
  const file = path.join(AGENT_DIR, 'src', 'agent.js');
  if (!fs.existsSync(file)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(file);
});

// ── GET /downloads/agent-package.json ────────────────────────
router.get('/agent-package.json', (req, res) => {
  const file = path.join(AGENT_DIR, 'package.json');
  if (!fs.existsSync(file)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(file);
});

// ── GET /downloads/ — index page ─────────────────────────────
router.get('/', (req, res) => {
  const serverIP = req.hostname || '187.127.134.246';
  res.send(`<!DOCTYPE html>
<html>
<head><title>NexusIT Agent Downloads</title>
<style>body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:40px;max-width:700px;margin:auto}
h1{color:#6366f1}a{color:#818cf8}pre{background:#1e293b;padding:16px;border-radius:8px;overflow-x:auto}
.badge{background:#1e293b;padding:4px 10px;border-radius:4px;font-size:13px}</style>
</head>
<body>
<h1>NexusIT Endpoint Agent</h1>
<p>Install the agent on any machine you want to manage.</p>

<h2>Windows <span class="badge">PowerShell (Admin)</span></h2>
<pre>Set-ExecutionPolicy Bypass -Scope Process -Force; iwr http://${serverIP}:3080/downloads/install-windows.ps1 | iex</pre>

<h2>Linux <span class="badge">bash</span></h2>
<pre>curl -fsSL http://${serverIP}:3080/downloads/install-linux.sh | bash</pre>

<h2>Manual Download</h2>
<ul>
  <li><a href="/downloads/install-windows.ps1">install-windows.ps1</a></li>
  <li><a href="/downloads/agent.js">agent.js</a></li>
  <li><a href="/downloads/agent-package.json">package.json</a></li>
</ul>
<p style="color:#64748b;margin-top:40px">NexusIT Dashboard: <a href="http://${serverIP}:3080">http://${serverIP}:3080</a></p>
</body></html>`);
});

module.exports = router;
