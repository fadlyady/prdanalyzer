#!/usr/bin/env node

/**
 * Browser QA Guard MCP Server
 * Model Context Protocol (MCP) Server for deterministic, secure QA browser automation.
 * Enforces Gate 2 (Tab/Domain Guard), Gate 3 (Zero-Leak Credential Vault),
 * Gate 4 (Mutation Policy berlevel: safe | full | full_external — lihat policy.js),
 * Gate 5 (Evidence Capture + Mutation Ledger), and Gate 6 (RBAC Session Reset).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { fileURLToPath } from 'url';

import { MutationGuard, DomainGuard, CredentialVault } from './guards.js';
import { BrowserManager } from './browser-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../');

// Initialize Guard Engines (konfigurasi dibaca ulang dari .env setiap init / set permission)
const credentialVault = new CredentialVault(WORKSPACE_ROOT);
const mutationGuard = new MutationGuard(credentialVault.readRawEnv());
const domainGuard = new DomainGuard(credentialVault.readRawEnv());
const browserManager = new BrowserManager({ cdpPort: 9222 });
const reloadPolicy = () => { const env = credentialVault.readRawEnv(); mutationGuard.reload(env); domainGuard.reload(env); return env; };
const ensureLedger = (featureName) => {
  if (featureName || !browserManager.evidenceDir) browserManager.setEvidenceDirectory(featureName || 'browser', WORKSPACE_ROOT);
  mutationGuard.setLedgerFile(path.join(browserManager.evidenceDir, 'mutation_ledger.jsonl'));
  return path.relative(WORKSPACE_ROOT, mutationGuard.ledgerFile);
};
const json = (obj, isError = false) => ({ ...(isError ? { isError: true } : {}), content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const withTag = v => (typeof v === 'string' ? v.replace(/\{\{TAG\}\}/g, mutationGuard.tag || '') : v);

/** Info elemen untuk Gate 4: teks tombol, teks kontainer (baris/kartu/dialog/form), link navigasi, di dalam form. */
async function elementInfo(page, selector) {
  try {
    return await page.locator(selector).first().evaluate((el) => {
      const txt = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      const box = el.closest('tr,li,[role=row],[role=listitem],[role=dialog],dialog,.modal,[class*=modal],[class*=drawer],article,form');
      const a = el.closest('a[href]'); const href = a ? a.getAttribute('href') || '' : '';
      return { text: txt.slice(0, 200), ctx: box ? (box.innerText || '').slice(0, 2000) : '', isLink: Boolean(a) && !/^(#|javascript:)/i.test(href), inForm: Boolean(el.closest('form')) };
    }, null, { timeout: 3000 });
  } catch { return {}; }
}

// Create MCP Server Instance
const server = new Server(
  {
    name: 'browser-qa-guard',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define Exposed Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'qa_check_browser_state',
        description: 'Gate 2: Memeriksa apakah Chrome CDP aktif pada port 9222 dan mendaftar seluruh tab terbuka untuk mencegah tab hijacking.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'qa_init_browser',
        description: 'Gate 2: Meluncurkan Chrome (jika belum aktif) atau menyambungkan ke tab target. Domain Allowlist dari .env (QA_STAGING_HOSTS / *_BASE_URL_STAGING); host di QA_PROD_HOSTS_DENY selalu ditolak. Respons memuat kebijakan mutasi aktif (Gate 4) untuk ditampilkan ke user.',
        inputSchema: {
          type: 'object',
          properties: {
            targetUrl: { type: 'string', description: 'URL target pengujian staging' },
            autoLaunch: { type: 'boolean', description: 'Luncurkan Chrome otomatis jika belum aktif', default: true },
            selectedTabId: { type: 'string', description: 'Tab ID spesifik jika ingin menggunakan tab yang sudah terbuka' },
            cleanExtraTabs: { type: 'boolean', description: 'Tutup tab-tab sisa pengujian lain agar hemat memori', default: true },
          },
          required: ['targetUrl'],
        },
      },
      {
        name: 'qa_list_available_roles',
        description: 'Gate 3: Mendaftar role yang tersedia di .env dengan password yang TERMASKING PENUH untuk mencegah kebocoran kredensial ke prompt AI. Mendeteksi ambiguitas jika ada lebih dari 1 user per role prefix.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'qa_set_mutation_permission',
        description: 'Gate 4: Mengatur mode mutasi. safe = read-only (mutasi -> PARTIAL TEST WITH REASON); full = CREATE/UPDATE/DELETE nyata di staging (update/delete hanya pada data ber-TAG); full_external = full + kirim/broadcast ke penerima di QA_TEST_RECIPIENT_ALLOWLIST. Finansial selalu diblokir (kecuali QA_FINANCIAL_SANDBOX=true). Mengembalikan dataTag yang WAJIB dipakai pada data yang dibuat ({{TAG}} di value fill).',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['safe', 'full', 'full_external'], description: 'Mode mutasi. Jika kosong: allow_mutation=true -> QA_MUTATION_MODE .env (atau full), false -> safe' },
            allow_mutation: { type: 'boolean', description: 'Legacy: true = full, false = safe' },
            data_tag: { type: 'string', description: 'TAG data uji (opsional, untuk rerun memakai TAG lama)' },
            featureName: { type: 'string', description: 'Nama fitur — folder run evidence & mutation_ledger.jsonl' },
            confirmed_by: { type: 'string', description: 'Identitas atau alasan konfirmasi user' },
          },
        },
      },
      {
        name: 'qa_get_mutation_ledger',
        description: 'Gate 5: Ringkasan mutasi yang dijalankan/diblokir pada run ini (per kategori, data yang dibuat, lokasi mutation_ledger.jsonl) + petunjuk teardown data ber-TAG.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'qa_login_role',
        description: 'Gate 3: Melakukan autofill dan submit login ke browser secara langsung tanpa pernah membocorkan password plaintext ke context AI.',
        inputSchema: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Nama role (misal: "CS", "ADMIN", "OWNER")' },
            suffix: { type: 'string', description: 'Suffix identitas role jika terdapat ambiguitas (misal: "A" untuk USER_CS_A)' },
            usernameSelector: { type: 'string', description: 'CSS Selector input username/email (opsional, auto-fallback)' },
            passwordSelector: { type: 'string', description: 'CSS Selector input password (opsional, auto-fallback)' },
            submitSelector: { type: 'string', description: 'CSS Selector tombol submit login (opsional, auto-fallback)' },
          },
          required: ['role'],
        },
      },
      {
        name: 'qa_execute_action',
        description: 'Gate 4: Menjalankan aksi UI (click, fill, select, hover, press, wait) dengan Mutation Policy otomatis (klasifikasi dari selector + teks elemen). Aksi yang melanggar policy -> PARTIAL TEST WITH REASON. Gunakan {{TAG}} di value untuk menandai data uji. Setelah aksi, URL dicek ulang terhadap domain allowlist.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['click', 'fill', 'select', 'hover', 'press', 'wait_for_selector'],
              description: 'Jenis aksi UI yang ingin dijalankan'
            },
            selector: { type: 'string', description: 'CSS/Text selector elemen target' },
            value: { type: 'string', description: 'Nilai input jika aksinya fill/select/press' },
            isMutation: { type: 'boolean', description: 'Tandai true jika aksi ini mengubah/membuat/menghapus data', default: false },
            mutationType: { type: 'string', enum: ['create', 'update', 'delete', 'state_change', 'external', 'financial', 'session_end', 'navigation'], description: 'Kategori eksplisit. "navigation" hanya menurunkan kategori create (mis. tombol Tambah yang membuka form).' },
            tcId: { type: 'string', description: 'ID Test Case (untuk ledger & evidence)' },
            step: { type: 'string', description: 'Nama langkah (untuk ledger & evidence)' },
          },
          required: ['action', 'selector'],
        },
      },
      {
        name: 'qa_assert_element',
        description: 'Gate 5: Melakukan verifikasi UI state (visible, hidden, contains_text, attribute_equals, url_contains).',
        inputSchema: {
          type: 'object',
          properties: {
            assertionType: {
              type: 'string',
              enum: ['visible', 'hidden', 'contains_text', 'attribute_equals', 'url_contains'],
              description: 'Tipe assertion'
            },
            selector: { type: 'string', description: 'CSS/Text selector target' },
            expectedValue: { type: 'string', description: 'Nilai teks/atribut yang diharapkan' },
            timeoutMs: { type: 'number', description: 'Timeout assertion dalam milidetik', default: 5000 },
          },
          required: ['assertionType'],
        },
      },
      {
        name: 'qa_capture_evidence',
        description: 'Gate 5: Mengambil screenshot bukti uji dan menyimpannya secara otomatis ke direktori browser-execution/automate-result/run_<Feature>_<timestamp>/ dengan format penamaan standar.',
        inputSchema: {
          type: 'object',
          properties: {
            featureName: { type: 'string', description: 'Nama fitur yang sedang diuji' },
            tcId: { type: 'string', description: 'ID Test Case (misal: TC_FLOW_001)' },
            stepName: { type: 'string', description: 'Nama langkah pengujian' },
            status: {
              type: 'string',
              enum: ['PASSED', 'FAILED', 'PARTIAL TEST WITH REASON', 'SKIP WITH REASON'],
              description: 'Status hasil uji langkah ini'
            },
          },
          required: ['featureName', 'tcId', 'stepName', 'status'],
        },
      },
      {
        name: 'qa_reset_session',
        description: 'Gate 6: Membersihkan cookies, localStorage, dan sessionStorage browser untuk mencegah RBAC contamination saat berganti role uji.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'qa_close_browser',
        description: 'Post-flight: Menutup koneksi dan browser Chrome secara bersih saat pengujian selesai.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle Tool Executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'qa_check_browser_state': {
        const isAlive = await browserManager.isCdpAlive();
        const tabs = isAlive ? await browserManager.getOpenTabs() : [];
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              cdpActive: isAlive,
              cdpPort: browserManager.cdpPort,
              totalTabs: tabs.length,
              tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url })),
              recommendation: isAlive && tabs.length > 0
                ? 'Browser aktif terdeteksi. Konfirmasikan ke pengguna apakah ingin menggunakan tab saat ini atau membuka tab baru.'
                : 'Browser belum aktif pada port CDP. Gunakan qa_init_browser untuk meluncurkannya otomatis.'
            }, null, 2)
          }]
        };
      }

      case 'qa_init_browser': {
        const { targetUrl, autoLaunch = true, selectedTabId, cleanExtraTabs = true } = args;

        // Domain guard check (allowlist dari .env, target TIDAK otomatis ditambahkan)
        reloadPolicy();
        const dg = domainGuard.check(targetUrl);
        if (!dg.ok) {
          return json({ status: 'DOMAIN_GUARD_REJECT', targetUrl, reason: dg.reason }, true);
        }
        domainGuard.setTargetUrl(targetUrl);

        // Launch if needed
        if (autoLaunch) {
          await browserManager.launchChrome(targetUrl);
        }

        const conn = await browserManager.connect(targetUrl, selectedTabId);
        if (cleanExtraTabs) {
          await browserManager.cleanExtraTabs();
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'READY',
              activeUrl: conn.currentUrl,
              pageTitle: conn.title,
              domainCheck: domainGuard.check(conn.currentUrl || targetUrl),
              mutationPolicy: mutationGuard.summary(),
              message: 'Browser berhasil terhubung dan siap menjalankan skenario pengujian. Tampilkan mutationPolicy ke user sebelum eksekusi.'
            }, null, 2)
          }]
        };
      }

      case 'qa_list_available_roles': {
        const roles = credentialVault.listAvailableRoles();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              availableRoles: roles,
              notice: 'Password disembunyikan sepenuhnya dari context AI demi keamanan zero-leakage.'
            }, null, 2)
          }]
        };
      }

      case 'qa_set_mutation_permission': {
        const { mode, allow_mutation, data_tag, featureName, confirmed_by } = args;
        reloadPolicy();
        if (!mode && typeof allow_mutation !== 'boolean') return json({ status: 'CURRENT_POLICY', ...mutationGuard.summary() });
        if (mode && mode !== 'safe' && browserManager.activePage) {
          const dg = domainGuard.check(browserManager.activePage.url());
          if (!dg.ok) return json({ status: 'DOMAIN_GUARD_REJECT', reason: `Mode ${mode} ditolak: halaman aktif bukan staging. ${dg.reason}` }, true);
        }
        const res = mutationGuard.setPermission(mode ? mode !== 'safe' : allow_mutation, confirmed_by || 'user', { mode, tag: data_tag });
        const ledger = (res.mode !== 'safe' || featureName) ? ensureLedger(featureName) : null;
        mutationGuard.record({ status: 'POLICY', category: 'policy', target: res.mode, actor: confirmed_by || 'user' });
        return json({ status: 'POLICY_UPDATED', ...res, ledgerFile: ledger });
      }

      case 'qa_login_role': {
        const { role, suffix, usernameSelector, passwordSelector, submitSelector } = args;
        const creds = credentialVault.getCredentialsForRole(role, suffix);

        if (!creds || !creds.username) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Gate 3 Missing Credential: Kredensial untuk role "${role}" (suffix: ${suffix || 'any'}) tidak ditemukan di .env.`
            }]
          };
        }

        if (!browserManager.activePage) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Browser page belum aktif. Panggil qa_init_browser terlebih dahulu.' }]
          };
        }

        const page = browserManager.activePage;

        // Auto-fallback selectors
        const uSelector = usernameSelector || 'input[type="email"], input[name="username"], input[name="email"], input[id="username"], input[id="email"]';
        const pSelector = passwordSelector || 'input[type="password"], input[name="password"], input[id="password"]';
        const sSelector = submitSelector || 'button[type="submit"], button:has-text("Login"), button:has-text("Masuk"), input[type="submit"]';

        await page.waitForSelector(uSelector, { timeout: 10000 });
        await page.fill(uSelector, creds.username);
        await page.fill(pSelector, creds.password);
        await page.click(sSelector);
        await page.waitForLoadState('domcontentloaded').catch(() => {});

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'LOGIN_EXECUTED',
              role,
              keyUsed: creds.key,
              username: creds.username.slice(0, 3) + '***',
              currentUrl: page.url(),
              notice: 'Autofill berhasil dijalankan tanpa membocorkan plaintext password.'
            }, null, 2)
          }]
        };
      }

      case 'qa_execute_action': {
        const { action, selector, isMutation = false, mutationType, tcId, step } = args;
        const value = withTag(args.value);

        if (!browserManager.activePage) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Browser page belum aktif. Panggil qa_init_browser terlebih dahulu.' }]
          };
        }

        const page = browserManager.activePage;

        // 1. Evaluate with Mutation Policy (Gate 4) — selector + teks elemen + konteks baris/dialog
        const el = await elementInfo(page, selector);
        const needsScreen = !['fill', 'select', 'hover', 'wait_for_selector'].includes(action);
        const screenText = needsScreen ? await page.evaluate(() => (document.body?.innerText || '').slice(0, 20000)).catch(() => '') : '';
        const guardCheck = mutationGuard.evaluateAction(action, selector, value, isMutation, el, { mutationType, screenText });
        const pageDomain = domainGuard.check(page.url());
        if (!guardCheck.blocked && guardCheck.destructive && !pageDomain.ok) {
          Object.assign(guardCheck, { blocked: true, status: 'PARTIAL TEST WITH REASON', reason: `Mutasi diblokir: halaman aktif bukan staging. ${pageDomain.reason}` });
        }
        if (guardCheck.category) ensureLedger();
        if (guardCheck.blocked) {
          let evidence = null;
          if (tcId) { evidence = await browserManager.captureScreenshot(`${tcId}_${step || 'step'}_partial_mutation`).catch(() => null); }
          mutationGuard.record({ status: 'BLOCKED', category: guardCheck.category, keyword: guardCheck.keyword, action, target: selector, element: (el.text || '').slice(0, 80), tcId, step, url: page.url(), reason: guardCheck.reason });
          return json({ status: guardCheck.status, actionBlocked: true, category: guardCheck.category, reason: guardCheck.reason, selector, evidence });
        }

        // 2. Execute via Playwright
        switch (action) {
          case 'click':
            await page.click(selector, { timeout: 10000 });
            break;
          case 'fill':
            await page.fill(selector, value || '', { timeout: 10000 });
            break;
          case 'select':
            await page.selectOption(selector, value || '', { timeout: 10000 });
            break;
          case 'hover':
            await page.hover(selector, { timeout: 10000 });
            break;
          case 'press':
            await page.press(selector, value || 'Enter', { timeout: 10000 });
            break;
          case 'wait_for_selector':
            await page.waitForSelector(selector, { timeout: 10000 });
            break;
          default:
            throw new Error(`Aksi tidak dikenali: ${action}`);
        }

        if (guardCheck.destructive) {
          mutationGuard.record({ status: 'EXECUTED', category: guardCheck.category, keyword: guardCheck.keyword, action, target: selector, element: (el.text || '').slice(0, 80), tcId, step, url: page.url(), recipient: guardCheck.recipient, tagEvidence: guardCheck.tagEvidence });
        }

        // 3. Post-action domain check: keluar dari staging -> paksa Safe Mode
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        const after = domainGuard.check(page.url());
        let domainViolation;
        if (!after.ok) {
          const prev = mutationGuard.mode;
          if (prev !== 'safe') mutationGuard.setMode('safe', { actor: 'domain-guard' });
          domainViolation = { url: page.url(), reason: after.reason, mutationModeForcedTo: 'safe', previousMode: prev };
          mutationGuard.record({ status: 'DOMAIN_VIOLATION', category: 'domain', target: page.url(), tcId, step, reason: after.reason });
        }

        return json({
          status: domainViolation ? 'PASSED_WITH_DOMAIN_WARNING' : 'PASSED',
          action,
          selector,
          executed: true,
          mutation: guardCheck.destructive ? { category: guardCheck.category, mode: guardCheck.mode, tag: guardCheck.tag } : undefined,
          domainViolation,
        });
      }

      case 'qa_assert_element': {
        const { assertionType, selector, expectedValue, timeoutMs = 5000 } = args;

        if (!browserManager.activePage) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Browser page belum aktif. Panggil qa_init_browser terlebih dahulu.' }]
          };
        }

        const page = browserManager.activePage;
        let passed = false;
        let actual = null;

        switch (assertionType) {
          case 'visible':
            await page.waitForSelector(selector, { state: 'visible', timeout: timeoutMs });
            passed = true;
            break;
          case 'hidden':
            await page.waitForSelector(selector, { state: 'hidden', timeout: timeoutMs });
            passed = true;
            break;
          case 'contains_text': {
            await page.waitForSelector(selector, { timeout: timeoutMs });
            actual = await page.textContent(selector);
            passed = (actual || '').includes(expectedValue);
            break;
          }
          case 'url_contains': {
            actual = page.url();
            passed = actual.includes(expectedValue);
            break;
          }
          default:
            throw new Error(`Assertion type tidak didukung: ${assertionType}`);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: passed ? 'PASSED' : 'FAILED',
              assertionType,
              selector,
              expectedValue,
              actualValue: actual
            }, null, 2)
          }]
        };
      }

      case 'qa_capture_evidence': {
        const { featureName, tcId, stepName, status } = args;
        browserManager.setEvidenceDirectory(featureName, WORKSPACE_ROOT);
        const screenshotName = `${tcId}_${stepName}_${status}`;
        const savedPath = await browserManager.captureScreenshot(screenshotName);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'EVIDENCE_SAVED',
              tcId,
              stepName,
              qaStatus: status,
              screenshotPath: savedPath
            }, null, 2)
          }]
        };
      }

      case 'qa_get_mutation_ledger': {
        return json(mutationGuard.ledgerSummary());
      }

      case 'qa_reset_session': {
        const result = await browserManager.resetSession();
        // Ganti role dalam run yang sama: mode mutasi & TAG dipertahankan, memori konteks TAG dibersihkan.
        mutationGuard.tagContextUntil = -1; mutationGuard.tagContextFrom = null;
        return json({ ...(result || {}), mutationPolicy: mutationGuard.summary().mode, dataTag: mutationGuard.tag });
      }

      case 'qa_close_browser': {
        const result = await browserManager.closeBrowser();
        const ledger = mutationGuard.ledgerSummary();
        reloadPolicy();
        mutationGuard.resetToDefault();
        mutationGuard.ledger = []; mutationGuard.setLedgerFile(null); browserManager.evidenceDir = null; browserManager.evidenceFeature = null;
        return json({
          status: 'CLOSED',
          message: 'Browser Chrome berhasil ditutup secara bersih. Izin mutasi di-reset ke default.',
          mutationLedger: ledger,
          closeResult: result,
        });
      }

      default:
        throw new Error(`Tool "${name}" tidak ditemukan pada browser-qa-guard MCP server.`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Error pada tool "${name}": ${error.message}`
      }]
    };
  }
});

// Start Server with Stdio Transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('Browser QA Guard MCP Server running on stdio.\n');
}

main().catch(err => {
  process.stderr.write(`Fatal error starting MCP Server: ${err.message}\n`);
  process.exit(1);
});
