/**
 * Deterministic Hard Guardrails — Mobile QA
 *  - MutationGuard : Gate 4 — adapter MutationPolicy bersama (safe | full | full_external, lihat
 *                    mcp-server-browser-qa/src/policy.js). Mutasi via koordinat mentah selalu diblokir;
 *                    koordinat ber-anchor (relatif ke elemen ber-ID/label) boleh di mode full + evidence.
 *  - BuildGuard    : Gate 2 (hanya package staging di allowlist; foreground app wajib package staging)
 *  - CredentialVault: Gate 3 — dipakai ulang dari browser-qa-guard (satu sumber kebenaran .env & masking)
 */
import { MutationPolicy } from '../../mcp-server-browser-qa/src/policy.js';
export { CredentialVault } from '../../mcp-server-browser-qa/src/guards.js';
export { MutationPolicy, classify, MODES } from '../../mcp-server-browser-qa/src/policy.js';

const NAV_ID = /(^|_)(menu|tab|nav|drawer_menu|bottom_nav|back)(_|$)/;

export class MutationGuard extends MutationPolicy {
  /** Legacy boolean: true -> mode default .env (bila bukan safe) atau full; false -> safe. */
  setPermission(allow, opts = {}) {
    const mode = opts.mode || (allow ? (this.defaultMode && this.defaultMode !== 'safe' ? this.defaultMode : 'full') : 'safe');
    return this.setMode(mode, { actor: opts.actor || 'user', tag: opts.tag });
  }
  /**
   * @param ctx {action, label, id, tier, isMutation, mutationType, contextText, screenText}
   * Label panjang (> 40 karakter) = data list (nama pelanggan/pesan) -> hanya resource-id yang diklasifikasi,
   * tetapi tetap dipakai sebagai konteks TAG.
   */
  evaluate({ action, label = '', id = '', tier = '', isMutation = false, mutationType = null, contextText, screenText = '' } = {}) {
    if (!['tap', 'long_press', 'double_tap', 'submit'].includes(action)) return { blocked: false, destructive: false };
    return super.evaluate({
      text: `${label.length <= 40 ? label : ''} ${id}`, isMutation, mutationType, tier,
      contextText: contextText ?? label, screenText, isNavigation: NAV_ID.test(id.replace(/^.*:id\//, '')),
    });
  }
}

export class BuildGuard {
  constructor({ allowlist = [], strict = true } = {}) {
    this.allowlist = new Set(allowlist.filter(Boolean));
    this.strict = strict;
    this.pkg = null;
  }
  check(pkg) {
    if (!this.allowlist.has(pkg)) return { ok: false, reason: `Package ${pkg} tidak ada di allowlist (${[...this.allowlist].join(', ') || '-'}).` };
    if (this.strict && !/\.(stag|staging|dev|qa)$/.test(pkg)) return { ok: false, reason: `Package ${pkg} tidak berakhiran .stag/.staging/.dev/.qa (strict mode).` };
    this.pkg = pkg; return { ok: true };
  }
  /** Picker/komponen sistem yang sah dibuka app (Galeri/Photo Picker, File, Kamera, chooser). Bisa ditambah via env MOBILE_EXTERNAL_ALLOWLIST. */
  static PICKERS = new Set([
    'com.google.android.providers.media.module', 'com.android.providers.media.module', 'com.android.providers.media',
    'com.google.android.documentsui', 'com.android.documentsui',
    'com.sec.android.app.camera', 'com.android.camera', 'com.android.camera2', 'com.google.android.GoogleCamera',
    'com.sec.android.gallery3d', 'com.google.android.apps.photos', 'com.android.intentresolver', 'android',
    'com.miui.gallery', 'com.android.fileexplorer', 'com.coloros.gallery3d', 'com.oplus.camera',
  ]);
  setExtraPickers(list = []) { for (const p of list) if (p) BuildGuard.PICKERS.add(p); }
  isPicker(pkg) { return BuildGuard.PICKERS.has(pkg); }
  /** foreground yang diizinkan: package staging, dialog izin sistem (ditangani), picker sistem; selain itu = keluar app */
  classify(foreground) {
    if (!foreground || foreground === this.pkg) return 'app';
    if (BuildGuard.PICKERS.has(foreground)) return 'system_picker';
    if (/permissioncontroller|packageinstaller/.test(foreground)) return 'permission_dialog';
    if (/launcher/.test(foreground)) return 'launcher';
    return 'other_app';
  }
}
