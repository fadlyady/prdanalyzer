/**
 * Dynamic Multi-Tier Menu Structure & CTA Crawler for PRD Analyzer & QA Workflows
 * 
 * Capabilities:
 * - Reads .env and discovers all USER_OWNER_<NAME> credentials
 * - Strictly enforces Multi-Owner Resolution Gate (lists candidates if >1, validates if 0)
 * - Connects to Google Chrome via CDP (Port 9222) using persistent QA profile
 * - Auto-detects login session; logs in with Owner credentials if needed
 * - Provides Human Handshake Gate for OTP / 2FA / CAPTCHA
 * - [STRICT SIDEBAR SCOPING] Auto-expands ONLY menu accordions inside sidebar (zero mutation risks)
 * - [UNIVERSAL SUBMENU RESOLUTION] Resolves span[role="link"], a[href], and button sub-items
 * - [DEEP SEQUENTIAL TRAVERSAL] Clicks each submenu, waits for page load, extracts full CTA/input catalog
 * - Writes Dual-Format Output: Hierarchical JSON and Markdown to ./strukturmenu/<app-name>/
 * - Performs Comparative UI Drift Analysis (Diffing new visit vs previous visit)
 * - Updates latest.json and latest.md pointers
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../');
const STRUKTUR_MENU_DIR = path.join(PROJECT_ROOT, 'strukturmenu');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const CDP_PORT = process.env.CDP_PORT || '9222';
const CDP_URL = process.env.CDP_URL || `http://localhost:${CDP_PORT}`;

// 1. Parse .env and find all owner credentials
function getOwnerCredentials() {
  if (!fs.existsSync(ENV_PATH)) return { owners: {}, rawEnv: {} };
  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  const rawEnv = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [k, ...v] = trimmed.split('=');
    if (k && v.length) rawEnv[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });

  const owners = {};
  for (const [key, val] of Object.entries(rawEnv)) {
    if (key.startsWith('USER_OWNER_')) {
      const appSuffix = key.replace('USER_OWNER_', '');
      const passKey = `PASS_OWNER_${appSuffix}`;
      owners[appSuffix] = {
        key: appSuffix,
        usernameVar: key,
        username: val,
        passwordVar: passKey,
        password: rawEnv[passKey] || ''
      };
    }
  }

  return { owners, rawEnv };
}

// 2. Browser lifecycle functions
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
  const chromeAppPath = process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : (process.platform === 'win32'
      ? process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
      : 'google-chrome');

  const profileDir = path.join(process.env.HOME || process.env.USERPROFILE, 'chrome-qa-profile');

  const proc = spawn(chromeAppPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`
  ], {
    detached: true,
    stdio: 'ignore'
  });
  proc.unref();

  const start = Date.now();
  while (Date.now() - start < 15000) {
    await new Promise(r => setTimeout(r, 600));
    if (await checkCDPAlive()) {
      console.log(`\x1b[32m[BROWSER] Google Chrome QA berhasil diluncurkan pada port ${CDP_PORT}!\x1b[0m`);
      await fetch(`${CDP_URL}/json/new`, { method: 'PUT' }).catch(() => {});
      return;
    }
  }
  throw new Error(`Gagal meluncurkan Chrome pada port ${CDP_PORT} dalam 15 detik.`);
}

async function getBrowser() {
  await ensureBrowserOpen();
  const res = await fetch(`${CDP_URL}/json`).catch(() => null);
  if (res && res.ok) {
    const targets = await res.json();
    if (!targets.some(t => t.type === 'page')) {
      await fetch(`${CDP_URL}/json/new`, { method: 'PUT' }).catch(() => {});
    }
  }
  return await chromium.connectOverCDP(CDP_URL);
}

// 3. Auto-expand all closed collapsible menu accordions STRICTLY in sidebar
function getSidebarLocator(page) {
  return page.locator('[data-sidebar="sidebar"], aside, nav, [data-sidebar="group"]').first();
}

async function expandAllMenuAccordions(page) {
  try {
    const titles = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"]') || document.querySelector('aside');
      if (!sidebar) return [];
      // Select collapsible buttons that are currently closed
      const closed = sidebar.querySelectorAll('[data-sidebar="menu-item"][data-state="closed"] button, button[data-state="closed"], [data-sidebar="menu-button"][data-state="closed"]');
      const expanded = [];
      closed.forEach(b => {
        const text = b.innerText.trim();
        if (text) expanded.push(text);
        b.click();
      });
      return expanded;
    });
    if (titles && titles.length > 0) {
      console.log(`\x1b[34m[AUTO-EXPAND] Membuka ${titles.length} menu accordion: ${titles.join(', ')}\x1b[0m`);
      await page.waitForTimeout(600);
    }
  } catch (err) {
    console.warn(`[WARN] Auto-expand warning: ${err.message}`);
  }
}

// 4. Extract entire Hierarchical Menu Tree (Group-Aware & Universal Element Resolution)
async function extractHierarchicalTree(page) {
  await expandAllMenuAccordions(page);

  return await page.evaluate(() => {
    const sidebar = document.querySelector('[data-sidebar="sidebar"]') || document.querySelector('aside') || document.querySelector('nav');
    if (!sidebar) return [];

    const tree = [];
    const groups = sidebar.querySelectorAll('[data-sidebar="group"]');

    // Helper to add unique item
    const addItem = (item) => {
      const exists = tree.some(t => t.group === item.group && t.parent === item.parent && t.title === item.title);
      if (!exists) tree.push(item);
    };

    groups.forEach(g => {
      const labelEl = g.querySelector('[data-sidebar="group-label"]');
      const groupName = labelEl ? labelEl.innerText.trim() : 'UMUM';

      const items = g.querySelectorAll('[data-sidebar="menu-item"]');
      items.forEach(item => {
        // Find main trigger / button / link / span
        const trigger = item.querySelector('button, [data-sidebar="menu-button"], [class*="menu-button"], a, span[role="link"]');
        if (!trigger) return;

        const rawText = trigger.innerText.trim().replace(/\n+/g, ' ');
        const badge = rawText.includes('Beta') ? 'Beta' : null;
        const title = rawText.replace(/\s*Beta\s*$/, '').trim();
        const href = trigger.getAttribute('href') || (trigger.tagName === 'A' ? trigger.href : '');
        const isCollapsible = trigger.tagName === 'BUTTON' && (trigger.hasAttribute('data-state') || item.querySelector('[data-sidebar="menu-sub"]'));

        if (isCollapsible) {
          // Find submenus inside menu-sub
          const subContainer = item.querySelector('[data-sidebar="menu-sub"]');
          const subItems = [];
          if (subContainer) {
            // In shadcn, click handlers are on span[role="link"], a, or button
            const subLinks = subContainer.querySelectorAll('span[role="link"], a, [data-sidebar="menu-sub-button"], button');
            subLinks.forEach(sub => {
              const subText = sub.innerText.trim().replace(/\n+/g, ' ');
              const subHref = sub.getAttribute('href') || (sub.tagName === 'A' ? sub.href : '');
              if (subText && !subItems.some(s => s.title === subText)) {
                subItems.push({
                  group: groupName,
                  parent: title,
                  title: subText,
                  badge: null,
                  href: subHref,
                  type: 'submenu'
                });
              }
            });
          }

          if (subItems.length > 0) {
            subItems.forEach(s => addItem(s));
          } else {
            addItem({
              group: groupName,
              parent: null,
              title,
              badge,
              href,
              type: 'collapsible-parent-empty'
            });
          }
        } else {
          addItem({
            group: groupName,
            parent: null,
            title,
            badge,
            href,
            type: trigger.tagName === 'A' ? 'direct-link' : 'menu-link'
          });
        }
      });
    });

    // Check prominent standalone action buttons inside sidebar (e.g. "Kirim broadcast")
    const actionButtons = sidebar.querySelectorAll('div.px-6 button, [data-sidebar="action"], [data-sidebar="content"] > div > button');
    actionButtons.forEach(btn => {
      const text = btn.innerText.trim().replace(/\n+/g, ' ');
      if (text && !tree.some(t => t.title === text)) {
        addItem({
          group: 'AKSI SIDEBAR',
          parent: null,
          title: text,
          badge: null,
          href: '',
          type: 'sidebar-action-cta'
        });
      }
    });

    return tree;
  });
}

// 5. Inspect single page structure (Headings, Breadcrumbs, CTAs, Inputs)
async function extractPageStructure(page) {
  return await page.evaluate(() => {
    const heading = (document.querySelector('h1, h2, .page-title, [class*="title"]') || {}).innerText || '';

    const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb, [aria-label*="breadcrumb" i], nav[aria-label="Breadcrumb"] a, nav[aria-label="Breadcrumb"] li'))
      .map(b => b.innerText.trim()).filter(Boolean);

    const btnSelectors = 'button, a.btn, a[class*="button"], [role="button"], input[type="button"], input[type="submit"]';
    const buttons = Array.from(document.querySelectorAll(btnSelectors))
      .map(b => {
        // Exclude only the main navigation menu items themselves
        if (b.getAttribute('data-sidebar') === 'menu-button' || b.closest('[data-sidebar="menu-sub"]')) return null;

        const rect = b.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(b).visibility !== 'hidden';
        const text = (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().replace(/\n+/g, ' ');
        const disabled = b.disabled || b.getAttribute('aria-disabled') === 'true';
        const type = b.getAttribute('type') || 'button';
        const isMutation = /submit|delete|hapus|simpan|save|bayar|transfer|kirim|broadcast/i.test(text) || type === 'submit';

        let selector = '';
        if (b.id) selector = `#${b.id}`;
        else if (b.getAttribute('data-testid')) selector = `[data-testid="${b.getAttribute('data-testid')}"]`;
        else if (b.getAttribute('name')) selector = `button[name="${b.getAttribute('name')}"]`;
        else selector = `button:has-text("${text.slice(0, 30)}")`;

        return {
          text,
          selector,
          id: b.id || '',
          type,
          disabled,
          isMutation,
          visible: isVisible
        };
      })
      .filter(b => b && b.visible && b.text.length > 0 && b.text.length < 60 && !['Toggle Sidebar', '10'].includes(b.text));

    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'))
      .map(inp => {
        if (inp.closest('[data-sidebar="sidebar"]') || inp.closest('aside')) return null;
        const rect = inp.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        let label = '';
        if (inp.id) {
          const l = document.querySelector(`label[for="${inp.id}"]`);
          if (l) label = l.innerText.trim();
        }
        if (!label && inp.closest('label')) label = inp.closest('label').innerText.trim();

        return {
          tag: inp.tagName.toLowerCase(),
          type: inp.type || 'text',
          name: inp.name || '',
          id: inp.id || '',
          placeholder: inp.placeholder || '',
          label,
          required: inp.required || inp.getAttribute('aria-required') === 'true',
          disabled: inp.disabled,
          visible: isVisible
        };
      })
      .filter(inp => inp && inp.visible);

    const modals = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal.show, .drawer, [class*="modal-open"], [class*="drawer-open"]'))
      .map(m => {
        const titleEl = m.querySelector('h1, h2, h3, .modal-title, [class*="title"]');
        return {
          title: titleEl ? titleEl.innerText.trim() : 'Active Modal/Drawer',
          visible: m.getBoundingClientRect().width > 0
        };
      })
      .filter(m => m.visible);

    return {
      heading: heading.trim(),
      title: document.title,
      url: window.location.href,
      path: window.location.pathname,
      breadcrumbs,
      buttons,
      inputs,
      modals
    };
  });
}

// 5b. Deep Interactive In-Page Exploration (Popovers, Table Row Actions, Drawers & Nested Creation Forms)
async function extractDeepPageFeatures(page, basePageUrl) {
  const deepFeatures = {
    popoverActions: [],
    rowActions: [],
    drawers: []
  };

  try {
    // 1. Popover Action CTAs (e.g. "Kirim broadcast" on page content)
    const kirimBtn = page.locator('main button:has-text("Kirim broadcast"), div.flex button:has-text("Kirim broadcast")').first();
    if (await kirimBtn.count() > 0 && await kirimBtn.isVisible()) {
      await kirimBtn.click();
      await page.waitForTimeout(600);
      const popoverOptions = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]');
        if (!dialog) return [];
        return Array.from(dialog.querySelectorAll('button, a')).map(b => b.innerText.trim()).filter(Boolean);
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      for (const opt of popoverOptions) {
        try {
          await kirimBtn.click();
          await page.waitForTimeout(500);
          const optEl = page.locator(`[role="dialog"] button:has-text("${opt}"), [role="dialog"] a:has-text("${opt}")`).first();
          if (await optEl.count() > 0) {
            await optEl.click();
            await page.waitForTimeout(2000);
            const subPageStruct = await extractPageStructure(page);
            deepFeatures.popoverActions.push({
              trigger: 'Kirim broadcast',
              optionName: opt,
              url: page.url(),
              path: new URL(page.url()).pathname,
              title: subPageStruct.title,
              heading: subPageStruct.heading,
              buttons: subPageStruct.buttons || [],
              inputs: subPageStruct.inputs || []
            });
            await page.goto(basePageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(1500);
          }
        } catch (e) {
          console.warn(`[WARN] Gagal inspeksi popover ${opt}: ${e.message}`);
          await page.goto(basePageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(1500);
        }
      }
    }

    // 2. Table Row Actions (Gear Icons & Action Menus)
    const gearBtn = page.locator('table tbody tr td:first-child button[aria-haspopup="dialog"], table tbody tr button:has(svg.text-primary)').first();
    if (await gearBtn.count() > 0 && await gearBtn.isVisible()) {
      await gearBtn.click();
      await page.waitForTimeout(600);
      const gearOptions = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]');
        if (!dialog) return [];
        return Array.from(dialog.querySelectorAll('button, a')).map(b => ({
          text: b.innerText.trim(),
          tag: b.tagName,
          href: b.getAttribute('href')
        })).filter(b => b.text);
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      for (const opt of gearOptions) {
        const isMutation = /hapus|delete|aktifkan|deactivate/i.test(opt.text);
        let subViewData = null;

        if (opt.href && !isMutation) {
          try {
            await gearBtn.click();
            await page.waitForTimeout(500);
            const optEl = page.locator(`[role="dialog"] a:has-text("${opt.text}")`).first();
            if (await optEl.count() > 0) {
              await optEl.click();
              await page.waitForTimeout(2000);
              subViewData = await extractPageStructure(page);
              await page.goto(basePageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
              await page.waitForTimeout(1500);
            }
          } catch (e) {
            console.warn(`[WARN] Gagal inspeksi gear option ${opt.text}: ${e.message}`);
            await page.goto(basePageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(1500);
          }
        }

        deepFeatures.rowActions.push({
          name: opt.text,
          href: opt.href || '',
          tag: opt.tag,
          isMutation,
          subView: subViewData
        });
      }
    }

    // 3. Modal / Drawer / Sub-page Triggers (e.g. Tambah agen, Tambah divisi, Tambah pelanggan, Buat segmentasi baru, Buat label baru, Buat template)
    const addTriggerButtons = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('main button, main a, div.flex button, div.flex a')).filter(b => {
        const text = (b.innerText || '').trim();
        if (!text || text.length > 35) return false;
        return /^(tambah|buat|create|add|import|sync)\s/i.test(text);
      });
      return candidates.map(b => ({
        text: (b.innerText || '').trim(),
        tag: b.tagName,
        href: b.getAttribute('href')
      }));
    });

    for (const trig of addTriggerButtons) {
      if (trig.href && trig.href !== '#' && !trig.href.startsWith('javascript:')) {
        try {
          const link = page.locator(`main a:has-text("${trig.text}"), a[href="${trig.href}"]`).first();
          if (await link.count() > 0 && await link.isVisible()) {
            await link.click();
            await page.waitForTimeout(2000);
            const subPageStruct = await extractPageStructure(page);
            deepFeatures.drawers.push({
              trigger: trig.text,
              type: 'sub-page-form',
              url: page.url(),
              path: new URL(page.url()).pathname,
              title: subPageStruct.title,
              heading: subPageStruct.heading,
              buttons: subPageStruct.buttons || [],
              inputs: subPageStruct.inputs || []
            });
            await page.goto(basePageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(1500);
          }
        } catch (e) {
          console.warn(`[WARN] Gagal inspeksi sub-page form ${trig.text}: ${e.message}`);
          await page.goto(basePageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(1500);
        }
      } else {
        try {
          const btn = page.locator(`main button:has-text("${trig.text}")`).first();
          if (await btn.count() > 0 && await btn.isVisible()) {
            await btn.click();
            await page.waitForTimeout(1000);
            const modalInfo = await page.evaluate(() => {
              const modal = document.querySelector('[role="dialog"], [role="alertdialog"], [class*="drawer"], [class*="sheet"]');
              if (!modal) return null;
              const titleEl = modal.querySelector('h1, h2, h3, [class*="title"]');
              const inputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]), select, textarea')).map(i => ({
                tag: i.tagName.toLowerCase(),
                type: i.type || 'text',
                name: i.name || '',
                placeholder: i.placeholder || '',
                label: i.closest('label')?.innerText.trim() || document.querySelector(`label[for="${i.id}"]`)?.innerText.trim() || ''
              }));
              const buttons = Array.from(modal.querySelectorAll('button, a.btn, [role="button"]')).map(b => ({
                text: (b.innerText || '').trim().replace(/\n+/g, ' '),
                disabled: b.disabled || b.getAttribute('aria-disabled') === 'true',
                isMutation: /submit|delete|hapus|simpan|save|kirim|buat|tambah/i.test(b.innerText || '')
              })).filter(b => b.text && b.text !== 'Close');
              return {
                title: titleEl ? titleEl.innerText.trim() : 'Modal / Drawer Dialog',
                inputs,
                buttons
              };
            });

            if (modalInfo) {
              deepFeatures.drawers.push({
                trigger: trig.text,
                type: 'modal-drawer-form',
                title: modalInfo.title,
                inputs: modalInfo.inputs || [],
                buttons: modalInfo.buttons || []
              });
            }
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
        } catch (e) {
          console.warn(`[WARN] Gagal inspeksi modal drawer ${trig.text}: ${e.message}`);
          await page.keyboard.press('Escape').catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn(`[WARN] Deep feature extraction warning: ${err.message}`);
  }

  return deepFeatures;
}

// 5c. Generate Dedicated Single Menu Markdown Report
function generateSingleMenuMarkdown(menuItem, appName, ownerAccount, timestamp) {
  const itemLabel = menuItem.parent ? `${menuItem.parent} > ${menuItem.title}` : menuItem.title;
  let md = `# Knowledge Struktur Menu: [${menuItem.group}] ${itemLabel}\n\n`;
  md += `> Dokumen ini merupakan hasil deep browser inspection resmi pada aplikasi staging untuk mencegah UI/Contract Drift.\n\n`;
  md += `- **Aplikasi**: \`${appName}\`\n`;
  md += `- **Kategori Grup**: \`[${menuItem.group}]\`\n`;
  md += `- **Menu Induk**: \`${menuItem.parent || '(Root)'}\`\n`;
  md += `- **Nama Menu / Sub-Menu**: \`${menuItem.title}\`${menuItem.badge ? ` \`[${menuItem.badge}]\`` : ''}\n`;
  md += `- **URL Route / Path**: \`${menuItem.path || menuItem.href || menuItem.urlPath || ''}\`\n`;
  md += `- **Akun / Role**: \`${ownerAccount || 'Owner'}\`\n`;
  md += `- **Waktu Inspeksi**: ${timestamp}\n\n`;

  md += `## 1. Tampilan Utama Halaman (Base Page View)\n\n`;
  md += `- **Page Heading**: "${menuItem.heading || menuItem.title}"\n`;
  if (menuItem.breadcrumbs && menuItem.breadcrumbs.length > 0) {
    md += `- **Breadcrumbs**: ${menuItem.breadcrumbs.join(' > ')}\n`;
  }
  md += `- **Total Tombol CTA Ditemukan**: ${(menuItem.buttons || []).length}\n`;
  md += `- **Total Input / Filter Field**: ${(menuItem.inputs || []).length}\n\n`;

  if (menuItem.buttons && menuItem.buttons.length > 0) {
    md += `### 1.1. Katalog Tombol CTA\n\n`;
    md += `| CTA Label | Selector / Rekomendasi | Tipe | State | Aksi Mutasi? |\n`;
    md += `|---|---|:---:|:---:|:---:|\n`;
    menuItem.buttons.forEach(b => {
      const stateBadge = b.disabled ? 'Disabled' : 'Enabled';
      const mutationBadge = b.isMutation ? '**YA (Wajib Izin)**' : 'Safe';
      md += `| **${b.text}** | \`${b.selector}\` | \`${b.type}\` | ${stateBadge} | ${mutationBadge} |\n`;
    });
    md += `\n`;
  }

  if (menuItem.inputs && menuItem.inputs.length > 0) {
    md += `### 1.2. Input & Filter Fields\n\n`;
    menuItem.inputs.forEach((inp, idx) => {
      const reqStr = inp.required ? ' *(Wajib)*' : '';
      const lbl = inp.label ? `[Label: "${inp.label}"] ` : '';
      const ph = inp.placeholder ? `placeholder="${inp.placeholder}"` : '';
      md += `- ${idx + 1}. \`${inp.tag.toUpperCase()}\` (${inp.type}) ${lbl}${ph}${reqStr}\n`;
    });
    md += `\n`;
  }

  // 2. Popover Actions & Forms
  const popovers = menuItem.deepFeatures ? menuItem.deepFeatures.popoverActions : [];
  if (popovers && popovers.length > 0) {
    md += `## 2. Aksi Popover & Form Pembuatan (Tier-2 Sub-Views)\n\n`;
    popovers.forEach((pop, idx) => {
      md += `### 2.${idx + 1}. Opsi CTA: "${pop.optionName}" (Trigger: \`${pop.trigger}\`)\n\n`;
      md += `- **URL Form**: \`${pop.path}\`\n`;
      md += `- **Heading**: "${pop.heading || pop.optionName}"\n\n`;
      if (pop.inputs && pop.inputs.length > 0) {
        md += `**Form Input Fields**:\n`;
        pop.inputs.forEach((inp, iIdx) => {
          const lbl = inp.label ? `[Label: "${inp.label}"] ` : '';
          const ph = inp.placeholder ? `placeholder="${inp.placeholder}"` : '';
          md += `- ${iIdx + 1}. \`${inp.tag.toUpperCase()}\` (${inp.type}) ${lbl}${ph}\n`;
        });
        md += `\n`;
      }
      if (pop.buttons && pop.buttons.length > 0) {
        md += `**Tombol CTA pada Form**:\n`;
        md += `| CTA Label | State | Aksi Mutasi? |\n`;
        md += `|---|:---:|:---:|\n`;
        pop.buttons.forEach(b => {
          const stateBadge = b.disabled ? 'Disabled' : 'Enabled';
          const mutationBadge = b.isMutation ? '**YA (Wajib Izin)**' : 'Safe';
          md += `| **${b.text}** | ${stateBadge} | ${mutationBadge} |\n`;
        });
        md += `\n`;
      }
    });
  }

  // 3. Table Row Actions & Gear Menus
  const rowActions = menuItem.deepFeatures ? menuItem.deepFeatures.rowActions : [];
  if (rowActions && rowActions.length > 0) {
    md += `## 3. Aksi Baris Tabel (Table Row Actions & Gear Icon)\n\n`;
    md += `| Aksi Baris | Tipe | URL Sub-View / Path | Aksi Mutasi? |\n`;
    md += `|---|:---:|---|:---:|\n`;
    rowActions.forEach(ra => {
      const pathStr = ra.href ? `\`${ra.href}\`` : '*(Inline Action / Dialog)*';
      const mutStr = ra.isMutation ? '**YA (Wajib Izin)**' : 'Safe';
      md += `| **${ra.name}** | \`${ra.tag}\` | ${pathStr} | ${mutStr} |\n`;
    });
    md += `\n`;

    rowActions.filter(ra => ra.subView).forEach(ra => {
      md += `### Detail Sub-View Baris: "${ra.name}" (\`${ra.href}\`)\n\n`;
      md += `- **Heading**: "${ra.subView.heading || ra.name}"\n`;
      if (ra.subView.buttons && ra.subView.buttons.length > 0) {
        md += `- **Tombol Aksi**: ${ra.subView.buttons.map(b => `\`${b.text}\``).join(', ')}\n`;
      }
      md += `\n`;
    });
  }

  // 4. Modals & Drawers
  const drawers = menuItem.deepFeatures ? menuItem.deepFeatures.drawers : [];
  if (drawers && drawers.length > 0) {
    md += `## 4. Modal Drawer & Sub-Page Form (Safe-Mode Inspected)\n\n`;
    drawers.forEach((drw, idx) => {
      md += `### 4.${idx + 1}. ${drw.title || drw.heading || 'Drawer Form'} (Trigger: \`${drw.trigger}\`)\n\n`;
      if (drw.url) md += `- **URL Route**: \`${drw.path || drw.url}\`\n`;
      if (drw.inputs && drw.inputs.length > 0) {
        md += `**Input Fields**:\n`;
        drw.inputs.forEach((inp, iIdx) => {
          const lbl = inp.label ? `[Label: "${inp.label}"] ` : '';
          const ph = inp.placeholder ? `placeholder="${inp.placeholder}"` : '';
          md += `- ${iIdx + 1}. \`${inp.tag.toUpperCase()}\` (${inp.type}) ${lbl}${ph}\n`;
        });
        md += `\n`;
      }
      if (drw.buttons && drw.buttons.length > 0) {
        md += `**Tombol CTA**:\n`;
        md += `| CTA Label | State | Aksi Mutasi? |\n`;
        md += `|---|:---:|:---:|\n`;
        drw.buttons.forEach(b => {
          const stateBadge = b.disabled ? 'Disabled' : 'Enabled';
          const mutationBadge = b.isMutation ? '**YA (Wajib Izin)**' : 'Safe';
          md += `| **${b.text}** | ${stateBadge} | ${mutationBadge} |\n`;
        });
        md += `\n`;
      }
    });
  }

  return md;
}

// 6. Perform Comparative Diffing between new visit and previous visit
function compareVisits(newVisit, oldVisit) {
  const diff = {
    newMenus: [],
    removedMenus: [],
    newCtas: [],
    removedCtas: [],
    hasChanges: false
  };

  const oldMenuSet = new Set((oldVisit.menuTree || []).map(n => n.parent ? `${n.parent} > ${n.title}` : n.title));
  const newMenuSet = new Set((newVisit.menuTree || []).map(n => n.parent ? `${n.parent} > ${n.title}` : n.title));

  newMenuSet.forEach(m => {
    if (!oldMenuSet.has(m)) {
      diff.newMenus.push(m);
      diff.hasChanges = true;
    }
  });

  oldMenuSet.forEach(m => {
    if (!newMenuSet.has(m)) {
      diff.removedMenus.push(m);
      diff.hasChanges = true;
    }
  });

  const oldCtaSet = new Set((oldVisit.pages || []).flatMap(p => (p.buttons || []).map(b => `[${p.path}] ${b.text}`)));
  const newCtaSet = new Set((newVisit.pages || []).flatMap(p => (p.buttons || []).map(b => `[${p.path}] ${b.text}`)));

  newCtaSet.forEach(c => {
    if (!oldCtaSet.has(c)) {
      diff.newCtas.push(c);
      diff.hasChanges = true;
    }
  });

  oldCtaSet.forEach(c => {
    if (!newCtaSet.has(c)) {
      diff.removedCtas.push(c);
      diff.hasChanges = true;
    }
  });

  return diff;
}

// 7. Generate Comprehensive Hierarchical Markdown Report
function generateMarkdownReport(data, diff = null) {
  let md = `# Knowledge Struktur Menu & Katalog CTA: ${data.appName}\n\n`;
  md += `> Dokumen ini merupakan hasil live browser inspection resmi pada aplikasi staging untuk mencegah UI/Contract Drift.\n\n`;
  md += `- **Aplikasi**: \`${data.appName}\`\n`;
  md += `- **Target URL**: ${data.baseUrl}\n`;
  md += `- **Akun / Role**: \`${data.ownerAccount || 'Owner (Session Active)'}\`\n`;
  md += `- **Waktu Inspeksi**: ${data.timestamp}\n`;
  md += `- **Total Halaman Diinspeksi**: ${data.pages.length}\n`;
  md += `- **Total Tombol CTA Ditemukan**: ${data.pages.reduce((acc, p) => acc + (p.buttons || []).length, 0)}\n\n`;

  md += `## 1. Hierarki Navigasi, Kategori Grup & Sub-Menu (Modular Directory)\n\n`;
  md += `| # | Kategori Grup | Menu Induk | Nama Sub-Menu / Halaman | URL Route / Path | Berkas Knowledge Detail (.md) |\n`;
  md += `|---|---|---|---|---|:---:|\n`;

  const sanitize = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const treeItems = data.menuTree || [];
  treeItems.forEach((item, idx) => {
    const groupSlug = sanitize(item.group || 'umum');
    const itemSlug = sanitize(item.parent ? `${item.parent}-${item.title}` : item.title);
    const singleFileBase = `menu_structure_${groupSlug}_${itemSlug}`;

    const groupBadge = `**${item.group || 'UMUM'}**`;
    const parentLabel = item.parent ? `📂 **${item.parent}**` : `📄 *(Root)*`;
    const badgeText = item.badge ? ` \`[${item.badge}]\`` : '';
    const childLabel = item.parent ? `└── **${item.title}**` : (item.type === 'sidebar-action-cta' ? `⚡ **${item.title}**` : `**${item.title}**${badgeText}`);
    const pathLabel = item.urlPath ? `\`${item.urlPath}\`` : (item.href ? `\`${item.href}\`` : (item.type === 'sidebar-action-cta' ? '*(Action Modal)*' : '*(Dynamic State)*'));
    const linkStr = item.type === 'sidebar-action-cta' 
      ? `*(Aksi Sidebar)*` 
      : `[Lihat Detail Halaman](file://${path.join(data.appDir || '', `${singleFileBase}_latest.md`)})`;

    md += `| ${idx + 1} | ${groupBadge} | ${parentLabel} | ${childLabel} | ${pathLabel} | ${linkStr} |\n`;
  });

  md += `\n## 2. Katalog Tombol CTA & Selector per Halaman / Sub-Menu\n\n`;
  data.pages.forEach((p, idx) => {
    const pageHeading = p.heading ? ` - "${p.heading}"` : '';
    md += `### 2.${idx + 1}. Halaman: ${p.menuLabel || p.title}${pageHeading} (\`${p.path}\`)\n\n`;
    if (p.breadcrumbs && p.breadcrumbs.length > 0) {
      md += `*Breadcrumbs*: ${p.breadcrumbs.join(' > ')}\n\n`;
    }

    if (!p.buttons || p.buttons.length === 0) {
      md += `*(Tidak ditemukan tombol CTA pada halaman ini)*\n\n`;
    } else {
      md += `| CTA Label | Selector / Rekomendasi | Tipe | State | Aksi Mutasi? |\n`;
      md += `|---|---|:---:|:---:|:---:|\n`;
      p.buttons.forEach(b => {
        const stateBadge = b.disabled ? 'Disabled' : 'Enabled';
        const mutationBadge = b.isMutation ? '**YA (Wajib Izin)**' : 'Safe';
        md += `| **${b.text}** | \`${b.selector}\` | \`${b.type}\` | ${stateBadge} | ${mutationBadge} |\n`;
      });
      md += `\n`;
    }

    if (p.inputs && p.inputs.length > 0) {
      md += `**Input & Filter Fields**:\n`;
      p.inputs.forEach((inp, iIdx) => {
        const reqStr = inp.required ? ' *(Wajib)*' : '';
        const lbl = inp.label ? `[Label: "${inp.label}"] ` : '';
        const ph = inp.placeholder ? `placeholder="${inp.placeholder}"` : '';
        md += `- ${iIdx + 1}. \`${inp.tag.toUpperCase()}\` (${inp.type}) ${lbl}${ph}${reqStr}\n`;
      });
      md += `\n`;
    }
  });

  if (diff && diff.hasChanges) {
    md += `## 3. Comparative UI Drift (Komparasi vs Kunjungan Sebelumnya)\n\n`;
    if (diff.newMenus.length > 0) {
      md += `### 🟢 Menu Baru Terdeteksi:\n`;
      diff.newMenus.forEach(m => md += `- ${m}\n`);
      md += `\n`;
    }
    if (diff.removedMenus.length > 0) {
      md += `### 🔴 Menu yang Hilang / Dipindahkan:\n`;
      diff.removedMenus.forEach(m => md += `- ${m}\n`);
      md += `\n`;
    }
    if (diff.newCtas.length > 0) {
      md += `### 🟢 Tombol CTA Baru:\n`;
      diff.newCtas.slice(0, 15).forEach(c => md += `- ${c}\n`);
      md += `\n`;
    }
    if (diff.removedCtas.length > 0) {
      md += `### 🔴 Tombol CTA Dihapus / Berubah Nama:\n`;
      diff.removedCtas.slice(0, 15).forEach(c => md += `- ${c}\n`);
      md += `\n`;
    }
  } else if (diff) {
    md += `## 3. Comparative UI Drift\n\n`;
    md += `> Tidak ada perubahan struktur menu atau tombol CTA dibandingkan kunjungan sebelumnya (Konsisten / No Drift).\n\n`;
  }

  return md;
}

// 8. Main Orchestrator
async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const appName = getArg('--app') || 'chatreborn';
  const specifiedOwnerKey = getArg('--owner-key');
  const targetUrl = getArg('--url');
  const maxPages = parseInt(getArg('--max-pages') || '35', 10);

  const { owners, rawEnv } = getOwnerCredentials();
  const ownerKeys = Object.keys(owners);

  console.log(`\n\x1b[32m=== DYNAMIC MULTI-TIER MENU & CTA CRAWLER ===\x1b[0m`);
  console.log(`Target App : ${appName}`);

  let selectedOwner = null;
  if (ownerKeys.length === 0) {
    console.warn(`\x1b[33m[GATE 3] Tidak ditemukan kredensial Owner (USER_OWNER_...) di .env.\x1b[0m`);
  } else if (ownerKeys.length > 1) {
    if (!specifiedOwnerKey) {
      console.error(`\x1b[31m[GATE 3 STRICT] Ditemukan lebih dari 1 kredensial Owner di .env:\x1b[0m`);
      ownerKeys.forEach((k, idx) => {
        console.log(`  ${idx + 1}. \x1b[36m--owner-key=${k}\x1b[0m (${owners[k].usernameVar}: ${owners[k].username})`);
      });
      console.error(`\nHarap tentukan kredensial dengan flag \x1b[1m--owner-key=<NAME>\x1b[0m agar tidak menggunakan sembarangan kredensial!\n`);
      process.exit(2);
    } else {
      selectedOwner = owners[specifiedOwnerKey.toUpperCase()] || owners[specifiedOwnerKey];
      if (!selectedOwner) {
        console.error(`\x1b[31m[GATE 3] Kredensial --owner-key="${specifiedOwnerKey}" tidak ditemukan di .env!\x1b[0m`);
        process.exit(2);
      }
      console.log(`Selected Owner: \x1b[36m${selectedOwner.usernameVar}\x1b[0m (${selectedOwner.username})`);
    }
  } else {
    selectedOwner = owners[ownerKeys[0]];
    console.log(`Selected Owner: \x1b[36m${selectedOwner.usernameVar}\x1b[0m (${selectedOwner.username})`);
  }

  const baseUrl = targetUrl || rawEnv.E2E_BASE_URL_STAGING || rawEnv.BASE_URL || 'https://chat-dev.everpro.id';
  console.log(`Base URL   : ${baseUrl}\n`);

  const browser = await getBrowser();
  const context = browser.contexts()[0];
  let page = context.pages()[0] || await context.newPage();

  console.log(`Navigasi ke Base URL awal: ${baseUrl}...`);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // Check login state
  const isLoginPage = page.url().includes('/login') || (await page.locator('input[type="password"]:visible').count()) > 0;
  if (isLoginPage) {
    if (!selectedOwner) {
      console.error(`\x1b[31m[HALT] Aplikasi memerlukan login tetapi kredensial Owner belum ditentukan!\x1b[0m`);
      process.exit(3);
    }

    console.log(`\x1b[33m[AUTH] Terdeteksi halaman login. Melakukan login sebagai Owner: ${selectedOwner.username}...\x1b[0m`);
    const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], #email, #username').first();
    const passInput = page.locator('input[type="password"], input[name="password"], #password').first();
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Masuk"), button:has-text("Login")').first();

    if (await emailInput.isVisible() && await passInput.isVisible()) {
      await emailInput.fill(selectedOwner.username);
      await passInput.fill(selectedOwner.password);
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(5000);
      }
    }

    const hasOtp = (await page.locator('input[name*="otp" i], input[placeholder*="otp" i], text="Verifikasi", text="OTP"').count()) > 0;
    if (hasOtp) {
      console.log(`\x1b[35m[HUMAN HANDSHAKE] Terdeteksi verifikasi OTP/CAPTCHA di browser Chrome!\x1b[0m`);
      console.log(`Silakan masukkan kode OTP / selesaikan CAPTCHA langsung pada browser. Script menunggu hingga 30 detik...`);
      for (let w = 0; w < 30; w++) {
        await page.waitForTimeout(1000);
        if (!page.url().includes('/login') && !((await page.locator('input[name*="otp" i]').count()) > 0)) {
          console.log(`\x1b[32m[AUTH] Berhasil melewati verifikasi dan masuk ke dashboard!\x1b[0m`);
          break;
        }
      }
    }
  } else {
    console.log(`\x1b[32m[AUTH] Sesi browser sudah aktif (sudah login di dashboard).\x1b[0m`);
  }

  // 1. Discover Full Menu Tree strictly in Sidebar (with accordion auto-expansion)
  console.log(`\n\x1b[34m[TREE DISCOVERY] Memindai seluruh hierarki menu induk dan sub-menu di sidebar...\x1b[0m`);
  const menuTree = await extractHierarchicalTree(page);

  console.log(`\x1b[32m✔ Ditemukan total ${menuTree.length} menu, sub-menu, dan aksi sidebar:\x1b[0m`);
  menuTree.forEach((m, idx) => {
    const groupLabel = `[${m.group || 'UMUM'}]`;
    const badgeStr = m.badge ? ` [${m.badge}]` : '';
    if (m.parent) {
      console.log(`   ${idx + 1}. ${groupLabel} 📂 ${m.parent} ──> 📄 ${m.title}`);
    } else if (m.type === 'sidebar-action-cta') {
      console.log(`   ${idx + 1}. ${groupLabel} ⚡ ${m.title} (Sidebar Action Button)`);
    } else {
      console.log(`   ${idx + 1}. ${groupLabel} 📄 ${m.title}${badgeStr} ${m.href ? `(${m.href})` : ''}`);
    }
  });

  // 2. Prepare Output Directory & Timestamp
  const appDir = path.join(STRUKTUR_MENU_DIR, appName);
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
  }

  const existingFiles = fs.readdirSync(appDir).filter(f => f.startsWith(`menu_structure_${appName}_`) && f.endsWith('.json'));
  let previousVisitData = null;
  if (existingFiles.length > 0) {
    existingFiles.sort();
    const lastFile = existingFiles[existingFiles.length - 1];
    try {
      previousVisitData = JSON.parse(fs.readFileSync(path.join(appDir, lastFile), 'utf-8'));
    } catch (e) {}
  }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  // 3. Sequential Deep Traversal (Visit each submenu & extract deep tier-2 features)
  console.log(`\n\x1b[34m[DEEP TRAVERSAL] Menginspeksi halaman untuk setiap menu & sub-menu...\x1b[0m`);
  const pagesData = [];
  const visitedPaths = new Set();
  const sanitize = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  for (let i = 0; i < menuTree.length && pagesData.length < maxPages; i++) {
    const item = menuTree[i];
    const itemLabel = item.parent ? `[${item.group}] ${item.parent} > ${item.title}` : `[${item.group}] ${item.title}`;

    console.log(`\n[${pagesData.length + 1}/${Math.min(menuTree.length, maxPages)}] Membuka: \x1b[1m${itemLabel}\x1b[0m`);

    // If it's a sidebar action button (e.g. "Kirim broadcast"), record without clicking in passive crawl mode
    if (item.type === 'sidebar-action-cta') {
      console.log(`   ℹ [SAFE MODE] Tombol aksi sidebar '${item.title}' dicatat tanpa diklik (mencegah mutasi/popup tak diinginkan).`);
      continue;
    }

    try {
      // If currently on /chatroom or page without sidebar, return to baseUrl to continue CRM menu traversal
      const currentUrl = page.url();
      const hasSidebar = await page.evaluate(() => {
        return !!(document.querySelector('[data-sidebar="sidebar"]') || document.querySelector('aside'));
      });
      if (!hasSidebar || (currentUrl.includes('/chatroom') && item.title !== 'Chat room')) {
        console.log(`   [NAV] Kembali ke ${baseUrl} untuk mengakses menu sidebar...`);
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
      }

      // If item is a submenu under a parent, ensure parent collapsible is open
      if (item.parent) {
        await page.evaluate((parentTitle) => {
          const sidebar = document.querySelector('[data-sidebar="sidebar"]') || document.querySelector('aside');
          if (!sidebar) return;
          const parentBtn = Array.from(sidebar.querySelectorAll('button')).find(b => b.innerText.includes(parentTitle));
          if (parentBtn) {
            const state = parentBtn.getAttribute('data-state') || parentBtn.closest('[data-state]')?.getAttribute('data-state');
            if (state === 'closed') {
              parentBtn.click();
            }
          }
        }, item.parent);
        await page.waitForTimeout(750);
      }

      // Click target element in DOM
      const clickTarget = async () => {
        return await page.evaluate((target) => {
          const sidebar = document.querySelector('[data-sidebar="sidebar"]') || document.querySelector('aside');
          if (!sidebar) return false;

          if (target.parent) {
            // Submenu items: Target span[role="link"], a, button, or menu-sub-button
            const subLinks = Array.from(sidebar.querySelectorAll('[data-sidebar="menu-sub"] span[role="link"], [data-sidebar="menu-sub"] a, [data-sidebar="menu-sub"] button, [data-sidebar="menu-sub-button"]'));
            const el = subLinks.find(s => s.innerText.trim() === target.title);
            if (el) {
              el.click();
              return true;
            }
          } else {
            // Main menu items: Target class containing menu-button, a, button, span[role="link"]
            const candidates = Array.from(sidebar.querySelectorAll('[class*="menu-button"], [data-sidebar="menu-button"], a, span[role="link"]'));
            for (const el of candidates) {
              const t = el.innerText ? el.innerText.trim().replace(/\s*Beta\s*$/, '').trim() : '';
              if (t === target.title) {
                el.click();
                return true;
              }
            }
          }
          return false;
        }, item);
      };

      let targetClicked = await clickTarget();
      await page.waitForTimeout(2000);

      // If clicked a submenu and URL didn't change from previous path, retry once
      if (item.parent && !visitedPaths.has(new URL(page.url()).pathname)) {
        // ok
      } else if (item.parent && visitedPaths.has(new URL(page.url()).pathname)) {
        await clickTarget();
        await page.waitForTimeout(2000);
      }

      const currentPath = new URL(page.url()).pathname;
      item.urlPath = currentPath;

      if (!visitedPaths.has(currentPath)) {
        visitedPaths.add(currentPath);
        const pageStruct = await extractPageStructure(page);
        pageStruct.menuLabel = itemLabel;
        pageStruct.group = item.group;
        pageStruct.parent = item.parent;
        pageStruct.title = item.title;
        pageStruct.badge = item.badge;
        pageStruct.urlPath = currentPath;

        console.log(`   ✔ Base URL: ${currentPath} | Title: "${pageStruct.title}" | CTAs: ${(pageStruct.buttons || []).length} | Inputs: ${(pageStruct.inputs || []).length}`);

        // Deep Interactive Exploration (Popover options, Table row actions / Gear icons, Drawers)
        console.log(`   🔍 [DEEP EXPLORATION] Memindai opsi popover, menu baris tabel, dan modal drawer...`);
        const deepFeatures = await extractDeepPageFeatures(page, page.url());
        pageStruct.deepFeatures = deepFeatures;

        const popoverCount = (deepFeatures.popoverActions || []).length;
        const rowActionCount = (deepFeatures.rowActions || []).length;
        const drawerCount = (deepFeatures.drawers || []).length;
        if (popoverCount > 0 || rowActionCount > 0 || drawerCount > 0) {
          console.log(`      ↳ Ditemukan: ${popoverCount} Popover Forms, ${rowActionCount} Row Actions, ${drawerCount} Modals/Drawers.`);
        }

        pagesData.push(pageStruct);

        // Generate and Save Modular Knowledge File for this specific menu
        const groupSlug = sanitize(item.group || 'umum');
        const itemSlug = sanitize(item.parent ? `${item.parent}-${item.title}` : item.title);
        const singleFileBase = `menu_structure_${groupSlug}_${itemSlug}`;

        const singleMenuPayload = {
          appName,
          baseUrl,
          ownerAccount: selectedOwner ? selectedOwner.username : 'Active Session',
          timestamp: now.toLocaleString(),
          menuItem: item,
          page: pageStruct
        };

        const singleJsonPath = path.join(appDir, `${singleFileBase}_${timestamp}.json`);
        const singleMdPath = path.join(appDir, `${singleFileBase}_${timestamp}.md`);
        const singleMdContent = generateSingleMenuMarkdown(pageStruct, appName, selectedOwner ? selectedOwner.username : 'Active Session', now.toLocaleString());

        fs.writeFileSync(singleJsonPath, JSON.stringify(singleMenuPayload, null, 2), 'utf-8');
        fs.writeFileSync(singleMdPath, singleMdContent, 'utf-8');
        fs.writeFileSync(path.join(appDir, `${singleFileBase}_latest.json`), JSON.stringify(singleMenuPayload, null, 2), 'utf-8');
        fs.writeFileSync(path.join(appDir, `${singleFileBase}_latest.md`), singleMdContent, 'utf-8');

        console.log(`   📄 [MODULAR KNOWLEDGE] Tersimpan: ${singleFileBase}_${timestamp}.md`);
      } else {
        console.log(`   ℹ Path ${currentPath} sudah pernah diinspeksi.`);
      }
    } catch (err) {
      console.warn(`   \x1b[33m[WARN] Gagal membuka ${itemLabel}: ${err.message}\x1b[0m`);
    }
  }

  // 4. Generate Master Index & Overall Artifacts
  const payload = {
    appName,
    baseUrl,
    appDir,
    ownerAccount: selectedOwner ? selectedOwner.username : 'Active Session',
    timestamp: now.toLocaleString(),
    menuTree,
    pages: pagesData
  };

  let diff = null;
  if (previousVisitData) {
    diff = compareVisits(payload, previousVisitData);
    console.log(`\n\x1b[35m=== HASIL KOMPARASI UI DRIFT (VISIT TERAKHIR VS BARU) ===\x1b[0m`);
    if (diff.hasChanges) {
      if (diff.newMenus.length > 0) console.log(`🟢 Menu Baru: ${diff.newMenus.join(', ')}`);
      if (diff.removedMenus.length > 0) console.log(`🔴 Menu Hilang: ${diff.removedMenus.join(', ')}`);
      if (diff.newCtas.length > 0) console.log(`🟢 CTA Baru: ${diff.newCtas.slice(0, 5).join(', ')}...`);
      if (diff.removedCtas.length > 0) console.log(`🔴 CTA Hilang: ${diff.removedCtas.slice(0, 5).join(', ')}...`);
    } else {
      console.log(`Struktur menu dan tombol CTA 100% konsisten (No Drift).`);
    }
  }

  const jsonFilename = `menu_structure_${appName}_${timestamp}.json`;
  const jsonPath = path.join(appDir, jsonFilename);
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');

  const mdFilename = `menu_structure_${appName}_${timestamp}.md`;
  const mdPath = path.join(appDir, mdFilename);
  const mdContent = generateMarkdownReport(payload, diff);
  fs.writeFileSync(mdPath, mdContent, 'utf-8');

  fs.writeFileSync(path.join(appDir, 'latest.json'), JSON.stringify(payload, null, 2), 'utf-8');
  fs.writeFileSync(path.join(appDir, 'latest.md'), mdContent, 'utf-8');

  console.log(`\n\x1b[32m[SUCCESS] Knowledge Lengkap Hierarki Menu Berhasil Disimpan:\x1b[0m`);
  console.log(`- JSON : ${jsonPath}`);
  console.log(`- MD   : ${mdPath}`);
  console.log(`- Pointer 'latest.json' & 'latest.md' telah diperbarui.\n`);

  await browser.close();
}

main().catch(err => {
  console.error(`\x1b[31m[FATAL] Error running menu inspector: ${err.message}\x1b[0m`);
  process.exit(1);
});
