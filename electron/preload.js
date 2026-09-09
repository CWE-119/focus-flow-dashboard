const { contextBridge, ipcRenderer } = require('electron');

function onUpdate(channel, listener) {
  const handler = (_event, updateInfo) => listener(updateInfo);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// Expose safe API to renderer process
contextBridge.exposeInMainWorld('electron', {
  // Get API URL from main process
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  getLocalApiToken: () => ipcRenderer.invoke('get-local-api-token'),

  // Get app version
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // Narrow update API; renderer code cannot invoke or subscribe to arbitrary IPC channels.
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
    onAvailable: (listener) => onUpdate('updates:available', listener),
    onDownloaded: (listener) => onUpdate('updates:downloaded', listener),
    onError: (listener) => onUpdate('updates:error', listener),
  },
  
  // Desktop audio capture (system audio)
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  // Platform info
  platform: process.platform,
  isElectron: true,
});
