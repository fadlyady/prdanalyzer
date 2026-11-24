/**
 * Fixture uji per aplikasi diambil dari profil aktif (lokal), bukan ditulis di kode test (Pondasi P1/P8).
 *   profiles/<QA_ACTIVE_PROFILE>/knowledge/mobile/smoke.json   (contoh: profiles/_template/knowledge/mobile/smoke.json)
 * Tanpa profil/fixture -> null; test yang butuh data aplikasi akan SKIP dengan alasan jelas.
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { activeProfile, readQaEnv } = createRequire(import.meta.url)(path.join(ROOT, 'scripts', 'lib', 'qa-env.cjs'));
export function loadMobileFixture() {
  let ap; try { ap = activeProfile(ROOT); } catch { return null; }
  if (!ap.alias) return null;
  const f = path.join(ap.profileDir, 'knowledge', 'mobile', 'smoke.json');
  if (!fs.existsSync(f)) return null;
  let env = {}; try { env = readQaEnv(ROOT); } catch { /* rahasia belum ada */ }
  return { alias: ap.alias, pkg: env.MOBILE_APP_PACKAGE_STAGING || '', ...JSON.parse(fs.readFileSync(f, 'utf8')) };
}
