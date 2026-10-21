/**
 * Test Runner Bridge for browser-qa-execution skill
 * Connects to active Chrome (CDP port 9222), executes UI actions,
 * takes evidence screenshots to timestamped run directories,
 * and calls generate_docx_report.py to compile corporate test reports.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const AUTOMATE_RESULT_DIR = fs.existsSync(path.join(PROJECT_ROOT, 'browser-execution', 'automate-result'))
  ? path.join(PROJECT_ROOT, 'browser-execution', 'automate-result')
  : path.join(PROJECT_ROOT, 'automate-result');
const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';

// 1. Parse .env credentials & role mappings
function parseEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...vals] = trimmed.split('=');
    if (key && vals.length > 0) {
      env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
  return env;
}

// 2. Discover available roles in .env
function getRolesFromEnv(env) {
  const roles = {};
  for (const [key, val] of Object.entries(env)) {
    if (key.startsWith('USER_')) {
      const match = key.match(/^USER_([A-Z0-9]+)_(.+)$/);
      if (match) {
        const role = match[1].toLowerCase();
        const suffix = match[2];
        const passKey = `PASS_${match[1]}_${suffix}`;
        roles[role] = {
          role,
          username: val,
          password: env[passKey] || ''
        };
      }
    }
  }
  return roles;
}

// 2b. Discover and group all credentials by role prefix (supports multi-credential disambiguation)
function getDetailedCredentialsFromEnv(env) {
  const grouped = {};
  for (const [key, val] of Object.entries(env)) {
    if (key.startsWith('USER_')) {
      const match = key.match(/^USER_([A-Z0-9]+)_(.+)$/);
      if (match) {
        const rolePrefix = match[1].toUpperCase();
        const suffix = match[2];
        const passKey = `PASS_${match[1]}_${suffix}`;
        if (!grouped[rolePrefix]) grouped[rolePrefix] = [];
        grouped[rolePrefix].push({
          key,
          role: rolePrefix,
          identifier: suffix,
          username: val,
          password: env[passKey] || ''
        });
      }
    }
  }
  return grouped;
}

// 2c. Validate credentials for a required role (detecting MISSING, SINGLE, or AMBIGUOUS)
function validateCredentialsForRole(env, targetRole) {
  const cleanRole = (targetRole || '').trim().toUpperCase();
  const grouped = getDetailedCredentialsFromEnv(env);

  let matchingKeys = [cleanRole];
  if (cleanRole === 'CS' || cleanRole === 'AGENT') matchingKeys = ['CS', 'AGENT'];
  if (cleanRole === 'OWNER') matchingKeys = ['OWNER'];
  if (cleanRole === 'ADMIN') matchingKeys = ['ADMIN'];

  let matched = [];
  for (const k of matchingKeys) {
    if (grouped[k]) matched = matched.concat(grouped[k]);
  }

  if (matched.length === 0) {
    return {
      status: 'MISSING',
      role: targetRole,
      message: `Kredensial untuk role "${targetRole}" tidak ditemukan di file .env. Mohon tambahkan USER_${cleanRole}_<NAME> dan PASS_${cleanRole}_<NAME>.`
    };
  }

  if (matched.length > 1) {
    return {
      status: 'AMBIGUOUS',
      role: targetRole,
      candidates: matched,
      message: `Ditemukan ${matched.length} kredensial untuk role "${targetRole}" di .env: ${matched.map(m => m.key).join(', ')}.`
    };
  }

  return {
    status: 'OK',
    role: targetRole,
    credential: matched[0]
  };
}

// 3. Discover URL variables from .env
function discoverUrlVariables(env) {
  const urlVars = [];
  for (const [key, val] of Object.entries(env)) {
    if (/(?:URL|HOST|DOMAIN|STAGING|ENDPOINT)/i.test(key) && /^https?:\/\//i.test(val)) {
      urlVars.push({ key, value: val });
    }
  }
  return urlVars;
}

// 4. Check runtime dependencies (Playwright & python-docx)
function checkRuntimeDependencies() {
  const missing = [];
  try {
    require.resolve('playwright');
  } catch (e) {
    missing.push({ type: 'npm', name: 'playwright', fix: 'npm install' });
  }
  try {
    execSync('python3 -c "import docx"', { stdio: 'ignore' });
  } catch (e) {
    missing.push({ type: 'python', name: 'python-docx', fix: 'pip install -r requirements.txt' });
  }
  return {
    ok: missing.length === 0,
    missing
  };
}

// 5. Create run directory
function createRunDir(featureName = 'test') {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const cleanFeature = featureName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const runId = `run_${cleanFeature}_${timestamp}`;
  const runDir = path.join(AUTOMATE_RESULT_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });
  return { runId, runDir, timestamp };
}

// 6. Cross-platform Multi-Path Chrome Executable Discovery
function findChromeExecutable() {
  if (process.platform === 'darwin') {
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(process.env.HOME || '', 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p;
    }
    return 'google-chrome';
  } else if (process.platform === 'win32') {
    const winPaths = [
      path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMW6432'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe')
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) return p;
    }
    return 'chrome.exe';
  } else {
    // Linux
    const linuxPaths = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
    return 'google-chrome';
  }
}

async function checkCDPAlive() {
  try {
    const res = await fetch(`${CDP_URL}/json/version`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

// 7. Get all open browser page tabs via CDP
async function getOpenBrowserTabs() {
  try {
    const res = await fetch(`${CDP_URL}/json`).catch(() => null);
    if (!res || !res.ok) return [];
    const targets = await res.json();
    return targets.filter(t => t.type === 'page' && !t.url.startsWith('chrome-extension://'));
  } catch (e) {
    return [];
  }
}

async function ensureBrowserOpen(targetUrl = null) {
  if (await checkCDPAlive()) {
    console.log(`\x1b[32m[BROWSER] Chrome dengan port remote debugging (${CDP_URL}) sudah aktif.\x1b[0m`);
    return;
  }

  console.log(`\x1b[33m[BROWSER] Chrome port 9222 belum aktif. Membuka Google Chrome QA otomatis...\x1b[0m`);
  const chromeAppPath = findChromeExecutable();
  const profileDir = path.join(process.env.HOME || process.env.USERPROFILE, 'chrome-qa-profile');

  const args = [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--start-maximized'
  ];
  if (targetUrl) {
    args.push(targetUrl);
  }

  const proc = spawn(chromeAppPath, args, {
    detached: true,
    stdio: 'ignore'
  });
  proc.unref();

  const start = Date.now();
  while (Date.now() - start < 15000) {
    await new Promise(r => setTimeout(r, 600));
    if (await checkCDPAlive()) {
      console.log(`\x1b[32m[BROWSER] Google Chrome QA berhasil diluncurkan dan port 9222 siap!\x1b[0m`);
      await fetch(`${CDP_URL}/json/new`, { method: 'PUT' }).catch(() => {});
      return;
    }
  }
  throw new Error(`Gagal meluncurkan Chrome pada port 9222 dalam 15 detik. Pastikan executable Chrome terpasang di sistem (${chromeAppPath}).`);
}

async function closeBrowser() {
  try {
    const res = await fetch(`${CDP_URL}/json/version`).catch(() => null);
    if (!res || !res.ok) {
      console.log(`[BROWSER] Chrome sudah dalam keadaan tertutup.`);
      return;
    }
    const data = await res.json();
    if (!data.webSocketDebuggerUrl) return;

    await new Promise(resolve => {
      const ws = new WebSocket(data.webSocketDebuggerUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      };
      ws.onmessage = () => {
        ws.close();
        resolve();
      };
      ws.onerror = () => resolve();
      setTimeout(resolve, 3000);
    });
    console.log(`\x1b[32m[BROWSER] Browser Chrome QA berhasil ditutup otomatis.\x1b[0m`);
  } catch (e) {
    console.error(`[BROWSER] Gagal menutup browser:`, e.message);
  }
}

async function connectBrowser() {
  try {
    await ensureBrowserOpen();
    const res = await fetch(`${CDP_URL}/json`).catch(() => null);
    if (res && res.ok) {
      const targets = await res.json();
      const hasPage = targets.some(t => t.type === 'page');
      if (!hasPage) {
        await fetch(`${CDP_URL}/json/new`, { method: 'PUT' }).catch(() => {});
      }
    }
    const browser = await chromium.connectOverCDP(CDP_URL);
    return browser;
  } catch (err) {
    console.error(`\x1b[31m[ERROR] Cannot connect to Chrome on ${CDP_URL}.\x1b[0m`);
    throw err;
  }
}

module.exports = {
  PROJECT_ROOT,
  ENV_PATH,
  AUTOMATE_RESULT_DIR,
  CDP_URL,
  parseEnv,
  getRolesFromEnv,
  getDetailedCredentialsFromEnv,
  validateCredentialsForRole,
  discoverUrlVariables,
  checkRuntimeDependencies,
  findChromeExecutable,
  getOpenBrowserTabs,
  createRunDir,
  checkCDPAlive,
  ensureBrowserOpen,
  closeBrowser,
  connectBrowser
};
