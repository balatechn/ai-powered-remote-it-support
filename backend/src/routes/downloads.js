'use strict';
const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');

const AGENT_SECRET  = process.env.AGENT_SECRET || 'change_this_agent_secret';
const STATIC_DIR    = process.env.DOWNLOADS_DIR || '/opt/nexusit/downloads-static';

// ── GET /downloads/ — Index page ──────────────────────────
router.get('/', (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host  = req.headers.host || '187.127.134.246:3080';
  const base  = `${proto}://${host}`;
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>NexusIT Agent Download</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .wrap{max-width:640px;width:100%}
  .logo{display:flex;align-items:center;gap:10px;margin-bottom:32px}
  .logo-icon{width:40px;height:40px;background:#6366f1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px}
  .logo-text{font-size:1.4rem;font-weight:700;color:#fff}
  .logo-text span{color:#818cf8}
  h1{font-size:1.6rem;font-weight:700;color:#fff;margin-bottom:8px}
  .sub{color:#94a3b8;margin-bottom:28px;line-height:1.6}
  .step{display:flex;gap:14px;margin-bottom:20px;align-items:flex-start}
  .step-num{min-width:28px;height:28px;background:#6366f1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;margin-top:2px}
  .step-body h3{font-size:14px;font-weight:600;color:#e2e8f0;margin-bottom:6px}
  .step-body p{font-size:13px;color:#94a3b8;margin-bottom:8px;line-height:1.5}
  .cmd-box{position:relative;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:14px 16px}
  .cmd-box code{font-family:'Cascadia Code','Consolas',monospace;font-size:12.5px;color:#79c0ff;display:block;white-space:pre-wrap;word-break:break-all;padding-right:56px}
  .copy-btn{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:#21262d;border:1px solid #30363d;color:#8b949e;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;transition:all .15s}
  .copy-btn:hover{background:#30363d;color:#e2e8f0}
  .note{background:#0d2137;border:1px solid #1d4ed8;border-radius:8px;padding:14px 16px;font-size:13px;color:#93c5fd;line-height:1.6;margin-bottom:28px}
  .note code{background:#1e3a5f;padding:2px 6px;border-radius:4px;font-family:monospace}
  .download-btn{display:inline-flex;align-items:center;gap:8px;background:#6366f1;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;transition:background .15s}
  .download-btn:hover{background:#4f46e5}
  .divider{border:none;border-top:1px solid #1e293b;margin:28px 0}
  .back{font-size:13px;color:#64748b;margin-top:20px}
  .back a{color:#818cf8;text-decoration:none}
  .back a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">
    <div class="logo-icon">⚡</div>
    <div class="logo-text">Nexus<span>IT</span></div>
  </div>

  <h1>Install Endpoint Agent</h1>
  <p class="sub">Connect this machine to your NexusIT dashboard for remote management, terminal access, and real-time monitoring.</p>

  <div class="note">
    <strong>You need the AGENT_SECRET</strong> — ask your administrator or run this on the server:<br>
    <code>grep AGENT_SECRET /opt/nexusit/.env</code>
  </div>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <h3>Open PowerShell as Administrator</h3>
      <p>Right-click the Start menu → <strong>Windows PowerShell (Admin)</strong> or <strong>Terminal (Admin)</strong></p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <h3>Run the installer</h3>
      <p>Paste and run this one-line command:</p>
      <div class="cmd-box">
        <code id="cmd">Set-ExecutionPolicy Bypass -Scope Process -Force; iwr ${base}/downloads/install-windows.ps1 | iex</code>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('cmd').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)})">Copy</button>
      </div>
    </div>
  </div>

  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <h3>Enter the AGENT_SECRET when prompted</h3>
      <p>The agent will install, configure itself, and connect to the dashboard automatically.</p>
    </div>
  </div>

  <hr class="divider">

  <a class="download-btn" href="/downloads/install-windows.ps1" download>
    ⬇ Download install-windows.ps1
  </a>

  <p class="back">← <a href="${base}">Back to NexusIT Dashboard</a></p>
</div>
</body>
</html>`);
});

// ── GET /downloads/install-windows.ps1 ────────────────────
router.get('/install-windows.ps1', (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host  = req.headers.host || '187.127.134.246:3080';
  const base  = `${proto}://${host}`;

  const script = `# NexusIT Endpoint Agent Installer - Windows
# Run as Administrator in PowerShell:
#   Set-ExecutionPolicy Bypass -Scope Process -Force; iwr ${base}/downloads/install-windows.ps1 | iex

$SERVER_URL   = "${base}"
$AGENT_SECRET = Read-Host "Enter AGENT_SECRET"
$INSTALL_DIR  = "C:\\NexusIT-Agent"
$TASK_NAME    = "NexusIT-Agent"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  NexusIT Endpoint Agent Installer" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole("Administrator")) {
    Write-Host "ERROR: Please run PowerShell as Administrator." -ForegroundColor Red; exit 1
}

# Install Node.js if missing
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[1/4] Downloading Node.js..." -ForegroundColor Yellow
    $msi = "$env:TEMP\\node.msi"
    Invoke-WebRequest "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile $msi
    Start-Process msiexec -Wait -ArgumentList "/I \\"$msi\\" /quiet"
    $env:PATH = [Environment]::GetEnvironmentVariable("PATH","Machine")
    Write-Host "  Node.js installed." -ForegroundColor Green
} else {
    Write-Host "[1/4] Node.js $(node --version) found." -ForegroundColor Green
}

New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
New-Item -ItemType Directory -Force -Path "$INSTALL_DIR\\src"  | Out-Null
New-Item -ItemType Directory -Force -Path "$INSTALL_DIR\\logs" | Out-Null

Write-Host "[2/4] Downloading agent files..." -ForegroundColor Yellow
Invoke-WebRequest "$SERVER_URL/downloads/agent.js"           -OutFile "$INSTALL_DIR\\src\\agent.js"
Invoke-WebRequest "$SERVER_URL/downloads/agent-package.json" -OutFile "$INSTALL_DIR\\package.json"
Write-Host "  Done." -ForegroundColor Green

Write-Host "[3/4] Writing config..." -ForegroundColor Yellow
@"
SERVER_URL=$SERVER_URL
AGENT_SECRET=$AGENT_SECRET
HEARTBEAT_INTERVAL=10000
"@ | Set-Content "$INSTALL_DIR\\.env" -Encoding UTF8

Set-Location $INSTALL_DIR
npm install | Out-Null

Write-Host "[4/4] Registering scheduled task..." -ForegroundColor Yellow
$vbs = "$INSTALL_DIR\\launch.vbs"
@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "node $INSTALL_DIR\\src\\agent.js", 0, False
"@ | Set-Content $vbs -Encoding UTF8

$action    = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "\\"$vbs\\""
$trigger   = New-ScheduledTaskTrigger -AtStartup
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TASK_NAME -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
Start-ScheduledTask -TaskName $TASK_NAME

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  Agent installed and running!" -ForegroundColor Green
Write-Host "  Device will appear in dashboard within 15s" -ForegroundColor Green
Write-Host "  Dashboard: $SERVER_URL" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="install-windows.ps1"');
  res.send(script);
});

// ── GET /downloads/agent.js ────────────────────────────────
router.get('/agent.js', (req, res) => {
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
  res.status(404).send('agent.js not found on server');
});

// ── GET /downloads/agent-package.json ─────────────────────
router.get('/agent-package.json', (_req, res) => {
  res.json({
    name: 'nexusit-agent',
    version: '1.0.0',
    main: 'src/agent.js',
    scripts: { start: 'node src/agent.js' },
    dependencies: {
      axios:            '^1.7.7',
      dotenv:           '^16.4.5',
      'socket.io-client': '^4.8.0',
      systeminformation: '^5.23.5',
      uuid:             '^10.0.0',
      winston:          '^3.14.2'
    }
  });
});

// ── GET /downloads/NexusIT-Setup.exe ──────────────────────
router.get('/NexusIT-Setup.exe', (req, res) => {
  const candidates = [
    path.join(STATIC_DIR, 'NexusIT Setup 1.0.0.exe'),
    path.resolve(__dirname, '../../../../electron/dist/NexusIT Setup 1.0.0.exe')
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      res.setHeader('Content-Disposition', 'attachment; filename="NexusIT-Setup.exe"');
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.sendFile(f);
    }
  }
  res.status(404).send('Installer not yet available.');
});

module.exports = router;
