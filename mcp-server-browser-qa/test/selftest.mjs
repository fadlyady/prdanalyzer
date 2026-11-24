/**
 * Self-test browser-qa-guard tanpa Chrome: (1) protokol MCP (tools, policy, domain reject sebelum launch)
 * (2) MutationGuard browser (klasifikasi selector + teks elemen, link navigasi, TAG, external, finansial)
 * (3) DomainGuard (allowlist .env, deny production, target tidak auto-allow).
 * Jalankan: npm run selftest
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { MutationGuard, DomainGuard, classify } from '../src/guards.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, failN = 0; const ok = (c, m) => { c ? pass++ : failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };

// ---- 1. MCP protocol ----
const client = new Client({ name: 'selftest', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: 'node', args: [path.join(here, '../src/index.js')] }));
const { tools } = await client.listTools(); ok(tools.length === 11, `listTools = ${tools.length} tools`);
const raw = async (name, args = {}) => (await client.callTool({ name, arguments: args }));
const call = async (name, args = {}) => JSON.parse((await raw(name, args)).content[0].text);
ok((await call('qa_set_mutation_permission')).status === 'CURRENT_POLICY', 'tanpa argumen -> baca policy');
const p0 = await call('qa_set_mutation_permission', { allow_mutation: false }); ok(p0.mode === 'safe' && p0.legacyMode === 'SAFE_MODE_ACTIVE', 'legacy allow_mutation=false -> safe');
const rj = await raw('qa_init_browser', { targetUrl: 'https://example-production-host.invalid/', autoLaunch: false });
ok(rj.isError && /DOMAIN_GUARD_REJECT/.test(rj.content[0].text), 'init ke host di luar allowlist ditolak sebelum launch');
ok((await call('qa_get_mutation_ledger')).executed === 0, 'ledger kosong');
await client.close();

// ---- 2. MutationGuard browser ----
const g = new MutationGuard({});
ok(g.evaluateAction('click', '#btn-delete', '', false, { text: 'Hapus' }).blocked, 'safe: klik Hapus diblokir');
ok(!g.evaluateAction('fill', 'input[name=name]', 'Tambah produk baru').blocked, 'safe: fill dengan kata "Tambah" bukan mutasi');
ok(g.evaluateAction('click', '#x', '', false, { text: 'Simpan' }).blocked, 'safe: teks elemen "Simpan" terdeteksi walau selector netral');
ok(!g.evaluateAction('click', 'a.sidebar', '', false, { text: 'Kirim broadcast', isLink: true }).blocked, 'link navigasi "Kirim broadcast" bukan mutasi');
ok(g.evaluateAction('press', 'input#q', 'Enter', false, { inForm: true }).blocked, 'safe: Enter di dalam form = submit diblokir');
ok(!g.evaluateAction('press', 'input#q', 'Tab', false, { inForm: true }).blocked, 'Tab bukan mutasi');
g.setPermission(true, 'selftest', { tag: 'QAAUTO-B1' });
ok(g.mode === 'full', 'legacy true -> full');
ok(!g.evaluateAction('click', '#add', '', false, { text: 'Tambah' }).blocked, 'full: create jalan');
ok(g.evaluateAction('click', '#del', '', false, { text: 'Hapus', ctx: 'Label Prioritas  Hapus' }).blocked, 'full: hapus baris tanpa TAG diblokir');
ok(!g.evaluateAction('click', '#del', '', false, { text: 'Hapus', ctx: 'QAAUTO-B1 label  Hapus' }).blocked, 'full: hapus baris ber-TAG jalan');
ok(g.evaluateAction('click', '#send', '', false, { text: 'Kirim' }).blocked, 'full: kirim (external) diblokir');
ok(g.evaluateAction('click', '#pay', '', false, { text: 'Top Up' }).blocked, 'full: top up (finansial) diblokir');
ok(g.evaluateAction('click', '#x', '', false, { text: 'Keluar' }).blocked, 'logout tanpa penanda diblokir');
ok(classify('btn-hapus-pesan').category === 'delete' && classify('Edit balasan cepat').category === 'update', 'klasifikasi kategori');

// ---- 3. DomainGuard ----
const d = new DomainGuard({ E2E_BASE_URL_STAGING: 'https://stag-dashboard.example.com', QA_STAGING_HOSTS: 'staging.example.com', QA_PROD_HOSTS_DENY: 'dashboard.example.com,*.prod.example.com' });
ok(d.check('https://stag-dashboard.example.com/inbox').ok, 'host dari E2E_BASE_URL_STAGING diizinkan');
ok(d.check('https://api.staging.example.com').ok, 'subdomain staging diizinkan');
ok(!d.check('https://dashboard.example.com').ok, 'host production (deny) ditolak');
ok(!d.check('https://x.prod.example.com').ok, 'wildcard deny ditolak');
d.setTargetUrl('https://evil.example.com'); ok(!d.isUrlAllowed('https://evil.example.com'), 'target URL tidak auto-masuk allowlist');
ok(!new DomainGuard({}).check('https://stag.example.com').ok, 'allowlist kosong -> tolak dengan instruksi konfigurasi');

console.log(`\n${pass} PASS, ${failN} FAIL`); process.exit(failN ? 1 : 0);
