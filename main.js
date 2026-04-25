// main.js — Perch main process: windows, IPC, agent orchestration
import { app, BrowserWindow, ipcMain, screen, shell, Tray, nativeImage, Notification } from 'electron';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables FIRST before any other imports that might use them
dotenv.config({ path: path.join(__dirname, '.env') });

// electron-store is CJS — use createRequire to import it in an ESM context
const require = createRequire(import.meta.url);
const Store = require('electron-store');

import { initClient, runAgent, stopAgent } from './agent.js';
import { setStore, setMainWindow } from './tools.js';

// ─────────────────────────────────────────────────
// Electron Store
// ─────────────────────────────────────────────────
const store = new Store({
  defaults: {
    apiKey: process.env.GROQ_API_KEY || '',
    tasks: [
      { id: '1', name: 'Chrome',      icon: '🌐', instruction: 'Open Google Chrome' },
      { id: '2', name: 'Notepad',     icon: '📝', instruction: 'Open Notepad' },
      { id: '3', name: '25min Timer', icon: '⏱',  instruction: 'Set a 25 minute focus timer' },
      { id: '4', name: '5min Break',  icon: '☕', instruction: 'Set a 5 minute break timer' },
      { id: '5', name: 'My IP',       icon: '🔌', instruction: 'Show my public IP address' },
      { id: '6', name: 'Screenshot',  icon: '📸', instruction: 'Take a screenshot and tell me what\'s on my screen' },
    ],
    chatHistory: [],
    settings: {
      hoverDelay: 800,
      theme: 'dark',
      autoStart: false,
      sensorHeight: 6,
    }
  }
});

// Give tools access to the store
setStore(store);

// ─────────────────────────────────────────────────
// Initialize Groq Client
// ─────────────────────────────────────────────────
// Always prefer .env key over stored key (env is source of truth on dev)
const PLACEHOLDER = 'your-groq-api-key-here';
const envKey = process.env.GROQ_API_KEY;
const storedKey = store.get('apiKey');
const apiKey = (envKey && envKey !== PLACEHOLDER) ? envKey
             : (storedKey && storedKey !== PLACEHOLDER) ? storedKey
             : null;

// Keep store in sync with .env key
if (envKey && envKey !== PLACEHOLDER && storedKey !== envKey) {
  store.set('apiKey', envKey);
}

if (apiKey) {
  initClient(apiKey);
}

// ─────────────────────────────────────────────────
// Window references
// ─────────────────────────────────────────────────
let tray = null;
let sensorWindow = null;
let panelWindow = null;
let hideTimeout = null;
let mouseInPanel = false;
let mouseInSensor = false;

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 620;

// ─────────────────────────────────────────────────
// Sensor Zone Window (invisible, top of screen)
// ─────────────────────────────────────────────────
function createSensorWindow() {
  const { width } = screen.getPrimaryDisplay().bounds;
  const sensorHeight = store.get('settings.sensorHeight') || 6;
  const panelX = (width - PANEL_WIDTH) / 2;

  sensorWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: sensorHeight,
    x: panelX,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  sensorWindow.loadFile(path.join(__dirname, 'renderer', 'sensor.html'));
  sensorWindow.setIgnoreMouseEvents(false);
  sensorWindow.show();

  // Prevent sensor from ever gaining visible focus
  sensorWindow.on('focus', () => {
    sensorWindow.blur();
  });
}

// ─────────────────────────────────────────────────
// Panel Window (main UI, centered on screen)
// ─────────────────────────────────────────────────
function createPanelWindow() {
  const { width } = screen.getPrimaryDisplay().bounds;
  const panelX = (width - PANEL_WIDTH) / 2;
  const panelY = 0;

  panelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    x: panelX,
    y: panelY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,      // Must be true so the input field can receive keyboard events
    resizable: false,
    hasShadow: false,
    show: false,
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  panelWindow.loadFile(path.join(__dirname, 'renderer', 'panel.html'));
  setMainWindow(panelWindow);
  // Note: we use showInactive() to display the panel without stealing focus.
  // The user can click the input to focus it naturally.
}

// ─────────────────────────────────────────────────
// Show / Hide panel
// ─────────────────────────────────────────────────
function showPanel() {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  clearHideTimeout();
  panelWindow.showInactive();
  panelWindow.webContents.send('panel:doShow');
}

function hidePanel() {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  panelWindow.webContents.send('panel:doHide');
  // Wait for animation then actually hide
  setTimeout(() => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.hide();
    }
  }, 350);
}

function scheduleHide() {
  clearHideTimeout();
  const delay = store.get('settings.hoverDelay') || 800;
  hideTimeout = setTimeout(() => {
    if (!mouseInPanel && !mouseInSensor) {
      hidePanel();
    }
  }, delay);
}

function clearHideTimeout() {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

// ─────────────────────────────────────────────────
// Tray Icon
// ─────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Perch — Desktop AI Agent');

  tray.on('click', () => {
    showPanel();
  });
}

// ─────────────────────────────────────────────────
// App Lifecycle
// ─────────────────────────────────────────────────
app.whenReady().then(() => {
  createSensorWindow();
  createPanelWindow();
  createTray();

  // Set auto-start
  const autoStart = store.get('settings.autoStart');
  if (autoStart) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath
    });
  }
});

app.on('window-all-closed', () => {
  // Don't quit — Perch lives in the tray
});

// Handle quit button from settings
ipcMain.on('app:quit', () => {
  app.quit();
});

// ─────────────────────────────────────────────────
// IPC: Panel Visibility (sensor + panel hover tracking)
// ─────────────────────────────────────────────────
ipcMain.on('sensor:hover', () => {
  mouseInSensor = true;
  showPanel();
});

ipcMain.on('panel:mouseEnter', () => {
  mouseInPanel = true;
  clearHideTimeout();
});

ipcMain.on('panel:mouseLeave', () => {
  mouseInPanel = false;
  mouseInSensor = false;
  scheduleHide();
});

ipcMain.on('panel:show', () => showPanel());
ipcMain.on('panel:hide', () => {
  mouseInPanel = false;
  mouseInSensor = false;
  hidePanel();
});

// ─────────────────────────────────────────────────
// IPC: Agent
// ─────────────────────────────────────────────────
let agentRunning = false;

ipcMain.handle('agent:run', async (event, message) => {
  if (agentRunning) {
    event.sender.send('agent:error', { message: 'Agent is already running. Please wait.' });
    return;
  }
  agentRunning = true;

  const chatHistory = store.get('chatHistory') || [];

  // Save user message
  chatHistory.push({
    role: 'user',
    content: message,
    timestamp: Date.now()
  });

  const sendEvent = (channel, data) => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send(channel, data);
    }
  };

  try {
    const response = await runAgent(message, chatHistory, sendEvent);

    if (response) {
      chatHistory.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });
    }

    // Keep only last 50 messages
    while (chatHistory.length > 50) {
      chatHistory.shift();
    }
    store.set('chatHistory', chatHistory);

  } catch (err) {
    sendEvent('agent:error', { message: err.message });
  } finally {
    agentRunning = false;
  }
});

ipcMain.handle('agent:stop', () => {
  stopAgent();
  agentRunning = false;
});

// ─────────────────────────────────────────────────
// IPC: Tasks
// ─────────────────────────────────────────────────
ipcMain.handle('tasks:get', () => {
  return store.get('tasks') || [];
});

ipcMain.handle('tasks:run', async (event, taskId) => {
  const tasks = store.get('tasks') || [];
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  // Run the task instruction through the agent
  const fakeEvent = { sender: panelWindow?.webContents };
  await ipcMain.emit('agent:run-internal', task.instruction);

  // Actually invoke it properly
  if (panelWindow && !panelWindow.isDestroyed()) {
    // Trigger agent:run from renderer side logic
    panelWindow.webContents.send('tasks:runInstruction', { instruction: task.instruction });
  }
});

ipcMain.handle('tasks:delete', (event, taskId) => {
  const tasks = store.get('tasks') || [];
  const filtered = tasks.filter(t => t.id !== taskId);
  store.set('tasks', filtered);
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send('tasks:updated', { tasks: filtered });
  }
  return filtered;
});

// ─────────────────────────────────────────────────
// IPC: Settings
// ─────────────────────────────────────────────────
ipcMain.handle('settings:get', () => {
  return store.get('settings');
});

ipcMain.handle('settings:set', (event, { key, value }) => {
  store.set(`settings.${key}`, value);

  if (key === 'autoStart') {
    app.setLoginItemSettings({
      openAtLogin: value,
      path: process.execPath
    });
  }

  return store.get('settings');
});

ipcMain.handle('settings:getApiKey', () => {
  const key = store.get('apiKey') || '';
  // Mask the key for display
  if (key && key.length > 8) {
    return key.substring(0, 4) + '•'.repeat(key.length - 8) + key.substring(key.length - 4);
  }
  return key ? '••••••••' : '';
});

ipcMain.handle('settings:setApiKey', (event, key) => {
  store.set('apiKey', key);
  initClient(key);
  return true;
});

// ─────────────────────────────────────────────────
// IPC: Chat History
// ─────────────────────────────────────────────────
ipcMain.handle('chat:getHistory', () => {
  return store.get('chatHistory') || [];
});

ipcMain.handle('chat:clear', () => {
  store.set('chatHistory', []);
  return [];
});
