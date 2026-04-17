# ============================================================
# NexusIT Endpoint Agent - Windows Installer
# Run as Administrator in PowerShell:
# Set-ExecutionPolicy Bypass -Scope Process -Force
# iwr http://187.127.134.246:3080/downloads/install-windows.ps1 | iex
# ============================================================

$SERVER_URL = "http://187.127.134.246:3080"
$INSTALL_DIR = "C:\NexusIT-Agent"
$SERVICE_NAME = "NexusIT-Agent"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NexusIT Endpoint Agent Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ── Check Admin ──────────────────────────────────────────────
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Write-Host "ERROR: Run PowerShell as Administrator." -ForegroundColor Red
    exit 1
}

# ── Install Node.js if missing ───────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[1/4] Installing Node.js..." -ForegroundColor Yellow
    $nodeInstaller = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile $nodeInstaller
    Start-Process msiexec.exe -Wait -ArgumentList "/I `"$nodeInstaller`" /quiet"
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
    Write-Host "  Node.js installed." -ForegroundColor Green
} else {
    Write-Host "[1/4] Node.js already installed: $(node --version)" -ForegroundColor Green
}

# ── Download agent files ─────────────────────────────────────
Write-Host "[2/4] Downloading agent files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
New-Item -ItemType Directory -Force -Path "$INSTALL_DIR\src" | Out-Null
New-Item -ItemType Directory -Force -Path "$INSTALL_DIR\logs" | Out-Null

Invoke-WebRequest "$SERVER_URL/downloads/agent.js"          -OutFile "$INSTALL_DIR\src\agent.js"
Invoke-WebRequest "$SERVER_URL/downloads/agent-package.json" -OutFile "$INSTALL_DIR\package.json"
Write-Host "  Agent files downloaded." -ForegroundColor Green

# ── Create .env config ───────────────────────────────────────
Write-Host "[3/4] Configuring agent..." -ForegroundColor Yellow

$agentSecret = Read-Host "Enter AGENT_SECRET (from your NexusIT server .env)"

@"
SERVER_URL=$SERVER_URL
AGENT_SECRET=$agentSecret
HEARTBEAT_INTERVAL=30000
"@ | Set-Content "$INSTALL_DIR\.env" -Encoding UTF8

# ── Install npm packages ─────────────────────────────────────
Set-Location $INSTALL_DIR
npm install --prefix $INSTALL_DIR | Out-Null
Write-Host "  Dependencies installed." -ForegroundColor Green

# ── Install as Windows Service ───────────────────────────────
Write-Host "[4/4] Installing as Windows Service..." -ForegroundColor Yellow

# Create a VBScript launcher (runs node silently in background)
@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "node $INSTALL_DIR\src\agent.js", 0, False
"@ | Set-Content "$INSTALL_DIR\launch.vbs" -Encoding UTF8

# Register scheduled task to run at startup
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$INSTALL_DIR\launch.vbs`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Unregister-ScheduledTask -TaskName $SERVICE_NAME -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $SERVICE_NAME -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null

# Start it now
Start-ScheduledTask -TaskName $SERVICE_NAME

Write-Host "" 
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Agent installed and running!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Server  : $SERVER_URL" -ForegroundColor White
Write-Host "  Logs    : $INSTALL_DIR\logs\agent.log" -ForegroundColor White
Write-Host "  Service : Task Scheduler > $SERVICE_NAME" -ForegroundColor White
Write-Host ""
Write-Host "  This device will appear in NexusIT dashboard" -ForegroundColor Cyan
Write-Host "  at http://187.127.134.246:3080 within 30 seconds." -ForegroundColor Cyan
