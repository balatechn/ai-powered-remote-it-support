/**
 * NexusIT Desktop - Electron Main Process
 * Wraps the web dashboard in a native desktop window with system tray.
 */

const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;

const isDev = process.argv.includes('--dev');

// ─── Server URL Config ───────────────────────────────────────
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return { serverUrl: 'http://187.127.134.246:3080' };
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

const config = loadConfig();
const FRONTEND_URL = isDev ? 'http://localhost:5173' : config.serverUrl;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: false, // Frameless for custom title bar
    titleBarStyle: 'hidden',
    backgroundColor: '#020617',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false // Show after ready
  });

  mainWindow.loadURL(FRONTEND_URL);

  // Handle load failures (server unreachable)
  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadURL(`data:text/html,<html style="font-family:sans-serif;background:#020617;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center;max-width:420px;padding:40px">
        <div style="font-size:48px">⚠️</div>
        <h2 style="color:#6366f1">Cannot reach NexusIT server</h2>
        <p style="color:#94a3b8">Server: ${FRONTEND_URL}</p>
        <p style="color:#64748b;font-size:13px">Make sure the server is running, then click Retry.</p>
        <button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">Retry</button>
      </div></html>`);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open NexusIT', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: `Server: ${config.serverUrl}`, enabled: false },
    { label: 'Change Server URL...', click: () => showServerDialog() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setToolTip('NexusIT - AI Remote IT Support');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

// ─── Server URL Dialog ───────────────────────────────────────
function showServerDialog() {
  const win = new BrowserWindow({
    width: 460, height: 280, resizable: false, modal: true,
    parent: mainWindow, show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.setMenuBarVisibility(false);
  win.loadURL(`data:text/html,<html style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:32px">
    <h3 style="color:#6366f1;margin:0 0 20px">Change Server URL</h3>
    <input id="url" value="${config.serverUrl}" style="width:100%;padding:10px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;box-sizing:border-box" />
    <div style="margin-top:20px;display:flex;gap:12px;justify-content:flex-end">
      <button onclick="window.close()" style="padding:8px 20px;background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:8px;cursor:pointer">Cancel</button>
      <button onclick="save()" style="padding:8px 20px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer">Save & Reload</button>
    </div>
    <script>
      const {ipcRenderer} = require('electron');
      function save() { ipcRenderer.send('set-server-url', document.getElementById('url').value); window.close(); }
    </script></html>`);
  win.once('ready-to-show', () => win.show());
}

ipcMain.on('set-server-url', (_, url) => {
  config.serverUrl = url.trim();
  saveConfig(config);
  mainWindow?.loadURL(url.trim());
});

// ─── IPC Handlers ────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized());
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

// ─── App Lifecycle ───────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => { app.isQuitting = true; });
