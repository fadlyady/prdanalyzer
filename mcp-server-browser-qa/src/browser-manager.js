/**
 * Browser Lifecycle & Automation Manager
 * Interfaces with Google Chrome via Chrome DevTools Protocol (CDP port 9222)
 * using Playwright, handling cross-platform discovery, tab protection, and evidence capture.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

export class BrowserManager {
  constructor(options = {}) {
    this.cdpPort = options.cdpPort || 9222;
    this.cdpUrl = `http://localhost:${this.cdpPort}`;
    this.browser = null;
    this.context = null;
    this.activePage = null;
    this.evidenceDir = null;
    this.chromeProcess = null;
  }

  async isCdpAlive() {
    try {
      const res = await fetch(`${this.cdpUrl}/json/version`, { signal: AbortSignal.timeout(1500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getOpenTabs() {
    try {
      const res = await fetch(`${this.cdpUrl}/json/list`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return [];
      const tabs = await res.json();
      return tabs
        .filter(t => t.type === 'page' && !t.url.startsWith('chrome-extension://'))
        .map(t => ({
          id: t.id,
          title: t.title || 'Untitled',
          url: t.url,
          webSocketDebuggerUrl: t.webSocketDebuggerUrl
        }));
    } catch {
      return [];
    }
  }

  findChromeExecutable() {
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

  async launchChrome(targetUrl = 'about:blank') {
    const isAlive = await this.isCdpAlive();
    if (isAlive) {
      return { launched: false, message: `Chrome CDP sudah aktif pada port ${this.cdpPort}` };
    }

    const chromePath = this.findChromeExecutable();
    const tempProfileDir = path.join(os.homedir() || os.tmpdir(), '.chrome-qa-mcp-profile');
    if (!fs.existsSync(tempProfileDir)) {
      fs.mkdirSync(tempProfileDir, { recursive: true });
    }

    const args = [
      `--remote-debugging-port=${this.cdpPort}`,
      '--start-maximized',
      `--user-data-dir=${tempProfileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      targetUrl
    ];

    this.chromeProcess = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore'
    });
    this.chromeProcess.unref();

    // Poll until CDP is available (up to 10 seconds)
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await this.isCdpAlive()) {
        return { launched: true, message: `Chrome berhasil diluncurkan pada port ${this.cdpPort}` };
      }
    }

    throw new Error(`Gagal mendeteksi Chrome CDP pada port ${this.cdpPort} setelah 10 detik peluncuran.`);
  }

  async connect(targetUrl = null, tabId = null) {
    if (!this.browser) {
      this.browser = await chromium.connectOverCDP(this.cdpUrl);
    }

    const contexts = this.browser.contexts();
    this.context = contexts.length > 0 ? contexts[0] : await this.browser.newContext({ viewport: null });

    const pages = this.context.pages();

    if (tabId) {
      // Find page matching tabId
      for (const p of pages) {
        if (p.url().includes(tabId)) {
          this.activePage = p;
          break;
        }
      }
    }

    if (!this.activePage) {
      this.activePage = pages.length > 0 ? pages[0] : await this.context.newPage();
    }

    if (targetUrl && this.activePage.url() === 'about:blank') {
      await this.activePage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    return {
      connected: true,
      currentUrl: this.activePage.url(),
      title: await this.activePage.title()
    };
  }

  async cleanExtraTabs() {
    if (!this.context) return;
    const pages = this.context.pages();
    for (const p of pages) {
      if (p !== this.activePage && !p.isClosed()) {
        await p.close().catch(() => {});
      }
    }
  }

  async resetSession() {
    if (!this.context || !this.activePage) return;
    try {
      await this.context.clearCookies();
      await this.activePage.evaluate(() => {
        try { localStorage.clear(); } catch(e) {}
        try { sessionStorage.clear(); } catch(e) {}
      });
      return { success: true, message: 'Cookies dan Web Storage berhasil dibersihkan.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  setEvidenceDirectory(runFeatureName, projectRoot) {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
    const targetBase = path.join(projectRoot, 'browser-execution', 'automate-result');
    const folderName = `run_${runFeatureName || 'test'}_${timestamp}`;
    this.evidenceDir = path.join(targetBase, folderName);
    if (!fs.existsSync(this.evidenceDir)) {
      fs.mkdirSync(this.evidenceDir, { recursive: true });
    }
    return this.evidenceDir;
  }

  async captureScreenshot(name = 'step') {
    if (!this.activePage || this.activePage.isClosed()) return null;
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}.png`;
    const fullPath = this.evidenceDir
      ? path.join(this.evidenceDir, filename)
      : path.join(os.tmpdir(), filename);

    await this.activePage.screenshot({ path: fullPath, fullPage: false });
    return fullPath;
  }

  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {}
      this.browser = null;
      this.context = null;
      this.activePage = null;
    }
    return { closed: true };
  }
}
