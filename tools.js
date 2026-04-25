// tools.js — All executable tools for Perch agent
import { exec, spawn } from 'child_process';
import { shell, Notification } from 'electron';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Try to load robotjs — it's optional (requires native compilation)
let robot = null;
try {
  robot = (await import('@jitsi/robotjs')).default;
} catch (e) {
  console.warn('[Perch] robotjs not available — type_text, press_key, mouse_click tools disabled.');
  console.warn('[Perch] Install @jitsi/robotjs if you need keyboard/mouse control.');
}

// Active timers storage
const activeTimers = new Map();

// Store reference — set from main.js
let store = null;
let mainWindow = null;

export function setStore(s) {
  store = s;
}

export function setMainWindow(win) {
  mainWindow = win;
}

// ─────────────────────────────────────────────────
// Tool: open_app
// ─────────────────────────────────────────────────
const APP_PATHS = {
  'chrome': 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'google chrome': 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'firefox': 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
  'notepad': 'notepad.exe',
  'calculator': 'calc.exe',
  'calc': 'calc.exe',
  'explorer': 'explorer.exe',
  'file explorer': 'explorer.exe',
  'cmd': 'cmd.exe',
  'powershell': 'powershell.exe',
  'spotify': path.join(process.env.APPDATA || '', 'Spotify\\Spotify.exe'),
  'discord': path.join(process.env.LOCALAPPDATA || '', 'Discord\\Update.exe --processStart Discord.exe'),
  'vscode': path.join(process.env.LOCALAPPDATA || '', 'Programs\\Microsoft VS Code\\Code.exe'),
  'vs code': path.join(process.env.LOCALAPPDATA || '', 'Programs\\Microsoft VS Code\\Code.exe'),
  'code': path.join(process.env.LOCALAPPDATA || '', 'Programs\\Microsoft VS Code\\Code.exe'),
  'slack': path.join(process.env.LOCALAPPDATA || '', 'slack\\slack.exe'),
  'teams': path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Teams\\current\\Teams.exe'),
};

async function open_app({ app }) {
  try {
    const appLower = app.toLowerCase().trim();
    const knownPath = APP_PATHS[appLower];

    if (knownPath) {
      spawn(knownPath, [], { detached: true, stdio: 'ignore', shell: true }).unref();
      return { success: true, result: `Opened ${app}` };
    }

    // If it looks like a full path, try it directly
    if (app.includes('\\') || app.includes('/') || app.endsWith('.exe')) {
      spawn(app, [], { detached: true, stdio: 'ignore', shell: true }).unref();
      return { success: true, result: `Opened ${app}` };
    }

    // Fallback: try 'start' command via PowerShell
    await execAsync(`powershell -Command "Start-Process '${app}'"`, { timeout: 10000 });
    return { success: true, result: `Opened ${app}` };
  } catch (err) {
    return { success: false, result: `Failed to open ${app}: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────
// Tool: open_website
// ─────────────────────────────────────────────────
async function open_website({ url }) {
  try {
    let fullUrl = url;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = 'https://' + fullUrl;
    }
    await shell.openExternal(fullUrl);
    return { success: true, result: `Opened ${fullUrl}` };
  } catch (err) {
    return { success: false, result: `Failed to open ${url}: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────
// Tool: type_text
// ─────────────────────────────────────────────────
async function type_text({ text }) {
  if (!robot) {
    return { success: false, result: 'robotjs not available — cannot type text. Install @jitsi/robotjs.' };
  }
  try {
    // Delay so the target window regains focus
    await new Promise(r => setTimeout(r, 500));
    robot.typeString(text);
    return { success: true, result: `Typed: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"` };
  } catch (err) {
    return { success: false, result: `Failed to type text: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────
// Tool: press_key
// ─────────────────────────────────────────────────
async function press_key({ key }) {
  if (!robot) {
    return { success: false, result: 'robotjs not available — cannot press keys. Install @jitsi/robotjs.' };
  }
  try {
    const parts = key.toLowerCase().split('+').map(k => k.trim());

    if (parts.length === 1) {
      // Single key
      const keyName = mapKeyName(parts[0]);
      robot.keyTap(keyName);
    } else {
      // Key combo: last part is the key, rest are modifiers
      const modifiers = parts.slice(0, -1).map(mapModifier);
      const mainKey = mapKeyName(parts[parts.length - 1]);
      robot.keyTap(mainKey, modifiers);
    }
    return { success: true, result: `Pressed: ${key}` };
  } catch (err) {
    return { success: false, result: `Failed to press ${key}: ${err.message}` };
  }
}

function mapKeyName(key) {
  const map = {
    'enter': 'enter', 'return': 'enter',
    'tab': 'tab', 'space': 'space',
    'backspace': 'backspace', 'delete': 'delete',
    'escape': 'escape', 'esc': 'escape',
    'up': 'up', 'down': 'down', 'left': 'left', 'right': 'right',
    'home': 'home', 'end': 'end',
    'pageup': 'pageup', 'pagedown': 'pagedown',
    'f1': 'f1', 'f2': 'f2', 'f3': 'f3', 'f4': 'f4',
    'f5': 'f5', 'f6': 'f6', 'f7': 'f7', 'f8': 'f8',
    'f9': 'f9', 'f10': 'f10', 'f11': 'f11', 'f12': 'f12',
    'win': 'command', 'windows': 'command', 'meta': 'command',
    'printscreen': 'printscreen', 'insert': 'insert',
  };
  return map[key] || key;
}

function mapModifier(mod) {
  const map = {
    'ctrl': 'control', 'control': 'control',
    'alt': 'alt',
    'shift': 'shift',
    'win': 'command', 'windows': 'command', 'meta': 'command', 'super': 'command',
  };
  return map[mod] || mod;
}

// ─────────────────────────────────────────────────
// Tool: mouse_click
// ─────────────────────────────────────────────────
async function mouse_click({ x, y }) {
  if (!robot) {
    return { success: false, result: 'robotjs not available — cannot click mouse. Install @jitsi/robotjs.' };
  }
  try {
    robot.moveMouse(Math.round(x), Math.round(y));
    await new Promise(r => setTimeout(r, 100));
    robot.mouseClick();
    return { success: true, result: `Clicked at (${x}, ${y})` };
  } catch (err) {
    return { success: false, result: `Failed to click at (${x}, ${y}): ${err.message}` };
  }
}

// ─────────────────────────────────────────────────
// Tool: run_command
// ─────────────────────────────────────────────────
async function run_command({ command, silent = false }) {
  try {
    // Sanitize: escape double quotes for powershell
    const sanitized = command.replace(/"/g, '\\"');
    const { stdout, stderr } = await execAsync(
      `powershell -NoProfile -Command "${sanitized}"`,
      { timeout: 30000, maxBuffer: 1024 * 1024 }
    );
    const output = stdout.trim() || stderr.trim() || '(no output)';
    return {
      success: true,
      result: silent ? 'Command executed successfully.' : output.substring(0, 2000)
    };
  } catch (err) {
    return { success: false, result: `Command failed: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────
// Tool: set_timer
// ─────────────────────────────────────────────────
async function set_timer({ minutes, label }) {
  try {
    const id = `timer_${Date.now()}`;
    const ms = minutes * 60 * 1000;

    const timeout = setTimeout(() => {
      const notif = new Notification({
        title: '⏱ Timer Complete!',
        body: label || `Your ${minutes} minute timer is done!`,
        icon: path.join(process.cwd(), 'assets', 'icon.png'),
      });
      notif.show();
      activeTimers.delete(id);
    }, ms);

    activeTimers.set(id, { timeout, label, endsAt: Date.now() + ms });

    return {
      success: true,
      result: `Timer set: "${label}" — ${minutes} minute(s). You'll get a notification when it's done.`
    };
  } catch (err) {
    return { success: false, result: `Failed to set timer: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────
// Tool: take_screenshot
// ─────────────────────────────────────────────────
async function take_screenshot() {
  try {
    const screenshot = (await import('screenshot-desktop')).default;
    const imgBuffer = await screenshot({ format: 'png' });
    const base64 = imgBuffer.toString('base64');
    return {
      success: true,
      result: base64,
      isImage: true
    };
  } catch (err) {
    return { success: false, result: `Screenshot failed: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────
// Tool: show_notification
// ─────────────────────────────────────────────────
async function show_notification({ title, message }) {
  try {
    const notif = new Notification({
      title: title,
      body: message,
      icon: path.join(process.cwd(), 'assets', 'icon.png'),
    });
    notif.show();
    return { success: true, result: `Notification shown: "${title}"` };
  } catch (err) {
    return { success: false, result: `Notification failed: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────
// Tool: save_task
// ─────────────────────────────────────────────────
async function save_task({ name, instruction }) {
  try {
    const { v4: uuidv4 } = await import('uuid');
    const tasks = store.get('tasks') || [];

    const newTask = {
      id: uuidv4(),
      name: name,
      instruction: instruction,
      icon: '⚡'
    };

    tasks.push(newTask);
    store.set('tasks', tasks);

    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tasks:updated', { tasks });
    }

    return { success: true, result: `Task "${name}" saved to quick-access panel.` };
  } catch (err) {
    return { success: false, result: `Failed to save task: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────
// Tool Router
// ─────────────────────────────────────────────────
const TOOL_MAP = {
  open_app,
  open_website,
  type_text,
  press_key,
  mouse_click,
  run_command,
  set_timer,
  take_screenshot,
  show_notification,
  save_task,
};

export async function executeTool(name, args) {
  const fn = TOOL_MAP[name];
  if (!fn) {
    return { success: false, result: `Unknown tool: ${name}` };
  }
  console.log(`[Perch] Executing tool: ${name}`, args);
  return await fn(args);
}

export { activeTimers };
