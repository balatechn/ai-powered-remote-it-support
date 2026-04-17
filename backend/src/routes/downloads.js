/**
 * Downloads Route
 * Serves agent installer files for endpoint devices.
 */

const express = require('express');
const router = express.Router();

// ── GET /downloads/install-windows.ps1 ───────────────────────
router.get('/install-windows.ps1', (req, res) => {
  const serverIP = req.headers.host?.split(':')[0] || '187.127.134.246';
  const serverURL = `http://${serverIP}:3080`;

  const script = `# ============================================================
# NexusIT Endpoint Agent - Windows Installer
# Run as Administrator in PowerShell:
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   iwr ${serverURL}/downloads/install-windows.ps1 | iex
# ============================================================

$SERVER_URL = "${serverURL}"
$INSTALL_DIR = "C:\\NexusIT-Agent"
$TASK_NAME = "NexusIT-Agent"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NexusIT Endpoint Agent Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Write-Host "ERROR: Run PowerShell as Administrator." -ForegroundColor Red; exit 1
}

# Install Node.js if missing
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[1/4] Installing Node.js..." -ForegroundColor Yellow
    $installer = "$env:TEMP\\node-installer.msi"
    Invoke-WebRequest "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile $installer
    Start-Process msiexec.exe -Wait -ArgumentList "/I \`"$installer\`" /quiet"
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine")
    Write-Host "  Node.js installed." -ForegroundColor Green
} else {
    Write-Host "[1/4] Node.js: \$(node --version)" -ForegroundColor Green
}

# Create directories
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
New-Item -ItemType Directory -Force -Path "$INSTALL_DIR\\src" | Out-Null
New-Item -ItemType Directory -Force -Path "$INSTALL_DIR\\logs" | Out-Null

# Download agent files
Write-Host "[2/4] Downloading agent files..." -ForegroundColor Yellow
Invoke-WebRequest "$SERVER_URL/downloads/agent.js"           -OutFile "$INSTALL_DIR\\src\\agent.js"
Invoke-WebRequest "$SERVER_URL/downloads/agent-package.json" -OutFile "$INSTALL_DIR\\package.json"
Write-Host "  Done." -ForegroundColor Green

# Configure
Write-Host "[3/4] Configuring..." -ForegroundColor Yellow
$secret = Read-Host "Enter AGENT_SECRET (from server .env)"
@"
SERVER_URL=$SERVER_URL
AGENT_SECRET=\$secret
HEARTBEAT_INTERVAL=30000
"@ | Set-Content "$INSTALL_DIR\\.env" -Encoding UTF8

Set-Location $INSTALL_DIR
npm install --prefix $INSTALL_DIR | Out-Null

# Register as scheduled task (runs at startup as SYSTEM)
Write-Host "[4/4] Registering startup task..." -ForegroundColor Yellow
@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "node C:\\NexusIT-Agent\\src\\agent.js", 0, False
"@ | Set-Content "$INSTALL_DIR\\launch.vbs" -Encoding UTF8

$action   = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "\`"$INSTALL_DIR\\launch.vbs\`""
$trigger  = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:\$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TASK_NAME -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
Start-ScheduledTask -TaskName $TASK_NAME

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Agent installed and running!" -ForegroundColor Green
Write-Host "  Device will appear in dashboard within 30s" -ForegroundColor Green
Write-Host "  Dashboard: $SERVER_URL" -ForegroundColor Green
Write-Host "  Logs: $INSTALL_DIR\\logs\\agent.log" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="install-windows.ps1"');
  res.send(script);
});

// ── GET /downloads/agent.js ───────────────────────────────────
router.get('/agent.js', (req, res) => {
  // Serve the agent source via the API - read from mounted volume path
  const fs = require('fs');
  const path = require('path');
  // In container: /app/src/ is backend src, agent is at /opt/nexusit/agent/src/agent.js
  const candidates = [
    '/opt/nexusit/agent/src/agent.js',
    path.resolve(__dirname, '../../../../agent/src/agent.js')
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      res.setHeader('Content-Type', 'text/plain');
      return res.sendFile(f);
    }
  }
  res.status(404).send('agent.js not found');
});

// ── GET /downloads/agent-package.json ────────────────────────
router.get('/agent-package.json', (req, res) => {
  res.json({
    name: 'nexusit-agent',
    version: '1.0.0',
    main: 'src/agent.js',
    scripts: { start: 'node src/agent.js' },
    dependencies: {
      axios: '^1.7.7',
      dotenv: '^16.4.5',
      'socket.io-client': '^4.8.0',
      systeminformation: '^5.23.5',
      uuid: '^10.0.0',
      winston: '^3.14.2'
    }
  });
});

// ── GET /downloads/ — index ───────────────────────────────────
router.get('/', (req, res) => {
  const host = req.headers.host || '187.127.134.246:3080';
  const serverURL = `http://${host}`;
  res.send(`<!DOCTYPE html>
<html>
<head><title>NexusIT Agent Downloads</title>
<style>
  body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:40px;max-width:720px;margin:auto}
  h1{color:#6366f1} h2{color:#94a3b8;margin-top:32px}
  a{color:#818cf8;text-decoration:none} a:hover{text-decoration:underline}
  pre{background:#1e293b;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.6}
  .note{background:#1e3a5f;border-left:3px solid #3b82f6;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:13px}
</style>
</head>
<body>
<h1>NexusIT Endpoint Agent</h1>
<p>Install on any machine to monitor and manage it from the <a href="${serverURL}">NexusIT dashboard</a>.</p>

<div class="note">
  You need the <strong>AGENT_SECRET</strong> from the server.<br>
  SSH into the server and run: <code>grep AGENT_SECRET /opt/nexusit/.env</code>
</div>

<h2>Windows — PowerShell (run as Administrator)</h2>
<pre>Set-ExecutionPolicy Bypass -Scope Process -Force; iwr ${serverURL}/downloads/install-windows.ps1 | iex</pre>

<h2>Direct Downloads</h2>
<ul>
  <li><a href="/downloads/install-windows.ps1">install-windows.ps1</a> — Windows auto-installer</li>
  <li><a href="/downloads/agent.js">agent.js</a> — Agent source</li>
  <li><a href="/downloads/agent-package.json">package.json</a> — Dependencies</li>
</ul>
</body></html>`);
});

module.exports = router;


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
