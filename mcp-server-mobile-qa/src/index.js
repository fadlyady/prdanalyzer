#!/usr/bin/env node
/**
 * Mobile QA Guard MCP Server (Android / Appium UiAutomator2)
 * Gate 2 Device & Build Guard, Gate 3 Zero-Leak Credential, Gate 4 Mutation Policy berlevel (safe|full|full_external,
 * koordinat mentah diblokir untuk mutasi, koordinat ber-anchor + evidence diizinkan di full),
 * Gate 5 Evidence & Confidence, Gate 6 Clean Session Reset. Pasangan dari browser-qa-guard.
 */
import { ENV_BOOTSTRAP } from './env-bootstrap.js'; // HARUS paling awal
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import { mp4Info } from './mp4.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS } from './tools.js';
import { MutationGuard, BuildGuard, CredentialVault } from './guards.js';
import { Device, listDevices, apkInfo, ensureAppium, appiumUp, sleep } from './device.js';
import { MobileSession } from './session.js';
import { screenType } from './ui-tree.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = process.env.QA_WORKSPACE_ROOT || path.resolve(__dirname, '../../');
const DIRS = {
  apk: path.join(ROOT, 'mobile-execution', 'build-apk'),
  result: path.join(ROOT, 'mobile-execution', 'automate-result'),
  support: path.join(ROOT, 'mobile-execution', 'automate-support'),
};
const vault = new CredentialVault(ROOT);
const mutationGuard = new MutationGuard(vault.readRawEnv());
const S = { device: null, session: null, appium: null, run: null, app: null };

const cfg = () => {
  const env = vault.readRawEnv();
  const pkg = env.MOBILE_APP_PACKAGE_STAGING || ''; // wajib diisi di .secrets/<QA_ACTIVE_PROFILE>.env
  return {
    pkg, activity: env.MOBILE_APP_ACTIVITY || '',
    allowlist: (env.MOBILE_APP_PACKAGE_ALLOWLIST || pkg).split(',').map(s => s.trim()),
    strict: env.MOBILE_BUILD_GUARD_STRICT !== 'false',
    // Default: Appium dikelola MCP sendiri di port khusus 4733 (env SDK/Java dijamin benar).
    // Set APPIUM_URL di .env hanya jika ingin memakai server Appium eksternal.
    appiumUrl: env.APPIUM_URL || 'http://127.0.0.1:4733', appiumExternal: Boolean(env.APPIUM_URL), udid: env.ANDROID_DEVICE_SERIAL || null, env,
  };
};
const stamp = () => { const n = new Date(), p = x => String(x).padStart(2, '0'); return `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`; };
const rel = p => path.relative(ROOT, p);
const out = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = (msg, extra = {}) => ({ content: [{ type: 'text', text: JSON.stringify({ status: 'ERROR', error: msg, ...extra }, null, 2) }], isError: true });
const need = () => { if (!S.session) throw new Error('Sesi belum aktif. Jalankan qa_init_app terlebih dahulu.'); return S.session; };
const logAction = (o) => { if (S.run) fs.appendFileSync(path.join(S.run.dir, 'actions.jsonl'), JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n'); };
const apks = () => (fs.existsSync(DIRS.apk) ? fs.readdirSync(DIRS.apk).filter(f => f.endsWith('.apk')) : []);

const H = {};
H.qa_check_device_state = async () => {
  const c = cfg(); const d = listDevices();
  const ready = d.devices.filter(x => x.state === 'device');
  const res = { adb: d.adb, devices: d.devices, appium: { url: c.appiumUrl, managedByMcp: !c.appiumExternal, running: await appiumUp(c.appiumUrl) }, environment: ENV_BOOTSTRAP, stagingPackage: c.pkg, apks: apks().map(f => apkInfo(path.join(DIRS.apk, f))) };
  if (!ENV_BOOTSTRAP.ANDROID_HOME) res.envWarning = 'Android SDK tidak ditemukan. Jalankan mobile-execution/probe/install_mac.sh atau set ANDROID_HOME.';
  if (ready.length === 1 || c.udid) {
    const dev = new Device(c.udid || ready[0].serial);
    res.app = dev.installed(c.pkg);
    const base = c.pkg.replace(/\.(stag|staging|dev|qa)$/, '');
    res.otherVariantsInstalled = dev.packages(base).filter(p => p !== c.pkg);
  }
  if (!d.adb) res.hint = 'adb tidak ditemukan. Jalankan mobile-execution/probe/install_mac.sh';
  else if (!ready.length) res.hint = 'Tidak ada device siap. Colok HP, aktifkan USB debugging, setujui dialog Allow USB debugging.';
  else if (ready.length > 1 && !c.udid) res.hint = 'Lebih dari 1 device siap: tanyakan user device mana (udid).';
  return out(res);
};

H.qa_init_app = async (a) => {
  if (S.session) return out({ status: 'ALREADY_ACTIVE', device: S.device.serial, app: S.app, runDir: rel(S.run.dir) });
  const c = cfg(); const notes = [];
  const pkg = a.package || c.pkg;
  const bg = new BuildGuard({ allowlist: c.allowlist, strict: c.strict }); const chk = bg.check(pkg);
  bg.setExtraPickers((c.env.MOBILE_EXTERNAL_ALLOWLIST || '').split(',').map(x => x.trim()));
  if (!chk.ok) return fail(`[BUILD GUARD] ${chk.reason}`);
  const { devices, adb } = listDevices(); if (!adb) return fail('adb tidak ditemukan.');
  const ready = devices.filter(d => d.state === 'device');
  const udid = a.udid || c.udid || (ready.length === 1 ? ready[0].serial : null);
  if (!udid) return out({ status: 'NEEDS_DECISION', gate: 'DEVICE', question: ready.length ? 'Lebih dari 1 device terhubung. Device mana yang dipakai?' : 'Tidak ada device siap.', options: ready.map(d => ({ udid: d.serial, model: `${d.brand || ''} ${d.model || ''}`.trim(), android: d.release })) });
  if (!ready.find(d => d.serial === udid)) return fail(`Device ${udid} tidak dalam state "device".`, { devices });
  const dev = new Device(udid); const info = dev.info();
  if (info.sdk && info.sdk < 28) return fail(`Android API ${info.sdk} < 28 tidak didukung.`);

  // --- APK & versi ---
  const list = apks(); let apk = null;
  if (a.apkFile) { if (!list.includes(a.apkFile)) return fail(`APK ${a.apkFile} tidak ada di build-apk/.`, { available: list }); apk = apkInfo(path.join(DIRS.apk, a.apkFile)); }
  else if (list.length === 1) apk = apkInfo(path.join(DIRS.apk, list[0]));
  else if (list.length > 1) return out({ status: 'NEEDS_DECISION', gate: 'APK', question: 'Ada lebih dari 1 APK di build-apk/. Pakai yang mana?', options: list });
  if (apk?.package && apk.package !== pkg) return fail(`[BUILD GUARD] APK ${apk.file} berisi package ${apk.package}, bukan ${pkg}.`);
  const inst = dev.installed(pkg); const policy = a.installPolicy || 'ask';
  const decide = (question, options) => out({ status: 'NEEDS_DECISION', gate: 'BUILD_VERSION', question, installed: inst, apk, options });
  let action = 'use_installed';
  if (!inst.installed) {
    if (!apk) return fail(`App ${pkg} belum terpasang dan tidak ada APK di build-apk/.`);
    if (policy !== 'install') return decide(`App ${pkg} belum terpasang. Install ${apk.file}?`, ['install']);
    action = 'install';
  } else if (apk?.versionCode && apk.versionCode > inst.versionCode) {
    if (policy === 'ask') return decide(`Build di HP (${inst.versionCode}) lebih lama dari APK (${apk.versionCode}). Upgrade atau pakai yang terpasang?`, ['install', 'use_installed']);
    action = policy;
  } else if (apk?.versionCode && apk.versionCode < inst.versionCode) {
    if (policy !== 'use_installed') return decide(`Build di HP (${inst.versionCode}) LEBIH BARU dari APK (${apk.versionCode}). Downgrade tidak dilakukan otomatis (butuh uninstall). Pakai build terpasang, atau taruh APK terbaru di build-apk/.`, ['use_installed']);
  } else if (apk && !apk.versionCode) notes.push('aapt2 tidak tersedia: versi APK tidak terbaca, memakai build terpasang.');
  if (action === 'install') { dev.install(apk.path); notes.push(`APK ${apk.file} diinstal.`); }
  const app = { package: pkg, ...dev.installed(pkg), framework: apk?.framework || 'unknown' };
  if (!/stag|staging|dev|qa/i.test(app.versionName || '')) notes.push(`PERINGATAN: versionName "${app.versionName}" tanpa penanda staging.`);
  const base = pkg.replace(/\.(stag|staging|dev|qa)$/, ''); const others = dev.packages(base).filter(p => p !== pkg);
  if (others.length) notes.push(`Varian lain terpasang di device: ${others.join(', ')} — Build Guard memastikan hanya ${pkg} yang diuji.`);
  const granted = dev.grantRuntime(pkg); if (granted.length) notes.push(`Izin runtime di-grant: ${granted.join(', ')}`);
  if (cfg().env.MOBILE_QUIET_NOTIFICATIONS !== 'false') notes.push(`Notifikasi selama sesi: ${dev.quietNotifications().join(', ')} (di-restore saat qa_close_app)`);

  // --- Appium + sesi ---
  const ap = await ensureAppium(c.appiumUrl); S.appium = ap.proc;
  const activity = a.activity || c.activity || (dev.shell('cmd', 'package', 'resolve-activity', '--brief', pkg).trim().split('\n').pop().split('/')[1] || '');
  const sess = new MobileSession({ device: dev, pkg, activity: activity.startsWith('.') ? pkg + activity : activity, appiumUrl: c.appiumUrl, buildGuard: bg });
  try { await sess.start(); }
  catch (e) {
    dev.restoreAll(); if (S.appium) { S.appium.kill(); S.appium = null; }
    const m = e.message || '';
    if (/ANDROID_HOME|ANDROID_SDK_ROOT|JAVA_HOME/.test(m)) {
      return fail(c.appiumExternal
        ? `Server Appium eksternal (${c.appiumUrl}) berjalan tanpa ANDROID_HOME/JAVA_HOME. Hapus APPIUM_URL dari .env agar MCP mengelola Appium sendiri, atau restart Appium dari terminal yang sudah memuat ~/.zshrc.`
        : `Appium di ${c.appiumUrl} tidak memiliki ANDROID_HOME/JAVA_HOME (kemungkinan sisa proses lama). Hentikan dengan: pkill -f "appium.*4733" lalu ulangi.`, { environment: ENV_BOOTSTRAP });
    }
    throw e;
  }
  const ts = stamp(); const feature = (a.featureName || 'mobile').replace(/[^\w-]+/g, '_').slice(0, 40);
  const dir = path.join(DIRS.result, `run_${feature}_${ts}`); fs.mkdirSync(dir, { recursive: true });
  Object.assign(S, { device: dev, session: sess, run: { dir, feature, ts }, app });
  mutationGuard.reload(vault.readRawEnv()); mutationGuard.setLedgerFile(path.join(dir, 'mutation_ledger.jsonl'));
  if (mutationGuard.mode === 'safe' && mutationGuard.defaultMode) mutationGuard.setMode(mutationGuard.defaultMode, { actor: '.env QA_MUTATION_MODE' });
  const meta = { device: info, app, apk: apk && { file: apk.file, versionCode: apk.versionCode }, appiumStartedByMcp: ap.started, runDir: rel(dir), startedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, 'run_meta.json'), JSON.stringify(meta, null, 2));
  logAction({ tool: 'init', ...meta });
  if (!sess.treeReady) notes.push('PERINGATAN: UI tree app kosong setelah 20 detik (layar terkunci/overlay?). Buka kunci HP & tutup pop-up, lalu qa_inspect_screen.');
  return out({ status: sess.treeReady ? 'READY' : 'READY_WITH_WARNING', ...meta, mutationPolicy: mutationGuard.summary(), homeAnchor: sess.homeAnchor, homeIdPrefix: sess.homeIdPrefix, notes, screen: sess.summary(25) });
};

H.qa_list_available_roles = async () => out({ roles: vault.listAvailableRoles() });
H.qa_set_mutation_permission = async ({ allow, mode, dataTag } = {}) => {
  mutationGuard.reload(vault.readRawEnv());
  if (!mode && typeof allow !== 'boolean') return out({ status: 'CURRENT_POLICY', ...mutationGuard.summary() });
  const r = mutationGuard.setPermission(mode ? mode !== 'safe' : allow, { mode, tag: dataTag });
  logAction({ tool: 'mutation_permission', mode: r.mode, dataTag: r.dataTag });
  mutationGuard.record({ status: 'POLICY', category: 'policy', target: r.mode });
  return out({ status: 'POLICY_UPDATED', ...r, ledgerFile: mutationGuard.ledgerFile ? rel(mutationGuard.ledgerFile) : null });
};
H.qa_get_mutation_ledger = async () => { const l = mutationGuard.ledgerSummary(); return out({ ...l, ledgerFile: l.ledgerFile ? rel(l.ledgerFile) : null }); };

H.qa_login_role = async ({ role, suffix, att }) => {
  const s = need();
  const cred = vault.getCredentialsForRole(role, suffix);
  if (!cred) return fail(`Kredensial untuk role ${role}${suffix ? '_' + suffix : ''} tidak ada di .env.`, { available: vault.listAvailableRoles() });
  const r = await s.login({ username: cred.username, password: cred.password, att });
  const masked = cred.username.length > 4 ? `${cred.username.slice(0, 2)}***${cred.username.slice(-2)}` : '****';
  logAction({ tool: 'login', role, key: cred.key, status: r.status });
  return out({ role, credentialKey: cred.key, user: masked, ...r });
};

H.qa_inspect_screen = async ({ maxElements = 60 } = {}) => { const s = need(); await s.settle(5000); const g = await s.foregroundGuard('inspect'); return out({ ...s.summary(maxElements), foreground: g.picker || s.pkg, guard: g.picker ? undefined : g.note, isHome: s.isHome() }); };

async function snapPartial(tcId, step) {
  if (!tcId || !S.run) return null;
  const f = path.join(S.run.dir, `${tcId}_${(step || 'step').replace(/[^\w-]+/g, '_')}_partial_mutation.png`);
  fs.writeFileSync(f, Buffer.from(await S.session.driver.takeScreenshot(), 'base64')); return rel(f);
}

H.qa_execute_action = async (a) => {
  const s = need(); const { action, target = {}, direction = 'up', percent = 0.7, isMutation = false, mutationType, tcId, step, settleMs } = a;
  const value = typeof a.value === 'string' ? a.value.replace(/\{\{TAG\}\}/g, mutationGuard.tag || '') : a.value;
  await s.refresh();
  if (action !== 'wait') s.markAction();
  if (['back', 'hide_keyboard', 'wait', 'press_key'].includes(action) || (['scroll', 'swipe'].includes(action) && !Object.keys(target).length)) {
    if (action === 'back') await s.driver.back();
    if (action === 'press_key') { const code = { ENTER: 66, SEARCH: 84, BACK: 4, TAB: 61 }[String(value || 'ENTER').toUpperCase()]; if (!code) return fail(`press_key "${value}" tidak didukung (ENTER|SEARCH|BACK|TAB).`); await s.driver.pressKeyCode(code); }
    if (action === 'hide_keyboard') { try { await s.driver.hideKeyboard(); } catch { /* none */ } }
    if (action === 'wait') await sleep(Number(value) || 1000);
    if (action === 'scroll' || action === 'swipe') await s.swipe(direction, percent);
    await s.settle(settleMs ?? 6000); const g = await s.foregroundGuard(action);
    logAction({ tool: 'action', action, tcId, step });
    return out({ status: 'DONE', action, guard: g.picker ? undefined : g.note, foreground: g.picker || s.pkg, seenToasts: s.seenToasts(), screen: s.summary(25) });
  }
  const r = await s.resolve(target, { scrollTries: action === 'type' || target.scroll === false ? 0 : 3 });
  if (!r.ok) { logAction({ tool: 'action', action, target, tcId, step, status: 'FAILED', error: r.error }); return out({ status: 'FAILED', action, error: r.error, candidates: r.candidates, screen: s.summary(25) }); }
  const el = r.el; const label = el.label || ''; const id = el.node['resource-id'] || '';
  const tier = r.el.textOnly ? 'text-node' : r.tier;
  const contextText = [label, ...(el.allLabels || [])].join(' | ');
  const screenText = s.nodes.map(n => n.label).filter(Boolean).join(' | ');
  const guard = mutationGuard.evaluate({ action, label, id, tier, isMutation, mutationType, contextText, screenText });
  if (guard.blocked) {
    const ev = await snapPartial(tcId, step);
    logAction({ tool: 'action', action, label, id, tcId, step, status: guard.status, reason: guard.reason });
    mutationGuard.record({ status: 'BLOCKED', category: guard.category, keyword: guard.keyword, action, target: label.slice(0, 80) || id || target, tier, tcId, step, screen: s.summary(1).title, reason: guard.reason, evidence: ev });
    return out({ status: guard.status, category: guard.category, reason: guard.reason, evidence: ev, element: { label, id, bounds: el.node.bounds }, anchor: r.anchor });
  }
  let before = null;
  if (guard.destructive && guard.requiresEvidence && S.run) {
    before = path.join(S.run.dir, `${tcId || 'step'}_${(step || 'step').replace(/[^\w-]+/g, '_')}_anchored_before.png`);
    fs.writeFileSync(before, Buffer.from(await s.driver.takeScreenshot(), 'base64'));
  }
  if (['tap', 'long_press', 'double_tap'].includes(action)) await s.tapNode(el, action);
  else if (action === 'type' || action === 'clear') {
    const e = await s.editElement(el); await e.click();
    if (action === 'clear') await e.clearValue();
    else {
      const envKey = /^\{\{ENV:([A-Z0-9_]+)\}\}$/.exec(value || '');
      await e.setValue(envKey ? (cfg().env[envKey[1]] || '') : (value ?? ''));
    }
  } else if (action === 'scroll' || action === 'swipe') await s.swipe(direction, percent, el.node);
  await s.settle(settleMs ?? 8000); const g = await s.foregroundGuard(action);
  let after = null;
  if (before) { after = before.replace(/_before\.png$/, '_after.png'); fs.writeFileSync(after, Buffer.from(await s.driver.takeScreenshot(), 'base64')); }
  if (guard.destructive) mutationGuard.record({ status: 'EXECUTED', category: guard.category, keyword: guard.keyword, action, target: label.slice(0, 80) || id || JSON.stringify(target).slice(0, 120), tier, anchor: r.anchor, tcId, step, recipient: guard.recipient, tagEvidence: guard.tagEvidence, evidence: before ? [rel(before), rel(after)] : undefined });
  const res = { status: 'DONE', action, tier, anchor: r.anchor, mutationCategory: guard.destructive ? guard.category : undefined, anchoredEvidence: before ? [rel(before), rel(after)] : undefined, confidence: s.confidence(tier), element: { label: label.slice(0, 120), id: id || undefined, bounds: el.node.bounds }, scrolledToFind: r.scrolled || undefined, mutation: guard.destructive || undefined, guard: g.picker ? undefined : g.note, foreground: g.picker || s.pkg, seenToasts: s.seenToasts(), screen: s.summary(25) };
  logAction({ tool: 'action', action, tcId, step, tier, label: label.slice(0, 80), id, mutation: guard.destructive, status: 'DONE' });
  return out(res);
};

H.qa_assert_element = async ({ assertion, target = {}, expected = '', timeoutMs = 6000 }) => {
  const s = need(); const t0 = Date.now(); let last = {};
  const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
  do {
    await s.refresh(); const sum = s.summary(0);
    if (assertion === 'visible' || assertion === 'not_visible' || assertion === 'count_at_least' || assertion === 'enabled' || assertion === 'disabled') {
      const r = await s.resolve({ ...target, scroll: false }, { allowMany: true, scrollTries: 0 });
      const count = r.ok ? (r.all?.length || 1) : 0;
      const tier = r.ok ? (r.el.textOnly ? 'text-node' : r.tier) : null;
      if (assertion === 'visible') last = { pass: r.ok, actual: r.ok ? `ditemukan (${count})` : r.error, tier };
      if (assertion === 'not_visible') last = { pass: !r.ok, actual: r.ok ? `masih terlihat (${count})` : 'tidak terlihat', tier: tier || 'label' };
      if (assertion === 'count_at_least') last = { pass: count >= Number(expected || 1), actual: `${count} elemen`, tier };
      if (assertion === 'enabled' || assertion === 'disabled') {
        const n = r.ok ? r.el.node : null; const en = n && n.enabled !== 'false' && (n.clickable === 'true' || /EditText/.test(n.class || ''));
        last = { pass: r.ok && (assertion === 'enabled' ? en : !en), actual: r.ok ? (en ? 'enabled' : 'disabled') : r.error, tier };
      }
    } else if (assertion === 'contains_text') {
      let scope = s.nodes;
      if (Object.keys(target).length) { const r = await s.resolve({ ...target, scroll: false }, { allowMany: true, scrollTries: 0 }); if (r.ok) { const b = r.el.node.box; scope = s.nodes.filter(n => n.box && n.box.x1 >= b.x1 && n.box.y1 >= b.y1 && n.box.x2 <= b.x2 && n.box.y2 <= b.y2); } }
      const hit = scope.find(n => norm(n.label).includes(norm(expected)));
      last = { pass: Boolean(hit), actual: hit ? hit.label.slice(0, 150) : `teks "${expected}" tidak ada`, tier: 'label' };
    } else if (assertion === 'screen_title') last = { pass: norm(sum.title).includes(norm(expected)), actual: sum.title, tier: 'label' };
    else if (assertion === 'toast_contains') {
      // toast singkat: cek toast saat ini + toast yang sempat terlihat sejak aksi terakhir (termasuk teks overlay Flutter)
      const pool = [...sum.toasts, ...s.seenToasts(), ...s.seenTexts()];
      const hit = pool.find(x => norm(x).includes(norm(expected)));
      last = { pass: Boolean(hit), actual: hit || `toast terlihat: ${[...new Set([...sum.toasts, ...s.seenToasts()])].join(' | ') || '(tidak ada)'}`, tier: 'label' };
    }
    else if (assertion === 'seen_text') { const hit = s.seenTexts().find(x => norm(x).includes(norm(expected))); last = { pass: Boolean(hit), actual: hit || `"${expected}" tidak terlihat sejak aksi terakhir`, tier: 'label' }; }
    else if (assertion === 'not_seen_text') { const hit = s.seenTexts().find(x => norm(x).includes(norm(expected))); last = { pass: !hit, actual: hit ? `TERLIHAT: ${hit.slice(0, 150)}` : 'tidak terlihat sejak aksi terakhir', tier: 'label' }; if (!last.pass) break; }
    if (last.pass && assertion !== 'not_seen_text') break; await sleep(800);
  } while (Date.now() - t0 < timeoutMs);
  const res = { result: last.pass ? 'PASS' : 'FAIL', assertion, expected: expected || undefined, actual: last.actual, tier: last.tier, confidence: last.tier ? s.confidence(last.tier) : undefined };
  logAction({ tool: 'assert', ...res });
  return out(res);
};

H.qa_capture_evidence = async ({ tcId, step, status, logcat }) => {
  const s = need(); if (!S.run) return fail('Folder run belum ada.');
  const base = `${tcId}_${String(step).replace(/[^\w-]+/g, '_')}_${String(status).replace(/[^\w-]+/g, '_')}`;
  const png = path.join(S.run.dir, `${base}.png`);
  fs.writeFileSync(png, Buffer.from(await s.driver.takeScreenshot(), 'base64'));
  const res = { screenshot: rel(png) };
  if (logcat || /FAIL/i.test(status)) res.logcat = rel(S.device.logcat(s.pkg, path.join(S.run.dir, `${base}_logcat.txt`)));
  logAction({ tool: 'evidence', tcId, step, status, ...res });
  return out(res);
};

H.qa_screen_recording = async ({ action, tcId = 'run' }) => {
  const s = need();
  if (action === 'start') { if (s.recording) return out({ status: 'ALREADY_RECORDING', tcId: s.recording }); await s.driver.startRecordingScreen({ timeLimit: '1200', bitRate: '3000000' }); s.recording = tcId; return out({ status: 'RECORDING', tcId }); }
  if (!s.recording) return out({ status: 'NOT_RECORDING' });
  const b64 = await s.driver.stopRecordingScreen(); const f = path.join(S.run.dir, `${s.recording}_recording.mp4`);
  fs.writeFileSync(f, Buffer.from(b64, 'base64')); s.recording = null; return out({ status: 'SAVED', video: rel(f) });
};

H.qa_device_control = async ({ action, value }) => {
  const s = need(); const d = S.device; let note = '';
  switch (action) {
    case 'rotate_landscape': await s.driver.setOrientation('LANDSCAPE'); note = 'LANDSCAPE'; break;
    case 'rotate_portrait': await s.driver.setOrientation('PORTRAIT'); note = 'PORTRAIT'; break;
    case 'background': await s.driver.execute('mobile: backgroundApp', { seconds: Number(value) || 5 }); note = `background ${Number(value) || 5}s`; break;
    case 'kill_relaunch': await s.driver.terminateApp(s.pkg); await sleep(1000); await s.driver.activateApp(s.pkg); note = 'app di-kill lalu dibuka ulang'; break;
    case 'network_off': note = d.network(false); break;
    case 'network_on': note = d.network(true); break;
    case 'font_scale': note = d.fontScale(Number(value) || 1.3); break;
    case 'dark_mode_on': note = d.darkMode(true); break;
    case 'dark_mode_off': note = d.darkMode(false); break;
    case 'revoke_permission': { const perm = `android.permission.${String(value || 'CAMERA').toUpperCase()}`; d.shell('pm', 'revoke', s.pkg, perm); d.restore.push(['perm', perm, s.pkg]); note = `${perm} dicabut`; break; }
    case 'grant_permission': { const perm = `android.permission.${String(value || 'CAMERA').toUpperCase()}`; d.shell('pm', 'grant', s.pkg, perm); note = `${perm} diberikan`; break; }
    case 'permission_dialog': s.permissionPolicy = ['allow', 'deny', 'leave'].includes(value) ? value : 'allow'; note = `policy dialog izin = ${s.permissionPolicy}`; break;
    case 'camera_video': {
      // data uji video: rekam langsung di device (orientasi file mengikuti posisi fisik HP)
      S.camMark = Number(d.shell('date', '+%s').trim()) || 0;
      d.shell('am', 'start', '-a', 'android.media.action.VIDEO_CAMERA'); await sleep(2500); note = `kamera mode video dibuka (mark ${S.camMark})`; break;
    }
    case 'save_latest_video': {
      const [rawName, wantRot] = String(value || 'video').split('@'); const name = rawName.replace(/[^\w-]+/g, '_'); const dir = '/sdcard/DCIM/Camera';
      const files = d.shell('ls', '-t', dir).split('\n').map(x => x.trim()).filter(x => /\.mp4$/i.test(x));
      if (!files.length) return fail(`Tidak ada video di ${dir}.`);
      const src = `${dir}/${files[0]}`; const mtime = Number(d.shell('stat', '-c', '%Y', src).trim()) || 0;
      if (S.camMark && mtime < S.camMark - 2) return fail(`Video terbaru (${files[0]}) lebih lama dari saat kamera dibuka — rekaman baru tidak tersimpan.`);
      const dst = `/sdcard/Download/qa_${name}.mp4`; d.shell('cp', src, dst);
      try { d.shell('am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', `file://${dst}`); } catch { /* ok */ }
      const local = path.join(S.run.dir, `${name}.mp4`); try { d.adb(['pull', src, local], 300000); } catch { /* ok */ }
      const meta = fs.existsSync(local) ? mp4Info(local) : null;
      note = `${files[0]} -> ${dst}${meta ? ` | ${meta.width}x${meta.height} rotasi ${meta.rotation}°` : ''}${fs.existsSync(local) ? ` | salinan: ${rel(local)}` : ''}`;
      if (wantRot !== undefined && meta && meta.rotation !== Number(wantRot)) return fail(`Rotasi file ${meta.rotation}° tidak sesuai target ${wantRot}° — posisi HP saat merekam salah, rekam ulang. (${note})`);
      break;
    }
    case 'idle_wait': { const ms = Math.max(0, Number(value ?? 10000)); await s.driver.updateSettings({ waitForIdleTimeout: ms }); note = `waitForIdleTimeout ${ms} ms${ms < 1000 ? ' (mode cepat: layar terus berubah, mis. video diputar)' : ''}`; break; }
    case 'activate_app': await s.driver.activateApp(s.pkg); note = `kembali ke ${s.pkg}`; break;
    case 'restore': s.permissionPolicy = 'allow'; try { await s.driver.updateSettings({ waitForIdleTimeout: 10000 }); } catch { /* ok */ } note = d.restoreAll().join(', ') || 'tidak ada yang perlu di-restore'; try { await s.driver.setOrientation('PORTRAIT'); } catch { /* ok */ } break;
    default: return fail(`Aksi ${action} tidak dikenal.`);
  }
  await s.settle(8000); const g = await s.foregroundGuard(action);
  const orient = await s.driver.getOrientation().catch(() => null);
  logAction({ tool: 'device_control', action, value, note });
  return out({ status: 'DONE', action, note, orientation: orient, guard: g.note, screen: s.summary(20) });
};

H.qa_navigate_home = async () => { const s = need(); const r = await s.goHome(); return out({ ...r, screen: s.summary(20) }); };

H.qa_reset_session = async () => {
  const s = need(); try { await s.driver.terminateApp(s.pkg); } catch { /* ok */ }
  const r = S.device.clear(s.pkg); const granted = S.device.grantRuntime(s.pkg);
  await s.driver.activateApp(s.pkg); await s.settle(20000); await s.foregroundGuard('reset'); s.homeAnchor = []; s.homeIdPrefix = [];
  mutationGuard.tagContextUntil = -1; mutationGuard.tagContextFrom = null; // ganti role: mode & TAG tetap, memori konteks TAG dibersihkan
  logAction({ tool: 'reset_session', result: r });
  return out({ status: 'RESET', pmClear: r, regranted: granted, screenType: screenType(s.nodes), next: 'Panggil qa_login_role untuk role batch berikutnya.' });
};

H.qa_push_support_file = async ({ fileName }) => {
  need(); const src = path.join(DIRS.support, path.basename(fileName));
  if (!fs.existsSync(src)) return fail(`File ${fileName} tidak ada di mobile-execution/automate-support/.`, { available: fs.existsSync(DIRS.support) ? fs.readdirSync(DIRS.support).filter(f => !f.startsWith('.')) : [] });
  const dst = `/sdcard/Download/${path.basename(fileName)}`; S.device.push(src, dst);
  try { S.device.shell('am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', `file://${dst}`); } catch { /* ok */ }
  return out({ status: 'PUSHED', devicePath: dst });
};

H.qa_close_app = async ({ keepAppRunning = false } = {}) => {
  const res = { status: 'CLOSED' };
  if (S.session) {
    const s = S.session;
    try { if (s.recording) res.video = JSON.parse((await H.qa_screen_recording({ action: 'stop' })).content[0].text).video; } catch { /* ok */ }
    res.restored = S.device.restoreAll();
    try { await s.driver.setOrientation('PORTRAIT'); } catch { /* ok */ }
    if (!keepAppRunning) { try { await s.driver.terminateApp(s.pkg); } catch { /* ok */ } }
    if (S.run) { fs.writeFileSync(path.join(S.run.dir, 'guard_events.json'), JSON.stringify(s.guardEvents, null, 2)); res.runDir = rel(S.run.dir); res.guardEvents = s.guardEvents.length; }
    const led = mutationGuard.ledgerSummary(); res.mutationLedger = { ...led, ledgerFile: led.ledgerFile ? rel(led.ledgerFile) : null };
    if (S.run) fs.writeFileSync(path.join(S.run.dir, 'mutation_summary.json'), JSON.stringify(res.mutationLedger, null, 2));
    try { await s.driver.deleteSession(); } catch { /* ok */ }
  }
  if (S.appium) { S.appium.kill(); res.appiumStopped = true; }
  mutationGuard.reload(vault.readRawEnv()); mutationGuard.resetToDefault(); mutationGuard.ledger = []; mutationGuard.setLedgerFile(null);
  Object.assign(S, { device: null, session: null, appium: null, run: null, app: null });
  return out(res);
};

// ---------------- server ----------------
const server = new Server({ name: 'mobile-qa-guard', version: '1.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const h = H[name]; if (!h) return fail(`Tool ${name} tidak dikenal.`);
  try { return await h(args); } catch (e) { logAction({ tool: name, error: e.message }); return fail(e.message.split('\n')[0]); }
});
const cleanup = async () => { try { await H.qa_close_app({ keepAppRunning: true }); } catch { /* ok */ } process.exit(0); };
process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);
await server.connect(new StdioServerTransport());
