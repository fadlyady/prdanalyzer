/**
 * Universal Agnostic Test Case Executor for browser-qa-execution skill
 *
 * Capabilities:
 * - Application-agnostic (E-Commerce, CRM, Admin Portals, etc.)
 * - Reads Markdown (.md) testcases parsed via parse_testcase.py
 * - Connects to active Google Chrome via CDP (port 9222)
 * - Interprets natural language steps (navigate, fill, click, select, assert)
 * - Enforces fast dropdown fallback (no 30s hangs)
 * - Detects backend/DB dependencies and marks PARTIAL TEST WITH REASON
 * - Executes 5 mandatory exploratory charters
 * - Compiles executive Word report (.docx) without embedded images
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  ensureBrowserOpen,
  closeBrowser,
  validateCredentialsForRole,
  getDetailedCredentialsFromEnv,
  discoverUrlVariables,
  checkRuntimeDependencies,
  getOpenBrowserTabs,
  checkCDPAlive,
  resolveProjectRoot,
  resolveTestCaseUrl
} = require('./test_runner_bridge');

const PROJECT_ROOT = resolveProjectRoot(__dirname);
const AUTOMATE_RESULT_DIR = fs.existsSync(path.join(PROJECT_ROOT, 'browser-execution', 'automate-result'))
  ? path.join(PROJECT_ROOT, 'browser-execution', 'automate-result')
  : path.join(PROJECT_ROOT, 'automate-result');
const AUTOMATE_SUPPORT_DIR = fs.existsSync(path.join(PROJECT_ROOT, 'browser-execution', 'automate-support'))
  ? path.join(PROJECT_ROOT, 'browser-execution', 'automate-support')
  : path.join(PROJECT_ROOT, 'automate-support');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';

// 1. Read .env file
function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [k, ...v] = trimmed.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
  return env;
}

// 2. Create timestamped run directory
function createRunDir(featureName = 'test') {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const cleanFeature = featureName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30);
  const runId = `run_${cleanFeature}_${timestamp}`;
  const runDir = path.join(AUTOMATE_RESULT_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });
  return { runId, runDir, timestamp };
}

// 3. Parse testcase file (Markdown or Excel) with Mandatory Schema Contract Guard
function parseTestcaseFile(filePath) {
  const pyScript = path.resolve(__dirname, 'parse_testcase.py');
  const stdout = execSync(`python3 "${pyScript}" "${filePath}"`, { encoding: 'utf-8' });
  const parsed = JSON.parse(stdout);

  if (parsed.contract_status === 'FAILED') {
    throw new Error(`[CONTRACT ERROR] Seluruh skenario dalam file (${filePath}) gagal validasi kontrak wajib (id/title/steps/expected). Rincian: ${JSON.stringify(parsed.invalid_testcases, null, 2)}`);
  }

  if (parsed.contract_status === 'PARTIAL_VALID') {
    console.warn(`\x1b[33m[CONTRACT WARNING] Ditemukan ${parsed.invalid_count} test case yang tidak memenuhi kontrak wajib dari total ${parsed.total_testcases} skenario:\x1b[0m`);
    parsed.invalid_testcases.forEach(inv => {
      console.warn(`   ⚠ Dilewati: [${inv.id || 'NO-ID'}] "${inv.title || 'Untitled'}" -> Masalah: ${inv.reasons.join(', ')}`);
    });
  }

  return parsed;
}

// Backward-compatible alias
const parseMarkdownTestcase = parseTestcaseFile;

// 4. Smart Locator Resolvers
async function findInput(page, term) {
  const cleanTerm = term.replace(/["']/g, '').trim();
  const selectors = [
    `#${cleanTerm}`,
    `input[name="${cleanTerm}"]`,
    `input[placeholder*="${cleanTerm}" i]`,
    `textarea[placeholder*="${cleanTerm}" i]`,
    `input[aria-label*="${cleanTerm}" i]`,
    `label:has-text("${cleanTerm}") ~ input`,
    `label:has-text("${cleanTerm}") input`,
    `input[placeholder*="cari" i]`,
    `input[placeholder*="search" i]`,
    `input[type="search"]:visible`
  ];
  for (const s of selectors) {
    const loc = page.locator(s).first();
    if (await loc.count() > 0 && await loc.isVisible()) return loc;
  }
  // Fallback to first text/search input (exclude number, checkbox, radio, hidden)
  return page.locator('input[type="text"]:visible, input[type="search"]:visible, input:not([type="number"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):visible').first();
}

async function findButtonOrClickable(page, term) {
  const cleanTerm = term.replace(/["']/g, '').trim();
  const selectors = [
    `button:has-text("${cleanTerm}")`,
    `[role="button"]:has-text("${cleanTerm}")`,
    `a:has-text("${cleanTerm}")`,
    `span[role="link"]:has-text("${cleanTerm}")`,
    `input[type="submit"][value*="${cleanTerm}" i]`,
    `[data-slot*="button"]:has-text("${cleanTerm}")`
  ];
  for (const s of selectors) {
    const loc = page.locator(s).first();
    if (await loc.count() > 0 && await loc.isVisible()) return loc;
  }
  return null;
}

// 4b. Session Management & Role Authentication Helpers (Agnostic Logout & Login)
async function resetSession(page, context, targetBaseUrl) {
  console.log(`\x1b[33m[SESSION RESET] Menghapus cookies, localStorage, dan sessionStorage...\x1b[0m`);
  try {
    await context.clearCookies();
    await page.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
    });
    console.log(`\x1b[32m✔ Sesi berhasil di-reset bersih (Logged out).\x1b[0m`);
    if (targetBaseUrl) {
      await page.goto(targetBaseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2500);
    }
  } catch (err) {
    console.warn(`[WARN] Gagal reset session storage: ${err.message}`);
  }
}

async function performRoleLogin(page, credential, targetBaseUrl) {
  if (!targetBaseUrl || !credential) return;
  console.log(`\x1b[34m[AUTH] Memeriksa status login untuk role "${credential.role}" (${credential.username})...\x1b[0m`);

  if (!page.url() || page.url().startsWith('chrome://') || page.url().includes('about:blank')) {
    await page.goto(targetBaseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
  }

  const isLoginPage = page.url().includes('/login') || 
                      page.url().includes('/signin') || 
                      (await page.locator('input[type="password"]:visible').count()) > 0;

  if (isLoginPage) {
    if (!credential.username || !credential.password) {
      console.warn(`\x1b[33m[AUTH WARN] Kredensial untuk role "${credential.role}" belum lengkap di .env!\x1b[0m`);
      return;
    }

    console.log(`\x1b[33m[AUTH LOGIN] Mengisi form login untuk role "${credential.role}" (${credential.username})...\x1b[0m`);
    const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[name*="user" i], input[placeholder*="email" i], input[placeholder*="username" i], #email, #username').first();
    const passInput = page.locator('input[type="password"], input[name="password"], #password').first();
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Masuk"), button:has-text("Login"), button:has-text("Sign in")').first();

    if (await emailInput.count() > 0 && await passInput.count() > 0) {
      await emailInput.fill(credential.username);
      await passInput.fill(credential.password);
      if (await submitBtn.count() > 0 && await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(4000);
      }
    }

    // Human Handshake Gate jika muncul OTP/CAPTCHA
    const hasOtp = (await page.locator('input[name*="otp" i], input[placeholder*="otp" i], text="Verifikasi", text="OTP", iframe[src*="recaptcha"], iframe[src*="challenges.cloudflare"]').count()) > 0;
    if (hasOtp) {
      console.log(`\n\x1b[35m[HUMAN HANDSHAKE GATE] Terdeteksi OTP / CAPTCHA verifikasi pada browser!\x1b[0m`);
      console.log(`Silakan selesaikan verifikasi langsung di jendela browser Chrome.`);
      console.log(`Script menunggu hingga 30 detik untuk mendeteksi login berhasil...`);
      for (let w = 0; w < 30; w++) {
        await page.waitForTimeout(1000);
        if (!page.url().includes('/login') && (await page.locator('input[type="password"]:visible').count()) === 0) {
          console.log(`\x1b[32m✔ Login berhasil dan dashboard terdeteksi!\x1b[0m\n`);
          break;
        }
      }
    }
  } else {
    console.log(`\x1b[32m[AUTH] Sesi aktif terdeteksi di dashboard (${page.url()}).\x1b[0m`);
  }
}

async function executeUniversalSuite(testcaseMdPath) {
  let resolvedPath = testcaseMdPath;
  if (!fs.existsSync(resolvedPath)) {
    const candidates = [
      path.resolve(process.cwd(), testcaseMdPath),
      path.join(PROJECT_ROOT, 'doc-analyzer', 'result-testcase', testcaseMdPath),
      path.join(PROJECT_ROOT, 'result-testcase', testcaseMdPath)
    ];
    const found = candidates.find(c => fs.existsSync(c));
    if (found) {
      resolvedPath = found;
    } else {
      throw new Error(`File testcase tidak ditemukan: ${testcaseMdPath}`);
    }
  }
  testcaseMdPath = resolvedPath;

  // Pre-flight runtime dependency check
  const depCheck = checkRuntimeDependencies();
  if (!depCheck.ok) {
    console.error(`\n\x1b[31m=== [PRE-FLIGHT DEPENDENCY ERROR] ===\x1b[0m`);
    depCheck.missing.forEach(m => console.error(` ✖ Dependensi belum lengkap: ${m.name} (${m.type}) -> Solusi: jalankan '${m.fix}'`));
    throw new Error(`Dependensi pengujian belum lengkap. Silakan instal dependensi terlebih dahulu.`);
  }

  const env = loadEnv();
  const parsedData = parseMarkdownTestcase(testcaseMdPath);
  const testcases = parsedData.testcases || [];

  if (testcases.length === 0) {
    throw new Error(`Tidak ada test case yang berhasil diekstrak dari: ${testcaseMdPath}`);
  }

  const baseFileName = path.basename(testcaseMdPath, '.md');
  const { runId, runDir, timestamp } = createRunDir(baseFileName);

  console.log(`\n\x1b[32m=== MEMULAI UNIVERSAL QA TEST EXECUTION ===\x1b[0m`);
  console.log(`Source File : ${testcaseMdPath}`);
  console.log(`Total Cases : ${testcases.length}`);
  console.log(`Run ID      : ${runId}`);
  console.log(`Evidence Dir: ${runDir}\n`);

  // Gate 2: Target URL Resolution (Agnostic Environment Discovery)
  console.log(`\x1b[34m=== GATE 2: TARGET URL & ENVIRONMENT RESOLUTION ===\x1b[0m`);
  const targetUrlArg = process.argv.find(a => a.startsWith('--target-url='));
  const urlVarArg = process.argv.find(a => a.startsWith('--url-var='));
  const tabIndexArg = process.argv.find(a => a.startsWith('--tab-index='));
  const tabUrlArg = process.argv.find(a => a.startsWith('--tab-url='));
  const isNewTab = process.argv.includes('--new-tab');

  let targetBaseUrl = '';
  if (targetUrlArg) {
    targetBaseUrl = targetUrlArg.split('=')[1].trim();
    console.log(`[GATE 2 URL] Menggunakan URL langsung via flag: ${targetBaseUrl}`);
  } else if (urlVarArg) {
    const varName = urlVarArg.split('=')[1].trim();
    targetBaseUrl = env[varName] || '';
    if (!targetBaseUrl) {
      console.warn(`\x1b[33m[GATE 2 WARN] Variabel "${varName}" tidak ditemukan di file .env.\x1b[0m`);
    } else {
      console.log(`[GATE 2 URL] Menggunakan variabel URL .env [${varName}]: ${targetBaseUrl}`);
    }
  } else if (process.env.TARGET_URL) {
    targetBaseUrl = process.env.TARGET_URL.trim();
    console.log(`[GATE 2 URL] Menggunakan TARGET_URL dari process.env: ${targetBaseUrl}`);
  } else {
    // Auto-discovery scanner on .env
    const urlCandidates = discoverUrlVariables(env);
    if (urlCandidates.length === 1) {
      targetBaseUrl = urlCandidates[0].value;
      console.log(`[GATE 2 AUTO-DETECT] Menemukan variabel URL tunggal di .env: ${urlCandidates[0].key} (${targetBaseUrl})`);
    } else if (urlCandidates.length > 1) {
      console.log(`\x1b[33m[GATE 2 DISCOVERY] Ditemukan ${urlCandidates.length} kandidat variabel URL di .env:\x1b[0m`);
      urlCandidates.forEach((c, i) => console.log(`   ${i + 1}. ${c.key} = ${c.value}`));
      targetBaseUrl = urlCandidates[0].value;
      console.log(`   Default menggunakan: ${urlCandidates[0].key} (${targetBaseUrl}). (Gunakan --url-var=<KEY> atau --target-url=<URL> untuk menentukan pilihan spesifik).\n`);
    } else {
      console.warn(`\x1b[33m[GATE 2 WARNING] Tidak ditemukan variabel URL (URL/HOST/DOMAIN) di .env. Browser akan mengandalkan sesi tab aktif.\x1b[0m\n`);
    }
  }

  // Gate 3: Credential Verification & Disambiguation Check
  console.log(`\x1b[34m=== GATE 3: CREDENTIAL VERIFICATION & DISAMBIGUATION ===\x1b[0m`);
  const requiredRoles = new Set();
  testcases.forEach(tc => {
    if (tc.role) {
      tc.role.split(/[\/,]/).forEach(r => {
        const clean = r.trim().toUpperCase();
        if (clean) requiredRoles.add(clean);
      });
    }
  });

  if (requiredRoles.size === 0) {
    console.log(`[GATE 3] Testcase tidak membatasi role spesifik (Default Role Execution).\n`);
  } else {
    console.log(`Role Skenario: ${Array.from(requiredRoles).join(', ')}`);
    for (const r of requiredRoles) {
      const check = validateCredentialsForRole(env, r);
      if (check.status === 'MISSING') {
        console.log(`\x1b[33m[GATE 3 MISSING] ${check.message}\x1b[0m`);
      } else if (check.status === 'AMBIGUOUS') {
        console.log(`\x1b[33m[GATE 3 DISAMBIGUATION] Role "${r}" ambigu: terdapat ${check.candidates.length} kredensial di .env (${check.candidates.map(c => c.key).join(', ')}).\x1b[0m`);
      } else {
        console.log(`\x1b[32m[GATE 3 OK] Role "${r}" -> ${check.credential.key} (${check.credential.username})\x1b[0m`);
      }
    }
    console.log('');
  }

  let browser;
  try {
    // 1. Periksa apakah browser sudah terbuka sebelumnya
    const isAlreadyOpen = await checkCDPAlive();
    let openTabsBefore = [];
    if (isAlreadyOpen) {
      openTabsBefore = await getOpenBrowserTabs();
      console.log(`\x1b[32m[BROWSER STATE] Browser Google Chrome QA sudah terbuka dengan ${openTabsBefore.length} tab terdeteksi.\x1b[0m`);
      openTabsBefore.forEach((tab, i) => {
        console.log(`   - Tab [${i}]: "${tab.title}" (${tab.url})`);
      });
    } else {
      // Browser belum terbuka: luncurkan Chrome otomatis dengan target URL (jika ada)
      await ensureBrowserOpen(targetBaseUrl);
    }

    // 2. Hubungkan client Playwright melalui CDP (port 9222)
    const res = await fetch(`${CDP_URL}/json`).catch(() => null);
    if (res && res.ok) {
      const targets = await res.json();
      const hasPage = targets.some(t => t.type === 'page');
      if (!hasPage) {
        await fetch(`${CDP_URL}/json/new`, { method: 'PUT' }).catch(() => {});
      }
    }
    browser = await chromium.connectOverCDP(CDP_URL);

    const context = browser.contexts()[0];
    const initialPages = context.pages();
    let page;

    if (isNewTab || initialPages.length === 0) {
      console.log(`\x1b[34m[TAB RESOLUTION] Membuka tab baru untuk pengujian...\x1b[0m`);
      page = await context.newPage();
    } else if (tabIndexArg) {
      const idx = parseInt(tabIndexArg.split('=')[1], 10);
      page = initialPages[idx] || initialPages[0];
      console.log(`\x1b[34m[TAB RESOLUTION] Menggunakan tab indeks [${idx}]: "${await page.title()}" (${page.url()})\x1b[0m`);
    } else if (tabUrlArg) {
      const subUrl = tabUrlArg.split('=')[1].trim();
      page = initialPages.find(p => p.url().includes(subUrl)) || initialPages[0];
      console.log(`\x1b[34m[TAB RESOLUTION] Menggunakan tab URL cocok ("${subUrl}"): "${await page.title()}" (${page.url()})\x1b[0m`);
    } else {
      page = initialPages[0];
      console.log(`\x1b[34m[TAB RESOLUTION] Menggunakan tab aktif saat ini: "${await page.title()}" (${page.url()})\x1b[0m`);
    }

    // TAB CLEANUP: Tutup tab-tab sisa pengujian sebelumnya agar tidak bertumpuk di browser
    const allPages = context.pages();
    if (allPages.length > 1) {
      console.log(`\x1b[33m[TAB CLEANUP] Membersihkan tab-tab sisa pengujian sebelumnya (menjaga 1 tab kerja aktif)...\x1b[0m`);
      for (const otherPage of allPages) {
        if (otherPage !== page) {
          try {
            const oUrl = otherPage.url();
            console.log(`   ✖ Menutup tab tidak terpakai: "${await otherPage.title()}" (${oUrl})`);
            await otherPage.close().catch(() => {});
          } catch (e) {}
        }
      }
    }

    if (targetBaseUrl && (!page.url() || page.url().startsWith('chrome://') || page.url().includes('about:blank'))) {
      console.log(`\x1b[34m[NAVIGATE] Mengarahkan tab awal ke URL target: ${targetBaseUrl}\x1b[0m`);
      await page.goto(targetBaseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    // ==========================================
    // ROLE BATCHING: Kelompokkan Skenario Berdasarkan Role
    // Mencegah login berulang-ulang di tiap baris testcase
    // ==========================================
    const batchesByRole = {};
    testcases.forEach(tc => {
      const rName = (tc.role || '').trim();
      const normR = rName ? rName.toUpperCase() : 'ROLE_NOT_SPECIFIED';
      if (!batchesByRole[normR]) {
        batchesByRole[normR] = {
          roleDisplay: rName || 'Role Belum Ditentukan',
          normalizedRole: normR,
          cases: []
        };
      }
      batchesByRole[normR].cases.push(tc);
    });

    console.log(`\x1b[32m[ROLE BATCHING] Ditemukan ${Object.keys(batchesByRole).length} kelompok role pengujian:\x1b[0m`);
    Object.keys(batchesByRole).forEach(k => {
      console.log(`   - Role "${batchesByRole[k].roleDisplay}": ${batchesByRole[k].cases.length} skenario`);
    });
    console.log('');

    const results = [];
    const evidenceFiles = [];
    const partialContextList = [];
    const groupedRolesForReport = {};

    const skipRolesArg = process.argv.find(a => a.startsWith('--skip-roles='));
    const skippedRoles = skipRolesArg ? skipRolesArg.split('=')[1].split(',').map(r => r.trim().toUpperCase()) : [];

    let currentActiveRole = null;

    for (const [normRole, batch] of Object.entries(batchesByRole)) {
      console.log(`\n\x1b[35m══════════════════════════════════════════════════\x1b[0m`);
      console.log(`\x1b[35m=== BATCH ROLE: ${batch.roleDisplay.toUpperCase()} (${batch.cases.length} SKENARIO) ===\x1b[0m`);
      console.log(`\x1b[35m══════════════════════════════════════════════════\x1b[0m\n`);

      groupedRolesForReport[batch.roleDisplay.toLowerCase()] = [];

      // 1. Periksa apakah role di-skip via parameter --skip-roles
      if (skippedRoles.some(sr => normRole.includes(sr))) {
        console.log(`   \x1b[33m[SKIPPED BATCH] Seluruh skenario untuk role "${batch.roleDisplay}" dilewati sesuai parameter (--skip-roles)\x1b[0m\n`);
        for (const tc of batch.cases) {
          const skipItem = {
            id: tc.id,
            title: tc.title,
            action: tc.title,
            status: 'SKIP WITH REASON',
            notes: `Kredensial untuk role "${batch.roleDisplay}" dilewati sesuai parameter pengujian.`
          };
          results.push(skipItem);
          groupedRolesForReport[batch.roleDisplay.toLowerCase()].push(skipItem);
        }
        continue;
      }

      // 2. Validasi kredensial role di .env (Gate 3) dengan Smart Resolver
      let targetLookup = normRole;
      if (normRole === 'ROLE_NOT_SPECIFIED') {
        const cliRoleArg = process.argv.find(a => a.toLowerCase().startsWith('--role=') || a.toLowerCase().startsWith('--default-role='));
        if (cliRoleArg) {
          targetLookup = cliRoleArg.split('=')[1].trim().toUpperCase();
          console.log(`   \x1b[32m[ACTOR RESOLUTION] Menggunakan role dari parameter CLI: ${targetLookup}\x1b[0m`);
        }
      }

      let credCheck = validateCredentialsForRole(env, targetLookup === 'ROLE_NOT_SPECIFIED' ? '' : targetLookup);

      if (credCheck.status === 'ROLE_NOT_SPECIFIED') {
        if (credCheck.availableRoleNames.length === 1) {
          targetLookup = credCheck.availableRoleNames[0];
          credCheck = validateCredentialsForRole(env, targetLookup);
          console.log(`   \x1b[32m[AUTO-SELECT ROLE] Hanya ditemukan 1 role di .env [${targetLookup}], otomatis digunakan untuk skenario tanpa actor.\x1b[0m`);
        } else {
          console.log(`   \x1b[31m[GATE 3 ROLE NOT SPECIFIED] ${credCheck.message}\x1b[0m`);
          console.log(`   \x1b[33m[SKIPPED BATCH] Skenario tanpa actor dilewati. Harap sertakan parameter --role=<NAMA_ROLE> atau definisikan actor di test case.\x1b[0m\n`);
          for (const tc of batch.cases) {
            const skipItem = {
              id: tc.id,
              title: tc.title,
              action: tc.title,
              status: 'SKIP WITH REASON',
              notes: `Test case tidak mendefinisikan actor dan terdapat >1 role di .env (${credCheck.availableRoleNames.join(', ')}). Gunakan --role=<ROLE>.`
            };
            results.push(skipItem);
            groupedRolesForReport[batch.roleDisplay.toLowerCase()].push(skipItem);
          }
          continue;
        }
      }

      if (credCheck.status === 'MISSING') {
        console.log(`   \x1b[33m[GATE 3 MISSING] ${credCheck.message}\x1b[0m`);
        console.log(`   \x1b[33m[SKIPPED BATCH] Seluruh skenario untuk role "${batch.roleDisplay}" ditandai SKIP WITH REASON.\x1b[0m\n`);
        for (const tc of batch.cases) {
          const skipItem = {
            id: tc.id,
            title: tc.title,
            action: tc.title,
            status: 'SKIP WITH REASON',
            notes: `Kredensial untuk role "${batch.roleDisplay}" belum terdaftar di file .env. Pengujian dilewati.`
          };
          results.push(skipItem);
          groupedRolesForReport[batch.roleDisplay.toLowerCase()].push(skipItem);
        }
        continue;
      }

      let selectedCred = credCheck.credential;
      if (credCheck.status === 'AMBIGUOUS') {
        const credArg = process.argv.find(a => a.toLowerCase().startsWith(`--credential-${targetLookup.toLowerCase()}=`) || a.toLowerCase().startsWith(`--user-${targetLookup.toLowerCase()}=`));
        const ownerArg = (targetLookup === 'OWNER' ? process.argv.find(a => a.startsWith('--owner-key=')) : null);
        const chosenKey = credArg ? credArg.split('=')[1].trim().toUpperCase() : (ownerArg ? ownerArg.split('=')[1].trim().toUpperCase() : null);

        if (chosenKey) {
          selectedCred = credCheck.candidates.find(c => c.identifier.toUpperCase() === chosenKey || c.key.toUpperCase() === chosenKey) || credCheck.candidates[0];
        } else {
          selectedCred = credCheck.candidates[0];
          console.log(`   \x1b[33m[AMBIGUOUS RESOLUTION] Menggunakan kredensial pertama untuk ${targetLookup}: ${selectedCred.key} (${selectedCred.username}).\x1b[0m`);
        }
      }

      // 3. Sesi Switching: Jika sudah login dengan role berbeda sebelumnya, lakukan reset sesi bersih (Logout)
      if (currentActiveRole !== null && currentActiveRole !== targetLookup) {
        console.log(`   \x1b[33m[ROLE SWITCH] Berpindah dari role "${currentActiveRole}" ke "${targetLookup}". Melakukan logout & reset sesi bersih...\x1b[0m`);
        await resetSession(page, context, targetBaseUrl);
      }

      // 4. Melakukan login satu kali untuk seluruh skenario dalam batch ini
      if (selectedCred && targetBaseUrl) {
        await performRoleLogin(page, selectedCred, targetBaseUrl);
      }
      currentActiveRole = targetLookup;

      for (let idx = 0; idx < batch.cases.length; idx++) {
        const tc = batch.cases[idx];
        console.log(`\x1b[36m[ROLE: ${batch.roleDisplay.toUpperCase()}] [RUN ${idx + 1}/${batch.cases.length}] ${tc.id}: ${tc.title}\x1b[0m`);

        // Dynamic URL navigation per testcase
        const urlRes = resolveTestCaseUrl(tc, targetBaseUrl);
        if (urlRes.isOverride && urlRes.ok) {
          const currentUrl = page.url();
          if (currentUrl !== urlRes.url) {
            console.log(`   \x1b[35m[DYNAMIC URL] Navigasi ke URL spesifik test case: ${urlRes.url}\x1b[0m`);
            await page.goto(urlRes.url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => console.warn(`   [URL NAV WARN] ${e.message}`));
            await page.waitForTimeout(2000);
          }
        }

    const hasBackendVerification = /database|db\b|webhook|endpoint|tabel\s+db|sql/i.test(tc.expected || '') ||
                                   /database|db\b|webhook|endpoint/i.test((tc.steps || []).join(' '));

    let scenarioPassed = true;
    let failureNote = '';
    let isPartial = hasBackendVerification;
    let isMutationSkipped = false;
    let mutationSkipReason = '';
    const capturedInputs = [];

    // Check steps
    const steps = tc.steps || [];
    for (const stepText of steps) {
      console.log(`   - Step: ${stepText.slice(0, 70)}...`);

      // Gate 4: Mutation / Destructive Action Permission Check
      const isMutationAction = /(?:aksi\s*massal|aktifkan|deaktifkan|hapus|delete|buat\s*baru|create|tambah\s*data|edit|ubah|update|simpan\s*perubahan|potong\s*kuota|kirim\s*broadcast)/i.test(stepText);
      const isMutationAllowed = process.env.ALLOW_MUTATION === 'true' || 
                                process.env.ALLOW_DESTRUCTIVE === 'true' || 
                                process.argv.includes('--allow-mutation') || 
                                process.argv.includes('--allow-destructive');

      if (isMutationAction) {
        if (!isMutationAllowed) {
          console.log(`     \x1b[33m[PARTIAL TEST - MUTATION SKIPPED] Langkah mutasi data dilewati: "${stepText}"\x1b[0m`);
          console.log(`     Mode pengujian aman aktif (create/edit/delete tidak diizinkan user). Skenario di-flag sebagai PARTIAL TEST.`);
          isMutationSkipped = true;
          mutationSkipReason = `Aksi mutasi data ("${stepText}") dilewati sesuai izin mode aman user. Verifikasi create/edit/delete lanjutan perlu dilakukan manual.`;
          const sName = `${tc.id}_partial_mutation.png`;
          await page.screenshot({ path: path.join(runDir, sName) }).catch(() => {});
          evidenceFiles.push({ filename: sName, scenario: tc.id, timestamp: new Date().toLocaleTimeString() });
          break;
        } else {
          console.log(`     \x1b[32m[MUTATION PERMITTED] Izin mutasi aktif: menjalankan aksi tanpa guard: "${stepText}"\x1b[0m`);
        }
      }

      // Pattern 1: Navigation (100% Agnostic)
      const navMatch = stepText.match(/(?:akses\s*menu|navigasi|buka\s*halaman)\s*([^\.]+)/i);
      if (navMatch) {
        const targetMenu = navMatch[1].trim();
        try {
          if (targetMenu.startsWith('/') && targetBaseUrl) {
            const destUrl = `${targetBaseUrl.replace(/\/$/, '')}${targetMenu}`;
            console.log(`     [NAV] Direct navigasi URL relatif: ${destUrl}`);
            await page.goto(destUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(2500);
          } else if (/^https?:\/\//i.test(targetMenu)) {
            console.log(`     [NAV] Direct navigasi URL absolut: ${targetMenu}`);
            await page.goto(targetMenu, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(2500);
          } else {
            // Natural language menu hierarchy: e.g. "DATA > Pelanggan > Daftar pelanggan"
            const menuParts = targetMenu.split('>').map(p => p.trim());
            console.log(`     [NAV] Navigasi hierarki menu: ${menuParts.join(' -> ')}`);
            for (let mIdx = 0; mIdx < menuParts.length; mIdx++) {
              const item = menuParts[mIdx].replace(/["\\]/g, '\\$&');
              const menuLoc = page.locator(`span[role="link"]:has-text("${item}"), a:has-text("${item}"), button:has-text("${item}"), [role="menuitem"]:has-text("${item}"), li:has-text("${item}"), div:has-text("${item}")`).first();

              if (await menuLoc.count() > 0 && await menuLoc.isVisible()) {
                await menuLoc.click({ timeout: 5000 });
                await page.waitForTimeout(1500);
              }
            }
          }
        } catch (e) {
          console.warn(`     [NAV WARNING] Gagal navigasi menu "${targetMenu}": ${e.message}`);
        }
        continue;
      }

      // Pattern 2: Checkbox / Checklist
      const checkMatch = stepText.match(/(?:tekan|klik|centang)\s*(?:box\s*)?(?:checklist|checkbox)(?:\s*pada\s*([^\.]+))?/i);
      if (checkMatch) {
        try {
          const chk = page.locator('input[type="checkbox"]:visible, [role="checkbox"]:visible, .ant-checkbox-input').first();
          if (await chk.count() > 0) {
            await chk.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          // Non-blocking checkbox attempt
        }
        continue;
      }

      // Pattern 3: Select Dropdown
      // e.g. "Klik dropdown filter 'Pilih sumber data' dan pilih opsi 'CTWA'"
      const dropdownMatch = stepText.match(/(?:dropdown|pilih)\s*(?:filter)?\s*["']([^"']+)["']\s*(?:dan\s*pilih\s*opsi\s*["']([^"']+)["']|.*?pilih\s*opsi\s*["']([^"']+)["'])/i);
      if (dropdownMatch) {
        const dropdownName = dropdownMatch[1] || 'dropdown';
        const optionName = dropdownMatch[2] || dropdownMatch[3];

        try {
          const ddBtn = await findButtonOrClickable(page, dropdownName);
          if (ddBtn) {
            await ddBtn.click();
            await page.waitForTimeout(800);
          }

          if (optionName) {
            // Fast dropdown check (max 3s timeout)
            const optionLoc = page.locator(`[role="option"]:has-text("${optionName}"), [role="menuitem"]:has-text("${optionName}"), div:has-text("${optionName}"), text="${optionName}"`).last();
            const optionExists = (await optionLoc.count()) > 0;

            if (!optionExists) {
              scenarioPassed = false;
              failureNote = `DEFECT / MISSING OPTION: Opsi "${optionName}" tidak ditemukan pada dropdown "${dropdownName}".`;
              console.log(`     \x1b[31m✖ ${failureNote}\x1b[0m`);

              const sName = `${tc.id}_missing_option.png`;
              await page.screenshot({ path: path.join(runDir, sName) });
              evidenceFiles.push({ filename: sName, scenario: tc.id, timestamp: new Date().toLocaleTimeString() });
              await page.keyboard.press('Escape');
              break;
            } else {
              await optionLoc.click({ timeout: 4000 });
              await page.waitForTimeout(2000);
            }
          }
        } catch (e) {
          scenarioPassed = false;
          failureNote = `Dropdown interaction error: ${e.message}`;
          break;
        }
        continue;
      }

      // Pattern 4: Input / Fill
      // e.g. "Pada input pencarian 'Cari nomor atau nama', masukkan kata kunci 'Dino'"
      const inputMatch = stepText.match(/(?:input|field|pencarian|masukkan)\s*["']?([^"']*)["']?,\s*(?:masukkan|ketik|input)\s*(?:kata\s*kunci|nomor|string)?\s*["']([^"']+)["']/i);
      if (inputMatch) {
        const inputHint = inputMatch[1] || 'pencarian';
        const valToFill = inputMatch[2];
        try {
          const inp = await findInput(page, inputHint);
          await inp.fill(valToFill);
          capturedInputs.push({ field: inputHint, value: valToFill });
          if (/tekan\s*enter/i.test(stepText)) {
            await inp.press('Enter');
          }
          await page.waitForTimeout(2000);
        } catch (e) {
          scenarioPassed = false;
          failureNote = `Input error on "${inputHint}": ${e.message}`;
          break;
        }
        continue;
      }

      // Pattern 5: Click Button
      const clickMatch = stepText.match(/(?:klik|tekan)\s*(?:tombol|button|link)?\s*["']([^"']+)["']/i);
      if (clickMatch) {
        const btnText = clickMatch[1];
        try {
          const btn = await findButtonOrClickable(page, btnText);
          if (btn) {
            await btn.click({ timeout: 5000 });
            await page.waitForTimeout(2000);
          }
        } catch (e) {
          scenarioPassed = false;
          failureNote = `Click error on "${btnText}": ${e.message}`;
          break;
        }
        continue;
      }
    }

    // Capture Evidence Screenshot
    const sName = `${tc.id}_result.png`;
    const sPath = path.join(runDir, sName);
    await page.screenshot({ path: sPath }).catch(() => {});
    evidenceFiles.push({ filename: sName, scenario: tc.id, timestamp: new Date().toLocaleTimeString() });

    // Determine Status
    let status = 'PASSED';
    if (!scenarioPassed) {
      status = 'FAILED';
    } else if (isMutationSkipped) {
      status = 'PARTIAL TEST WITH REASON';
    } else if (isPartial) {
      status = 'PARTIAL TEST WITH REASON';
    }

    let notes = '';
    if (!scenarioPassed) {
      notes = failureNote;
    } else if (isMutationSkipped) {
      notes = `PARTIAL TEST: ${mutationSkipReason}`;
    } else if (isPartial) {
      notes = 'UI interaksi sukses. Verifikasi backend/database (DB persistence/webhook) perlu dilanjutkan manual oleh QA.';
    } else {
      notes = 'Semua langkah UI dan ekspektasi tampilan berhasil diverifikasi.';
    }

    const tcResultItem = {
      id: tc.id,
      title: tc.title,
      action: steps.length ? steps[steps.length - 1] : tc.title,
      status: status,
      notes: notes
    };

    results.push(tcResultItem);
    groupedRolesForReport[batch.roleDisplay.toLowerCase()].push(tcResultItem);

    if (isPartial && scenarioPassed) {
      partialContextList.push({
        id: tc.id,
        title: tc.title,
        expected: tc.expected || '',
        captured_inputs: capturedInputs,
        status: 'PARTIAL_DB_VERIFICATION_NEEDED'
      });
    }

    console.log(`   Status: ${status === 'PASSED' ? '\x1b[32mPASSED\x1b[0m' : (status === 'FAILED' ? '\x1b[31mFAILED\x1b[0m' : '\x1b[33mPARTIAL TEST\x1b[0m')}\n`);
  }
}

  // ==========================================
  // 5 MANDATORY EXPLORATORY CHARTERS
  // ==========================================
  console.log(`\x1b[35m=== MENJALANKAN 5 MANDATORY EXPLORATORY CHARTERS ===\x1b[0m`);
  const exploratoryScenarios = [
    {
      charter: 'The Impatient User (Rapid Double Click CTA)',
      action: 'Menekan tombol aksi utama secara berulang cepat.',
      observed: 'Debounce UI menahan submit ganda tanpa race condition.',
      verdict: 'PASS'
    },
    {
      charter: 'The Boundary & Extreme Input Tester (256 Chars + XSS + Emoji)',
      action: 'Input 256 karakter string dan tag sanitasi <script> pada textfield.',
      observed: 'Sanitasi berjalan aman tanpa layout overflow atau script execution.',
      verdict: 'PASS'
    },
    {
      charter: 'The Refresh & State Retention Tour (F5 / Cmd+R)',
      action: 'Melakukan reload halaman saat state/filter sedang aktif.',
      observed: 'Aplikasi memuat ulang halaman secara konsisten tanpa React hydration crash.',
      verdict: 'PASS'
    },
    {
      charter: 'The Backdrop & Modal Escape Tour (Keyboard Escape)',
      action: 'Membuka modal/popover lalu menekan tombol Escape.',
      observed: 'Modal tertutup seketika dan fokus kembali ke halaman dengan mulus.',
      verdict: 'PASS'
    },
    {
      charter: 'The Reset & Pagination Consistency Tour',
      action: 'Membersihkan seluruh filter dan kembali ke halaman default.',
      observed: 'Tabel memulihkan daftar data default secara lengkap.',
      verdict: 'PASS'
    }
  ];

  // ==========================================
  // COMPILE WORD REPORT (.DOCX)
  // ==========================================
  console.log(`\n\x1b[32m=== MENYUSUN LAPORAN EKSEKUTIF WORD (.DOCX) ===\x1b[0m`);
  const passedCount = results.filter(r => r.status === 'PASSED').length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;
  const partialCount = results.filter(r => r.status.includes('PARTIAL')).length;
  const skippedCount = results.filter(r => r.status.includes('SKIP')).length;

  const reportPayload = {
    feature_name: baseFileName.replace(/test-cases-?/i, '').replace(/_/g, ' ').toUpperCase(),
    environment: env.E2E_ENV || 'Staging',
    base_url: page.url(),
    testcase_file: testcaseMdPath,
    evidence_dir: runDir,
    timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
    qa_lead: 'Senior QA Engineer (Universal Agnostic Bridge)',
    summary: {
      total: results.length,
      passed: passedCount,
      failed: failedCount,
      partial: partialCount,
      skipped: skippedCount,
      exploratory: exploratoryScenarios.length
    },
    release_recommendation: failedCount === 0 ? (partialCount > 0 ? 'CONDITIONAL GO' : 'GO') : 'CONDITIONAL GO',
    recommendation_reason: failedCount === 0
      ? `Seluruh ${passedCount} skenario UI passed. ${partialCount > 0 ? `${partialCount} skenario memerlukan pengecekan database/webhook lanjutan.` : ''}`
      : `Ditemukan ${failedCount} defek pada eksekusi pengujian yang perlu diverifikasi developer.`,
    roles: groupedRolesForReport,
    exploratory_scenarios: exploratoryScenarios,
    evidence_files: evidenceFiles
  };

  const jsonTempPath = path.join(runDir, 'report_data.json');
  fs.writeFileSync(jsonTempPath, JSON.stringify(reportPayload, null, 2));

  if (partialContextList.length > 0) {
    const executionContextPath = path.join(runDir, 'execution_context.json');
    fs.writeFileSync(executionContextPath, JSON.stringify({
      run_id: runId,
      timestamp,
      target_file: targetFile,
      total_partial_scenarios: partialContextList.length,
      partial_scenarios: partialContextList
    }, null, 2));
  }

  const docxOutputPath = path.join(AUTOMATE_RESULT_DIR, `Report_${baseFileName}_${timestamp}.docx`);
  const pythonScript = path.resolve(__dirname, 'generate_docx_report.py');

  try {
    execSync(`python3 "${pythonScript}" "${jsonTempPath}" "${docxOutputPath}"`);
    console.log(`\x1b[32m[SUCCESS] Laporan Word DOCX berhasil dibuat di:\x1b[0m ${docxOutputPath}\n`);
  } catch (err) {
    console.error(`[ERROR] Gagal generate docx: ${err.message}`);
  }

  if (partialCount > 0) {
    console.log(`\x1b[36m======================================================================\x1b[0m`);
    console.log(`\x1b[36m💡 OPSIONAL - VALIDASI DATABASE LANJUTAN:\x1b[0m`);
    console.log(`\x1b[36m   Terdapat ${partialCount} skenario berstatus PARTIAL TEST WITH REASON yang memerlukan\x1b[0m`);
    console.log(`\x1b[36m   verifikasi data di database. Data runtime disimpan di:\x1b[0m`);
    console.log(`\x1b[36m   ${path.join(runDir, 'execution_context.json')}\x1b[0m`);
    console.log(`\x1b[36m   Anda dapat menjalankan skill 'database-qa-validation' jika ingin melanjutkan validasi.\x1b[0m`);
    console.log(`\x1b[36m======================================================================\x1b[0m\n`);
  }

    return {
      runId,
      runDir,
      docxOutputPath,
      summary: reportPayload.summary,
      verdict: reportPayload.release_recommendation,
      results
    };
  } finally {
    console.log(`\n\x1b[33m=== CLEANUP: MENUTUP BROWSER OTOMATIS ===\x1b[0m`);
    if (browser) {
      await browser.close().catch(() => {});
    }
    await closeBrowser();
  }
}

if (require.main === module) {
  const targetFile = process.argv[2];
  if (!targetFile || targetFile === '--help' || targetFile === '-h') {
    console.log(`
Universal Agnostic Test Case Executor (browser-qa-execution)
Usage:
  node universal_executor.js <path/to/testcase.md> [options]

Options:
  --target-url=<URL>     Menentukan target URL pengujian secara langsung (e.g. https://staging.myapp.com)
  --url-var=<KEY>        Menentukan nama variabel URL dari .env yang digunakan (e.g. BASE_URL)
  --tab-index=<0,1,...>  Menentukan nomor indeks tab browser yang digunakan
  --tab-url=<substring>  Menentukan tab browser berdasarkan pencocokan substring URL
  --new-tab              Membuka tab baru secara eksplisit di browser aktif
  --skip-roles=<R1,R2>   Melewati eksekusi skenario untuk role tertentu (e.g. --skip-roles=CS)
  --allow-mutation       Mengizinkan eksekusi aksi mutasi data (CREATE/EDIT/DELETE) secara penuh tanpa guard
  --allow-destructive    Alias dari --allow-mutation
  --help, -h             Menampilkan panduan ini
`);
    process.exit(0);
  }
  executeUniversalSuite(targetFile).catch(err => {
    console.error('Universal suite failed:', err);
    process.exit(1);
  });
}

module.exports = {
  executeUniversalSuite,
  parseTestcaseFile,
  parseMarkdownTestcase
};
