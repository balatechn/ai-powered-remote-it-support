'use strict';
/**
 * Preload — secure IPC bridge between main process and renderer windows.
 * Only the methods listed here are exposed to the renderer.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexusIT', {
  getStatus:     ()      => ipcRenderer.invoke('get-status'),
  getSettings:   ()      => ipcRenderer.invoke('get-settings'),
  saveSettings:  (data)  => ipcRenderer.invoke('save-settings', data),
  openDashboard: ()      => ipcRenderer.invoke('open-dashboard'),
  openLogs:      ()      => ipcRenderer.invoke('open-logs'),
  reconnect:     ()      => ipcRenderer.invoke('reconnect'),

  // Push events from main → renderer
  onStatus:   (cb) => { ipcRenderer.on('status-update',  (_, d) => cb(d)); },
  onSettings: (cb) => { ipcRenderer.on('settings-data',  (_, d) => cb(d)); }
});
