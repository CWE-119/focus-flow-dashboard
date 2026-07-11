const { app, BrowserWindow, ipcMain, Menu, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

const PORT = 3000;
const API_PORT = 5000;

// Detect if running in development mode
let isDev = true;
let mainWindow;
let backendProcess;

function addModuleLookupPaths(paths) {
  const Module = require('module');
  const existing = new Set((process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean));

  for (const lookupPath of paths) {
    if (lookupPath && !existing.has(lookupPath)) {
      existing.add(lookupPath);
    }
  }

  process.env.NODE_PATH = Array.from(existing).join(path.delimiter);
  Module._initPaths();
}

// Helper: wait until a TCP port on localhost accepts connections
function waitForPort(port, timeoutMs = 10000) {
  const net = require('net');
  const start = Date.now();

  return new Promise((resolve, reject) => {
    (function attempt() {
      const socket = net.connect({ port, host: '127.0.0.1' }, () => {
        socket.destroy();
        return resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(attempt, 250);
      });
    })();
  });
}

// Start Express backend server
function startBackend() {
  return new Promise(async (resolve) => {
    // candidate paths to try (in order)
    const candidates = [];

    if (app.isPackaged) {
      // Prefer the app.asar path so backend JS can resolve app.asar/node_modules.
      // Native bindings are still loaded from app.asar.unpacked by Electron.
      candidates.push(path.join(app.getAppPath(), 'backend', 'index.js'));
      candidates.push(path.join(process.resourcesPath, 'app', 'backend', 'index.js'));
      candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'index.js'));

      addModuleLookupPaths([
        path.join(app.getAppPath(), 'node_modules'),
        path.join(process.resourcesPath, 'app', 'node_modules'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules'),
      ]);
    } else {
      candidates.push(path.join(__dirname, '../backend/index.js'));
    }

    let chosen = null;
    for (const p of candidates) {
      try {
        console.log('🔍 Checking backend candidate:', p, 'exists=', fs.existsSync(p));
        if (fs.existsSync(p)) {
          chosen = p;
          break;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!chosen) {
      console.error('❌ No backend file found in expected locations');
      return resolve();
    }

    console.log('🔄 Attempting to start backend from:', chosen);

    // Ensure the SQLite database is stored in a writable location when packaged.
    // We pass this path via an env var that the backend reads.
    let backendEnv = { ...process.env };
    try {
      // app.getPath('userData') is only valid after app is ready (which we are).
      const userDataDir = app.getPath('userData');
      const dbPath = path.join(userDataDir, 'focusflow.db');
      backendEnv.FOCUSFLOW_DB_PATH = dbPath;
      backendEnv.PORT = String(API_PORT);
      console.log('📁 Using DB path for backend:', dbPath);
    } catch (e) {
      console.warn('⚠ Could not determine userData path for DB:', e && e.message);
    }

    // Try require() first (in-process)
    try {
      console.log('📦 Requiring backend module in-process:', chosen);
      // Make env var visible before requiring backend
      process.env.FOCUSFLOW_DB_PATH = backendEnv.FOCUSFLOW_DB_PATH || process.env.FOCUSFLOW_DB_PATH;
      process.env.PORT = backendEnv.PORT || process.env.PORT;
      require(chosen);
      console.log('✓ Backend started via require()');
    } catch (err) {
      console.error('✗ Requiring backend failed:', err && err.message);

      // Fallback: spawn an external process using the electron/node executable
      const backendDir = path.dirname(chosen);
      console.log('🚀 Spawning backend process in:', backendDir, 'via', process.execPath);

      backendProcess = spawn(process.execPath, [chosen], {
        cwd: backendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        windowsHide: true,
        env: {
          ...backendEnv,
          ELECTRON_RUN_AS_NODE: '1',
          NODE_PATH: process.env.NODE_PATH || backendEnv.NODE_PATH,
        },
      });

      backendProcess.stdout?.on('data', (data) => {
        console.log('✓ [Backend]', data.toString().trim());
      });

      backendProcess.stderr?.on('data', (data) => {
        console.error('✗ [Backend Error]', data.toString().trim());
      });

      backendProcess.on('error', (err) => {
        console.error('❌ Failed to start backend process:', err && err.message);
      });

      backendProcess.on('exit', (code, signal) => {
        console.warn('⚠ Backend process exited with code:', code, 'signal:', signal);
      });
    }

    // Wait until the backend port accepts connections (or timeout)
    try {
      await waitForPort(API_PORT, 12000);
      console.log('✓ Backend is responding on port', API_PORT);
    } catch (e) {
      console.warn('⚠ Backend did not respond within timeout:', e && e.message);
    }

    resolve();
  });
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
    icon: isDev
      ? path.join(__dirname, '../public/FucosFlow.ico')
      : path.join(process.resourcesPath, 'FucosFlow.ico'),
  });

  // Load app
  let startUrl;
  if (isDev) {
    startUrl = `http://localhost:${PORT}`;
  } else {
    // In production, load from dist folder
    const distPath = path.join(app.getAppPath(), 'dist', 'index.html');
    startUrl = `file://${distPath}`;
    console.log('App path:', app.getAppPath());
    console.log('Loading production app from:', distPath);
    console.log('File exists:', fs.existsSync(distPath));
  }

  console.log('Loading URL:', startUrl);

  mainWindow.loadURL(startUrl);

  // Log any loading errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load app:', errorCode, errorDescription, startUrl);
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
  });

  // Open DevTools in development for debugging
  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.reload(),
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About FocusFlow',
          click: () => {
            // Open about dialog
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App initialization
app.on('ready', async () => {
  // Check if app is packaged to determine dev mode
  isDev = !app.isPackaged;

  console.log('📋 App Configuration:');
  console.log('  - isDev:', isDev);
  console.log('  - app.isPackaged:', app.isPackaged);
  console.log('  - process.resourcesPath:', process.resourcesPath);
  console.log('  - app.getAppPath():', app.getAppPath());

  // Configure auto-updater (only in production/packaged)
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();

    // Listen for update events
    autoUpdater.on('update-available', () => {
      if (mainWindow) {
        mainWindow.webContents.send('update-available');
      }
    });

    autoUpdater.on('update-downloaded', () => {
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded');
      }
    });

    autoUpdater.on('error', (error) => {
      console.error('Update error:', error);
    });
  }

  // Start backend
  await startBackend();

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Create window
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Clean up backend on app close
app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// IPC Handlers
ipcMain.handle('get-api-url', () => {
  return `http://localhost:${API_PORT}`;
});

ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  return sources.map((s) => ({ id: s.id, name: s.name }));
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.close());

// Update IPC handlers
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('check-for-updates', async () => {
  return await autoUpdater.checkForUpdates();
});

module.exports = { mainWindow };
