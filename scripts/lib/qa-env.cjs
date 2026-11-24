/**
 * qa-env — satu-satunya pembaca konfigurasi & rahasia untuk semua runner/MCP (Pondasi P1, P8).
 *
 * Urutan:
 *   1. <root>/.env                      -> hanya penunjuk profil aktif (QA_ACTIVE_PROFILE) + opsi lokal
 *   2. <root>/.secrets/<ALIAS>.env      -> nilai asli aplikasi aktif (URL, package, kredensial, DSN, policy)
 * Nilai di .secrets menimpa .env. Tanpa QA_ACTIVE_PROFILE -> mode lama (hanya .env), agar alur lama tidak putus.
 * Variabel proses QA_ACTIVE_PROFILE menimpa isi .env (mis. untuk menjalankan profil lain sekali jalan).
 */
const fs = require('fs');
const path = require('path');

function parseEnvFile(file) {
  const env = {};
  if (!file || !fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function activeProfile(root) {
  const base = parseEnvFile(path.join(root, '.env'));
  const alias = (process.env.QA_ACTIVE_PROFILE || base.QA_ACTIVE_PROFILE || '').trim();
  if (!alias) return { alias: null, base };
  if (!/^[A-Za-z0-9_-]+$/.test(alias)) throw new Error(`QA_ACTIVE_PROFILE tidak valid: ${alias}`);
  return {
    alias, base,
    profileDir: path.join(root, 'profiles', alias),
    secretsFile: path.join(root, '.secrets', `${alias}.env`),
    workDir: path.join(root, 'work', alias),
  };
}

function readQaEnv(root) {
  const p = activeProfile(root);
  if (!p.alias) return { ...p.base };
  if (!fs.existsSync(p.secretsFile)) {
    throw new Error(`Profil aktif ${p.alias} tidak punya file rahasia .secrets/${p.alias}.env. Salin profiles/_template/secrets.env.example lalu isi.`);
  }
  return { ...p.base, ...parseEnvFile(p.secretsFile), QA_ACTIVE_PROFILE: p.alias };
}


/** Slug fitur dari nama bebas: "test-cases-Filter_Data" -> "filter-data". */
function featureSlug(name) {
  return String(name || '').toLowerCase()
    .replace(/\.(md|xlsx|json)$/, '')
    .replace(/^(\d+-)?test[-_]?cases?[-_]?/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Bila file berada di work/<ALIAS>/<fitur>/..., kembalikan <fitur>; selain itu null. */
function featureFromPath(root, file) {
  if (!file) return null;
  const rel = path.relative(path.join(root, 'work'), path.resolve(root, file)).split(path.sep);
  return rel.length >= 3 && !rel[0].startsWith('..') && !rel[1].startsWith('_') ? rel[1] : null; // folder _xxx (mis. _audit) bukan fitur
}

/**
 * Lokasi folder run & laporan (Pondasi: work/<ALIAS>/<fitur>/runs|reports).
 * Fitur terdaftar bila folder work/<ALIAS>/<fitur>/ sudah ada (dibuat saat M0 Intake).
 * Fitur belum terdaftar / tanpa profil -> folder lama (legacyDir), agar alur lama tetap jalan.
 * QA_WORK_FEATURE (env) memaksa slug fitur.
 */
function resolveRunLocation(root, featureName, legacyDir, sourceFile) {
  const ap = activeProfile(root);
  const slug = process.env.QA_WORK_FEATURE || featureFromPath(root, sourceFile) || featureSlug(featureName);
  if (ap.alias && slug) {
    const fdir = path.join(ap.workDir, slug);
    if (fs.existsSync(fdir)) {
      return { mode: 'work', alias: ap.alias, feature: slug, featureDir: fdir,
        runsDir: path.join(fdir, 'runs'), reportsDir: path.join(fdir, 'reports') };
    }
  }
  return { mode: 'legacy', alias: ap.alias, feature: slug || null, featureDir: null, runsDir: legacyDir, reportsDir: legacyDir };
}

/** Catat run baru di work/<ALIAS>/<fitur>/runs/index.json (hanya mode work). */
function registerRun(root, loc, entry) {
  if (!loc || loc.mode !== 'work') return null;
  const f = path.join(loc.runsDir, 'index.json');
  fs.mkdirSync(loc.runsDir, { recursive: true });
  let idx = { alias: loc.alias, feature: loc.feature, runs: [] };
  if (fs.existsSync(f)) { try { idx = JSON.parse(fs.readFileSync(f, 'utf-8')); } catch (e) { /* index rusak -> buat ulang */ } }
  idx.runs = idx.runs || [];
  const rec = { ...entry, path: entry.path ? path.relative(root, path.resolve(root, entry.path)) : undefined, registered_at: new Date().toISOString() };
  const i = idx.runs.findIndex(r => r.run_id === rec.run_id);
  if (i >= 0) idx.runs[i] = { ...idx.runs[i], ...rec }; else idx.runs.push(rec);
  fs.writeFileSync(f, JSON.stringify(idx, null, 2));
  return f;
}

module.exports = { parseEnvFile, activeProfile, readQaEnv, featureSlug, featureFromPath, resolveRunLocation, registerRun };
