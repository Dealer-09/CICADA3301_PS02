// tools/chrome.js — Chrome discovery, launch, and CDP management for Windows
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

const CDP_PORT = process.env.NIRO_CDP_PORT || 9222;

/**
 * Locate Chrome/Chromium executable on Windows by scanning known install paths.
 */
export function getChromeExecutable() {
  const candidates = [
    // Chrome stable
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    // Chrome Beta / Dev / Canary
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome Beta', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome Dev', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome SxS', 'Application', 'chrome.exe'),
    // Chromium
    path.join(process.env.LOCALAPPDATA || '', 'Chromium', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Chromium', 'Application', 'chrome.exe'),
    // Edge as fallback
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        console.log(`[chrome.js] Found browser at: ${p}`);
        return p;
      }
    } catch (_) {}
  }

  throw new Error('Could not find Chrome, Chromium, or Edge. Please install Google Chrome.');
}

/**
 * Get the Chrome user data directory.
 */
function getChromeUserDataDir() {
  return path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
}

/**
 * Discover Chrome profiles from User Data directory.
 * Returns array of { id, name, email }.
 */
export function discoverProfiles() {
  const userDataDir = getChromeUserDataDir();
  const profiles = [];

  try {
    const entries = fs.readdirSync(userDataDir);
    for (const entry of entries) {
      if (entry !== 'Default' && !entry.startsWith('Profile ')) continue;
      const prefPath = path.join(userDataDir, entry, 'Preferences');
      if (!fs.existsSync(prefPath)) continue;
      try {
        const raw = fs.readFileSync(prefPath, 'utf8');
        const prefs = JSON.parse(raw);
        const accountInfo = prefs?.account_info?.[0];
        const name = accountInfo?.full_name || prefs?.profile?.name || entry;
        const email = accountInfo?.email || '';
        profiles.push({ id: entry, name, email });
      } catch (_) {
        profiles.push({ id: entry, name: entry, email: '' });
      }
    }
  } catch (err) {
    console.warn('[chrome.js] Could not read Chrome profiles:', err.message);
  }

  return profiles;
}

/**
 * Select the best Chrome profile:
 * 1. First profile with a Google/Gmail email
 * 2. 'Default' profile
 * 3. First profile found
 */
export function getDefaultProfile() {
  const profiles = discoverProfiles();
  if (profiles.length === 0) return 'Default';

  const googleProfile = profiles.find(p => p.email && (p.email.includes('@gmail.com') || p.email.includes('@google.com')));
  if (googleProfile) return googleProfile.id;

  const defaultProfile = profiles.find(p => p.id === 'Default');
  if (defaultProfile) return defaultProfile.id;

  return profiles[0].id;
}

let chromeProcess = null;

/**
 * Launch Chrome with remote debugging enabled on the CDP port.
 * Uses the user's actual Chrome profile so cookies/logins are preserved.
 */
export function launchChrome() {
  const chromePath = getChromeExecutable();
  const profileId = getDefaultProfile();
  const userDataDir = getChromeUserDataDir();

  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--profile-directory=${profileId}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
  ];

  console.log(`[chrome.js] Launching Chrome: ${chromePath}`);
  console.log(`[chrome.js] Profile: ${profileId}, CDP port: ${CDP_PORT}`);

  chromeProcess = spawn(chromePath, args, {
    detached: true,
    stdio: 'ignore',
  });

  chromeProcess.unref();

  chromeProcess.on('error', (err) => {
    console.error('[chrome.js] Chrome process error:', err.message);
    chromeProcess = null;
  });

  chromeProcess.on('exit', (code) => {
    console.log(`[chrome.js] Chrome exited with code ${code}`);
    chromeProcess = null;
  });

  return chromeProcess;
}

/**
 * Check if Chrome's CDP endpoint is responding.
 */
export function isChromeCDPReady() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${CDP_PORT}/json/version`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Poll CDP endpoint until Chrome is ready or timeout expires.
 * @param {number} timeoutMs - Max wait in ms (default 15s)
 * @param {number} intervalMs - Poll interval in ms (default 500ms)
 */
export async function waitForCDP(timeoutMs = 15000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isChromeCDPReady()) {
      console.log('[chrome.js] Chrome CDP is ready');
      return true;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Chrome CDP did not become ready within ${timeoutMs}ms`);
}
