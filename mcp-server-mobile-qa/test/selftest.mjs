/**
 * Self-test tanpa device: (1) protokol MCP (list tools, roles ter-masking, mutation permission, device state)
 * (2) resolver + guard memakai XML asli hasil probe (driver tiruan).
 * Jalankan: npm run selftest   (opsional: SELFTEST_XML_DIR=<folder probe_xxx>)
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { MobileSession } from '../src/session.js';
import { MutationGuard, BuildGuard } from '../src/guards.js';
import { loadMobileFixture } from './profile-fixture.mjs';
const FX = loadMobileFixture();

const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, failN = 0; const ok = (c, m) => { c ? pass++ : failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };

// ---- 1. MCP protocol ----
const client = new Client({ name: 'selftest', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: 'node', args: [path.join(here, '../src/index.js')] }));
const { tools } = await client.listTools(); ok(tools.length === 16, `listTools = ${tools.length} tools`);
const call = async (name, args = {}) => JSON.parse((await client.callTool({ name, arguments: args })).content[0].text);
const roles = await call('qa_list_available_roles');
ok(!JSON.stringify(roles).match(/PASS_|password"\s*:\s*"[^"]/i), 'roles tanpa password');
const pol0 = await call('qa_set_mutation_permission', { allow: false }); ok(pol0.mode === 'safe' && pol0.legacyMode === 'SAFE_MODE_ACTIVE', 'safe mode via legacy allow=false');
const pol1 = await call('qa_set_mutation_permission', { mode: 'full', dataTag: 'QAAUTO-SELFTEST' }); ok(pol1.mode === 'full' && pol1.dataTag === 'QAAUTO-SELFTEST', 'mode full + dataTag');
ok((await call('qa_set_mutation_permission')).status === 'CURRENT_POLICY', 'tanpa argumen -> baca policy');
ok((await call('qa_get_mutation_ledger')).dataTag === 'QAAUTO-SELFTEST', 'ledger summary');
const st = await call('qa_check_device_state'); ok('adb' in st, `device state (adb=${st.adb})`);
const ins = await call('qa_inspect_screen'); ok(ins.status === 'ERROR', 'inspect tanpa sesi -> ERROR terkendali');
await client.close();

// ---- 2. Resolver & guard dengan XML asli ----
const dir = process.env.SELFTEST_XML_DIR || (() => { const r = path.join(here, '../../mobile-execution/probe-result'); const d = fs.existsSync(r) ? fs.readdirSync(r).filter(x => x.startsWith('probe_')).sort().reverse() : []; for (const x of d) { if (fs.readdirSync(path.join(r, x)).some(f => f.includes(FX?.xmlFixture || '__none__'))) return path.join(r, x); } return null; })();
if (!dir || !FX) { console.log(`SKIP  resolver test (${!FX ? 'profil aktif tanpa knowledge/mobile/smoke.json' : 'tidak ada probe XML'})`); }
else {
  const xml = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.endsWith(FX.xmlFixture))), 'utf8');
  const s = new MobileSession({ device: {}, pkg: FX.pkg, activity: '', appiumUrl: 'http://127.0.0.1:4723', buildGuard: new BuildGuard({ allowlist: [FX.pkg] }) });
  s.driver = { getPageSource: async () => xml, execute: async () => {} };
  await s.refresh();
  const r1 = await s.resolve({ label: FX.tabLabel }); ok(r1.ok && r1.tier === 'label', `label tab -> ${r1.tier}`);
  const r2 = await s.resolve({ contains: FX.containsAmbiguous }, { scrollTries: 0 }); ok(!r2.ok && r2.ambiguous, `contains ambigu (${r2.candidates?.length} kandidat)`);
  const r3 = await s.resolve({ id: FX.listItemId }, { allowMany: true }); ok(r3.ok && r3.all.length >= 5, `id prefix item_* -> ${r3.all?.length} item`);
  const r4 = await s.resolve({ id: FX.listItemId.replace('*', '0') }); ok(r4.ok && r4.tier === 'resource-id', 'id item_0 -> resource-id');
  const r5 = await s.resolve({ label: 'Tidak Ada Elemen Ini' }, { scrollTries: 0 }); ok(!r5.ok, 'elemen tidak ada -> FAILED');
  const r6 = await s.resolve({ xy: [80, 170] }); ok(r6.ok && r6.tier === 'coordinate', 'xy -> coordinate (LOW)');
  ok(s.confidence('fuzzy') === 'LOW' && s.confidence('resource-id') === 'HIGH', 'mapping confidence');
  s.captureHomeAnchor(); ok(s.isHome(), `home anchor (${s.homeAnchor.length} label)`);
  const anchorEl = s.elements.find(e => e.node['resource-id']);
  if (anchorEl) {
    const ra = await s.resolve({ relativeTo: { id: anchorEl.node['resource-id'] }, side: 'right', offset: 40 }, { scrollTries: 0 });
    ok(ra.ok && ra.tier === 'anchored', `relativeTo id -> anchored (${ra.anchor?.synthetic ? 'titik offset' : 'elemen'})`);
    const rb = await s.resolve({ relativeTo: { contains: 'belum' }, side: 'right' }, { scrollTries: 0 });
    ok(!rb.ok, 'anchor fuzzy/ambigu ditolak');
  }
}
const g = new MutationGuard({});
ok(g.evaluate({ action: 'tap', label: 'Kirim' }).blocked, 'Safe Mode blokir "Kirim"');
ok(g.evaluate({ action: 'tap', label: 'Tambah' }).blocked, 'Safe Mode blokir "Tambah"');
ok(!g.evaluate({ action: 'tap', label: 'Closing' }).blocked, 'tab "Closing" tidak dianggap mutasi');
ok(g.evaluate({ action: 'tap', label: 'Keluar' }).blocked, 'logout diblokir');
g.setPermission(true, { tag: 'QAAUTO-T1' });
ok(g.mode === 'full', 'legacy allow=true -> full');
ok(!g.evaluate({ action: 'tap', label: 'Tambah' }).blocked, 'full: create jalan');
ok(!g.evaluate({ action: 'tap', label: 'Aktifkan' }).blocked, 'full: state_change jalan');
ok(g.evaluate({ action: 'tap', label: 'Kirim' }).blocked, 'full: kirim (external) tetap diblokir');
ok(g.evaluate({ action: 'tap', label: 'Bayar' }).blocked, 'full: finansial diblokir');
ok(g.evaluate({ action: 'tap', label: 'Hapus', contextText: 'Hapus | Label Prioritas' }).blocked, 'full: hapus data tanpa TAG diblokir');
ok(!g.evaluate({ action: 'tap', label: 'Hapus', contextText: 'Hapus | QAAUTO-T1 label uji' }).blocked, 'full: hapus data ber-TAG jalan');
g.evaluate({ action: 'tap', label: 'QAAUTO-T1 label uji', contextText: 'QAAUTO-T1 label uji' });
ok(!g.evaluate({ action: 'tap', label: 'Edit' }).blocked, 'full: edit setelah membuka data ber-TAG (konteks) jalan');
ok(g.evaluate({ action: 'tap', tier: 'coordinate', isMutation: true }).blocked, 'mutasi via koordinat mentah selalu diblokir');
ok(g.evaluate({ action: 'tap', tier: 'anchored', isMutation: true }).blocked, 'anchored tanpa label & tanpa mutationType diblokir');
const an = g.evaluate({ action: 'tap', tier: 'anchored', isMutation: true, mutationType: 'create' }); ok(!an.blocked && an.requiresEvidence, 'mutasi via koordinat ber-anchor + mutationType jalan + wajib evidence');
ok(g.evaluate({ action: 'tap', tier: 'anchored', isMutation: true, mutationType: 'external' }).blocked, 'anchored kirim (external) di mode full tetap diblokir');
ok(g.evaluate({ action: 'tap', id: 'app_home_drawer_menu_logout' }).blocked, 'logout menu tetap diblokir tanpa penanda');
ok(!g.evaluate({ action: 'tap', label: 'Keluar', mutationType: 'session_end' }).blocked, 'logout dengan mutationType eksplisit jalan');
const gx = new MutationGuard({ QA_TEST_RECIPIENT_ALLOWLIST: '081234567890,QA Tester' }); gx.setPermission(true, { mode: 'full_external' });
ok(gx.evaluate({ action: 'tap', label: 'Kirim', screenText: 'Budi Pelanggan | +62 812-3456-7890' }).blocked === false, 'full_external: kirim ke nomor allowlist (format +62) jalan');
ok(gx.evaluate({ action: 'tap', label: 'Kirim', screenText: 'Pelanggan Asli | 0899' }).blocked, 'full_external: penerima di luar allowlist diblokir');
const gd = new MutationGuard({ QA_MUTATION_MODE: 'full' }); ok(gd.mode === 'full', 'QA_MUTATION_MODE .env -> mode awal full');
gd.resetToDefault(); ok(gd.mode === 'full', 'resetToDefault kembali ke mode .env');
g.resetToDefault(); ok(g.mode === 'safe', 'resetToDefault tanpa .env -> safe');
const bg = new BuildGuard({ allowlist: ['com.example.app.staging'] });
ok(!bg.check('com.example.app').ok && bg.check('com.example.app.staging').ok, 'Build Guard tolak production');
console.log(`\n${pass} PASS, ${failN} FAIL`); process.exit(failN ? 1 : 0);
