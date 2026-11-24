/**
 * Deterministic Hard Guardrails for Browser QA Automation
 * Enforces Gate 2 (Domain/Tab Protection), Gate 3 (Credential Privacy),
 * Gate 4 (Mutation Policy berlevel — lihat policy.js), and Gate 6 (Session Isolation).
 */

import fs from 'fs';
import path from 'path';
import { MutationPolicy, list } from './policy.js';
import { createRequire } from 'node:module';
const { readQaEnv } = createRequire(import.meta.url)('../../scripts/lib/qa-env.cjs');

export { MutationPolicy, classify, MODES } from './policy.js';

/**
 * Adapter Gate 4 untuk browser: klasifikasi dari selector + teks elemen (bukan nilai input),
 * link navigasi (<a href>) tidak dianggap mutasi kecuali ditandai eksplisit.
 */
export class MutationGuard extends MutationPolicy {
  setPermission(allowed, actor = 'user', opts = {}) {
    const mode = opts.mode || (allowed ? (this.defaultMode && this.defaultMode !== 'safe' ? this.defaultMode : 'full') : 'safe');
    return this.setMode(mode, { actor, tag: opts.tag });
  }

  /**
   * @param el  info elemen dari halaman: { text, ctx, isLink, inForm }
   */
  evaluateAction(actionType, selector = '', value = '', isMutationExplicit = false, el = {}, opts = {}) {
    const a = (actionType || '').toLowerCase();
    const evaluated = ['click', 'press', 'dblclick', 'check', 'uncheck'];
    if (!evaluated.includes(a) && !isMutationExplicit) return { blocked: false, destructive: false };
    const elText = (el.text || '').length <= 60 ? (el.text || '') : '';
    let text = `${selector} ${elText}`;
    // press Enter di dalam form = submit
    if (a === 'press') { const enter = /^(enter|numpadenter)$/i.test(value || 'Enter'); text = !enter ? '' : el.inForm ? `${text} submit` : text; }
    return this.evaluate({
      text, isMutation: isMutationExplicit, mutationType: opts.mutationType,
      contextText: `${el.text || ''} ${el.ctx || ''}`, screenText: opts.screenText || '',
      isNavigation: Boolean(el.isLink),
    });
  }
}

const hostOf = u => { try { return new URL(u).hostname.toLowerCase(); } catch { return null; } };

/**
 * Domain guard: allowlist HANYA dari konfigurasi (.env), tidak pernah menambahkan host target secara otomatis.
 *   QA_STAGING_HOSTS      : daftar host staging (koma). Subdomain ikut diizinkan.
 *   *_BASE_URL_STAGING    : host-nya otomatis masuk allowlist (mis. E2E_BASE_URL_STAGING).
 *   QA_PROD_HOSTS_DENY    : host production — exact match, atau "*.domain" untuk semua subdomain. Selalu ditolak.
 */
export class DomainGuard {
  constructor(env = {}) { this.reload(env); this.targetUrl = null; }

  reload(env = {}) {
    const fromUrls = Object.entries(env).filter(([k]) => /_BASE_URL_STAGING$|^BASE_URL_STAGING$/.test(k)).map(([, v]) => hostOf(v)).filter(Boolean);
    this.allowedHostnames = new Set(['localhost', '127.0.0.1', ...list(env.QA_STAGING_HOSTS).map(h => h.toLowerCase()), ...fromUrls]);
    this.deny = list(env.QA_PROD_HOSTS_DENY).map(h => h.toLowerCase());
    return this;
  }

  configured() { return this.allowedHostnames.size > 2; }

  isDenied(host) {
    return this.deny.some(d => d.startsWith('*.') ? (host === d.slice(2) || host.endsWith(d.slice(1))) : host === d);
  }

  check(targetUrl) {
    const host = hostOf(targetUrl);
    if (!host) return { ok: false, reason: `URL "${targetUrl}" tidak valid.` };
    if (this.isDenied(host)) return { ok: false, host, reason: `Host ${host} terdaftar di QA_PROD_HOSTS_DENY (production).` };
    for (const a of this.allowedHostnames) if (host === a || host.endsWith(`.${a}`)) return { ok: true, host };
    return { ok: false, host, reason: this.configured()
      ? `Host ${host} tidak ada di allowlist staging (${[...this.allowedHostnames].join(', ')}).`
      : `Allowlist staging belum dikonfigurasi. Isi QA_STAGING_HOSTS atau E2E_BASE_URL_STAGING di .env.` };
  }

  setTargetUrl(url) { const r = this.check(url); if (r.ok) this.targetUrl = url; return r.ok; }
  isUrlAllowed(targetUrl) { return this.check(targetUrl).ok; }
}

export class CredentialVault {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.envPath = path.join(workspaceRoot, '.env');
  }

  /** Membaca .env + .secrets/<profil aktif>.env lewat scripts/lib/qa-env.cjs (satu sumber kebenaran). */
  readRawEnv() {
    return readQaEnv(this.workspaceRoot);
  }

  /**
   * Returns safe metadata for roles without revealing passwords to the LLM.
   */
  listAvailableRoles() {
    const env = this.readRawEnv();
    const roles = [];
    const grouped = {};

    for (const [key, val] of Object.entries(env)) {
      if (key.startsWith('USER_')) {
        const match = key.match(/^USER_([A-Z0-9]+)_(.+)$/);
        if (match) {
          const role = match[1].toLowerCase();
          const suffix = match[2];
          const passKey = `PASS_${match[1]}_${suffix}`;
          const hasPassword = Boolean(env[passKey]);

          // Mask username: show first 2 chars and domain or asterisks
          const maskedUsername = val.length > 4 ? `${val.slice(0, 2)}***${val.slice(-2)}` : '****';

          if (!grouped[role]) grouped[role] = [];
          grouped[role].push({
            role,
            suffix,
            identifier: `${role}_${suffix}`,
            hasPassword,
            maskedUsername
          });
        }
      }
    }

    // Format list and flag ambiguity (if > 1 user per role prefix)
    for (const [role, list] of Object.entries(grouped)) {
      roles.push({
        role,
        count: list.length,
        hasAmbiguity: list.length > 1,
        options: list
      });
    }

    return roles;
  }

  /**
   * Internal retrieval of username & password for in-process browser typing.
   * This is never returned in the tool response to the LLM.
   */
  getCredentialsForRole(roleName, suffix = null) {
    const env = this.readRawEnv();
    const cleanRole = roleName.toUpperCase();

    // If specific suffix is provided
    if (suffix) {
      const userKey = `USER_${cleanRole}_${suffix.toUpperCase()}`;
      const passKey = `PASS_${cleanRole}_${suffix.toUpperCase()}`;
      if (env[userKey]) {
        return {
          username: env[userKey],
          password: env[passKey] || '',
          key: `${cleanRole}_${suffix}`
        };
      }
    }

    // Search for first match with role prefix
    for (const [key, val] of Object.entries(env)) {
      if (key.startsWith(`USER_${cleanRole}_`)) {
        const passKey = key.replace('USER_', 'PASS_');
        return {
          username: val,
          password: env[passKey] || '',
          key
        };
      }
    }

    return null;
  }
}
