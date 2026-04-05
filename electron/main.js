const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const http = require('http');

const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;
const PORT = 3000;
const DEV_URL = `http://localhost:${PORT}`;

let mainWindow = null;
let nextServer = null;

// ── Data directory ─────────────────────────────────────────────────────────

function getDataDir() {
  if (IS_DEV) {
    return path.join(__dirname, '..', '.data');
  }
  return path.join(app.getPath('userData'), 'data');
}

// ── Settings loader ────────────────────────────────────────────────────────
// Read saved API keys and inject them into the environment before starting
// the Next.js server so LLM calls pick them up without a restart.

function loadSettings() {
  const settingsPath = path.join(getDataDir(), 'settings.json');
  if (!fs.existsSync(settingsPath)) return;
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    if (settings.openaiApiKey) process.env.OPENAI_API_KEY = settings.openaiApiKey;
    if (settings.anthropicApiKey) process.env.ANTHROPIC_API_KEY = settings.anthropicApiKey;
  } catch {
    // Ignore malformed settings
  }
}

// ── Next.js server ─────────────────────────────────────────────────────────

function startNextServer() {
  return new Promise((resolve, reject) => {
    if (IS_DEV) {
      // In development the Next.js dev server is started separately
      // (via `npm run electron:dev`). Just resolve immediately.
      resolve();
      return;
    }

    // Production: fork the standalone Next.js server bundled by electron-builder.
    const serverScript = path.join(process.resourcesPath, 'app', '.next', 'standalone', 'server.js');

    if (!fs.existsSync(serverScript)) {
      reject(new Error(`Next.js server not found at: ${serverScript}`));
      return;
    }

    const env = {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      STORYFORGE_DATA_DIR: getDataDir(),
      NODE_ENV: 'production',
    };

    const standaloneRoot = path.dirname(serverScript);

    nextServer = fork(serverScript, [], {
      env,
      silent: true,
      cwd: standaloneRoot,
    });

    nextServer.stdout?.on('data', (data) => {
      console.log('[next]', data.toString().trim());
      if (data.toString().includes('Ready') || data.toString().includes('started')) {
        resolve();
      }
    });

    nextServer.stderr?.on('data', (data) => {
      console.error('[next error]', data.toString().trim());
    });

    nextServer.on('error', reject);

    // Poll for the server to be accepting connections
    let attempts = 0;
    const MAX_ATTEMPTS = 60;
    const poll = setInterval(() => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(poll);
        reject(new Error('Next.js server did not start in time'));
        return;
      }
      const req = http.get(DEV_URL, () => {
        clearInterval(poll);
        resolve();
      });
      req.on('error', () => {}); // Ignore connection errors while polling
      req.end();
    }, 500);
  });
}

// ── Browser window ─────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#ffffff',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in the system browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(DEV_URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App lifecycle ──────────────────────────────────────────────────────────

app.on('ready', async () => {
  // Ensure data directory exists
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Inject saved API keys into env
  loadSettings();

  // Set data dir for Next.js server
  process.env.STORYFORGE_DATA_DIR = dataDir;

  try {
    await startNextServer();
    createWindow();
  } catch (err) {
    console.error('Failed to start Next.js server:', err);
    dialog.showErrorBox(
      'StoryForge',
      `Could not start the app server.\n\n${err.message}\n\nIf this persists, reinstall or run from a terminal to see logs.`,
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('quit', () => {
  if (nextServer) {
    nextServer.kill();
    nextServer = null;
  }
});
