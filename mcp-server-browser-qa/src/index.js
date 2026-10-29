#!/usr/bin/env node

/**
 * Browser QA Guard MCP Server
 * Model Context Protocol (MCP) Server for deterministic, secure QA browser automation.
 * Enforces Gate 2 (Tab/Domain Guard), Gate 3 (Zero-Leak Credential Vault),
 * Gate 4 (Pre-flight Mutation Guard), Gate 5 (Evidence Capture), and Gate 6 (RBAC Session Reset).
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

// Initialize Guard Engines
const mutationGuard = new MutationGuard();
const domainGuard = new DomainGuard(['localhost', '127.0.0.1']);
const credentialVault = new CredentialVault(WORKSPACE_ROOT);
const browserManager = new BrowserManager({ cdpPort: 9222 });

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
        description: 'Gate 2: Meluncurkan Chrome (jika belum aktif) atau menyambungkan ke tab target. Menerapkan Domain Allowlist untuk mencegah navigasi ke domain yang tidak diizinkan.',
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
        description: 'Gate 4: Mengatur kebijakan mutasi data (CREATE / EDIT / DELETE). Jika allow_mutation=false, semua aksi mutasi akan otomatis diblokir di level runtime dan ditandai PARTIAL TEST WITH REASON.',
        inputSchema: {
          type: 'object',
          properties: {
            allow_mutation: { type: 'boolean', description: 'Apakah aksi create/edit/delete diizinkan nyata di browser' },
            confirmed_by: { type: 'string', description: 'Identitas atau alasan konfirmasi user' },
          },
          required: ['allow_mutation'],
        },
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
        description: 'Gate 4: Menjalankan aksi UI (click, fill, select, hover, press, wait) dengan Safe Mode Guard otomatis. Menolak eksekusi mutasi jika izin belum diberikan.',
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

        // Domain guard check
        domainGuard.setTargetUrl(targetUrl);
        if (!domainGuard.isUrlAllowed(targetUrl)) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Domain Guard REJECT: URL "${targetUrl}" tidak diizinkan atau di luar boundary pengujian staging yang aman.`
            }]
          };
        }

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
              message: 'Browser berhasil terhubung dan siap menjalankan skenario pengujian.'
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
        const { allow_mutation, confirmed_by } = args;
        const res = mutationGuard.setPermission(allow_mutation, confirmed_by || 'user');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'POLICY_UPDATED',
              mode: res.mode,
              allowMutation: res.mutationAllowed,
              notice: res.mutationAllowed
                ? 'PERINGATAN: Live Mutation AKTIF. Aksi create/edit/delete akan dijalankan nyata.'
                : 'Safe Mode AKTIF: Aksi mutasi akan otomatis diblokir dan ditandai PARTIAL TEST WITH REASON.'
            }, null, 2)
          }]
        };
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
        const { action, selector, value, isMutation = false } = args;

        // 1. Evaluate with Mutation Guard (Gate 4)
        const guardCheck = mutationGuard.evaluateAction(action, selector, value, isMutation);
        if (guardCheck.blocked) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: guardCheck.status,
                actionBlocked: true,
                reason: guardCheck.reason,
                selector
              }, null, 2)
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

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'PASSED',
              action,
              selector,
              executed: true
            }, null, 2)
          }]
        };
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

      case 'qa_reset_session': {
        const result = await browserManager.resetSession();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'qa_close_browser': {
        const result = await browserManager.closeBrowser();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'CLOSED',
              message: 'Browser Chrome berhasil ditutup secara bersih.'
            }, null, 2)
          }]
        };
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
