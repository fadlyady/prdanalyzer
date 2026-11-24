/**
 * Environment bootstrap — MCP server dijalankan oleh IDE (app GUI macOS) yang TIDAK membaca ~/.zshrc,
 * sehingga ANDROID_HOME / JAVA_HOME / PATH (adb, appium) sering kosong. Modul ini mendeteksi lokasi umum
 * dan mengisi process.env sebelum modul lain dipakai. Tidak menimpa nilai yang sudah ada.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const home = os.homedir();
const exists = p => { try { return Boolean(p) && fs.existsSync(p); } catch { return false; } };
const report = { set: [], pathAdded: [] };

const sdkCandidates = [
  process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
  '/opt/homebrew/share/android-commandlinetools', '/usr/local/share/android-commandlinetools',
  path.join(home, 'Library/Android/sdk'), path.join(home, 'Android/Sdk'), '/opt/android-sdk',
];
const sdk = sdkCandidates.find(p => exists(p) && exists(path.join(p, 'platform-tools')));
if (sdk) {
  if (!process.env.ANDROID_HOME) { process.env.ANDROID_HOME = sdk; report.set.push('ANDROID_HOME'); }
  if (!process.env.ANDROID_SDK_ROOT) { process.env.ANDROID_SDK_ROOT = sdk; report.set.push('ANDROID_SDK_ROOT'); }
}
if (!process.env.JAVA_HOME) {
  let jh = null;
  try { if (exists('/usr/libexec/java_home')) jh = execFileSync('/usr/libexec/java_home', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* none */ }
  if (!jh) jh = ['/opt/homebrew/opt/openjdk', '/usr/lib/jvm/default-java'].find(exists) || null;
  if (jh) { process.env.JAVA_HOME = jh; report.set.push('JAVA_HOME'); }
}
const pathDirs = [
  sdk && path.join(sdk, 'platform-tools'), process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, 'bin'),
  path.join(home, '.npm-global/bin'), '/opt/homebrew/bin', '/usr/local/bin', path.dirname(process.execPath),
].filter(exists);
const cur = (process.env.PATH || '').split(path.delimiter);
for (const d of pathDirs.reverse()) if (!cur.includes(d)) { cur.unshift(d); report.pathAdded.push(d); }
process.env.PATH = cur.join(path.delimiter);

export const ENV_BOOTSTRAP = { ...report, ANDROID_HOME: process.env.ANDROID_HOME || null, JAVA_HOME: process.env.JAVA_HOME || null };
