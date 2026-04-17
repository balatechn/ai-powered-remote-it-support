@echo off
setlocal EnableDelayedExpansion
title NexusIT Agent Setup

:: ============================================================
:: NexusIT Endpoint Agent - Windows Setup
:: Double-click to run. Requires internet connection.
:: ============================================================

:: Request admin privileges (UAC prompt)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cls
echo.
echo  ============================================
echo    NexusIT Endpoint Agent Setup
echo  ============================================
echo.
echo  This will install the NexusIT monitoring agent
echo  on this computer so it can be managed from the
echo  NexusIT dashboard.
echo.
echo  Requirements:
echo    - Internet connection
echo    - Administrator rights (already granted)
echo.
echo ------------------------------------------------
echo.

:: ── Step 1: Ask for server details ───────────────────────────
set /p SERVER_URL="  Server URL (e.g. http://187.127.134.246:3080): "
if "!SERVER_URL!"=="" (
    echo  ERROR: Server URL is required.
    pause & exit /b 1
)

set /p AGENT_SECRET="  Agent Secret (from server .env): "
if "!AGENT_SECRET!"=="" (
    echo  ERROR: Agent secret is required.
    pause & exit /b 1
)

echo.
echo  Installing to: C:\NexusIT-Agent
echo  Server: !SERVER_URL!
echo.

:: ── Step 2: Check / Install Node.js ──────────────────────────
echo  [1/5] Checking Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo        Not found. Downloading Node.js v20...
    powershell -Command "Invoke-WebRequest 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile '%TEMP%\node-setup.msi'"
    echo        Installing Node.js silently...
    msiexec /i "%TEMP%\node-setup.msi" /quiet /norestart
    :: Refresh PATH
    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set PATH=%%b
    del "%TEMP%\node-setup.msi" >nul 2>&1
    echo        Node.js installed.
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo        Found: %%v
)

:: ── Step 3: Create directories ────────────────────────────────
echo  [2/5] Creating installation directory...
if not exist "C:\NexusIT-Agent\src"  mkdir "C:\NexusIT-Agent\src"
if not exist "C:\NexusIT-Agent\logs" mkdir "C:\NexusIT-Agent\logs"

:: ── Step 4: Download agent files ──────────────────────────────
echo  [3/5] Downloading agent files...
powershell -Command "Invoke-WebRequest '!SERVER_URL!/downloads/agent.js' -OutFile 'C:\NexusIT-Agent\src\agent.js'" >nul 2>&1
if %errorLevel% neq 0 (
    echo        ERROR: Could not download agent.js from server.
    echo        Make sure the server is running and the URL is correct.
    pause & exit /b 1
)
powershell -Command "Invoke-WebRequest '!SERVER_URL!/downloads/agent-package.json' -OutFile 'C:\NexusIT-Agent\package.json'" >nul 2>&1
echo        Done.

:: ── Step 5: Write .env config ─────────────────────────────────
echo  [4/5] Writing configuration...
(
    echo SERVER_URL=!SERVER_URL!
    echo AGENT_SECRET=!AGENT_SECRET!
    echo HEARTBEAT_INTERVAL=30000
) > "C:\NexusIT-Agent\.env"

:: Install npm packages
echo        Installing dependencies (this may take a minute^)...
pushd "C:\NexusIT-Agent"
call npm install --prefix "C:\NexusIT-Agent" >nul 2>&1
popd
echo        Done.

:: ── Step 6: Install as Windows startup task ───────────────────
echo  [5/5] Registering startup service...

:: Create a VBScript launcher so it runs silently (no console window)
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.Run "node C:\NexusIT-Agent\src\agent.js", 0, False
) > "C:\NexusIT-Agent\launch.vbs"

:: Remove any old task
schtasks /delete /tn "NexusIT-Agent" /f >nul 2>&1

:: Create scheduled task (runs as SYSTEM at startup, restarts on failure)
schtasks /create /tn "NexusIT-Agent" /tr "wscript.exe \"C:\NexusIT-Agent\launch.vbs\"" /sc ONSTART /ru SYSTEM /rl HIGHEST /f >nul 2>&1

:: Start it now
schtasks /run /tn "NexusIT-Agent" >nul 2>&1

echo        Done.

:: ── Summary ───────────────────────────────────────────────────
echo.
echo  ============================================
echo    Installation Complete!
echo  ============================================
echo.
echo    Server  : !SERVER_URL!
echo    Install : C:\NexusIT-Agent\
echo    Logs    : C:\NexusIT-Agent\logs\agent.log
echo    Service : Task Scheduler ^> NexusIT-Agent
echo.
echo    This device will appear in the NexusIT
echo    dashboard within 30 seconds.
echo.
echo    Dashboard: !SERVER_URL!
echo.
echo ------------------------------------------------
echo.

:: Open dashboard in browser
powershell -Command "Start-Process '!SERVER_URL!'" >nul 2>&1

pause
