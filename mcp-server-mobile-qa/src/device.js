/**
 * Device layer: adb, APK info, Appium server lifecycle, kontrol device untuk charter exploratory.
 * Semua perintah adb selalu memakai -s <serial>.
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const sh = (cmd, args, timeout = 60000) => execFileSync(cmd, args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).replace(/\r/g, '');
export const which = bin => { try { sh('which', [bin]); return true; } catch { return false; } };
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export class Device {
  constructor(serial) { this.serial = serial; this.restore = []; }
  adb(args, timeout = 120000) { return sh('adb', ['-s', this.serial, ...args], timeout); }
  shell(...args) { return this.adb(['shell', ...args]); }
  prop(k) { try { return this.shell('getprop', k).trim(); } catch { return ''; } }
  info() { return { serial: this.serial, brand: this.prop('ro.product.brand'), model: this.prop('ro.product.model'), release: this.prop('ro.build.version.release'), sdk: Number(this.prop('ro.build.version.sdk')) || null }; }
  installed(pkg) {
    let d = ''; try { d = this.shell('dumpsys', 'package', pkg); } catch { /* none */ }
    const vc = Number((d.match(/versionCode=(\d+)/) || [])[1]) || null;
    return { installed: Boolean(vc), versionCode: vc, versionName: (d.match(/versionName=(\S+)/) || [])[1] || null };
  }
  packages(prefix) { try { return this.shell('pm', 'list', 'packages', prefix).split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean); } catch { return []; } }
  install(apk) { return this.adb(['install', '-r', '-g', apk], 600000); }
  clear(pkg) { return this.shell('pm', 'clear', pkg).trim(); }
  /** Grant semua runtime permission yang diminta app tapi belum granted (generik, dari dumpsys). */
  grantRuntime(pkg) {
    let d = ''; try { d = this.shell('dumpsys', 'package', pkg); } catch { return []; }
    const perms = [...new Set([...d.matchAll(/(android\.permission\.[A-Z_]+): granted=false/g)].map(m => m[1]))];
    const ok = [];
    for (const p of perms) { try { this.shell('pm', 'grant', pkg, p); ok.push(p.replace('android.permission.', '')); } catch { /* not grantable */ } }
    return ok;
  }
  pid(pkg) { try { return this.shell('pidof', pkg).trim(); } catch { return ''; } }
  logcat(pkg, file, lines = 400) {
    const pid = this.pid(pkg); let out = '';
    try { out += pid ? this.adb(['logcat', '-d', '-t', String(lines), `--pid=${pid}`]) : '(proses app tidak berjalan — kemungkinan crash)\n'; } catch (e) { out += `logcat error: ${e.message}\n`; }
    try { out += '\n===== crash buffer =====\n' + this.adb(['logcat', '-d', '-b', 'crash', '-t', '100']); } catch { /* ok */ }
    fs.writeFileSync(file, out); return file;
  }
  push(local, remote) { return this.adb(['push', local, remote], 300000); }

  // ---- kontrol device (charter exploratory); setiap perubahan dicatat untuk di-restore ----
  network(on) {
    if (!on) this.restore.push(['network', true]);
    try { this.shell('cmd', 'connectivity', 'airplane-mode', on ? 'disable' : 'enable'); return `airplane-mode ${on ? 'OFF' : 'ON'}`; }
    catch { this.shell('svc', 'wifi', on ? 'enable' : 'disable'); this.shell('svc', 'data', on ? 'enable' : 'disable'); return `wifi+data ${on ? 'ON' : 'OFF'}`; }
  }
  fontScale(v) {
    const cur = this.shell('settings', 'get', 'system', 'font_scale').trim() || '1.0';
    if (!this.restore.some(r => r[0] === 'font')) this.restore.push(['font', cur]);
    this.shell('settings', 'put', 'system', 'font_scale', String(v)); return `font_scale ${cur} -> ${v}`;
  }
  darkMode(on) {
    const cur = (this.shell('cmd', 'uimode', 'night').match(/Night mode: (\w+)/) || [])[1] || 'no';
    if (!this.restore.some(r => r[0] === 'dark')) this.restore.push(['dark', cur]);
    this.shell('cmd', 'uimode', 'night', on ? 'yes' : 'no'); return `night mode ${cur} -> ${on ? 'yes' : 'no'}`;
  }
  /** Matikan pop-up notifikasi melayang (heads-up) + DND agar notifikasi app lain tidak menutupi/mengambil alih jendela aktif. */
  quietNotifications() {
    const done = [];
    try {
      const cur = this.shell('settings', 'get', 'global', 'heads_up_notifications_enabled').trim();
      if (!this.restore.some(r => r[0] === 'headsup')) this.restore.push(['headsup', cur === 'null' ? '1' : cur]);
      this.shell('settings', 'put', 'global', 'heads_up_notifications_enabled', '0'); done.push('heads-up OFF');
    } catch (e) { done.push(`heads-up gagal: ${e.message.split('\n')[0]}`); }
    try {
      const zen = this.shell('settings', 'get', 'global', 'zen_mode').trim();
      if (!this.restore.some(r => r[0] === 'dnd')) this.restore.push(['dnd', zen]);
      this.shell('cmd', 'notification', 'set_dnd', 'priority'); done.push('DND ON');
    } catch (e) { done.push(`DND gagal: ${e.message.split('\n')[0]}`); }
    return done;
  }
  restoreAll() {
    const done = [];
    for (const [k, v, extra] of this.restore.reverse()) {
      try {
        if (k === 'network') { this.network(true); done.push('network ON'); }
        if (k === 'font') { this.shell('settings', 'put', 'system', 'font_scale', v); done.push(`font_scale ${v}`); }
        if (k === 'dark') { this.shell('cmd', 'uimode', 'night', v); done.push(`night ${v}`); }
        if (k === 'perm') { try { this.shell('pm', 'grant', extra, v); done.push(`grant ${v.replace('android.permission.', '')}`); } catch { /* ok */ } }
        if (k === 'headsup') { this.shell('settings', 'put', 'global', 'heads_up_notifications_enabled', v); done.push(`heads-up ${v}`); }
        if (k === 'dnd') { this.shell('cmd', 'notification', 'set_dnd', v === '0' ? 'off' : 'priority'); done.push(`DND ${v === '0' ? 'off' : 'on'}`); }
      } catch (e) { done.push(`gagal restore ${k}: ${e.message}`); }
    }
    this.restore = []; return done;
  }
}

export function listDevices() {
  if (!which('adb')) return { adb: false, devices: [] };
  const lines = sh('adb', ['devices', '-l']).split('\n').slice(1).filter(l => l.trim());
  const devices = lines.map(l => {
    const [serial, state, ...rest] = l.trim().split(/\s+/);
    const kv = Object.fromEntries(rest.filter(x => x.includes(':')).map(x => x.split(':')));
    const d = { serial, state, model: kv.model, product: kv.product, usb: Boolean(kv.usb), emulator: /^emulator-|^127\.0\.0\.1:/.test(serial) };
    if (state === 'device') Object.assign(d, new Device(serial).info());
    return d;
  });
  return { adb: true, devices };
}

function findAapt2() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT; if (!sdk) return null;
  const bt = path.join(sdk, 'build-tools'); if (!fs.existsSync(bt)) return null;
  for (const v of fs.readdirSync(bt).sort().reverse()) { const p = path.join(bt, v, 'aapt2'); if (fs.existsSync(p)) return p; }
  return null;
}
export function apkInfo(apk) {
  const info = { file: path.basename(apk), path: apk, package: null, versionCode: null, versionName: null, framework: 'unknown' };
  const a2 = findAapt2();
  if (a2) {
    try {
      const m = sh(a2, ['dump', 'badging', apk]).match(/package: name='([^']+)' versionCode='(\d+)' versionName='([^']*)'/);
      if (m) Object.assign(info, { package: m[1], versionCode: Number(m[2]), versionName: m[3] });
    } catch { /* ignore */ }
  }
  try {
    const l = sh('unzip', ['-l', apk], 120000);
    info.framework = /lib\/[^/]+\/libflutter\.so/.test(l) ? 'flutter' : /index\.android\.bundle|libreactnativejni\.so|libhermes\.so/.test(l) ? 'react-native' : 'native';
  } catch { /* ignore */ }
  return info;
}

export async function appiumUp(url) { try { return (await fetch(new URL('/status', url))).ok; } catch { return false; } }
export async function ensureAppium(url) {
  if (await appiumUp(url)) return { proc: null, started: false };
  if (!which('appium')) throw new Error('Appium tidak ditemukan dan server belum berjalan. Jalankan mobile-execution/probe/install_mac.sh');
  const u = new URL(url);
  const proc = spawn('appium', ['--address', u.hostname, '--port', u.port || '4733', '--log-level', 'error'], { stdio: 'ignore', env: { ...process.env } });
  for (let i = 0; i < 40; i++) { if (await appiumUp(url)) return { proc, started: true }; await sleep(1000); }
  proc.kill(); throw new Error('Appium server gagal start dalam 40 detik.');
}
