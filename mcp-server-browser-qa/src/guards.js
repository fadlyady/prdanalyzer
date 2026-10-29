/**
 * Deterministic Hard Guardrails for Browser QA Automation
 * Enforces Gate 2 (Domain/Tab Protection), Gate 3 (Credential Privacy),
 * Gate 4 (Pre-flight Mutation Guard), and Gate 6 (Session Isolation).
 */

import fs from 'fs';
import path from 'path';

export class MutationGuard {
  constructor() {
    this.mutationAllowed = false;
    this.permissionGrantedBy = null;
    this.destructiveKeywords = [
      'delete', 'hapus', 'destroy', 'remove', 'trash', 'drop', 'purge',
      'create', 'tambah', 'add', 'new', 'buat',
      'update', 'edit', 'ubah', 'save', 'simpan',
      'checkout', 'bayar', 'pay', 'confirm', 'submit'
    ];
  }

  setPermission(allowed, actor = 'user') {
    this.mutationAllowed = Boolean(allowed);
    this.permissionGrantedBy = allowed ? actor : null;
    return {
      mutationAllowed: this.mutationAllowed,
      mode: this.mutationAllowed ? 'LIVE_MUTATION_ENABLED' : 'SAFE_MODE_ACTIVE'
    };
  }

  isDestructive(actionType, selector = '', value = '', isMutationExplicit = false) {
    if (isMutationExplicit) return true;

    const lowerSelector = (selector || '').toLowerCase();
    const lowerValue = (value || '').toLowerCase();
    const lowerAction = (actionType || '').toLowerCase();

    // Specific destructive actions
    if (['delete', 'remove', 'submit'].includes(lowerAction)) return true;

    // Check selectors and text for destructive terms
    for (const kw of this.destructiveKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lowerSelector) || regex.test(lowerValue)) {
        return true;
      }
    }
    return false;
  }

  evaluateAction(actionType, selector, value, isMutationExplicit) {
    const destructive = this.isDestructive(actionType, selector, value, isMutationExplicit);
    if (destructive && !this.mutationAllowed) {
      return {
        blocked: true,
        status: 'PARTIAL TEST WITH REASON',
        reason: `Aksi [${actionType}] pada selector "${selector}" diidentifikasi sebagai aksi mutasi (CREATE/EDIT/DELETE). Safe Mode AKTIF sehingga eksekusi dibatalkan secara deterministik.`
      };
    }
    return { blocked: false };
  }
}

export class DomainGuard {
  constructor(allowedHostnames = []) {
    this.allowedHostnames = new Set(allowedHostnames);
    this.targetUrl = null;
  }

  setTargetUrl(url) {
    try {
      const parsed = new URL(url);
      this.targetUrl = url;
      this.allowedHostnames.add(parsed.hostname);
      return true;
    } catch (e) {
      return false;
    }
  }

  isUrlAllowed(targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      // Disallow about:blank / chrome internal URLs if navigating away
      if (['localhost', '127.0.0.1'].includes(parsed.hostname)) return true;

      for (const allowed of this.allowedHostnames) {
        if (parsed.hostname === allowed || parsed.hostname.endsWith(`.${allowed}`)) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
}

export class CredentialVault {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.envPath = path.join(workspaceRoot, '.env');
  }

  readRawEnv() {
    if (!fs.existsSync(this.envPath)) return {};
    const content = fs.readFileSync(this.envPath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
    return env;
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
