/**
 * Device smoke test (READ-ONLY) untuk mcp-server-mobile-qa — dijalankan di Mac dengan HP terhubung.
 *   node test/device_smoke.mjs [--udid SERIAL] [--role owner --suffix 1]
 * Label & ID layar diambil dari profiles/<QA_ACTIVE_PROFILE>/knowledge/mobile/smoke.json (lokal).
 * Menguji tool MCP lewat protokol MCP sungguhan: init, login, inspect, tab, drawer, mutation guard (Keluar diblokir),
 * assert, evidence, rotasi/background, close. Tidak ada aksi mutasi data.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { loadMobileFixture } from './profile-fixture.mjs';
const FX = loadMobileFixture();
if (!FX) { console.error('SMOKE SKIP: profil aktif belum punya knowledge/mobile/smoke.json (salin dari profiles/_template).'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const client = new Client({ name: 'device-smoke', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: 'node', args: [path.join(here, '../src/index.js')] }));
const results = []; let runDir = null;
const call = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); return JSON.parse(r.content[0].text); };
const check = (step, cond, detail) => { results.push({ step, result: cond ? 'PASS' : 'FAIL', detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${step}${detail ? '  — ' + detail : ''}`); };
try {
  const st = await call('qa_check_device_state');
  check('check_device_state', st.adb && st.devices.some(d => d.state === 'device'), `${st.devices.filter(d => d.state === 'device').map(d => `${d.serial} ${d.model}`).join(', ')} | app ${st.app?.versionName} | lain: ${st.otherVariantsInstalled}`);
  const init = await call('qa_init_app', { featureName: 'device_smoke', udid: arg('udid'), installPolicy: 'use_installed' });
  check('init_app', init.status === 'READY', init.status === 'READY' ? `${init.app.package} ${init.app.versionName} (${init.app.framework}) layar=${init.screen?.screenType}` : JSON.stringify(init).slice(0, 300));
  if (init.status !== 'READY') throw new Error('init gagal');
  runDir = init.runDir;
  check('safe_mode', (await call('qa_set_mutation_permission', { allow: false })).mode === 'SAFE_MODE_ACTIVE');
  const login = await call('qa_login_role', { role: arg('role', 'owner'), suffix: arg('suffix', FX.roleSuffix) });
  check('login_role', ['PASSED', 'ALREADY_LOGGED_IN_OR_UNKNOWN'].includes(login.status), `${login.status} ${login.user || ''} ${(login.steps || []).join(' > ')}`);
  const pw = JSON.stringify(login); check('password tidak bocor', !/PASS_|"password"/i.test(pw));
  let scr = await call('qa_inspect_screen'); check('inspect_screen', scr.interactive > 0, `"${scr.title}" ${scr.interactive} elemen, id ${scr.resourceIdPct}%, label ${scr.labeledPct}%, home=${scr.isHome}`);
  let a = await call('qa_execute_action', { action: 'tap', target: { label: FX.tabLabel } }); check('tap tab (label)', a.status === 'DONE', `tier=${a.tier} conf=${a.confidence}`);
  a = await call('qa_execute_action', { action: 'tap', target: { label: FX.ambiguousLabel, index: 0 } }); check('tap tab bernama ganda (index 0)', a.status === 'DONE', `tier=${a.tier}`);
  const amb = await call('qa_execute_action', { action: 'tap', target: { label: FX.ambiguousLabel } }); check('ambiguity guard (label ganda)', amb.status === 'FAILED' && amb.candidates?.length >= 2, `${amb.candidates?.length} kandidat`);
  const cnt = await call('qa_assert_element', { assertion: 'count_at_least', target: { id: FX.listItemId }, expected: '1' }); check('assert count list percakapan', cnt.result === 'PASS', cnt.actual);
  scr = await call('qa_inspect_screen'); const menu = scr.elements.find(e => e.position === 'app-bar-kiri');
  a = await call('qa_execute_action', { action: 'tap', target: { ref: menu?.ref } }); check('buka drawer (ikon tanpa label)', a.status === 'DONE', `tier=${a.tier} conf=${a.confidence}`);
  const vis = await call('qa_assert_element', { assertion: 'visible', target: { id: FX.drawerItemId } }); check('assert item drawer visible', vis.result === 'PASS', `tier=${vis.tier}`);
  const out = await call('qa_execute_action', { action: 'tap', target: { label: FX.logoutLabel }, tcId: 'SMOKE', step: 'logout' }); check('mutation guard blokir logout', /PARTIAL/.test(out.status), out.reason);
  a = await call('qa_execute_action', { action: 'tap', target: { label: FX.settingsLabel } }); check('tap menu pengaturan', a.status === 'DONE', `tier=${a.tier}`);
  const ttl = await call('qa_assert_element', { assertion: 'screen_title', expected: FX.settingsLabel }); check('assert judul pengaturan', ttl.result === 'PASS', ttl.actual);
  const ev = await call('qa_capture_evidence', { tcId: 'SMOKE', step: 'pengaturan', status: ttl.result === 'PASS' ? 'PASSED' : 'FAILED' }); check('capture_evidence', Boolean(ev.screenshot), ev.screenshot);
  const home = await call('qa_navigate_home'); check('navigate_home', home.ok, home.method);
  scr = await call('qa_inspect_screen'); const m2 = scr.elements.find(e => e.position === 'app-bar-kiri');
  await call('qa_execute_action', { action: 'tap', target: { ref: m2?.ref } });
  const bk = await call('qa_execute_action', { action: 'back' });
  check('OBSERVASI: back saat drawer terbuka tetap di app', !bk.guard, bk.guard || `layar: ${bk.screen?.title || '-'}`);
  await call('qa_capture_evidence', { tcId: 'SMOKE', step: 'back_drawer', status: bk.guard ? 'FAILED' : 'PASSED' });
  await call('qa_navigate_home');
  const rot = await call('qa_device_control', { action: 'rotate_landscape' }); check('rotate_landscape', rot.status === 'DONE', `orientasi=${rot.orientation}`);
  await call('qa_device_control', { action: 'rotate_portrait' });
  const bgd = await call('qa_device_control', { action: 'background', value: '3' }); check('background 3s', bgd.status === 'DONE', bgd.guard || 'kembali ke app');
  const fail = await call('qa_capture_evidence', { tcId: 'SMOKE', step: 'logcat', status: 'FAILED' }); check('evidence FAILED + logcat', Boolean(fail.logcat), fail.logcat);
} catch (e) { check('exception', false, e.message); }
finally {
  const c = await call('qa_close_app', {}).catch(e => ({ error: e.message })); check('close_app', c.status === 'CLOSED', `guardEvents=${c.guardEvents} restored=${(c.restored || []).join(',')}`);
  await client.close();
  const root = path.resolve(here, '../../mobile-execution/automate-result');
  const f = path.join(root, `smoke_result_${Date.now()}.json`); fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ verdict: results.every(r => r.result === 'PASS') ? 'SMOKE PASSED' : 'SMOKE FAILED', runDir, results }, null, 2));
  const n = results.filter(r => r.result === 'PASS').length; const verdict = n === results.length ? 'SMOKE PASSED' : 'SMOKE FAILED';
  console.log(`\n================ ${verdict}: ${n}/${results.length} langkah PASS ================`);
  if (n !== results.length) console.log('Langkah gagal:\n' + results.filter(r => r.result !== 'PASS').map(r => `  - ${r.step}: ${r.detail || ''}`).join('\n'));
  console.log(`Hasil: ${path.relative(path.resolve(here, '../..'), f)}`);
  process.exit(0);
}
