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

module.exports = { parseEnvFile, activeProfile, readQaEnv };
