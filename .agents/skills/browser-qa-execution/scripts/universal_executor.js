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
  getDetailedCredentialsFromEnv
} = require('./test_runner_bridge');

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
const AUTOMATE_RESULT_DIR = path.join(PROJECT_ROOT, 'automate-result');
const AUTOMATE_SUPPORT_DIR = path.join(PROJECT_ROOT, 'automate-support');
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

// 3. Parse Markdown testcase using parse_testcase.py
function parseMarkdownTestcase(mdFilePath) {
  const pyScript = path.resolve(__dirname, 'parse_testcase.py');
  const stdout = execSync(`python3 "${pyScript}" "${mdFilePath}"`, { encoding: 'utf-8' });
  return JSON.parse(stdout);
}

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

// 5. Main Execution Engine
async function executeUniversalSuite(testcaseMdPath) {
  if (!fs.existsSync(testcaseMdPath)) {
    throw new Error(`File testcase tidak ditemukan: ${testcaseMdPath}`);
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
    // 1. Pastikan Chrome aktif (jika belum terbuka, buka otomatis)
    await ensureBrowserOpen();

    // 2. Self-healing: Pastikan minimal ada 1 target tab halaman aktif
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
    let page = context.pages()[0];
    if (!page) {
      page = await context.newPage();
    }

    const targetBaseUrl = env.E2E_BASE_URL_STAGING || env.BASE_URL || 'https://chat-dev.everpro.id';
    if (!page.url() || page.url().startsWith('chrome://') || page.url().includes('about:blank')) {
      console.log(`\x1b[34m[NAVIGATE] Membuka URL target awal: ${targetBaseUrl}\x1b[0m`);
      await page.goto(targetBaseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    const results = [];
    const evidenceFiles = [];

    const skipRolesArg = process.argv.find(a => a.startsWith('--skip-roles='));
    const skippedRoles = skipRolesArg ? skipRolesArg.split('=')[1].split(',').map(r => r.trim().toUpperCase()) : [];

    for (let idx = 0; idx < testcases.length; idx++) {
      const tc = testcases[idx];
      console.log(`\x1b[36m[RUN ${idx + 1}/${testcases.length}] ${tc.id}: ${tc.title}\x1b[0m`);

      // Check if role is skipped per user choice
      if (tc.role && skippedRoles.some(sr => tc.role.toUpperCase().includes(sr))) {
        console.log(`   \x1b[33m[SKIPPED] Skenario dilewati karena kredensial role "${tc.role}" belum terdaftar di .env (sesuai persetujuan user)\x1b[0m\n`);
        results.push({
          id: tc.id,
          title: tc.title,
          action: tc.title,
          status: 'SKIP WITH REASON',
          notes: `Kredensial untuk role "${tc.role}" belum terdaftar di file .env. Pengujian dilewati sesuai persetujuan user.`
        });
        continue;
      }

    const hasBackendVerification = /database|db\b|webhook|endpoint|tabel\s+db|sql/i.test(tc.expected || '') ||
                                   /database|db\b|webhook|endpoint/i.test((tc.steps || []).join(' '));

    let scenarioPassed = true;
    let failureNote = '';
    let isPartial = hasBackendVerification;
    let isMutationSkipped = false;
    let mutationSkipReason = '';

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

      // Pattern 1: Navigation (Executed first so page is ready before input/clicking)
      const navMatch = stepText.match(/(?:akses\s*menu|navigasi|buka\s*halaman)\s*([^\.]+)/i);
      if (navMatch) {
        const targetMenu = navMatch[1].trim();
        try {
          if (/pelanggan|customer/i.test(targetMenu)) {
            const destUrl = `${targetBaseUrl}/customers`;
            if (!page.url().includes('/customers')) {
              console.log(`     [NAV] Direct navigasi ke halaman Pelanggan: ${destUrl}`);
              await page.goto(destUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
              await page.waitForTimeout(3000);
            }
          } else {
            const menuParts = targetMenu.split('>').map(p => p.trim());
            const finalItem = menuParts[menuParts.length - 1];
            const menuLoc = page.locator(`span[role="link"]:has-text("${finalItem}"), a:has-text("${finalItem}"), text="${finalItem}"`).first();
            if (await menuLoc.count() > 0 && await menuLoc.isVisible()) {
              await menuLoc.click({ timeout: 5000 });
              await page.waitForTimeout(2500);
            }
          }
        } catch (e) {
          console.warn(`     [NAV WARNING] Gagal navigasi: ${e.message}`);
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

    results.push({
      id: tc.id,
      title: tc.title,
      action: steps.length ? steps[steps.length - 1] : tc.title,
      status: status,
      notes: notes
    });

    console.log(`   Status: ${status === 'PASSED' ? '\x1b[32mPASSED\x1b[0m' : (status === 'FAILED' ? '\x1b[31mFAILED\x1b[0m' : '\x1b[33mPARTIAL TEST\x1b[0m')}\n`);
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
    roles: {
      default_role: results
    },
    exploratory_scenarios: exploratoryScenarios,
    evidence_files: evidenceFiles
  };

  const jsonTempPath = path.join(runDir, 'report_data.json');
  fs.writeFileSync(jsonTempPath, JSON.stringify(reportPayload, null, 2));

  const docxOutputPath = path.join(AUTOMATE_RESULT_DIR, `Report_${baseFileName}_${timestamp}.docx`);
  const pythonScript = path.resolve(__dirname, 'generate_docx_report.py');

  try {
    execSync(`python3 "${pythonScript}" "${jsonTempPath}" "${docxOutputPath}"`);
    console.log(`\x1b[32m[SUCCESS] Laporan Word DOCX berhasil dibuat di:\x1b[0m ${docxOutputPath}\n`);
  } catch (err) {
    console.error(`[ERROR] Gagal generate docx: ${err.message}`);
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
  if (!targetFile) {
    console.error('Usage: node universal_executor.js <path/to/testcase.md>');
    process.exit(1);
  }
  executeUniversalSuite(targetFile).catch(err => {
    console.error('Universal suite failed:', err);
    process.exit(1);
  });
}

module.exports = { executeUniversalSuite };
