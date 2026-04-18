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

  // Check if EXE installer exists on disk
  const exeCandidates = [
    path.join(STATIC_DIR, 'NexusIT-Setup.exe'),
    path.join(STATIC_DIR, 'NexusIT Agent Setup 1.0.0.exe'),
    path.resolve(__dirname, '../../../../../electron-agent/dist/NexusIT Agent Setup 1.0.0.exe')
  ];
  const exeAvailable = exeCandidates.some(f => fs.existsSync(f));

  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>NexusIT Agent Download</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .wrap{max-width:660px;width:100%}
  .logo{display:flex;align-items:center;gap:10px;margin-bottom:32px}
  .logo-icon{width:40px;height:40px;background:#6366f1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px}
  .logo-text{font-size:1.4rem;font-weight:700;color:#fff}
  .logo-text span{color:#818cf8}
  h1{font-size:1.6rem;font-weight:700;color:#fff;margin-bottom:8px}
  .sub{color:#94a3b8;margin-bottom:28px;line-height:1.6}
  /* Install options */
  .options{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px}
  .option{background:#0d1420;border:2px solid #1e293b;border-radius:12px;padding:20px;cursor:default;transition:border-color .15s}
  .option.recommended{border-color:#6366f1}
  .option-badge{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#818cf8;margin-bottom:10px}
  .option h3{font-size:15px;font-weight:700;color:#fff;margin-bottom:6px}
  .option p{font-size:12px;color:#64748b;line-height:1.6;margin-bottom:16px}
  .option ul{list-style:none;margin-bottom:16px}
  .option ul li{font-size:12px;color:#94a3b8;margin-bottom:4px;padding-left:16px;position:relative}
  .option ul li::before{content:'✓';position:absolute;left:0;color:#4ade80}
  .dl-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;transition:all .15s;width:100%;text-align:center}
  .dl-btn--primary{background:#6366f1;color:#fff}
  .dl-btn--primary:hover{background:#4f46e5}
  .dl-btn--secondary{background:#1e293b;color:#94a3b8;border:1px solid #334155}
  .dl-btn--secondary:hover{background:#273548;color:#e2e8f0}
  .dl-btn--unavail{background:#0d1117;color:#475569;border:1px solid #1e293b;cursor:not-allowed;opacity:0.6}
  /* Advanced section */
  details{margin-top:8px}
  summary{font-size:13px;color:#475569;cursor:pointer;user-select:none;list-style:none}
  summary::-webkit-details-marker{display:none}
  summary::before{content:'▶ '}
  details[open] summary::before{content:'▼ '}
  summary:hover{color:#94a3b8}
  .adv-inner{margin-top:16px;padding-top:16px;border-top:1px solid #1e293b}
  .step{display:flex;gap:14px;margin-bottom:18px;align-items:flex-start}
  .step-num{min-width:26px;height:26px;background:#334155;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#94a3b8;margin-top:2px}
  .step-body h4{font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:5px}
  .step-body p{font-size:12px;color:#64748b;margin-bottom:8px;line-height:1.5}
  .cmd-box{position:relative;background:#0d1117;border:1px solid #1e293b;border-radius:8px;padding:12px 14px}
  .cmd-box code{font-family:'Cascadia Code','Consolas',monospace;font-size:11.5px;color:#79c0ff;display:block;white-space:pre-wrap;word-break:break-all;padding-right:50px}
  .copy-btn{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:#1e293b;border:1px solid #334155;color:#64748b;font-size:10px;padding:3px 8px;border-radius:5px;cursor:pointer;transition:all .15s}
  .copy-btn:hover{background:#334155;color:#e2e8f0}
  .note{background:#0d1a2a;border:1px solid #1e3a5f;border-radius:8px;padding:12px 14px;font-size:12px;color:#93c5fd;line-height:1.6;margin-bottom:20px}
  .note code{background:#1e3a5f;padding:1px 5px;border-radius:3px;font-family:monospace}
  .back{font-size:12px;color:#334155;margin-top:24px}
  .back a{color:#6366f1;text-decoration:none}
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

  <div class="options">
    <!-- EXE installer -->
    <div class="option recommended">
      <div class="option-badge">⭐ Recommended</div>
      <h3>Windows Setup (.exe)</h3>
      <p>One-click visual installer with system-tray app. Shows connection status &amp; live stats.</p>
      <ul>
        <li>Double-click to install</li>
        <li>System-tray icon (green/red/yellow)</li>
        <li>Live CPU, RAM &amp; disk stats</li>
        <li>Auto-starts at login</li>
      </ul>
      ${exeAvailable
        ? `<a class="dl-btn dl-btn--primary" href="/downloads/NexusIT-Setup.exe">⬇ Download NexusIT-Setup.exe</a>`
        : `<span class="dl-btn dl-btn--unavail">⬇ Installer not yet available</span>`
      }
    </div>

    <!-- PS1 installer -->
    <div class="option">
      <div class="option-badge">Advanced</div>
      <h3>PowerShell Script</h3>
      <p>Silent background agent. Ideal for servers, mass deployment, or headless machines.</p>
      <ul>
        <li>Runs as SYSTEM service</li>
        <li>No GUI required</li>
        <li>Suitable for scripted rollout</li>
        <li>Works on all Windows versions</li>
      </ul>
      <a class="dl-btn dl-btn--secondary" href="/downloads/install-windows.ps1" download>⬇ Download install-windows.ps1</a>
    </div>
  </div>

  <details>
    <summary>PowerShell one-liner (run directly without downloading)</summary>
    <div class="adv-inner">
      <div class="note">
        You need the <strong>AGENT_SECRET</strong> — ask your administrator or run on the server:<br>
        <code>grep AGENT_SECRET /opt/nexusit/.env</code>
      </div>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-body">
          <h4>Open PowerShell as Administrator</h4>
          <p>Right-click the Start menu → <strong>Windows PowerShell (Admin)</strong> or <strong>Terminal (Admin)</strong></p>
        </div>
      </div>

      <div class="step">
        <div class="step-num">2</div>
        <div class="step-body">
          <h4>Run the installer command</h4>
          <div class="cmd-box">
            <code id="cmd">$f="$env:TEMP\\nxit.ps1"; iwr ${base}/downloads/install-windows.ps1 -OutFile $f -UseBasicParsing; powershell -ExecutionPolicy Bypass -File $f; Remove-Item $f -Force</code>
            <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('cmd').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)})">Copy</button>
          </div>
        </div>
      </div>

      <div class="step">
        <div class="step-num">3</div>
        <div class="step-body">
          <h4>Enter the AGENT_SECRET when prompted</h4>
          <p>The agent will install, configure itself, and connect automatically.</p>
        </div>
      </div>
    </div>
  </details>

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
# Save to file and run as Administrator:
#   $f="$env:TEMP\\nxit.ps1"; iwr ${base}/downloads/install-windows.ps1 -OutFile $f -UseBasicParsing; powershell -ExecutionPolicy Bypass -File $f; Remove-Item $f -Force

$ErrorActionPreference = "Stop"
$INSTALL_DIR = "C:\\NexusIT-Agent"
$TASK_NAME   = "NexusIT-Agent"
$SERVER_URL  = "${base}"

function Pause-OnExit {
    Write-Host ""
    Write-Host "Press Enter to close this window..." -ForegroundColor Gray
    Read-Host | Out-Null
}

try {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "  NexusIT Endpoint Agent Installer" -ForegroundColor Cyan
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""

    # Check admin
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")
    if (-not $isAdmin) {
        Write-Host "ERROR: Please close this window and re-run PowerShell as Administrator." -ForegroundColor Red
        Pause-OnExit; return
    }

    # Get secret
    $AGENT_SECRET = Read-Host "Enter AGENT_SECRET"
    if (-not $AGENT_SECRET) {
        Write-Host "ERROR: AGENT_SECRET cannot be empty." -ForegroundColor Red
        Pause-OnExit; return
    }

    # Step 1 - Node.js
    Write-Host "[1/4] Checking Node.js..." -ForegroundColor Yellow
    $nodePath = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodePath) {
        Write-Host "      Node.js not found. Downloading installer..." -ForegroundColor Yellow
        $msi = "$env:TEMP\\node-installer.msi"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile $msi -UseBasicParsing
        Start-Process msiexec.exe -Wait -ArgumentList "/I \`"$msi\`" /quiet /norestart"
        $env:PATH = [Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [Environment]::GetEnvironmentVariable("PATH","User")
        Write-Host "      Node.js installed." -ForegroundColor Green
    } else {
        Write-Host "      Node.js $(node --version) found." -ForegroundColor Green
    }

    # Step 2 - Download agent files from server
    Write-Host "[2/4] Downloading agent files..." -ForegroundColor Yellow
    if (Test-Path $INSTALL_DIR) { Remove-Item -Recurse -Force $INSTALL_DIR }
    New-Item -ItemType Directory -Force -Path "$INSTALL_DIR\\src"  | Out-Null
    New-Item -ItemType Directory -Force -Path "$INSTALL_DIR\\logs" | Out-Null

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest "$SERVER_URL/downloads/agent.js" -OutFile "$INSTALL_DIR\\src\\agent.js" -UseBasicParsing
    Invoke-WebRequest "$SERVER_URL/downloads/agent-package.json" -OutFile "$INSTALL_DIR\\package.json" -UseBasicParsing

    Write-Host "      Files downloaded." -ForegroundColor Green

    # Step 3 - Write config and install dependencies
    Write-Host "[3/4] Writing config and installing dependencies..." -ForegroundColor Yellow
    Set-Content "$INSTALL_DIR\\.env" -Encoding UTF8 -Value @(
        "SERVER_URL=$SERVER_URL",
        "AGENT_SECRET=$AGENT_SECRET",
        "HEARTBEAT_INTERVAL=10000"
    )
    Set-Location $INSTALL_DIR
    Write-Host "      Running npm install..." -ForegroundColor Yellow
    $npmOut = npm install 2>&1
    if ($LASTEXITCODE -ne 0) { throw "npm install failed: $npmOut" }
    Write-Host "      Dependencies installed." -ForegroundColor Green

    # Step 4 - Register as scheduled task
    Write-Host "[4/4] Registering startup task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue

    $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $nodeExe) { $nodeExe = "node.exe" }
    $action    = New-ScheduledTaskAction -Execute $nodeExe -Argument "src\\agent.js" -WorkingDirectory $INSTALL_DIR
    $trigger   = New-ScheduledTaskTrigger -AtStartup
    $settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $TASK_NAME -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
    Start-ScheduledTask -TaskName $TASK_NAME

    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host "  SUCCESS! Agent installed and started." -ForegroundColor Green
    Write-Host "  Device will appear in dashboard in ~15s." -ForegroundColor Green
    Write-Host "  Dashboard: $SERVER_URL" -ForegroundColor Green
    Write-Host "  Log file:  $INSTALL_DIR\\logs\\agent.log" -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Line $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())" -ForegroundColor Red
}

Pause-OnExit
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
    path.join(STATIC_DIR, 'NexusIT-Setup.exe'),
    path.join(STATIC_DIR, 'NexusIT Agent Setup 1.0.0.exe'),
    path.resolve(__dirname, '../../../../../electron-agent/dist/NexusIT Agent Setup 1.0.0.exe'),
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
