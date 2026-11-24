/**
 * MobileSession: koneksi Appium + resolusi target berlapis + aksi + assertion + guard foreground.
 * Tier locator: resource-id (HIGH) -> label exact (HIGH) -> contains/fuzzy (LOW) -> text-node (LOW) -> anchored (LOW) -> coordinate (LOW)
 * anchored = elemen/titik relatif ke anchor ber-ID/label exact (target.relativeTo + side) — satu-satunya jalur koordinat yang boleh untuk mutasi.
 */
import { remote } from 'webdriverio';
import { parseNodes, interactiveElements, effLabel, isEdit, screenType, screenTitle, screenSize, summarize, center, inside } from './ui-tree.js';
import { sleep } from './device.js';

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const xq = s => (String(s).includes('"') ? `'${s}'` : `"${s}"`);
const HIGH = new Set(['resource-id', 'label']);

export class MobileSession {
  constructor({ device, pkg, activity, appiumUrl, buildGuard }) {
    Object.assign(this, { device, pkg, activity, appiumUrl: new URL(appiumUrl), buildGuard });
    this.driver = null; this.nodes = []; this.elements = []; this.homeAnchor = []; this.guardEvents = []; this.recording = null;
    this.seen = new Map(); this.permissionPolicy = 'allow';
  }
  async start() {
    this.driver = await remote({
      hostname: this.appiumUrl.hostname, port: Number(this.appiumUrl.port || 4723), path: '/', logLevel: 'error',
      capabilities: {
        platformName: 'Android', 'appium:automationName': 'UiAutomator2', 'appium:udid': this.device.serial,
        'appium:appPackage': this.pkg, 'appium:appActivity': this.activity, 'appium:noReset': true,
        'appium:autoGrantPermissions': true, 'appium:newCommandTimeout': 600, 'appium:disableIdLocatorAutocompletion': true,
        'appium:uiautomator2ServerInstallTimeout': 120000, 'appium:adbExecTimeout': 60000,
      },
    });
    // Pop-up notifikasi/overlay bisa menjadi "jendela aktif" -> tree app kosong. Multi-window membaca semua jendela.
    try { await this.driver.updateSettings({ enableMultiWindows: true }); } catch { /* driver lama */ }
    await this.settle(25000); await this.foregroundGuard('launch');
    this.treeReady = await this.waitTree(20000);
    if (this.treeReady && screenType(this.nodes) === 'other') this.captureHomeAnchor(); // sesi login masih aktif -> layar awal = home
    return this.nodes;
  }
  async refresh() {
    this.xml = await this.driver.getPageSource();
    // multi-window aktif: buang node milik jendela lain (pop-up notifikasi, overlay sistem); dialog izin ditangani foregroundGuard.
    // simpan: node app staging, node picker sistem (Galeri/File/Kamera), dan Toast (package bisa systemui)
    this.nodes = parseNodes(this.xml).filter(n => !n.package || n.package === this.pkg || this.buildGuard.isPicker(n.package) || /Toast/.test(n.class || n.tag));
    this.elements = interactiveElements(this.nodes);
    // catat semua teks & toast yang terlihat sejak aksi terakhir (toast hanya tampil ±2-3 detik)
    const now = Date.now();
    for (const n of this.nodes) if (n.label) { const k = (/Toast/.test(n.class || n.tag) ? 'toast:' : '') + n.label; if (!this.seen.has(k)) this.seen.set(k, now); }
    return this.nodes;
  }
  async waitTree(maxMs = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) { await this.refresh(); if (this.elements.length) return true; await sleep(1500); }
    return false;
  }
  async settle(maxMs = 15000) {
    let last = -1, stable = 0; const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const n = (await this.refresh()).length;
      stable = n === last ? stable + 1 : 0; last = n;
      if (stable >= 1 && Date.now() - t0 > 1500) return; await sleep(1000);
    }
  }
  async foregroundGuard(stage) {
    const fg = await this.driver.getCurrentPackage().catch(() => null);
    const kind = this.buildGuard.classify(fg);
    if (kind === 'app') return { ok: true };
    if (kind === 'system_picker') return { ok: true, picker: fg, note: `Picker sistem aktif: ${fg}` };
    if (kind === 'permission_dialog') {
      if (this.permissionPolicy === 'leave') return { ok: true, picker: fg, note: 'Dialog izin sistem dibiarkan (policy leave).' };
      const sel = this.permissionPolicy === 'deny' ? '//*[contains(@resource-id,"permission_deny")]' : '//*[contains(@resource-id,"permission_allow")]';
      const btn = await this.driver.$$(sel);
      if (btn.length) { await btn[0].click(); await sleep(1200); }
      this.guardEvents.push({ stage, foreground: fg, action: `${this.permissionPolicy} permission dialog` }); return { ok: true, note: `Dialog izin sistem di-${this.permissionPolicy} otomatis.` };
    }
    this.guardEvents.push({ stage, foreground: fg, action: 'activateApp' });
    await this.driver.activateApp(this.pkg); await sleep(2500); await this.refresh();
    return { ok: false, note: `[BUILD GUARD] App keluar ke ${fg} (${kind}) saat "${stage}" -> dikembalikan ke ${this.pkg}.` };
  }
  summary(max = 40) { return summarize(this.nodes, max); }
  markAction() { this.seen = new Map(); }
  seenToasts() { return [...this.seen.keys()].filter(k => k.startsWith('toast:')).map(k => k.slice(6)); }
  seenTexts() { return [...this.seen.keys()].map(k => k.replace(/^toast:/, '')); }

  /** Resolusi target. target: {ref|id|label|contains|hint|type|xy|relativeTo+side(+offset), index?, scroll?} */
  async resolve(target = {}, { allowMany = false, scrollTries = 3 } = {}) {
    for (let attempt = 0; attempt <= scrollTries; attempt++) {
      const r = this._resolveOnce(target, allowMany);
      if (r.ok || r.ambiguous || target.xy || r.anchorFound || target.scroll === false || attempt === scrollTries) return { ...r, scrolled: attempt };
      await this.swipe('up', 0.6); await this.settle(4000);
    }
  }
  _resolveOnce(t, allowMany) {
    const E = this.elements, N = this.nodes;
    const pick = (list, tier) => {
      if (!list.length) return null;
      if (t.index != null) return list[t.index] ? { ok: true, el: list[t.index], tier, count: list.length } : { ok: false, error: `index ${t.index} di luar jumlah kandidat (${list.length}).` };
      if (list.length > 1 && !allowMany) return { ok: false, ambiguous: true, tier, error: `Target ambigu: ${list.length} kandidat. Tentukan "index" atau gunakan ref/id.`, candidates: list.slice(0, 10).map(e => ({ ref: e.ref, id: e.node['resource-id'] || undefined, label: e.label, bounds: e.node.bounds })) };
      return { ok: true, el: list[0], tier, count: list.length, all: list };
    };
    if (t.relativeTo) return this._resolveAnchored(t);
    if (t.xy) { const [x, y] = t.xy; return { ok: true, el: { node: { box: { x1: x, y1: y, x2: x, y2: y }, bounds: `[${x},${y}]` }, label: '' }, tier: 'coordinate' }; }
    if (t.ref) {
      const e = E.find(x => x.ref === t.ref);
      return e ? { ok: true, el: e, tier: e.node['resource-id'] ? 'resource-id' : e.label ? 'label' : 'coordinate' } : { ok: false, error: `ref ${t.ref} tidak ada di layar saat ini (stale). Panggil qa_inspect_screen ulang.` };
    }
    if (t.id) {
      const re = t.id.endsWith('*') ? new RegExp('^' + t.id.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : null;
      let list = E.filter(e => re ? re.test(e.node['resource-id'] || '') : e.node['resource-id'] === t.id);
      if (t.contains) list = list.filter(e => norm(e.label).includes(norm(t.contains)) || (e.allLabels || []).some(l => norm(l).includes(norm(t.contains))));
      const nonInter = !list.length ? N.filter(n => re ? re.test(n['resource-id'] || '') : n['resource-id'] === t.id).map(n => ({ node: n, label: effLabel(n, N).label })) : [];
      return pick(list.length ? list : nonInter, 'resource-id') || { ok: false, error: `resource-id "${t.id}" tidak ditemukan.` };
    }
    if (t.idContains) {
      let list = E.filter(e => (e.node['resource-id'] || '').includes(t.idContains));
      if (t.contains) list = list.filter(e => norm(e.label).includes(norm(t.contains)) || (e.allLabels || []).some(l => norm(l).includes(norm(t.contains))));
      return pick(list, 'resource-id') || { ok: false, error: `resource-id mengandung "${t.idContains}" tidak ditemukan.` };
    }
    if (t.type) {
      const list = E.filter(e => isEdit(e.node) && (t.type === 'password' ? e.node.password === 'true' : e.node.password !== 'true'));
      return pick(list, 'label') || { ok: false, error: `Field ${t.type} tidak ditemukan.` };
    }
    const want = norm(t.label ?? t.text ?? t.hint ?? t.contains);
    if (!want) return { ok: false, error: 'Target kosong. Gunakan ref, id, label, contains, type, atau xy.' };
    if (t.label != null || t.text != null || t.hint != null) {
      let exact = E.filter(e => norm(e.label) === want || norm(e.node.hint) === want);
      if (!exact.length) exact = E.filter(e => (e.allLabels || []).some(l => norm(l) === want)); // label anak exact (pola Flutter)
      const r = pick(exact, 'label'); if (r) return r;
    }
    const fuzzy = E.filter(e => norm(e.label).includes(want) || norm(e.node.hint).includes(want));
    const r2 = pick(fuzzy, 'fuzzy'); if (r2) return r2;
    const textNodes = N.filter(n => n.label && norm(n.label).includes(want)).map(n => {
      const parent = E.filter(e => inside(n, e.node)).sort((a, b) => (a.node.box.x2 - a.node.box.x1) * (a.node.box.y2 - a.node.box.y1) - (b.node.box.x2 - b.node.box.x1) * (b.node.box.y2 - b.node.box.y1))[0];
      return parent || { node: n, label: n.label, textOnly: true };
    });
    return pick(textNodes, 'text-node') || { ok: false, error: `Elemen "${want}" tidak ditemukan di layar.` };
  }
  /**
   * Target relatif ke anchor HIGH (resource-id / label exact): elemen interaktif terdekat di sisi `side`
   * (right|left|above|below) yang sejajar dengan anchor. Jika tidak ada elemen dan `offset` (px) diberikan,
   * dipakai titik sintetis anchor-edge + offset. Contoh: tombol kirim tanpa ID di kanan input pesan:
   *   {relativeTo:{id:"app_room_message_input_field"}, side:"right"}
   */
  _resolveAnchored(t) {
    const a = this._resolveOnce({ ...t.relativeTo, relativeTo: undefined }, false);
    if (!a?.ok) return { ok: false, error: `Anchor ${JSON.stringify(t.relativeTo)} tidak ditemukan: ${a?.error || '-'}` };
    if (!HIGH.has(a.tier) || a.el.textOnly) return { ok: false, anchorFound: true, error: `Anchor harus resource-id atau label exact (tier ${a.tier} tidak cukup untuk koordinat ber-anchor).` };
    const A = a.el.node.box; const side = t.side || 'right'; const tol = t.tolerance ?? 24;
    const ok = b => {
      const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
      if (side === 'right') return b.x1 >= A.x2 - 4 && cy >= A.y1 - tol && cy <= A.y2 + tol;
      if (side === 'left') return b.x2 <= A.x1 + 4 && cy >= A.y1 - tol && cy <= A.y2 + tol;
      if (side === 'above') return b.y2 <= A.y1 + 4 && cx >= A.x1 - tol && cx <= A.x2 + tol;
      if (side === 'below') return b.y1 >= A.y2 - 4 && cx >= A.x1 - tol && cx <= A.x2 + tol;
      return false;
    };
    const dist = b => side === 'right' ? b.x1 - A.x2 : side === 'left' ? A.x1 - b.x2 : side === 'above' ? A.y1 - b.y2 : b.y1 - A.y2;
    const cands = this.elements.filter(e => e.node !== a.el.node && e.node.box && !inside(a.el.node, e.node) && !inside(e.node, a.el.node) && ok(e.node.box))
      .sort((x, y) => dist(x.node.box) - dist(y.node.box));
    const anchor = { id: a.el.node['resource-id'] || undefined, label: a.el.label || undefined, bounds: a.el.node.bounds, side };
    const pickI = t.nth ?? 0;
    if (cands[pickI]) return { ok: true, el: cands[pickI], tier: 'anchored', anchor, anchorFound: true, count: cands.length };
    if (t.offset != null) {
      const cx = Math.round((A.x1 + A.x2) / 2), cy = Math.round((A.y1 + A.y2) / 2), o = Number(t.offset);
      const [x, y] = side === 'right' ? [A.x2 + o, cy] : side === 'left' ? [A.x1 - o, cy] : side === 'above' ? [cx, A.y1 - o] : [cx, A.y2 + o];
      return { ok: true, el: { node: { box: { x1: x, y1: y, x2: x, y2: y }, bounds: `[${x},${y}]` }, label: '' }, tier: 'anchored', anchor: { ...anchor, offset: o, synthetic: true }, anchorFound: true };
    }
    return { ok: false, anchorFound: true, error: `Tidak ada elemen interaktif di sisi ${side} anchor ${anchor.id || anchor.label}. Tambahkan offset (px) bila tombol tidak terbaca di UI tree.` };
  }
  confidence(tier) { return HIGH.has(tier) ? 'HIGH' : 'LOW'; }

  async tapNode(el, kind = 'tap') {
    const n = el.node;
    if (kind === 'tap' && n['resource-id'] && n.clickable === 'true') {
      // WebdriverIO v9: hasil $$ punya map/filter async -> iterasi manual dengan index (jangan pakai .map/.filter).
      const els = await this.driver.$$(`//*[@resource-id=${xq(n['resource-id'])} and @clickable="true"]`);
      for (let i = 0; i < els.length; i++) {
        const b = await els[i].getAttribute('bounds').catch(() => null);
        if (b === n.bounds) { await els[i].click(); return; }
      }
    }
    const { x, y } = center(n);
    const cmd = { tap: 'mobile: clickGesture', long_press: 'mobile: longClickGesture', double_tap: 'mobile: doubleClickGesture' }[kind];
    await this.driver.execute(cmd, kind === 'long_press' ? { x, y, duration: 1000 } : { x, y });
  }
  async editElement(el) {
    let n = el.node;
    if (!isEdit(n)) { const inner = this.nodes.find(c => isEdit(c) && inside(c, n)); if (!inner) throw new Error(`Target "${el.label || n['resource-id']}" bukan input field.`); n = inner; }
    const sel = n['resource-id'] ? `//android.widget.EditText[@resource-id=${xq(n['resource-id'])}]` : `//android.widget.EditText[@bounds=${xq(n.bounds)}]`;
    return this.driver.$(sel);
  }
  async swipe(direction = 'up', percent = 0.7, region) {
    const { W, H } = screenSize(this.nodes);
    const r = region?.box ? { left: region.box.x1, top: region.box.y1, width: region.box.x2 - region.box.x1, height: region.box.y2 - region.box.y1 }
      : { left: Math.round(W * 0.1), top: Math.round(H * 0.2), width: Math.round(W * 0.8), height: Math.round(H * 0.6) };
    await this.driver.execute('mobile: swipeGesture', { ...r, direction, percent });
  }
  textPresent(expected) { const w = norm(expected); return this.nodes.some(n => norm(n.label).includes(w)); }

  captureHomeAnchor() {
    const { H } = screenSize(this.nodes); const edits = this.nodes.filter(n => isEdit(n) && n.box);
    // label dari kolom input / pembungkusnya (mis. teks pencarian yang tersisa) bukan penanda layar -> dibuang
    const nearEdit = n => edits.some(e => e === n || inside(n, e) || inside(e, n));
    this.homeAnchor = [...new Set(this.nodes.filter(n => n.label && n.box && n.box.y2 < H * 0.2 && !nearEdit(n)).map(n => n.label))];
    // prefix resource-id layar (mis. "app_home") -> pembeda kuat home vs layar lain yang berbagi label
    this.homeIdPrefix = [...new Set(this.nodes.filter(n => n.box && n.box.y2 < H * 0.35 && n['resource-id']).map(n => n['resource-id'].split('/').pop().split('_')).filter(t => t.length >= 4).map(t => t.slice(0, 3).join('_')))];
    return this.homeAnchor;
  }
  isHome() {
    const ls = new Set(this.nodes.map(n => n.label));
    const labelsOk = this.homeAnchor.length > 0 && this.homeAnchor.filter(l => ls.has(l)).length >= Math.ceil(this.homeAnchor.length / 2);
    if (!labelsOk) return false;
    if (!this.homeIdPrefix?.length) return true;
    return this.nodes.some(n => n['resource-id'] && this.homeIdPrefix.some(p => n['resource-id'].split('/').pop().startsWith(p + '_')));
  }
  async goHome() {
    if (!this.homeAnchor.length) {
      // anchor belum ada -> jangan tekan back (bisa keluar app). Relaunch lalu jadikan layar awal sebagai anchor.
      await this.driver.terminateApp(this.pkg).catch(() => {}); await this.driver.activateApp(this.pkg); await this.settle(15000);
      if (await this.waitTree(15000) && screenType(this.nodes) === 'other') { this.captureHomeAnchor(); return { ok: true, method: 'relaunch+anchor' }; }
      return { ok: false, method: 'relaunch', reason: this.elements.length ? `Layar setelah relaunch bertipe ${screenType(this.nodes)}` : 'UI tree app kosong (overlay/jendela lain aktif?)' };
    }
    for (let i = 0; i < 4; i++) {
      await this.refresh(); if (this.isHome()) return { ok: true, method: i ? `back x${i}` : 'already' };
      const { H } = screenSize(this.nodes); const searchMode = this.nodes.some(n => isEdit(n) && n.box && n.box.y2 < H * 0.2);
      const from = `${screenTitle(this.nodes) || '(tanpa judul)'}${searchMode ? ' [mode pencarian]' : ''}`;
      await this.driver.back(); await this.settle(6000); await this.foregroundGuard(`back dari "${from}"`);
    }
    await this.driver.terminateApp(this.pkg).catch(() => {}); await this.driver.activateApp(this.pkg); await this.settle(15000);
    return { ok: this.isHome(), method: 'relaunch' };
  }

  /** Pre-login (consent/onboarding) + login form. Password tidak pernah dikembalikan. */
  async login({ username, password, att = 'decline' }) {
    const steps = [];
    for (let i = 0; i < 6; i++) {
      await this.refresh(); const type = screenType(this.nodes);
      if (type === 'login') break;
      if (type === 'tracking_consent') {
        const want = att === 'grant' ? /_att_granted_button$/ : /_att_decline_button$/;
        const el = this.elements.find(e => want.test(e.node['resource-id'] || ''));
        if (!el) return { status: 'FAILED', steps, reason: 'Layar izin pelacakan tanpa tombol yang dikenali.' };
        await this.tapNode(el); steps.push(`Izin pelacakan -> "${el.label}"`); await this.settle(8000); continue;
      }
      const skip = this.elements.find(e => /^(lewati|skip|nanti( saja)?|tutup|close|mengerti)$/i.test(e.label));
      if (skip) { await this.tapNode(skip); steps.push(`Onboarding -> "${skip.label}"`); await this.settle(8000); continue; }
      if (!this.homeAnchor.length) this.captureHomeAnchor();
      return { status: 'ALREADY_LOGGED_IN_OR_UNKNOWN', steps, screen: this.summary(15) };
    }
    const userEl = this.elements.find(e => isEdit(e.node) && e.node.password !== 'true');
    const passEl = this.elements.find(e => isEdit(e.node) && e.node.password === 'true');
    if (!userEl || !passEl) return { status: 'FAILED', steps, reason: 'Field username/password tidak lengkap.' };
    const u = await this.editElement(userEl); await u.click(); await u.setValue(username);
    const p = await this.editElement(passEl); await p.click(); await p.setValue(password);
    try { await this.driver.hideKeyboard(); } catch { /* ok */ }
    await sleep(800); await this.refresh();
    const btn = this.elements.filter(e => !isEdit(e.node) && e.node.clickable === 'true' && (/login_button$|sign_?in_button$/.test(e.node['resource-id'] || '') || /^(login|log in|masuk|sign in)$/i.test(e.label)));
    if (btn.length !== 1) return { status: 'FAILED', steps, reason: btn.length ? 'Tombol login ambigu.' : 'Tombol login tidak aktif/tidak ditemukan setelah input.' };
    await this.tapNode(btn[0]); steps.push(`Login -> "${btn[0].label}" (${btn[0].node['resource-id'] || 'label'})`);
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) { await sleep(2000); await this.refresh(); if (screenType(this.nodes) !== 'login') break; }
    if (screenType(this.nodes) === 'login') { const s = this.summary(10); return { status: 'FAILED', steps, reason: `Masih di layar login setelah 30 detik.${s.toasts.length ? ' Toast: ' + s.toasts.join(' | ') : ''} Jika ada OTP, selesaikan manual lalu panggil qa_inspect_screen.` }; }
    await this.settle(15000); await this.foregroundGuard('after_login'); this.captureHomeAnchor();
    return { status: 'PASSED', steps, durationSec: Math.round((Date.now() - t0) / 1000), home: { title: screenTitle(this.nodes), anchor: this.homeAnchor } };
  }
}
