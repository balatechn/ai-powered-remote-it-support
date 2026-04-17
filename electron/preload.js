/**
 * Electron Preload Script
 * Exposes safe APIs to the renderer process.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onNavigate: (callback) => ipcRenderer.on('navigate', (_, path) => callback(path)),
  platform: process.platform
});
