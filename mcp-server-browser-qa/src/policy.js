/**
 * Mutation Policy (Gate 4 v2) — satu sumber kebenaran untuk browser-qa-guard & mobile-qa-guard.
 *
 * Mode (QA_MUTATION_MODE di .env, atau qa_set_mutation_permission):
 *   safe          : read-only. Semua aksi mutasi diblokir -> PARTIAL TEST WITH REASON.
 *   full          : CREATE / UPDATE / DELETE / perubahan status di staging dijalankan nyata.
 *   full_external : full + aksi yang menjangkau pihak luar (kirim/broadcast/balas) HANYA bila
 *                   penerima di layar cocok dengan QA_TEST_RECIPIENT_ALLOWLIST.
 *
 * Aturan keras yang TIDAK ikut dilepas oleh mode apa pun:
 *   - financial (bayar/top up/checkout/potong kuota) diblokir kecuali QA_FINANCIAL_SANDBOX=true
 *   - session_end (logout/keluar) hanya bila ditandai eksplisit (isMutation / mutationType)
 *   - update/delete hanya pada data ber-TAG run (QA_REQUIRE_DATA_TAG, default "delete,update")
 *   - mutasi via koordinat mentah (xy) selalu diblokir; koordinat ber-anchor (relatif ke elemen ber-ID)
 *     boleh di mode full bila QA_ALLOW_ANCHORED_COORDINATE_MUTATION != false (wajib evidence sebelum/sesudah)
 *   - domain/build guard tetap berlaku (lihat guards.js)
 */
import fs from 'node:fs';
import path from 'node:path';

export const MODES = ['safe', 'full', 'full_external'];
export const list = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);

/** Urutan = prioritas klasifikasi (kategori paling berisiko menang). */
export const CATEGORY_KEYWORDS = [
  ['financial', ['checkout', 'bayar', 'pay', 'payment', 'top up', 'topup', 'beli', 'purchase', 'potong kuota', 'isi saldo']],
  ['session_end', ['logout', 'log out', 'keluar', 'sign out']],
  ['external', ['send', 'kirim', 'broadcast', 'blast', 'reply', 'balas']],
  ['delete', ['delete', 'hapus', 'destroy', 'remove', 'trash', 'buang', 'drop', 'purge']],
  ['update', ['update', 'edit', 'ubah', 'perbarui']],
  ['state_change', ['aktifkan', 'nonaktifkan', 'deaktifkan', 'activate', 'deactivate', 'assign', 'tugaskan', 'alihkan',
    'handover', 'takeover', 'ambil alih', 'tutup percakapan', 'close conversation', 'selesaikan', 'resolve', 'aksi massal']],
  ['create', ['create', 'tambah', 'add', 'buat', 'baru', 'new', 'save', 'simpan', 'submit', 'confirm', 'konfirmasi', 'setuju']],
];
export const CATEGORIES = [...CATEGORY_KEYWORDS.map(([c]) => c), 'navigation'];

const kwRegex = kw => new RegExp(`(^|[^a-z])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}([^a-z]|$)`, 'i');
const COMPILED = CATEGORY_KEYWORDS.map(([cat, kws]) => [cat, kws.map(k => [k, kwRegex(k)])]);

export function classify(text = '') {
  const t = String(text).toLowerCase().replace(/[_-]/g, ' ');
  for (const [cat, kws] of COMPILED) for (const [kw, re] of kws) if (re.test(t)) return { category: cat, keyword: kw };
  return null;
}

const stamp = (d = new Date()) => { const p = x => String(x).padStart(2, '0'); return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`; };
const digits = s => String(s).replace(/[\s\-().+]/g, '');
const PARTIAL = 'PARTIAL TEST WITH REASON';

export class MutationPolicy {
  constructor(env = {}) {
    this.mode = 'safe'; this.tag = null; this.actor = null;
    this.seq = 0; this.tagContextUntil = -1; this.tagContextFrom = null;
    this.ledger = []; this.ledgerFile = null;
    this.reload(env);
    if (this.defaultMode) this.setMode(this.defaultMode, { actor: '.env QA_MUTATION_MODE' });
  }

  reload(env = {}) {
    this.env = env;
    this.defaultMode = MODES.includes(env.QA_MUTATION_MODE) ? env.QA_MUTATION_MODE : null;
    this.recipients = list(env.QA_TEST_RECIPIENT_ALLOWLIST);
    this.requireTag = env.QA_REQUIRE_DATA_TAG === 'off' ? [] : list(env.QA_REQUIRE_DATA_TAG || 'delete,update');
    this.financialSandbox = env.QA_FINANCIAL_SANDBOX === 'true';
    this.tagPrefix = (env.QA_DATA_TAG_PREFIX || 'QAAUTO').replace(/[^\w-]/g, '');
    this.anchoredCoordinate = env.QA_ALLOW_ANCHORED_COORDINATE_MUTATION !== 'false';
    this.tagWindow = Number(env.QA_TAG_CONTEXT_WINDOW || 6);
    return this;
  }

  setMode(mode, { actor = 'user', tag } = {}) {
    if (!MODES.includes(mode)) throw new Error(`Mode mutasi "${mode}" tidak dikenal (${MODES.join('|')}).`);
    this.mode = mode; this.actor = actor;
    if (tag) this.tag = String(tag).trim();
    if (!this.tag) this.tag = `${this.tagPrefix}-${stamp()}`;
    this.tagContextUntil = -1; this.tagContextFrom = null;
    return this.summary();
  }

  /** Kembali ke mode default (.env) atau safe — dipanggil saat close/reset agar run berikutnya tidak mewarisi izin. */
  resetToDefault() { this.tag = null; return this.setMode(this.defaultMode || 'safe', { actor: this.defaultMode ? '.env QA_MUTATION_MODE' : 'auto-reset' }); }

  get mutationAllowed() { return this.mode !== 'safe'; }

  summary() {
    return {
      mode: this.mode,
      legacyMode: this.mode === 'safe' ? 'SAFE_MODE_ACTIVE' : 'LIVE_MUTATION_ENABLED',
      mutationAllowed: this.mutationAllowed,
      dataTag: this.tag,
      setBy: this.actor,
      rules: {
        requireDataTagFor: this.requireTag,
        externalRecipientsConfigured: this.recipients.length,
        financial: this.financialSandbox ? 'ALLOWED (sandbox)' : 'BLOCKED',
        anchoredCoordinateMutation: this.mutationAllowed && this.anchoredCoordinate ? 'ALLOWED (evidence sebelum/sesudah)' : 'BLOCKED',
        rawCoordinateMutation: 'BLOCKED',
      },
      notice: this.mode === 'safe'
        ? 'Safe Mode: aksi mutasi diblokir dan ditandai PARTIAL TEST WITH REASON.'
        : `PERINGATAN: mode ${this.mode} AKTIF — aksi mutasi dijalankan nyata di staging. Pakai TAG "${this.tag}" pada setiap data yang dibuat; edit/hapus hanya diizinkan pada data ber-TAG.`,
    };
  }

  hasTag(text = '') { return Boolean(this.tag) && String(text).toLowerCase().includes(this.tag.toLowerCase()); }

  /** Catat konteks ber-TAG (mis. membuka baris/detail data ber-TAG) agar edit/hapus beberapa langkah berikutnya diizinkan. */
  noteContext(text = '') {
    if (this.hasTag(text)) { this.tagContextUntil = this.seq + this.tagWindow; this.tagContextFrom = String(text).slice(0, 80); }
  }

  recipientMatch(text = '') {
    const low = String(text).toLowerCase(); const dig = digits(text);
    return this.recipients.find(r => {
      const d = digits(r);
      if (/^\d{8,}$/.test(d)) { const alt = d.startsWith('0') ? '62' + d.slice(1) : d.startsWith('62') ? '0' + d.slice(2) : null; return dig.includes(d) || (alt && dig.includes(alt)); }
      return low.includes(r.toLowerCase());
    }) || null;
  }

  /**
   * @param o.text          teks yang diklasifikasi (label/selector/id elemen)
   * @param o.isMutation    penanda eksplisit dari test case ([MUTATION])
   * @param o.mutationType  kategori eksplisit (create|update|delete|state_change|external|financial|session_end|navigation)
   * @param o.tier          tier locator ('coordinate' = xy mentah, 'anchored' = relatif ke elemen ber-ID/label)
   * @param o.contextText   teks elemen + kontainer (baris/kartu/dialog) — untuk aturan TAG
   * @param o.screenText    teks layar/halaman — untuk verifikasi penerima (external)
   * @param o.isNavigation  elemen terdeteksi sebagai navigasi (link/menu/tab) oleh guard platform
   */
  evaluate({ text = '', isMutation = false, mutationType = null, tier = '', contextText = '', screenText = '', isNavigation = false } = {}) {
    this.seq++;
    this.noteContext(contextText);
    const hit = classify(text);
    let category = hit?.category || null; const keyword = hit?.keyword || null;
    if (mutationType && CATEGORIES.includes(mutationType)) {
      // override eksplisit hanya boleh MENAIKKAN risiko, kecuali navigation untuk kategori create (mis. tombol "Tambah" yang membuka form)
      if (mutationType === 'navigation') { if (!category || category === 'create') category = null; }
      else category = mutationType;
    }
    if (!category && isMutation) category = 'create';
    if (category && isNavigation && ['create', 'external', 'state_change'].includes(category) && !isMutation && !mutationType) category = null;
    if (!category) return { blocked: false, destructive: false };

    const base = { category, keyword, mode: this.mode, tag: this.tag };
    const block = reason => ({ ...base, blocked: true, destructive: true, status: PARTIAL, reason });
    const what = `${category}${keyword ? ` ("${keyword}")` : ''}`;

    if (category === 'session_end' && !isMutation && mutationType !== 'session_end')
      return block('Aksi logout/keluar diblokir: mengakhiri sesi uji. Tandai isMutation=true / mutationType=session_end secara eksplisit jika memang skenario logout.');
    if (this.mode === 'safe')
      return block(`Aksi mutasi ${what} dilewati sesuai Safe Mode (izin CREATE/EDIT/DELETE tidak diberikan).`);
    if (category === 'financial' && !this.financialSandbox)
      return block(`Aksi finansial ${what} selalu diblokir (aturan keras). Set QA_FINANCIAL_SANDBOX=true hanya bila staging memakai payment sandbox.`);
    if (category === 'external') {
      if (this.mode !== 'full_external') return block(`Aksi ${what} menjangkau pihak luar (pesan/broadcast). Butuh mode full_external + QA_TEST_RECIPIENT_ALLOWLIST.`);
      if (!this.recipients.length) return block('Mode full_external aktif tetapi QA_TEST_RECIPIENT_ALLOWLIST kosong — penerima tidak bisa diverifikasi.');
      const who = this.recipientMatch(`${screenText} ${contextText}`);
      if (!who) return block(`Penerima di layar tidak cocok dengan QA_TEST_RECIPIENT_ALLOWLIST — ${what} tidak dijalankan untuk melindungi kontak nyata.`);
      base.recipient = who;
    }
    if (this.requireTag.includes(category)) {
      const direct = this.hasTag(contextText); const recent = this.seq <= this.tagContextUntil;
      if (!direct && !recent) return block(`Aksi ${what} hanya diizinkan pada data ber-TAG "${this.tag}" (QA_REQUIRE_DATA_TAG). Buka/pilih data ber-TAG terlebih dahulu, atau buat data uji dengan TAG ini.`);
      base.tagEvidence = direct ? 'element' : `konteks sebelumnya: ${this.tagContextFrom}`;
    }
    if (tier === 'coordinate') return block(`Aksi mutasi ${what} via tap koordinat/vision diblokir (aturan keras: mutasi wajib lewat elemen ber-id/berlabel atau koordinat ber-anchor).`);
    if (tier === 'anchored') {
      // elemen tanpa label/ID tidak bisa diklasifikasi -> kategori wajib dideklarasikan (mis. tombol kirim = external)
      if (!hit && !mutationType) return block('Mutasi via koordinat ber-anchor pada elemen tanpa label/ID wajib menyertakan mutationType eksplisit (mis. "external" untuk tombol kirim) agar aturan kategori berlaku.');
      if (!this.anchoredCoordinate) return block(`Aksi mutasi ${what} via koordinat ber-anchor dinonaktifkan (QA_ALLOW_ANCHORED_COORDINATE_MUTATION=false).`);
      base.requiresEvidence = true;
    }
    return { ...base, blocked: false, destructive: true };
  }

  /** Mutation ledger: jejak audit + bahan teardown. */
  setLedgerFile(file) { this.ledgerFile = file; if (file) fs.mkdirSync(path.dirname(file), { recursive: true }); }
  record(entry) {
    const e = { t: new Date().toISOString(), mode: this.mode, tag: this.tag, ...entry };
    this.ledger.push(e);
    if (this.ledgerFile) { try { fs.appendFileSync(this.ledgerFile, JSON.stringify(e) + '\n'); } catch { /* ok */ } }
    return e;
  }
  ledgerSummary() {
    const executed = this.ledger.filter(e => e.status === 'EXECUTED');
    const byCategory = {}; for (const e of executed) byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    return {
      mode: this.mode, dataTag: this.tag, ledgerFile: this.ledgerFile,
      executed: executed.length, blocked: this.ledger.filter(e => e.status === 'BLOCKED').length, byCategory,
      created: executed.filter(e => e.category === 'create').map(e => ({ tcId: e.tcId, target: e.target })),
      teardownHint: executed.some(e => e.category === 'create')
        ? `Ada data dibuat pada run ini. Bersihkan data ber-TAG "${this.tag}" (plan.teardown / TC cleanup) — hapus hanya data ber-TAG.`
        : 'Tidak ada data baru yang perlu dibersihkan.',
    };
  }
}
