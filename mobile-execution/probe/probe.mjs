#!/usr/bin/env node
/**
 * mobile-qa-execution — Phase 0 PROBE (Android / Appium UiAutomator2)
 *
 * Tujuan: mengukur kesiapan otomasi app (khususnya Flutter) sebelum skill penuh dibangun.
 *  1. Device Gate     : pilih device USB (adb), cek Android >= minSdk.
 *  2. Build Guard     : hanya package staging di allowlist; bandingkan versionCode APK vs terpasang.
 *  3. Login (opsional): kredensial USER_/PASS_<ROLE> dari .env, password TIDAK pernah dicetak/disimpan.
 *  4. Dump            : page source XML + screenshot per layar, hitung Testability Score.
 *  5. Explore (read-only): tap tab bottom-nav (label mutasi di-skip) & uji deep link.
 *  6. Report          : probe_report.md + probe_report.json di mobile-execution/probe-result/probe_<ts>/
 *
 * Contoh:
 *   node probe.mjs --login
 *   node probe.mjs --login --install --deeplinks "/profile,/broadcasts,/room/12345"
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from 'webdriverio';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- CLI & config ----------
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

function findRoot(start) {
  let d = start;
  for (let i = 0; i < 6; i++) { if (fs.existsSync(path.join(d, '.agents')) || fs.existsSync(path.join(d, '.env'))) return d; d = path.dirname(d); }
  return path.resolve(start, '..', '..');
}
const ROOT = findRoot(__dirname);
function loadEnv() {
  try { return createRequire(import.meta.url)(path.join(ROOT, 'scripts', 'lib', 'qa-env.cjs')).readQaEnv(ROOT); } catch (e) { if (/QA_ACTIVE_PROFILE|\.secrets/.test(e.message)) throw e; }
  return loadEnvLegacy();
}
function loadEnvLegacy() {
  const p = path.join(ROOT, '.env'); const env = {};
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const [k, ...v] = t.split('='); if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const ENV = loadEnv();
const CFG = {
  pkg: opt('package', ENV.MOBILE_APP_PACKAGE_STAGING || ''),
  activity: opt('activity', ENV.MOBILE_APP_ACTIVITY || ''),
  allowlist: (ENV.MOBILE_APP_PACKAGE_ALLOWLIST || ENV.MOBILE_APP_PACKAGE_STAGING || '').split(',').map(s => s.trim()),
  apkDir: path.join(ROOT, 'mobile-execution', 'build-apk'),
  apk: opt('apk', null),
  udid: opt('udid', ENV.ANDROID_DEVICE_SERIAL || null),
  role: opt('role', ENV.QA_DEFAULT_MOBILE_ROLE || 'OWNER_1').toUpperCase(),
  deeplinkHost: opt('deeplink-host', ENV.MOBILE_DEEPLINK_HOST || ''),
  deeplinks: opt('deeplinks', '').split(',').map(s => s.trim()).filter(Boolean),
  appium: new URL(opt('appium', ENV.APPIUM_URL || 'http://127.0.0.1:4723')),
  install: flag('install'),
  useInstalled: flag('use-installed'),
  fresh: flag('fresh'),
  att: opt('att', 'decline'),
  openChat: opt('open-chat', null) === null ? null : Number(opt('open-chat', '0')),
  login: flag('login'),
  exploreTabs: !flag('no-explore-tabs'),
  manualWaitSec: Number(opt('manual-wait', '90')),
};
if (!CFG.pkg) { console.error('MOBILE_APP_PACKAGE_STAGING belum diisi. Isi di .secrets/<QA_ACTIVE_PROFILE>.env atau pakai --package.'); process.exit(1); }
const MUTATION_RE = /\b(hapus|delete|remove|buat|create|tambah|add|new|baru|edit|ubah|update|simpan|save|kirim|send|submit|bayar|pay|checkout|top.?up|keluar|logout|log out|nonaktif|aktifkan|broadcast sekarang)\b/i;

const ts = (() => { const n = new Date(), p = x => String(x).padStart(2, '0'); return `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`; })();
const OUT = path.join(ROOT, 'mobile-execution', 'probe-result', `probe_${ts}`);
const log = (...a) => console.log('[probe]', ...a);
const die = (msg, hint) => { const e = new Error(`[STOP] ${msg}${hint ? `\n  -> ${hint}` : ''}`); e.stop = true; throw e; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const mask = (s) => !s ? '' : s.length <= 4 ? '***' : `${s.slice(0, 2)}***${s.slice(-2)}`;

// ---------- shell helpers ----------
const sh = (cmd, args, timeout = 60000) => execFileSync(cmd, args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
const adb = (...a) => sh('adb', CFG.udid ? ['-s', CFG.udid, ...a] : a, 300000).replace(/\r/g, '');
function which(bin) { try { sh('which', [bin]); return true; } catch { return false; } }

function findAapt2() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT; if (!sdk) return null;
  const bt = path.join(sdk, 'build-tools'); if (!fs.existsSync(bt)) return null;
  for (const v of fs.readdirSync(bt).sort().reverse()) { const p = path.join(bt, v, 'aapt2'); if (fs.existsSync(p)) return p; }
  return null;
}
function apkInfo(apk) {
  const info = { path: apk, package: null, versionCode: null, versionName: null, framework: 'unknown' };
  const a2 = findAapt2();
  if (a2) {
    try {
      const b = sh(a2, ['dump', 'badging', apk]);
      const m = b.match(/package: name='([^']+)' versionCode='(\d+)' versionName='([^']*)'/);
      if (m) Object.assign(info, { package: m[1], versionCode: Number(m[2]), versionName: m[3] });
    } catch { /* ignore */ }
  }
  try {
    const l = sh('unzip', ['-l', apk], 120000);
    if (/lib\/[^/]+\/libflutter\.so/.test(l)) info.framework = 'flutter';
    else if (/index\.android\.bundle|libreactnativejni\.so|libhermes\.so/.test(l)) info.framework = 'react-native';
    else info.framework = 'native';
  } catch { /* ignore */ }
  return info;
}

// ---------- page-source analysis ----------
function parseNodes(xml) {
  const nodes = [];
  const tagRe = /<([\w.$]+)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g; let m;
  while ((m = tagRe.exec(xml))) {
    if (m[1] === 'hierarchy') continue;
    const a = { tag: m[1] }; const attrRe = /([\w:-]+)="([^"]*)"/g; let k;
    while ((k = attrRe.exec(m[2]))) a[k[1]] = k[2];
    const b = (a.bounds || '').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (b) a.box = { x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4] };
    a.label = (a.text || a['content-desc'] || a.hint || '').replace(/&#10;|\n/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
    nodes.push(a);
  }
  return nodes;
}
const isEdit = n => /EditText/.test(n.class || n.tag);
const isInteractive = n => n.clickable === 'true' || n['long-clickable'] === 'true' || n.checkable === 'true' || isEdit(n);
const inside = (a, b) => a.box && b.box && a !== b && a.box.x1 >= b.box.x1 && a.box.y1 >= b.box.y1 && a.box.x2 <= b.box.x2 && a.box.y2 <= b.box.y2;
// Flutter sering menaruh label di node anak (mis. *_button_label) -> label efektif = label sendiri atau label anak.
function effLabel(n, nodes) {
  if (n.label) return { label: n.label, source: 'self' };
  const kids = nodes.filter(c => c.label && inside(c, n));
  const pref = kids.find(c => n['resource-id'] && (c['resource-id'] || '').startsWith(n['resource-id'])) || kids[0];
  return pref ? { label: pref.label, source: 'child' } : { label: '', source: 'none' };
}
function screenType(nodes) {
  if (nodes.some(n => isEdit(n) && n.password === 'true')) return 'login';
  if (nodes.some(n => /_att_/.test(n['resource-id'] || ''))) return 'tracking_consent';
  return 'other';
}
function analyze(name, xml, extra = {}) {
  const nodes = parseNodes(xml);
  const seen = new Set();
  const inter = nodes.filter(isInteractive).filter(n => { const k = `${n['resource-id']}|${n.bounds}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const eff = inter.map(n => ({ n, ...effLabel(n, nodes) }));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  return {
    screen: name, ...extra, screenType: screenType(nodes),
    totalNodes: nodes.length, interactive: inter.length,
    ownLabelPct: pct(inter.filter(n => n.label).length, inter.length),
    labeledPct: pct(eff.filter(e => e.label).length, inter.length),
    resourceIdPct: pct(inter.filter(n => n['resource-id']).length, inter.length),
    webview: nodes.some(n => /WebView/.test(n.class || n.tag)),
    toasts: nodes.filter(n => /Toast/.test(n.class || n.tag)).map(n => n.label),
    unlabeled: eff.filter(e => !e.label).slice(0, 20).map(e => ({ class: e.n.class || e.n.tag, id: e.n['resource-id'] || '', bounds: e.n.bounds })),
    locators: eff.map(e => ({ id: e.n['resource-id'] || '', label: e.label, labelSource: e.source, class: (e.n.class || e.n.tag).split('.').pop(), bounds: e.n.bounds, edit: isEdit(e.n), password: e.n.password === 'true', enabled: e.n.enabled !== 'false' })),
    labels: [...new Set(nodes.map(n => n.label).filter(Boolean))].slice(0, 80),
  };
}

// ---------- appium lifecycle ----------
async function appiumUp() { try { const r = await fetch(new URL('/status', CFG.appium)); return r.ok; } catch { return false; } }
async function ensureAppium() {
  if (await appiumUp()) { log(`Appium aktif di ${CFG.appium.href}`); return null; }
  if (!which('appium')) die('Appium tidak ditemukan dan server belum berjalan.', 'Jalankan: bash setup_check.sh');
  log('Menjalankan Appium server lokal...');
  const p = spawn('appium', ['--address', CFG.appium.hostname, '--port', CFG.appium.port || '4723', '--log-level', 'error'], { stdio: 'ignore' });
  for (let i = 0; i < 30; i++) { if (await appiumUp()) return p; await sleep(1000); }
  p.kill(); die('Appium server gagal start dalam 30 detik.');
}

// ---------- runtime ----------
const report = { startedAt: new Date().toISOString(), config: { ...CFG, appium: CFG.appium.href }, gates: {}, screens: [], deeplinks: [], login: null, guardEvents: [] };
let driver = null, appiumProc = null, secret = null;
const locatorMap = {};

async function snap(name, extra) {
  let xml = await driver.getPageSource();
  if (secret) xml = xml.split(secret).join('***');
  const idx = String(report.screens.length + 1).padStart(2, '0');
  fs.writeFileSync(path.join(OUT, `${idx}_${name}.xml`), xml);
  fs.writeFileSync(path.join(OUT, `${idx}_${name}.png`), Buffer.from(await driver.takeScreenshot(), 'base64'));
  const pkg = await driver.getCurrentPackage().catch(() => '?');
  const act = await driver.getCurrentActivity().catch(() => '?');
  const a = analyze(name, xml, { file: `${idx}_${name}`, foregroundPackage: pkg, activity: act, ...extra });
  report.screens.push(a);
  locatorMap[a.file] = { screenType: a.screenType, activity: act, locators: a.locators };
  log(`snap ${idx}_${name}: interactive=${a.interactive} labeled=${a.labeledPct}% resource-id=${a.resourceIdPct}% pkg=${pkg}`);
  return { xml, a };
}
async function foregroundGuard(stage) {
  const pkg = await driver.getCurrentPackage().catch(() => null);
  if (pkg && /permissioncontroller|packageinstaller/.test(pkg)) {
    const allow = await driver.$$('//*[contains(@resource-id,"permission_allow")]');
    if (allow.length) { await allow[0].click(); report.guardEvents.push({ stage, foreground: pkg, action: 'allow permission dialog' }); await sleep(1500); return true; }
  }
  if (pkg && pkg !== CFG.pkg) {
    report.guardEvents.push({ stage, foreground: pkg, action: 'activateApp' });
    log(`[BUILD GUARD] Foreground keluar ke ${pkg} pada "${stage}" -> kembali ke ${CFG.pkg}`);
    await driver.activateApp(CFG.pkg); await sleep(2500);
    return false;
  }
  return true;
}
async function settle(maxMs = 20000) {
  let last = -1, stable = 0; const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const n = parseNodes(await driver.getPageSource()).length;
    stable = n === last ? stable + 1 : 0; last = n;
    if (stable >= 1 && Date.now() - t0 > 2500) return;
    await sleep(1500);
  }
}
async function tapNode(n) {
  const x = Math.round((n.box.x1 + n.box.x2) / 2), y = Math.round((n.box.y1 + n.box.y2) / 2);
  await driver.execute('mobile: clickGesture', { x, y });
}
const xq = s => (s.includes('"') ? `'${s}'` : `"${s}"`);
// Klik dengan prioritas: resource-id unik -> content-desc unik -> koordinat. Mengembalikan tier yang dipakai.
async function clickNode(n) {
  if (n['resource-id']) {
    const els = await driver.$$(`//*[@resource-id=${xq(n['resource-id'])}${n.clickable === 'true' ? ' and @clickable="true"' : ''}]`);
    if (els.length === 1) { await els[0].click(); return 'resource-id'; }
    if (els.length > 1) { // Flutter: wrapper + node clickable dengan id & bounds sama -> aman klik yang pertama
      const bs = await Promise.all(els.map(e => e.getAttribute('bounds').catch(() => null)));
      if (bs.every(b => b && b === bs[0])) { await els[0].click(); return 'resource-id'; }
    }
  }
  if (n['content-desc']) {
    const els = await driver.$$(`//*[@content-desc=${xq(n['content-desc'])}]`);
    if (els.length === 1) { await els[0].click(); return 'content-desc'; }
  }
  await tapNode(n); return 'coordinate';
}
const src = async () => parseNodes(await driver.getPageSource());

// Layar sebelum form login: tracking consent, onboarding "Lewati", dsb. Hanya aksi non-mutasi.
async function passPreLogin() {
  const steps = [];
  for (let i = 0; i < 6; i++) {
    const nodes = await src(); const type = screenType(nodes);
    if (type === 'login') return { reached: 'login', steps };
    if (type === 'tracking_consent') {
      const want = CFG.att === 'grant' ? /_att_granted_button$/ : /_att_decline_button$/;
      const btn = nodes.find(n => n.clickable === 'true' && want.test(n['resource-id'] || ''));
      if (!btn) return { reached: 'stuck_tracking_consent', steps };
      const tier = await clickNode(btn);
      steps.push(`Tracking consent -> "${effLabel(btn, nodes).label}" (${btn['resource-id']}, via ${tier})`);
      await settle(10000); await snap('after_consent'); continue;
    }
    const skip = nodes.find(n => n.clickable === 'true' && /^(lewati|skip|nanti( saja)?|tutup|close|mengerti)$/i.test(effLabel(n, nodes).label));
    if (skip) {
      const tier = await clickNode(skip); steps.push(`Onboarding -> "${effLabel(skip, nodes).label}" (via ${tier})`);
      await settle(8000); await snap('after_onboarding'); continue;
    }
    return { reached: 'other', steps };
  }
  return { reached: 'loop_limit', steps };
}

async function doLogin() {
  const user = ENV[`USER_${CFG.role}`], pass = ENV[`PASS_${CFG.role}`];
  if (!user || !pass) die(`Kredensial USER_${CFG.role} / PASS_${CFG.role} tidak ada di .env`, `Tersedia: ${Object.keys(ENV).filter(k => k.startsWith('USER_')).join(', ') || '-'}`);
  secret = pass;
  const res = { role: CFG.role, user: mask(user), status: null, notes: [] };
  report.login = res;
  const nodes = await src(); const edits = nodes.filter(isEdit);
  const pwdN = edits.find(n => n.password === 'true'), userN = edits.find(n => n.password !== 'true');
  if (!pwdN || !userN) { res.status = 'FAILED'; res.notes.push(`Field login tidak lengkap (EditText: ${edits.length}).`); return; }
  res.fields = { username: userN['resource-id'] || `hint:${userN.hint}`, password: pwdN['resource-id'] || `hint:${pwdN.hint}` };
  const field = n => driver.$(n['resource-id'] ? `//android.widget.EditText[@resource-id=${xq(n['resource-id'])}]` : `//android.widget.EditText[@hint=${xq(n.hint)}]`);
  const u = await field(userN); await u.click(); await u.setValue(user);
  const typed = (await u.getText().catch(() => '')) || '';
  if (!typed.includes(user.slice(0, 3))) res.notes.push('Teks username tidak terbaca kembali dari field (cek screenshot).');
  const p = await field(pwdN); await p.click(); await p.setValue(pass);
  try { await driver.hideKeyboard(); } catch { /* ok */ }
  await sleep(1000);
  const after = await src();
  const seen = new Set();
  const btns = after.filter(n => !isEdit(n) && (n.clickable === 'true' || /login_button$/.test(n['resource-id'] || '')))
    .filter(n => /login_button$/.test(n['resource-id'] || '') || /^(login|log in|masuk|sign in)$/i.test(effLabel(n, after).label))
    // Flutter: wrapper (clickable=false) & node aktif (clickable=true) punya id+bounds sama -> utamakan yang clickable sebelum dedupe
    .sort((a, b) => (b.clickable === 'true') - (a.clickable === 'true'))
    .filter(n => { if (seen.has(n.bounds)) return false; seen.add(n.bounds); return true; });
  const enabled = btns.filter(n => n.clickable === 'true');
  if (enabled.length !== 1) {
    res.status = 'FAILED';
    res.notes.push(btns.length && !enabled.length ? 'Tombol login ditemukan tetapi masih disabled setelah input (cek validasi field).' : `Tombol login ambigu/tidak ditemukan (${enabled.length} kandidat).`);
    await snap('login_failed'); return;
  }
  const btn = enabled[0];
  res.loginButton = { id: btn['resource-id'] || '', label: effLabel(btn, after).label };
  res.loginButton.locatorTier = await clickNode(btn);
  const t0 = Date.now();
  const waitGone = async (ms) => { while (Date.now() - t0 < ms) { await sleep(2000); if (screenType(await src()) !== 'login') return true; } return false; };
  let done = await waitGone(25000);
  if (!done) {
    const { a } = await snap('login_pending');
    if (a.toasts.length) res.notes.push(`Toast: ${a.toasts.join(' | ')}`);
    log(`Masih di layar login. Jika ada OTP/verifikasi, selesaikan MANUAL di HP. Menunggu ${CFG.manualWaitSec} detik...`);
    done = await waitGone(25000 + CFG.manualWaitSec * 1000);
  }
  res.status = done ? 'PASSED' : 'FAILED';
  res.durationSec = Math.round((Date.now() - t0) / 1000);
}

// Analisa app setelah login (read-only, agnostik struktur):
//  1) Tab atas (pola semantics Flutter "Tab x dari y")  2) Ikon app bar (menu/drawer, filter, search)
//  3) Item drawer level-1 -> buka, snapshot, kembali.  Label mutasi (keluar/hapus/kirim/...) selalu dilewati.
const TAB_RE = /\btab\s+\d+\s+(dari|of)\s+\d+\b/i;
const dedupe = arr => { const s = new Set(); return arr.filter(n => { const k = n.bounds; if (s.has(k)) return false; s.add(k); return true; }); };
const slug = t => (t || 'x').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
async function explore() {
  const ex = { home: null, tabs: [], appBar: [], drawer: [], chat: null, notes: [] };
  report.explore = ex;
  let nodes = await src();
  if (screenType(nodes) === 'login') { ex.notes.push('Masih di layar login, eksplorasi dibatalkan.'); return; }
  const boxes = nodes.filter(n => n.box); const H = Math.max(...boxes.map(n => n.box.y2)), W = Math.max(...boxes.map(n => n.box.x2));
  const anchor = [...new Set(nodes.filter(n => n.label && n.box && n.box.y2 < H * 0.2).map(n => n.label))];
  const isHome = ns => { const ls = new Set(ns.map(n => n.label)); return anchor.length > 0 && anchor.filter(l => ls.has(l)).length >= Math.ceil(anchor.length / 2); };
  const backHome = async () => {
    for (let i = 0; i < 4; i++) { if (isHome(await src())) return true; await driver.back(); await settle(6000); await foregroundGuard('back'); }
    if (isHome(await src())) return true;
    // fallback: relaunch app (sesi login tetap tersimpan) -> kembali ke home sebagai anchor
    ex.notes.push('Back tidak kembali ke home -> relaunch app.');
    await driver.terminateApp(CFG.pkg).catch(() => {}); await driver.activateApp(CFG.pkg); await settle(15000);
    return isHome(await src());
  };
  const title = ns => (ns.filter(n => n.label && n.box && n.box.y2 < H * 0.13 && !TAB_RE.test(n.label)).sort((a, b) => a.box.x1 - b.box.x1)[0] || {}).label || '';
  ex.home = { title: title(nodes), anchor };

  // 1) Tab atas
  const tabs = dedupe(nodes.filter(n => n.box && n.clickable === 'true' && TAB_RE.test(n.label))).sort((a, b) => a.box.x1 - b.box.x1);
  for (const t of tabs) {
    const name = (nodes.find(c => c.label && !TAB_RE.test(c.label) && inside(c, t)) || {}).label || t.label;
    if (MUTATION_RE.test(name)) { ex.tabs.push({ name, skipped: 'MUTATION GUARD' }); continue; }
    const tier = await clickNode(t); await settle(8000); await foregroundGuard(`tab ${name}`);
    const { a } = await snap(`tab_${slug(name)}`, { via: tier });
    ex.tabs.push({ name, semantics: t.label, tier, items: a.locators.filter(l => /item_\d+$/.test(l.id)).length });
  }
  if (tabs[0]) { await clickNode(tabs[0]).catch(() => {}); await settle(5000); }

  // 2) Ikon app bar (+ drawer)
  nodes = await src();
  const bar = dedupe(nodes.filter(n => n.box && n.clickable === 'true' && !isEdit(n) && !TAB_RE.test(n.label) && n.box.y2 < H * 0.13 && (n.box.x2 - n.box.x1) < W * 0.3)).sort((a, b) => a.box.x1 - b.box.x1);
  for (const [i, b] of bar.entries()) {
    const lbl = effLabel(b, nodes).label; const pos = b.box.x1 < W * 0.25 ? 'kiri' : 'kanan';
    if (MUTATION_RE.test(lbl)) { ex.appBar.push({ position: pos, label: lbl, skipped: 'MUTATION GUARD' }); continue; }
    const before = await src(); const seenBefore = new Set(before.map(n => `${n.label}|${n.bounds}`));
    const tier = await clickNode(b); await settle(8000); await foregroundGuard(`appbar ${pos}`);
    const after = await src();
    const { a } = await snap(`appbar_${pos}_${i + 1}`, { via: tier, lowConfidence: !lbl });
    const fresh = dedupe(after.filter(n => n.box && n.clickable === 'true' && !seenBefore.has(`${n.label}|${n.bounds}`)))
      .map(n => ({ n, label: effLabel(n, after).label })).filter(x => x.label);
    const entry = { position: pos, label: lbl || '(ikon tanpa label)', bounds: b.bounds, tier, lowConfidence: !lbl, screenTitle: title(after), opened: a.labels.slice(0, 10) };
    ex.appBar.push(entry);
    if (pos === 'kiri' && fresh.length >= 3) {
      entry.kind = 'drawer';
      const items = fresh.sort((x, y) => x.n.box.y1 - y.n.box.y1).slice(0, 20);
      for (const it of items) {
        if (MUTATION_RE.test(it.label)) { ex.drawer.push({ label: it.label, skipped: 'MUTATION GUARD' }); continue; }
        const cur = await src(); const target = cur.find(n => n.clickable === 'true' && effLabel(n, cur).label === it.label) || it.n;
        const t2 = await clickNode(target); await settle(10000); await foregroundGuard(`menu ${it.label}`);
        const pg = await src();
        if (screenType(pg) === 'login') { ex.drawer.push({ label: it.label, error: 'Kembali ke layar login (sesi berakhir?)' }); return; }
        const { a: pa } = await snap(`menu_${slug(it.label)}`, { via: t2 });
        ex.drawer.push({ label: it.label, id: target['resource-id'] || '', tier: t2, screenTitle: title(pg), interactive: pa.interactive, resourceIdPct: pa.resourceIdPct, labeledPct: pa.labeledPct, sample: pa.labels.slice(0, 8) });
        if (!(await backHome())) { ex.notes.push(`Tidak bisa kembali ke home setelah membuka "${it.label}"; eksplorasi drawer dihentikan.`); return; }
        await clickNode(b); await settle(6000);
      }
      await backHome();
    } else {
      entry.kind = fresh.length ? 'panel/dialog' : 'halaman';
      if (!(await backHome())) { ex.notes.push(`Tidak bisa kembali ke home dari ikon app bar ${pos} #${i + 1}.`); return; }
    }
  }

  // 3) Opsional: buka 1 chatroom (efek samping: pesan ditandai sudah dibaca)
  if (CFG.openChat !== null) {
    nodes = await src();
    const item = nodes.find(n => new RegExp(`(^|_)item_${CFG.openChat}$`).test(n['resource-id'] || '')) || dedupe(nodes.filter(n => /item_\d+$/.test(n['resource-id'] || '')))[CFG.openChat];
    if (!item) { ex.notes.push(`Chat index ${CFG.openChat} tidak ditemukan.`); return; }
    const tier = await clickNode(item); await settle(10000); await foregroundGuard('chatroom');
    const { a } = await snap('chatroom', { via: tier });
    try { await driver.execute('mobile: swipeGesture', { left: Math.round(W * 0.1), top: Math.round(H * 0.25), width: Math.round(W * 0.8), height: Math.round(H * 0.5), direction: 'down', percent: 0.8 }); await settle(5000); await snap('chatroom_scrolled'); } catch { /* ok */ }
    ex.chat = { index: CFG.openChat, label: item.label, tier, screenTitle: title(await src()), interactive: a.interactive, resourceIdPct: a.resourceIdPct, labeledPct: a.labeledPct, ids: a.locators.map(l => l.id).filter(Boolean).slice(0, 40) };
    await backHome();
  }
}

async function tryDeeplinks() {
  for (const route of CFG.deeplinks) {
    const url = route.startsWith('http') ? route : CFG.deeplinkHost.replace(/\/$/, '') + route;
    const r = { route, url };
    try {
      await driver.execute('mobile: deepLink', { url, package: CFG.pkg });
      await settle(10000);
      r.stayedInApp = await foregroundGuard(`deeplink ${route}`);
      const { a } = await snap(`deeplink_${route.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '')}`);
      r.screenLabels = a.labels.slice(0, 10); r.activity = a.activity;
    } catch (e) { r.error = String(e.message || e).split('\n')[0]; }
    report.deeplinks.push(r);
  }
}

// ---------- report ----------
function writeReport() {
  fs.writeFileSync(path.join(OUT, 'probe_report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'locator_map.json'), JSON.stringify(locatorMap, null, 2));
  const g = report.gates, L = report.login, md = [];
  md.push(`# Mobile QA Probe Report — ${ts}`, '');
  if (report.error) md.push(`> ⚠️ Probe berhenti: ${report.error}`, '');
  md.push('## Device & Build', '', '| Item | Nilai |', '|---|---|');
  if (g.device) md.push(`| Device | ${g.device.serial} — ${g.device.brand} ${g.device.model}, Android ${g.device.release} (API ${g.device.sdk}) |`);
  if (g.apk) md.push(`| APK | ${path.basename(g.apk.path)} — ${g.apk.package || '?'} v${g.apk.versionName || '?'} (${g.apk.versionCode || '?'}) |`, `| Framework (APK) | ${g.apk.framework} |`);
  if (g.installed) md.push(`| Terpasang di HP | ${g.installed.versionName || '-'} (${g.installed.versionCode || '-'})${g.installed.installedNow ? ' — baru diinstal' : ''}${g.installed.decision ? ` — ${g.installed.decision}` : ''} |`);
  if (g.buildGuard) md.push(`| Build Guard | ${g.buildGuard} |`);
  if (g.fresh) md.push('| Reset | pm clear (fresh start) |');
  md.push('', '## Pre-Login', '');
  if (report.preLogin) { md.push(`- Kondisi akhir: **${report.preLogin.reached}**`); for (const s of report.preLogin.steps) md.push(`- ${s}`); } else md.push('- Tidak sampai tahap ini.');
  md.push('', '## Login', '');
  if (L) {
    md.push(`- Role: \`${L.role}\`${L.user ? ` (user ${L.user})` : ''} → **${L.status}**${L.durationSec ? ` (${L.durationSec}s)` : ''}`);
    if (L.fields) md.push(`- Field: username \`${L.fields.username}\`, password \`${L.fields.password}\``);
    if (L.loginButton) md.push(`- Tombol: "${L.loginButton.label}" \`${L.loginButton.id}\` via ${L.loginButton.locatorTier}`);
    if (L.notes.length) md.push(`- Catatan: ${L.notes.join('; ')}`);
  } else md.push(CFG.login ? '- Probe berhenti sebelum tahap login.' : '- Tidak dijalankan (tambahkan --login).');
  md.push('', '## Testability per Layar', '', '| # | Layar | Tipe | Interaktif | resource-id | Label efektif | Label sendiri | Toast |', '|---|---|---|---:|---:|---:|---:|---|');
  for (const s of report.screens) md.push(`| ${s.file.slice(0, 2)} | ${s.screen} | ${s.screenType} | ${s.interactive} | ${s.resourceIdPct}% | ${s.labeledPct}% | ${s.ownLabelPct}% | ${s.toasts.join(' / ') || '-'} |`);
  const avg = k => report.screens.length ? Math.round(report.screens.reduce((a, s) => a + s[k], 0) / report.screens.length) : 0;
  if (report.screens.length) {
    md.push('', `**Rata-rata:** resource-id ${avg('resourceIdPct')}%, label efektif ${avg('labeledPct')}% (label sendiri ${avg('ownLabelPct')}%)`, '', '_Label efektif = label milik elemen atau label dari node anak (pola Flutter `*_button` + `*_button_label`)._', '', '### Interpretasi', '');
    md.push(avg('resourceIdPct') >= 70 ? '- resource-id tersedia luas (Semantics identifier) → locator tier 1 = resource-id.' : avg('resourceIdPct') >= 20 ? '- resource-id tersedia sebagian → kombinasi resource-id + label.' : '- resource-id hampir tidak ada → minta dev `Semantics(identifier: ...)` pada elemen kunci.');
    md.push(avg('labeledPct') >= 80 ? '- Mayoritas elemen punya label efektif → langkah bahasa alami bisa dipetakan ke elemen.' : '- Banyak elemen tanpa label efektif → vision fallback (LOW CONFIDENCE) akan sering terpakai.');
  }
  const E = report.explore;
  if (E) {
    const st = ['# Struktur App (Mobile) — ' + (report.gates.apk?.package || CFG.pkg) + ' — ' + ts, ''];
    st.push(`## Home: ${E.home?.title || '-'}`, '');
    if (E.tabs.length) { st.push('### Tab atas', ''); for (const t of E.tabs) st.push(`- ${t.name}${t.skipped ? ` — DILEWATI (${t.skipped})` : ` — via ${t.tier}, ${t.items} item list`}`); st.push(''); }
    if (E.appBar.length) { st.push('### Ikon app bar', ''); for (const b of E.appBar) st.push(`- ${b.position}: ${b.label}${b.skipped ? ` — DILEWATI (${b.skipped})` : ` → ${b.kind || '-'}${b.screenTitle ? ` "${b.screenTitle}"` : ''} (via ${b.tier}${b.lowConfidence ? ', LOW CONFIDENCE' : ''})`}`); st.push(''); }
    if (E.drawer.length) { st.push('### Menu drawer (level 1)', '', '| Menu | Judul layar | resource-id | Label efektif | Locator |', '|---|---|---:|---:|---|'); for (const d of E.drawer) st.push(d.skipped || d.error ? `| ${d.label} | ${d.skipped ? 'DILEWATI (' + d.skipped + ')' : d.error} | - | - | - |` : `| ${d.label} | ${d.screenTitle || '-'} | ${d.resourceIdPct}% | ${d.labeledPct}% | ${d.id ? '`' + d.id + '`' : d.tier} |`); st.push(''); }
    if (E.chat) { st.push('### Chatroom (index ' + E.chat.index + ')', '', `- Judul: ${E.chat.screenTitle}; interaktif ${E.chat.interactive}, resource-id ${E.chat.resourceIdPct}%, label ${E.chat.labeledPct}%`, `- ID: ${E.chat.ids.map(i => '`' + i + '`').join(', ') || '-'}`, ''); }
    if (E.notes.length) { st.push('### Catatan', ''); for (const n of E.notes) st.push(`- ${n}`); }
    fs.writeFileSync(path.join(OUT, 'app_structure.md'), st.join('\n'));
    const ACTIVE = createRequire(import.meta.url)(path.join(ROOT, 'scripts', 'lib', 'qa-env.cjs')).activeProfile(ROOT);
    const live = ACTIVE.alias ? path.join(ACTIVE.profileDir, 'knowledge', 'mobile', 'live-analyzer', CFG.pkg, ts) : path.join(ROOT, 'doc-analyzer', 'strukturmenu', 'mobile-apps', 'live-analyzer', CFG.pkg, ts);
    try { fs.mkdirSync(live, { recursive: true }); fs.writeFileSync(path.join(live, 'app_structure.md'), st.join('\n')); fs.writeFileSync(path.join(live, 'locator_map.json'), JSON.stringify(locatorMap, null, 2)); } catch { /* opsional */ }
    md.push('', ...st.slice(2).map(l => l.replace(/^## /, '## Eksplorasi — ').replace(/^### /, '#### ')));
  }
  if (report.deeplinks.length) {
    md.push('', '## Deep Link', '', '| Route | Tetap di app | Label teratas / error |', '|---|:---:|---|');
    for (const d of report.deeplinks) md.push(`| \`${d.route}\` | ${d.error ? '-' : d.stayedInApp ? 'Ya' : 'Tidak'} | ${d.error ? `ERROR: ${d.error}` : (d.screenLabels || []).slice(0, 5).join(' · ')} |`);
  }
  if (report.guardEvents.length) { md.push('', '## Guard Events', ''); for (const e of report.guardEvents) md.push(`- ${e.stage}: foreground ${e.foreground} → ${e.action}`); }
  md.push('', '## Label per Layar', '');
  for (const s of report.screens) md.push(`- **${s.file}**: ${s.labels.slice(0, 25).join(' · ') || '-'}`);
  const ul = report.screens.filter(s => s.unlabeled.length);
  if (ul.length) { md.push('', '## Elemen Interaktif Tanpa Label Efektif', ''); for (const s of ul) md.push(`- **${s.file}**: ${s.unlabeled.map(u => `${u.id || u.class.split('.').pop()}${u.bounds}`).join(', ')}`); }
  md.push('', '_File XML & PNG per layar + `locator_map.json` ada di folder ini. Password di-mask (***) pada XML._');
  fs.writeFileSync(path.join(OUT, 'probe_report.md'), md.join('\n'));
}

// ---------- main ----------
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!which('adb')) die('adb tidak ditemukan.', 'Jalankan: bash setup_check.sh');

  // GATE: device
  const devs = sh('adb', ['devices']).split('\n').slice(1).map(l => l.trim().split(/\s+/)).filter(x => x[0]);
  const ready = devs.filter(d => d[1] === 'device');
  if (devs.some(d => d[1] === 'unauthorized')) log('Ada device "unauthorized": setujui dialog USB debugging di HP.');
  if (!CFG.udid) {
    if (!ready.length) die('Tidak ada device siap.', 'Colok HP, aktifkan USB debugging, cek "adb devices".');
    if (ready.length > 1) die(`Ada ${ready.length} device: ${ready.map(d => d[0]).join(', ')}`, 'Pilih salah satu dengan --udid <serial>');
    CFG.udid = ready[0][0];
  }
  const gp = k => adb('shell', 'getprop', k).trim();
  report.gates.device = { serial: CFG.udid, brand: gp('ro.product.brand'), model: gp('ro.product.model'), release: gp('ro.build.version.release'), sdk: Number(gp('ro.build.version.sdk')) };
  log('Device:', JSON.stringify(report.gates.device));
  if (report.gates.device.sdk < 28) die('Android < 9 (API 28) tidak didukung app ini.');

  // GATE: build guard
  if (!CFG.allowlist.includes(CFG.pkg)) die(`Package ${CFG.pkg} tidak ada di allowlist ${CFG.allowlist.join(',')}`);
  if (!/\.stag(ing)?$/.test(CFG.pkg) && ENV.MOBILE_BUILD_GUARD_STRICT !== 'false') die(`Package ${CFG.pkg} tidak berakhiran .stag — ditolak Build Guard.`);
  if (!CFG.apk) {
    const apks = fs.existsSync(CFG.apkDir) ? fs.readdirSync(CFG.apkDir).filter(f => f.endsWith('.apk')) : [];
    if (apks.length > 1) die(`Ada ${apks.length} APK di build-apk/: ${apks.join(', ')}`, 'Pilih dengan --apk <path>');
    CFG.apk = apks[0] ? path.join(CFG.apkDir, apks[0]) : null;
  }
  if (CFG.apk) {
    report.gates.apk = apkInfo(CFG.apk);
    if (report.gates.apk.package && report.gates.apk.package !== CFG.pkg) die(`APK berisi package ${report.gates.apk.package}, bukan ${CFG.pkg}. Ditolak Build Guard.`);
    if (!report.gates.apk.versionCode) log('aapt2 tidak ditemukan: versionCode APK tidak bisa dibaca (perbandingan versi dilewati).');
  }
  const readInstalled = () => { let d = ''; try { d = adb('shell', 'dumpsys', 'package', CFG.pkg); } catch { /* not installed */ } return { versionCode: Number((d.match(/versionCode=(\d+)/) || [])[1]) || null, versionName: (d.match(/versionName=(\S+)/) || [])[1] || null }; };
  const inst = readInstalled(); report.gates.installed = inst;
  const apkVc = report.gates.apk?.versionCode;
  const newerOnDevice = inst.versionCode && apkVc && inst.versionCode > apkVc;
  if (newerOnDevice) {
    // Downgrade butuh uninstall (data app hilang) -> tidak pernah dilakukan otomatis.
    if (!CFG.useInstalled) die(`Build di HP LEBIH BARU (HP ${inst.versionName} / ${inst.versionCode}) dibanding APK di build-apk/ (${apkVc}).`,
      'Pilih: (A) pakai build yang terpasang -> tambahkan --use-installed, atau (B) taruh APK versi terbaru di build-apk/ lalu jalankan dengan --install.');
    inst.decision = `use-installed (HP ${inst.versionCode} > APK ${apkVc})`;
  }
  const needInstall = !inst.versionCode || (!newerOnDevice && apkVc && apkVc !== inst.versionCode && !CFG.useInstalled);
  if (needInstall) {
    const why = !inst.versionCode ? 'belum terpasang' : `versi berbeda (HP ${inst.versionCode} vs APK ${apkVc})`;
    if (!CFG.apk) die(`App ${CFG.pkg} ${why} dan tidak ada APK di build-apk/.`);
    if (!CFG.install) die(`App ${CFG.pkg} ${why}.`, 'Jalankan ulang dengan --install untuk menginstal/upgrade (adb install -r -g), atau --use-installed untuk memakai build yang ada.');
    log(`Menginstal ${path.basename(CFG.apk)} (${why})... bisa 1-3 menit.`);
    adb('install', '-r', '-g', CFG.apk);
    Object.assign(inst, readInstalled(), { installedNow: true });
  }
  report.gates.buildGuard = inst.versionName && /stag/i.test(inst.versionName) ? `PASS (${CFG.pkg}, ${inst.versionName})` : `WARN (versionName "${inst.versionName}" tanpa penanda stag)`;
  log('Build Guard:', report.gates.buildGuard);

  if (CFG.fresh) { log(`--fresh: pm clear ${CFG.pkg} (data & sesi app staging di-reset)`); adb('shell', 'pm', 'clear', CFG.pkg); report.gates.fresh = true; }
  // runtime permissions (deterministik; abaikan yang tidak diminta app)
  for (const p of ['POST_NOTIFICATIONS', 'CAMERA', 'READ_CONTACTS', 'WRITE_CONTACTS', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'RECORD_AUDIO', 'READ_MEDIA_AUDIO']) {
    try { adb('shell', 'pm', 'grant', CFG.pkg, `android.permission.${p}`); } catch { /* skip */ }
  }

  // session
  appiumProc = await ensureAppium();
  driver = await remote({
    hostname: CFG.appium.hostname, port: Number(CFG.appium.port || 4723), path: '/', logLevel: 'error',
    capabilities: {
      platformName: 'Android', 'appium:automationName': 'UiAutomator2', 'appium:udid': CFG.udid,
      'appium:appPackage': CFG.pkg, 'appium:appActivity': CFG.activity, 'appium:noReset': true,
      'appium:autoGrantPermissions': true, 'appium:newCommandTimeout': 300,
      'appium:disableIdLocatorAutocompletion': true, 'appium:uiautomator2ServerInstallTimeout': 120000,
      'appium:adbExecTimeout': 60000,
    },
  });
  await settle(25000); await foregroundGuard('launch');
  await snap('launch');
  report.preLogin = await passPreLogin();
  if (CFG.login) {
    if (report.preLogin.reached === 'login') {
      await doLogin();
      if (report.login.status === 'PASSED') { await settle(20000); await foregroundGuard('after_login'); await snap('home_after_login'); }
    } else {
      report.login = { role: CFG.role, status: 'SKIP', notes: [`Form login tidak muncul (state: ${report.preLogin.reached}); kemungkinan sesi masih aktif. Gunakan --fresh untuk mulai dari kondisi bersih.`] };
    }
  }
  if (CFG.exploreTabs) await explore();
  if (CFG.deeplinks.length) await tryDeeplinks();
}

main()
  .catch(e => { report.error = String(e.message || e).split('\n')[0]; console.error(e.stop ? `\n${e.message}\n` : `[probe] ERROR: ${e.stack || e}`); })
  .finally(async () => {
    try { if (driver) await driver.deleteSession(); } catch { /* ignore */ }
    if (appiumProc) appiumProc.kill();
    if (fs.existsSync(OUT)) {
      writeReport(); log(`Laporan: ${path.relative(ROOT, path.join(OUT, 'probe_report.md'))}`);
      try { execFileSync('python3', [path.join(ROOT, '.agents/skills/mobile-qa-execution/scripts/update_ui_knowledge.py'), '--probe', OUT, '--package', CFG.pkg], { stdio: 'ignore' }); log(`Knowledge UI diperbarui: doc-analyzer/strukturmenu/mobile-apps/knowledge/${CFG.pkg}/`); } catch { /* opsional */ }
    }
    process.exit(report.error ? 1 : 0);
  });
