/**
 * Browser Bridge for PRD Analyzer & QA Automation
 * Connects directly to Google Chrome running with remote debugging port 9222 (CDP)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CDP_PORT = process.env.CDP_PORT || '9222';
const CDP_URL = `http://localhost:${CDP_PORT}`;

const { spawn } = require('child_process');

async function checkCDPAlive() {
  try {
    const res = await fetch(`${CDP_URL}/json/version`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function ensureBrowserOpen() {
  if (await checkCDPAlive()) return;

  console.log(`\x1b[33m[BROWSER] Chrome port ${CDP_PORT} belum aktif. Meluncurkan Chrome QA otomatis...\x1b[0m`);
  const chromeAppPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const profileDir = path.join(process.env.HOME, 'chrome-qa-profile');

  const proc = spawn(chromeAppPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`
  ], {
    detached: true,
    stdio: 'ignore'
  });
  proc.unref();

  const start = Date.now();
  while (Date.now() - start < 12000) {
    await new Promise(r => setTimeout(r, 600));
    if (await checkCDPAlive()) {
      console.log(`\x1b[32m[BROWSER] Chrome QA berhasil diluncurkan dan port ${CDP_PORT} siap!\x1b[0m`);
      await fetch(`${CDP_URL}/json/new`, { method: 'PUT' }).catch(() => {});
      return;
    }
  }
  throw new Error(`Gagal meluncurkan Chrome pada port ${CDP_PORT} dalam 12 detik.`);
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
    console.log(`\x1b[32m[BROWSER] Browser Chrome QA berhasil ditutup bersih.\x1b[0m`);
  } catch (e) {
    console.error(`[BROWSER] Error closing browser:`, e.message);
  }
}

async function getBrowser() {
  try {
    await ensureBrowserOpen();
    // Self-healing: Pastikan minimal ada 1 target tab halaman yang aktif
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
    console.error(`\x1b[31m[ERROR] Could not connect to Chrome on ${CDP_URL}: ${err.message}\x1b[0m\n`);
    throw err;
  }
}

async function getTargetPage(browser, target = '0') {
  const contexts = browser.contexts();
  let allPages = [];
  for (const ctx of contexts) {
    allPages = allPages.concat(ctx.pages());
  }

  if (allPages.length === 0) {
    throw new Error('Tidak ada tab halaman (page) yang terbuka di Chrome.');
  }

  // If target is a number index
  const numIndex = parseInt(target, 10);
  if (!isNaN(numIndex) && numIndex >= 0 && numIndex < allPages.length) {
    return allPages[numIndex];
  }

  // If target is a URL substring or Title substring
  const found = allPages.find(p => p.url().includes(target) || (p.title() && p.title().toLowerCase().includes(target.toLowerCase())));
  if (found) {
    return found;
  }

  // Default to the first page
  return allPages[0];
}

async function listTabs() {
  const browser = await getBrowser();
  const contexts = browser.contexts();
  let index = 0;
  console.log(`\n\x1b[32m=== DAFTAR TAB CHROME AKTIF (${CDP_URL}) ===\x1b[0m\n`);
  for (const ctx of contexts) {
    for (const page of ctx.pages()) {
      const title = await page.title();
      const url = page.url();
      console.log(`[\x1b[36m${index}\x1b[0m] \x1b[1m${title || '(Tanpa Judul)'}\x1b[0m`);
      console.log(`    URL: ${url}`);
      index++;
    }
  }
  console.log('');
  await browser.close();
}

async function inspectPage(target = '0') {
  const browser = await getBrowser();
  const page = await getTargetPage(browser, target);

  console.log(`\n\x1b[32m=== MENGINSPEKSI TAB: ${await page.title()} ===\x1b[0m`);
  console.log(`URL: ${page.url()}\n`);

  const pageInfo = await page.evaluate(() => {
    // 1. Headings
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map(h => ({ level: h.tagName.toLowerCase(), text: h.innerText.trim() }))
      .filter(h => h.text.length > 0)
      .slice(0, 15);

    // 2. Navigation items
    const navItems = Array.from(document.querySelectorAll('nav a, aside a, [role="navigation"] a, .sidebar a, .menu-item, [role="menuitem"]'))
      .map(el => ({ text: el.innerText.trim(), href: el.getAttribute('href') || '' }))
      .filter(el => el.text.length > 0 && el.text.length < 50)
      .slice(0, 25);

    // 3. Buttons & CTAs
    const buttons = Array.from(document.querySelectorAll('button, a.btn, a[class*="button"], [role="button"], input[type="button"], input[type="submit"]'))
      .map(b => {
        const rect = b.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(b).visibility !== 'hidden';
        return {
          text: (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().replace(/\n+/g, ' '),
          id: b.id || '',
          role: b.getAttribute('role') || 'button',
          ariaLabel: b.getAttribute('aria-label') || '',
          disabled: b.disabled || b.getAttribute('aria-disabled') === 'true',
          classes: b.className && typeof b.className === 'string' ? b.className.split(' ').slice(0, 3).join(' ') : '',
          visible: isVisible
        };
      })
      .filter(b => b.visible && b.text.length > 0 && b.text.length < 60)
      .slice(0, 30);

    // 4. Form inputs
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'))
      .map(inp => {
        const rect = inp.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        let labelText = '';
        if (inp.id) {
          const lbl = document.querySelector(`label[for="${inp.id}"]`);
          if (lbl) labelText = lbl.innerText.trim();
        }
        if (!labelText && inp.closest('label')) {
          labelText = inp.closest('label').innerText.trim();
        }
        return {
          tag: inp.tagName.toLowerCase(),
          type: inp.type || 'text',
          name: inp.name || '',
          id: inp.id || '',
          placeholder: inp.placeholder || '',
          label: labelText,
          required: inp.required || inp.getAttribute('aria-required') === 'true',
          disabled: inp.disabled,
          value: inp.value ? (inp.type === 'password' ? '***' : inp.value) : '',
          visible: isVisible
        };
      })
      .filter(inp => inp.visible)
      .slice(0, 30);

    // 5. Active Modals / Drawers
    const modals = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal.show, .drawer, [class*="modal-open"], [class*="drawer-open"]'))
      .map(m => ({
        title: (m.querySelector('h1, h2, h3, .modal-title, [class*="title"]') || {}).innerText || 'Unnamed Modal',
        visible: m.getBoundingClientRect().width > 0
      }))
      .filter(m => m.visible);

    return {
      title: document.title,
      headings,
      navItems,
      buttons,
      inputs,
      modals
    };
  });

  console.log('📌 \x1b[1mSTRUKTUR HEADINGS:\x1b[0m');
  if (pageInfo.headings.length === 0) console.log('   (Tidak ada)');
  pageInfo.headings.forEach(h => console.log(`   [${h.level.toUpperCase()}] ${h.text}`));

  console.log('\n📌 \x1b[1mNAVIGASI / MENU:\x1b[0m');
  if (pageInfo.navItems.length === 0) console.log('   (Tidak ada)');
  pageInfo.navItems.forEach(n => console.log(`   - ${n.text} ${n.href ? `(${n.href})` : ''}`));

  console.log('\n📌 \x1b[1mDAFTAR TOMBOL & CTA AKTIF:\x1b[0m');
  if (pageInfo.buttons.length === 0) console.log('   (Tidak ada)');
  pageInfo.buttons.forEach((b, i) => {
    const disabledBadge = b.disabled ? ' \x1b[31m[DISABLED]\x1b[0m' : ' \x1b[32m[ENABLED]\x1b[0m';
    const idBadge = b.id ? ` ID: #${b.id}` : '';
    console.log(`   ${i + 1}. "${b.text}"${disabledBadge}${idBadge}`);
  });

  console.log('\n📌 \x1b[1mFORM FIELDS & INPUT:\x1b[0m');
  if (pageInfo.inputs.length === 0) console.log('   (Tidak ada)');
  pageInfo.inputs.forEach((inp, i) => {
    const reqBadge = inp.required ? ' \x1b[33m*Required*\x1b[0m' : '';
    const labelStr = inp.label ? `[Label: "${inp.label}"] ` : '';
    const nameStr = inp.name ? `name="${inp.name}" ` : (inp.id ? `id="${inp.id}" ` : '');
    const phStr = inp.placeholder ? `placeholder="${inp.placeholder}"` : '';
    console.log(`   ${i + 1}. ${inp.tag.toUpperCase()} (${inp.type}) ${labelStr}${nameStr}${phStr}${reqBadge}`);
  });

  if (pageInfo.modals.length > 0) {
    console.log('\n📌 \x1b[1mMODAL / DRAWER AKTIF:\x1b[0m');
    pageInfo.modals.forEach(m => console.log(`   - Modal: ${m.title}`));
  }

  console.log('');
  await browser.close();
  return pageInfo;
}

async function takeScreenshot(target = '0', outputFilename = 'browser_snapshot.png') {
  const browser = await getBrowser();
  const page = await getTargetPage(browser, target);

  const outDir = path.resolve(__dirname, '../result-testcase/browser_inspections');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const cleanFilename = outputFilename.endsWith('.png') ? outputFilename : `${outputFilename}.png`;
  const fullPath = path.join(outDir, cleanFilename);

  await page.screenshot({ path: fullPath, fullPage: false });
  console.log(`\n\x1b[32m[SUCCESS] Screenshot tersimpan di:\x1b[0m ${fullPath}\n`);
  await browser.close();
  return fullPath;
}

async function navigatePage(target = '0', targetUrl) {
  if (!targetUrl) {
    console.error('Harap berikan URL tujuan.');
    return;
  }
  const browser = await getBrowser();
  const page = await getTargetPage(browser, target);
  console.log(`Navigasi ke: ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(`Selesai! Judul baru: ${await page.title()}`);
  await browser.close();
}

async function runSteps(stepsJsonPath) {
  const browser = await getBrowser();
  const page = await getTargetPage(browser, '0');

  const content = fs.readFileSync(path.resolve(stepsJsonPath), 'utf-8');
  const plan = JSON.parse(content);

  console.log(`\n\x1b[32m=== MENJALANKAN TEST SUITE: ${plan.suiteName || 'Curated Suite'} ===\x1b[0m\n`);

  for (let i = 0; i < plan.steps.length; i++) {
    const s = plan.steps[i];
    console.log(`Step ${i + 1}: \x1b[1m${s.description || s.action}\x1b[0m`);
    try {
      if (s.action === 'navigate') {
        await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } else if (s.action === 'click') {
        if (s.selector) {
          await page.click(s.selector, { timeout: 10000 });
        } else if (s.text) {
          await page.getByRole('button', { name: s.text }).click({ timeout: 10000 });
        }
      } else if (s.action === 'fill') {
        await page.fill(s.selector, s.value, { timeout: 10000 });
      } else if (s.action === 'assertVisible') {
        await page.waitForSelector(s.selector, { state: 'visible', timeout: 10000 });
        console.log(`   \x1b[32m✔ Assert PASS: Element ${s.selector} terlihat\x1b[0m`);
      } else if (s.action === 'assertText') {
        const text = await page.innerText(s.selector);
        if (!text.includes(s.expectedText)) {
          throw new Error(`Expected text "${s.expectedText}" not found in "${text}"`);
        }
        console.log(`   \x1b[32m✔ Assert PASS: Text "${s.expectedText}" cocok\x1b[0m`);
      } else if (s.action === 'wait') {
        await page.waitForTimeout(s.duration || 1000);
      } else if (s.action === 'screenshot') {
        await takeScreenshot('0', s.filename || `step_${i + 1}.png`);
      }
      console.log(`   \x1b[32mStatus: PASSED\x1b[0m\n`);
    } catch (err) {
      console.error(`   \x1b[31mStatus: FAILED -> ${err.message}\x1b[0m\n`);
      // Take failure screenshot automatically
      const failFile = `failure_step_${i + 1}.png`;
      await takeScreenshot('0', failFile);
      if (s.stopOnFailure !== false) {
        console.error(`[HALT] Pengujian dihentikan pada step ${i + 1} karena kegagalan.`);
        break;
      }
    }
  }

  await browser.close();
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';

  try {
    if (command === 'list') {
      await listTabs();
    } else if (command === 'inspect') {
      await inspectPage(args[1] || '0');
    } else if (command === 'screenshot') {
      await takeScreenshot(args[1] || '0', args[2] || 'browser_snapshot.png');
    } else if (command === 'navigate') {
      await navigatePage(args[1] || '0', args[2]);
    } else if (command === 'run') {
      if (!args[1]) {
        console.error('Harap berikan path ke file JSON langkah pengujian (contoh: node scripts/browser_bridge.js run steps.json)');
        process.exit(1);
      }
      await runSteps(args[1]);
    } else {
      console.log(`
Perintah yang tersedia:
  node scripts/browser_bridge.js list
  node scripts/browser_bridge.js inspect [tabIndex]
  node scripts/browser_bridge.js screenshot [tabIndex] [outputFilename]
  node scripts/browser_bridge.js navigate [tabIndex] [url]
  node scripts/browser_bridge.js run [path/to/steps.json]
      `);
    }
  } catch (err) {
    process.exit(1);
  }
}

main();
