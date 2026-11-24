#!/usr/bin/env node
/**
 * Mobile Plan Runner — fallback engine skill mobile-qa-execution.
 * Mengeksekusi rencana (JSON) hasil terjemahan test case oleh agent, lewat MCP mobile-qa-guard (protokol MCP sungguhan),
 * menghitung status per TC sesuai SOP, mengarsipkan evidence, dan menyusun laporan DOCX.
 *
 *   node runner/run_plan.mjs <plan.json>
 *
 * Step plan:
 *  {do:"tap"|"type"|"back"|"press_key"|"double_tap"|"scroll"|"wait"|..., target, value, isMutation, desc}
 *  {assert:"visible"|"contains_text"|..., target, expected, timeoutMs, soft, desc}
 *  {anyOf:[<assert>...], soft, desc}           -> lolos jika salah satu PASS
 *  {device:"rotate_landscape"|..., value, desc}
 *  {home:true} | {capture:"nama"} | {remember:{id, as, pattern}}
 *  target tambahan: {position:"app-bar-kanan", nth:-1} -> di-resolve lewat qa_inspect_screen; "${var}" dalam expected/value diganti dari remember.
 *  target {near:"teks", pick:"above"|"self", scrollDir:"down"} -> elemen tepat di atas teks (mis. media di atas caption bubble); scroll bila belum terlihat.
 *  {ifVisible:<target>, then:[...], else:[...]} -> percabangan sederhana (mis. mode pencarian sudah aktif).
 *  settleMs di step aksi -> batas tunggu UI stabil (kecilkan saat video diputar agar screenshot tepat waktu).
 *  {manual:"instruksi"} -> runner berhenti, QA melakukan aksi fisik (mis. memiringkan HP), tekan Enter untuk lanjut.
 *  {do, targets, manualFallback:"instruksi"} -> bila semua target gagal, minta QA melakukan aksi manual lalu coba sekali lagi/diterima.
 *  plan.setup[] (inline:true + {setupRef:id} di testcases untuk menjalankan di tengah urutan TC) -> kasus persiapan data (tidak dihitung di ringkasan); field provides/requires untuk men-skip TC bila data gagal dibuat.
 *  CLI: --udid --apk --install-policy --skip-setup --skip-teardown --tag <TAG> (variabel ${TAG} untuk penanda caption/nama data).
 *  plan.mutationMode: "safe" | "full" | "full_external" (legacy plan.allowMutation:true = "full"). TAG data uji diambil dari MCP
 *  (QA_DATA_TAG_PREFIX-yymmddHHMM) kecuali --tag diberikan. Step boleh memberi mutationType (create|update|delete|state_change|external|financial|session_end|navigation).
 *  target {relativeTo:{id|label}, side:"right"|"left"|"above"|"below", offset?} -> koordinat ber-anchor (boleh untuk mutasi di mode full, evidence sebelum/sesudah otomatis).
 *  plan.teardown[] -> kasus pembersihan data ber-TAG, dijalankan di akhir (juga saat run error) bila mode bukan safe; tidak dihitung di ringkasan.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(here, '../..');
const planPath = process.argv[2]; if (!planPath) { console.log('Usage: node runner/run_plan.mjs <plan.json>'); process.exit(1); }
const plan = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), planPath), 'utf8'));
// Pondasi: plan di work/<ALIAS>/<fitur>/plans/ -> semua evidence & laporan ke fitur itu (MCP ikut lewat QA_WORK_FEATURE).
const QA = createRequire(import.meta.url)(path.join(path.dirname(fileURLToPath(import.meta.url)), '../..', 'scripts', 'lib', 'qa-env.cjs'));
const PLAN_ABS = path.resolve(process.cwd(), planPath);
const PLAN_FEATURE = QA.featureFromPath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), PLAN_ABS);
if (PLAN_FEATURE && !process.env.QA_WORK_FEATURE) process.env.QA_WORK_FEATURE = PLAN_FEATURE;
const client = new Client({ name: 'mobile-plan-runner', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: 'node', args: [path.join(here, '../src/index.js')], env: { ...process.env } }));
const call = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); return JSON.parse(r.content[0].text); };
const cliArg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const vars = { TAG: cliArg('tag') || new Date().toTimeString().slice(0, 5).replace(':', '') }; const sub = v => typeof v === 'string' ? v.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '') : v;
const log = (...a) => console.log(...a);

const box = b => { const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(b || ''); return m ? { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] } : null; };
const area = b => (b.x2 - b.x1) * (b.y2 - b.y1);
async function resolveNear(t) {
  const key = sub(t.near).toLowerCase();
  for (let i = 0; i <= (t.scrollTries ?? 4); i++) {
    const scr = await call('qa_inspect_screen', { maxElements: 200 });
    const els = scr.elements.map(e => ({ ...e, b: box(e.bounds) })).filter(e => e.b);
    const cap = els.filter(e => (e.label || '').toLowerCase().includes(key)).sort((a, b) => area(a.b) - area(b.b))[0];
    if (cap) {
      if (t.pick === 'self') return { ref: cap.ref, _near: `self "${cap.label}"` };
      const W = Math.max(...els.map(e => e.b.x2)), Hs = Math.max(...els.map(e => e.b.y2));
      const above = els.filter(e => e !== cap && e.b.y2 <= cap.b.y1 + 20 && cap.b.y1 - e.b.y2 < 250 && e.b.x1 < cap.b.x2 && e.b.x2 > cap.b.x1 && area(e.b) < 0.6 * W * Hs)
        .sort((a, b) => b.b.y2 - a.b.y2)[0];
      return above ? { ref: above.ref, _near: `di atas "${cap.label}" ${above.bounds}` } : { ref: cap.ref, _near: `self "${cap.label}" (tidak ada elemen di atasnya)` };
    }
    if (i < (t.scrollTries ?? 4)) await call('qa_execute_action', { action: 'scroll', direction: t.scrollDir || 'down', percent: 0.5 });
  }
  throw new Error(`Teks "${sub(t.near)}" tidak ditemukan setelah scroll`);
}
async function askManual(text) {
  if (!process.stdin.isTTY) return { ok: false, detail: `butuh aksi manual QA (jalankan runner di terminal interaktif): ${text}` };
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write('\x07');
  const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 300000);
  try { await rl.question(`\n  >>> AKSI MANUAL QA: ${text}\n  >>> Tekan Enter jika sudah... `, { signal: ac.signal }); return { ok: true, manual: true, detail: `manual QA: ${text}` }; }
  catch { return { ok: false, detail: `manual QA tidak dikonfirmasi dalam 5 menit: ${text}` }; }
  finally { clearTimeout(tm); rl.close(); }
}
async function resolveTarget(t) {
  if (t && t.near) return resolveNear(t);
  if (!t || !t.position) return t && JSON.parse(sub(JSON.stringify(t)));
  const scr = await call('qa_inspect_screen', { maxElements: 80 });
  const list = scr.elements.filter(e => e.position === t.position);
  const e = list.at(t.nth ?? 0); if (!e) throw new Error(`Elemen posisi ${t.position}[${t.nth ?? 0}] tidak ditemukan`);
  return { ref: e.ref };
}
async function runAssert(s) {
  const r = await call('qa_assert_element', { assertion: s.assert, target: await resolveTarget(s.target), expected: sub(s.expected), timeoutMs: s.timeoutMs || 6000 });
  return { ok: r.result === 'PASS', conf: r.confidence, detail: `${s.assert}${s.expected ? ` "${sub(s.expected)}"` : ''}${s.target ? ' ' + JSON.stringify(s.target) : ''} -> ${r.result} (${r.actual})` };
}
async function runStep(s, tcId, idx) {
  if (s.home) { const r = await call('qa_navigate_home'); return { ok: r.ok, detail: `home (${r.method})` }; }
  if (s.capture) { const r = await call('qa_capture_evidence', { tcId, step: s.capture, status: 'INFO' }); return { ok: true, detail: `capture ${r.screenshot}`, file: r.screenshot }; }
  if (s.remember) {
    const scr = await call('qa_inspect_screen', { maxElements: 80 }); const e = scr.elements.find(x => x.id === s.remember.id);
    if (!e) return { ok: false, detail: `remember: id ${s.remember.id} tidak ada` };
    const m = s.remember.pattern ? new RegExp(s.remember.pattern).exec(e.label || '') : null;
    vars[s.remember.as] = (m ? m[1] : e.label || '').trim(); return { ok: true, detail: `${s.remember.as} = "${vars[s.remember.as]}"` };
  }
  if (s.manual) return askManual(sub(s.manual));
  if (s.ifVisible) {
    // percabangan sederhana: jalankan then[] bila target terlihat, else[] bila tidak
    const v = await runAssert({ assert: 'visible', target: s.ifVisible, timeoutMs: s.timeoutMs || 1500 });
    const branch = v.ok ? (s.then || []) : (s.else || []); const det = [`ifVisible ${JSON.stringify(s.ifVisible)} -> ${v.ok ? 'then' : 'else'}`];
    for (const [k, b] of branch.entries()) { const r = await runStep(b, tcId, `${idx}.${k + 1}`); det.push(`${b.desc || ''} ${r.detail}`); if (!r.ok && !b.soft) return { ok: false, detail: det.join(' | ') }; }
    return { ok: true, conf: v.ok ? 'HIGH' : undefined, detail: det.join(' | ') };
  }
  if (s.device) { const r = await call('qa_device_control', { action: s.device, value: s.value }); return { ok: r.status === 'DONE', detail: `${s.device}: ${r.note || r.error}${r.guard ? ' | ' + r.guard : ''}`, guard: r.guard }; }
  if (s.assert) return runAssert(s);
  if (s.anyOf) {
    const det = [];
    for (const a of s.anyOf) { const r = await runAssert({ ...a, timeoutMs: a.timeoutMs || 3000 }); det.push(r.detail); if (r.ok) return { ok: true, conf: r.conf, detail: `anyOf -> ${r.detail}` }; }
    return { ok: false, detail: `anyOf gagal: ${det.join(' || ')}` };
  }
  if (s.ensureApp) {
    // tutup picker/app sistem bila masih terbuka (mis. setelah background), tanpa menekan back bila sudah di app
    const scr = await call('qa_inspect_screen', { maxElements: 5 });
    if (scr.foreground && scr.foreground !== out.init?.app?.package) {
      const r = await call('qa_execute_action', { action: 'back', tcId, step: `s${idx}` });
      return { ok: r.status === 'DONE', detail: `foreground ${scr.foreground} -> back (${r.status})`, toasts: r.seenToasts };
    }
    return { ok: true, detail: 'sudah di app, tidak perlu back' };
  }
  if (s.inspect) {
    const scr = await call('qa_inspect_screen', { maxElements: 80 });
    const f = path.join(runDirGlobal || ROOT, `${tcId}_${s.inspect}_inspect.json`); fs.writeFileSync(f, JSON.stringify(scr, null, 2));
    return { ok: true, detail: `inspect "${scr.title}" ${scr.interactive} elemen -> ${path.basename(f)}` };
  }
  if (s.do && s.targets) {
    // coba beberapa target berurutan (UI sistem/picker berbeda antar device); berhenti di yang pertama DONE
    const tried = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const t of s.targets) {
        let tgt; try { tgt = await resolveTarget(t); } catch (e) { tried.push(`${JSON.stringify(t)}: ${e.message}`); continue; }
        const near = tgt._near; delete tgt._near;
        const r = await call('qa_execute_action', { action: s.do, target: { ...tgt, scroll: false }, value: sub(s.value), isMutation: s.isMutation, mutationType: s.mutationType, settleMs: s.settleMs, tcId, step: `s${idx}` });
        if (/PARTIAL/.test(r.status || '')) { if (s.manualFallback) break; return { ok: true, partial: r.reason, detail: `${s.do} -> ${r.status}: ${r.reason}` }; }
        if (r.status === 'DONE') return { ok: true, conf: r.confidence, toasts: r.seenToasts, detail: `${s.do} ${sub(JSON.stringify(t))}${near ? ` (${near})` : ''} -> DONE [${r.tier}/${r.confidence}] fg=${r.foreground}${r.seenToasts?.length ? ' toast=' + r.seenToasts.join('|') : ''}` };
        tried.push(`${JSON.stringify(t)}: ${r.error || r.status}`);
      }
      if (!s.manualFallback || attempt) break;
      const m = await askManual(sub(s.manualFallback)); if (!m.ok) return m;
      if (s.manualCompletes) return { ok: true, manual: true, detail: `target otomatis tidak tersedia -> ${m.detail}` };
    }
    return { ok: false, detail: `semua target gagal: ${tried.join(' || ')}` };
  }
  if (s.do) {
    const tgt0 = await resolveTarget(s.target); if (tgt0) delete tgt0._near;
    const r = await call('qa_execute_action', { action: s.do, target: tgt0, value: sub(s.value), direction: s.direction, isMutation: s.isMutation, mutationType: s.mutationType, settleMs: s.settleMs, tcId, step: `s${idx}` });
    if (/PARTIAL/.test(r.status || '')) return { ok: true, partial: r.reason, detail: `${s.do} -> ${r.status}: ${r.reason}` };
    return { ok: r.status === 'DONE', conf: r.confidence, guard: r.guard, toasts: r.seenToasts, detail: `${s.do} ${s.target ? JSON.stringify(s.target) : s.value || ''} -> ${r.status}${r.tier ? ` [${r.tier}/${r.confidence}]` : ''}${r.foreground && r.foreground !== out.init?.app?.package ? ` fg=${r.foreground}` : ''}${r.seenToasts?.length ? ' toast=' + r.seenToasts.join('|') : ''}${r.error ? ' ' + r.error : ''}${r.guard ? ' | ' + r.guard : ''}` };
  }
  return { ok: false, detail: 'step tidak dikenal' };
}
async function runCase(tc, kind) {
  const res = { id: tc.id, title: tc.title, steps: [], status: null, notes: [] };
  if (tc.skip) { res.status = 'SKIP WITH REASON'; res.notes.push(tc.skip); log(`\n### ${tc.id} — SKIP: ${tc.skip}`); return res; }
  const missing = (tc.requires || []).filter(k => !provided.has(k));
  if (missing.length) { res.status = 'SKIP WITH REASON'; res.notes.push(`Data uji belum tersedia (setup gagal): ${missing.join(', ')}`); log(`\n### ${tc.id} — SKIP: data ${missing.join(', ')} tidak tersedia`); return res; }
  log(`\n### ${tc.id} — ${tc.title}`);
  if (tc.record) await call('qa_screen_recording', { action: 'start', tcId: tc.id });
  let failed = false, partial = [], low = false, softFail = [], guards = []; const setupLow = []; let lastSetupLowIdx = -1, verifiedAfterSetup = false;
  for (const [i, s] of (tc.steps || []).entries()) {
    let r; try { r = await runStep(s, tc.id, i + 1); } catch (e) { r = { ok: false, detail: `ERROR ${e.message}` }; }
    if (s.expectNoGuard && r.guard) { r.ok = false; r.detail += ' [EXPECTATION: aksi ini tidak boleh membuat app keluar]'; }
    const mark = r.ok ? (r.partial ? 'PART' : 'ok  ') : (s.soft ? 'SOFT' : 'FAIL');
    log(`  ${mark} ${s.desc || ''} :: ${r.detail}`); res.steps.push({ desc: s.desc, ...r, soft: s.soft });
    if (r.guard) guards.push(r.guard);
    if (r.partial) partial.push(r.partial);
    if (r.conf === 'LOW') { if (s.setup) { setupLow.push(s.desc || r.detail); lastSetupLowIdx = i; verifiedAfterSetup = false; } else low = true; }
    if (s.assert && r.ok && r.conf === 'HIGH' && lastSetupLowIdx >= 0 && i > lastSetupLowIdx) verifiedAfterSetup = true;
    if (!r.ok && s.soft) { softFail.push(s.desc || r.detail); low = true; }
    if (!r.ok && !s.soft) { failed = true; if (!s.continueOnFail) break; }
  }
  if (setupLow.length && !verifiedAfterSetup) low = true; // navigasi LOW tanpa bukti HIGH -> tetap LOW
  const ev = await call('qa_capture_evidence', { tcId: tc.id, step: 'final', status: failed ? 'FAILED' : 'END' });
  res.evidence = [ev.screenshot, ev.logcat].filter(Boolean);
  if (tc.record) { const v = await call('qa_screen_recording', { action: 'stop' }); if (v.video) res.evidence.push(v.video); }
  if (kind === 'setup') res.status = failed ? 'SETUP GAGAL' : 'SETUP OK';
  else if (kind === 'charter') res.status = failed ? 'FAIL' : (low || softFail.length || guards.length) ? 'OBSERVATION' : 'PASS';
  else res.status = failed ? 'FAILED' : partial.length ? 'PARTIAL TEST WITH REASON' : (tc.layers?.network || tc.layers?.db) ? 'PARTIAL TEST WITH REASON' : low ? 'PASSED (LOW CONFIDENCE)' : 'PASSED';
  if (tc.visualReview && res.status === 'PASSED') res.status = 'PASSED (LOW CONFIDENCE)';
  if (tc.visualReview) res.notes.push(`Butuh review visual screenshot/rekaman: ${tc.visualReview}`);
  if (failed) res.notes.push('Gagal: ' + res.steps.filter(x => !x.ok && !x.soft).map(x => x.desc || x.detail).join('; '));
  if (partial.length) res.notes.push('Partial: ' + partial.join('; '));
  if (tc.layers?.network || tc.layers?.db) res.notes.push('Layer Network/DB tidak divalidasi.');
  if (setupLow.length) res.notes.push(`LOW pada langkah persiapan: ${setupLow.join('; ')} — ${verifiedAfterSetup ? 'hasilnya terverifikasi assertion HIGH (tidak menurunkan status)' : 'TIDAK terverifikasi assertion HIGH'}`);
  const lowSteps = res.steps.filter((x, k) => x.conf === 'LOW' && !(tc.steps[k] || {}).setup).map(x => x.desc).filter(Boolean);
  if (lowSteps.length) res.notes.push('LOW CONFIDENCE: ' + lowSteps.join('; '));
  if (softFail.length) res.notes.push('Perlu verifikasi visual: ' + softFail.join('; '));
  if (guards.length) res.notes.push('Guard: ' + guards.join(' | '));
  log(`  => ${res.status}`);
  return res;
}

const provided = new Set();
const out = { setup: [], teardown: [], policy: null, plan: planPath, startedAt: new Date().toISOString(), init: null, login: null, testcases: [], charters: [] };
let runDir = null; let runDirGlobal = null;
try {
  const cli = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  out.tag = vars.TAG;
  out.init = await call('qa_init_app', { featureName: plan.feature, udid: cli('udid') || plan.udid, apkFile: cli('apk') || plan.apkFile, installPolicy: cli('install-policy') || plan.installPolicy || 'use_installed' });
  if (out.init.status === 'NEEDS_DECISION') throw new Error(`Butuh keputusan (${out.init.gate}): ${out.init.question} Opsi: ${JSON.stringify(out.init.options)}. Ulangi dengan --apk <file> / --install-policy <install|use_installed>.`);
  if (out.init.status === 'READY_WITH_WARNING') { runDir = path.join(ROOT, out.init.runDir); throw new Error('UI tree app kosong saat start: ' + (out.init.notes || []).join(' | ')); }
  if (out.init.status !== 'READY') throw new Error('init: ' + JSON.stringify(out.init).slice(0, 400));
  log('NOTES ' + (out.init.notes || []).join(' | '));
  if (plan.requireNewerThan && !(out.init.app.versionCode > plan.requireNewerThan)) throw new Error(`Build terpasang ${out.init.app.versionName} (${out.init.app.versionCode}) belum berisi perbaikan (butuh versionCode > ${plan.requireNewerThan}). Taruh APK berisi fix di mobile-execution/build-apk/.`);
  runDir = path.join(ROOT, out.init.runDir); runDirGlobal = runDir; log(`READY ${out.init.app.package} ${out.init.app.versionName} | run: ${out.init.runDir}`);
  out.policy = await call('qa_set_mutation_permission', { mode: plan.mutationMode || (plan.allowMutation ? 'full' : 'safe'), dataTag: cliArg('tag') || plan.dataTag });
  if (out.policy.status === 'ERROR') throw new Error('mutation policy: ' + out.policy.error);
  if (!cliArg('tag') && out.policy.dataTag) vars.TAG = out.policy.dataTag; out.tag = vars.TAG;
  log(`MUTATION MODE ${out.policy.mode} | TAG ${vars.TAG} | ${out.policy.notice}`);
  for (const f of plan.supportFiles || []) { const r = await call('qa_push_support_file', { fileName: f }); log(`PUSH ${f}: ${r.status || r.error}`); }
  out.login = await call('qa_login_role', { role: plan.role, suffix: plan.suffix });
  log(`LOGIN ${out.login.status} (${out.login.credentialKey})`);
  if (!['PASSED', 'ALREADY_LOGGED_IN_OR_UNKNOWN'].includes(out.login.status)) throw new Error('login gagal: ' + (out.login.reason || out.login.error));
  const pre = await call('qa_navigate_home');
  if (!pre.ok) throw new Error(`Pre-flight home gagal (${pre.method}): ${pre.reason || 'layar home tidak dikenali'} — run dihentikan agar tidak menghasilkan FAILED palsu.`);
  log(`HOME OK (${pre.method}) "${pre.screen?.title}"`);
  if (process.argv.includes('--skip-setup')) { for (const c of plan.setup || []) if (c.provides) provided.add(c.provides); log(`SETUP dilewati (--skip-setup), TAG=${vars.TAG}`); }
  else for (const c of (plan.setup || []).filter(x => !x.inline)) { const r = await runCase(c, 'setup'); out.setup.push(r); if (r.status === 'SETUP OK' && c.provides) provided.add(c.provides); if (c.after) for (const s of c.after) await runStep(s, c.id, 0).catch(() => {}); }
  log(`\nTAG data uji: ${vars.TAG} (pakai --skip-setup --tag ${vars.TAG} untuk menjalankan ulang TC tanpa merekam/mengirim ulang)`);
  const runSetup = async (c) => {
    for (let a = 0; a <= (c.retries || 0); a++) {
      const r = await runCase(a ? { ...c, id: `${c.id}#${a + 1}` } : c, 'setup'); out.setup.push(r);
      if (r.status === 'SETUP OK') { if (c.provides) provided.add(c.provides); return; }
      if (a < (c.retries || 0)) log(`  ↻ ${c.id} gagal — diulang (percobaan ${a + 2})`);
    }
  };
  for (const tc of plan.testcases) { if (tc.setupRef) { const c = (plan.setup || []).find(x => x.id === tc.setupRef); if (c && !process.argv.includes('--skip-setup')) await runSetup(c); continue; } if (tc.charterSlot) { for (const c of plan.charters || []) out.charters.push(await runCase(c, 'charter')); await call('qa_device_control', { action: 'restore' }); continue; } out.testcases.push(await runCase(tc, 'tc')); }
} catch (e) { out.error = e.message; log('ERROR', e.message); }
finally {
  if (out.init?.status === 'READY' && (plan.teardown || []).length && out.policy && out.policy.mode !== 'safe' && !process.argv.includes('--skip-teardown')) {
    log(`\n--- TEARDOWN data ber-TAG ${vars.TAG} ---`);
    try { await call('qa_navigate_home'); } catch { /* ok */ }
    for (const c of plan.teardown) { try { out.teardown.push(await runCase(c, 'setup')); } catch (e) { out.teardown.push({ id: c.id, status: 'SETUP GAGAL', notes: [e.message] }); } }
  }
  out.close = await call('qa_close_app', { keepAppRunning: true }).catch(e => ({ error: e.message }));
  await client.close();
}
// ---- laporan ----
const cnt = st => out.testcases.filter(t => t.status.startsWith(st)).length;
const total = out.testcases.length, passed = cnt('PASSED'), failedN = cnt('FAILED'), partialN = cnt('PARTIAL'), skipped = cnt('SKIP');
const lowN = out.testcases.filter(t => t.status === 'PASSED (LOW CONFIDENCE)').length;
const verdict = (out.error || !total) ? 'NO-GO' : failedN ? 'NO-GO' : (partialN || lowN || out.charters.some(c => c.status !== 'PASS')) ? 'CONDITIONAL GO' : 'GO';
const app = out.init?.app || {}; const dev = out.init?.device || {};
const report = {
  feature_name: plan.featureTitle || plan.feature, environment: 'Staging Android',
  base_url: `${app.package} v${app.versionName} (${app.versionCode}) • ${dev.brand} ${dev.model} Android ${dev.release}`,
  timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB', testcase_file: plan.testcaseFile,
  evidence_dir: out.init?.runDir || '-', qa_lead: 'Senior QA Engineer (Mobile QA Guard / Appium)',
  summary: { total, passed, failed: failedN, partial: partialN, skipped, exploratory: out.charters.length },
  release_recommendation: verdict,
  recommendation_reason: `${passed} passed (${lowN} LOW CONFIDENCE), ${failedN} failed, ${partialN} partial, ${skipped} skip. Mode mutasi: ${out.policy?.mode || (plan.allowMutation ? 'full' : 'safe')} (TAG ${vars.TAG}; dijalankan ${out.close?.mutationLedger?.executed ?? 0}, diblokir ${out.close?.mutationLedger?.blocked ?? 0}).${out.teardown.length ? ` Teardown: ${out.teardown.map(c => `${c.id}=${c.status}`).join(', ')}.` : (out.close?.mutationLedger?.created?.length ? ` ${out.close.mutationLedger.teardownHint}` : '')} Charter: ${out.charters.map(c => `${c.id}=${c.status}`).join(', ')}.${out.setup.length ? ` Data setup: ${out.setup.map(c => `${c.id}=${c.status}`).join(', ')} (TAG ${vars.TAG}).` : ''}${out.error ? ' Run terhenti: ' + out.error : ''}`,
  roles: { [`${plan.role} (${out.login?.credentialKey || plan.suffix})`]: out.testcases.map(t => ({ id: t.id, title: t.title, action: t.steps.filter(s => s.desc).map(s => s.desc).join(' > ').slice(0, 300), status: t.status, notes: t.notes.join(' | ') || '-' })) },
  exploratory_scenarios: out.charters.map(c => ({ charter: c.title, action: c.steps.filter(s => s.desc).map(s => s.desc).join(' > ').slice(0, 250), observed: c.notes.join(' | ') || c.steps.map(s => s.detail).join(' | ').slice(0, 300), verdict: c.status })),
  evidence_files: [...out.testcases, ...out.charters].flatMap(t => (t.evidence || []).map(f => ({ filename: path.basename(f), scenario: t.id, timestamp: '-' }))),
};
const LOC = QA.resolveRunLocation(ROOT, plan.feature, path.join(ROOT, 'mobile-execution', 'automate-result'), PLAN_ABS);
const dir = runDir || (() => { const d = path.join(LOC.runsDir, `run_${plan.feature}_INCOMPLETE_${Date.now()}`); fs.mkdirSync(d, { recursive: true }); return d; })();
fs.writeFileSync(path.join(dir, 'run_results.json'), JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(dir, 'report_data.json'), JSON.stringify(report, null, 2));
const ts = path.basename(dir).match(/\d{8}_\d{6}$/)?.[0] || Date.now();
fs.mkdirSync(LOC.reportsDir, { recursive: true });
const docx = path.join(LOC.reportsDir, `Report_${plan.feature}_${ts}.docx`);
try { execFileSync('python3', [path.join(ROOT, '.agents/skills/browser-qa-execution/scripts/generate_docx_report.py'), path.join(dir, 'report_data.json'), docx], { stdio: 'ignore' }); log(`\nLaporan: ${path.relative(ROOT, docx)}`); }
catch { log('\nDOCX belum dibuat (python-docx tidak tersedia?). report_data.json tersimpan; laporan bisa dibuat ulang.'); }
// ---- perbarui UI knowledge per app (hanya package app yang diuji; picker OS ke _system/) ----
if (runDir && out.init?.app?.package) {
  try {
    execFileSync('python3', [path.join(ROOT, '.agents/skills/mobile-qa-execution/scripts/update_ui_knowledge.py'), '--run', runDir, '--package', out.init.app.package], { stdio: 'ignore' });
    log(`Knowledge UI diperbarui: profiles/<profil aktif>/knowledge/mobile/${out.init.app.package}/ui-knowledge.md`);
  } catch { log('Knowledge UI belum diperbarui (jalankan manual update_ui_knowledge.py --run <folder run>).'); }
}
log(`\n================ ${out.error ? 'RUN TIDAK SELESAI — ' : ''}${verdict} | ${passed}/${total} passed (${lowN} LOW), ${failedN} failed, ${partialN} partial, ${skipped} skip ================`);
log(`Evidence & hasil: ${path.relative(ROOT, dir)}`);
process.exit(0);
