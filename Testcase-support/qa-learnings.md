# Continuous QA Learnings — Generik (`qa-learnings.md`)

SSOT pembelajaran **lintas aplikasi** untuk semua skill. Tidak boleh memuat nama aplikasi, menu spesifik, host, akun,
atau data uji; pelajaran yang khusus satu aplikasi dicatat di `profiles/<ALIAS>/learnings.md` (lokal). Format entri baru
mengikuti `qa-review-learning` (Before vs After + guardrail + target skill).

---

### [2026-09-09] Standarisasi multi-platform & 3-Tier Coverage
- **Kategori**: Metodologi.
- **Pelajaran**: skill awal terlalu terikat satu domain dan hanya memeriksa UI.
- **Guardrail**: gerbang klarifikasi 7 dimensi; triple-layer assertion (UI, API/kontrak, DB); 3-tier coverage
  (happy path, boundary/systemic, exploratory); format ID `<PLATFORM>-<MODULE>-<SUBMODULE>-<TYPE>-<SEQ>`.
- **Target**: `prd-analyzer-business`, `generate-testcase`.

### [2026-09-16] Larangan mengarang endpoint API
- **Kategori**: Akurasi teknis.
- **Before**: TC memuat path endpoint tiruan yang tidak ada di dokumen/kontrak resmi.
- **After**: endpoint hanya dari `profiles/<ALIAS>/knowledge/api/` atau dokumen sumber; selain itu narasi fungsional
  `[Service/Contract] <service> memvalidasi ...`.
- **Target**: `generate-testcase`, `prd-analyzer-business`.

### [2026-09-16] Navigasi UI wajib grounded
- **Kategori**: Presisi langkah UI.
- **Before**: hierarki menu ditulis tanpa bukti visual.
- **After**: nama menu/CTA/urutan klik diambil persis dari knowledge web/mobile profil atau teks sumber; modul tanpa
  bukti ditulis sebagai modul fungsional netral `[Nama Modul - Role]`.
- **Target**: `generate-testcase`, `prd-analyzer-business`.

### [2026-09-16] Area abu-abu: bertanya, bukan berasumsi
- **Kategori**: Manajemen ambiguitas.
- **After**: pertanyaan terstruktur ke user; bila ditunda → `01-questions.md` dengan status `Open` dan nilai default netral;
  TC turunannya `Blocked by: Q-xx`.
- **Target**: semua skill analisa & desain.

### [2026-09-18] Bedah dokumen menyeluruh
- **Kategori**: Kedalaman parsing.
- **Before**: tabel skenario & sampel kasus di dokumen teknis terlewat karena skimming.
- **After**: traversal awal-akhir; seluruh tabel/sampel diinventarisasi sebagai baseline lalu diperluas; grep-before-answer
  sebelum menyebut ID/tabel; pertanyaan PM yang belum dijawab tidak dijawab sepihak.
- **Target**: `prd-analyzer-business`, `generate-testcase`.

### [2026-10-19] Role batching & clean session (anti RBAC contamination)
- **Kategori**: Eksekusi multi-role.
- **Before**: skenario role berbeda dijalankan berurutan pada sesi yang sama; tab menumpuk.
- **After**: satu tab kerja; TC dikelompokkan per role, login sekali per batch, reset cookies/storage (web) atau data app
  (mobile) saat ganti role; laporan dipisah per role.
- **Target**: `browser-qa-execution`, `mobile-qa-execution`.

### [2026-11-19] Prasyarat device mobile memengaruhi validitas run
- **Kategori**: Environment (Phase 0).
- **Before**: seluruh TC FAILED karena pop-up notifikasi/overlay membuat UI tree kosong; hasil sempat dianggap defect.
- **After**: pre-flight wajib — layar tidak terkunci, heads-up off + DND selama sesi; status `READY_WITH_WARNING`
  menghentikan run; FAILED karena device dicatat `failure_category: environment`.
- **Target**: `mobile-qa-execution`.

### [2026-11-19] Error state bukan empty state
- **Kategori**: Assertion.
- **Before**: layar error generik terbaca sebagai "data kosong" sehingga TC lolos.
- **After**: setiap halaman data wajib assertion eksplisit "tidak ada error state" (teks/ikon error dari knowledge profil),
  timeout halaman data memadai; error state selalu FAILED.
- **Target**: `mobile-qa-execution`, `browser-qa-execution`, `generate-testcase`.

### [2026-11-19] Runner dapat salah menilai — review wajib sebelum melapor
- **Kategori**: Review & verdict (Phase 8).
- **Before**: soft-fail/guard event diturunkan menjadi OBSERVATION; charter gagal tidak terlihat.
- **After**: reviewer membuka screenshot semua FAILED, LOW CONFIDENCE, dan charter; koreksi dicatat di `review.json`;
  laporan final `_REVIEWED`; temuan tidak konsisten antar run → intermiten, jalankan ulang.
- **Target**: `mobile-qa-execution`, `browser-qa-execution`, `qa-review-learning`.

### [2026-11-19] Bedakan kegagalan skrip dari defect produk
- **Kategori**: Triage (Phase 6/8).
- **Before**: plan menekan elemen yang salah di picker sistem → TC FAILED dan dilaporkan seperti defect.
- **After**: setiap FAILED wajib `failure_category` (product/script/environment/data); hanya `product` yang dihitung defect;
  pelajaran locator dicatat di knowledge profil (`seed.json`) agar tidak berulang.
- **Target**: `mobile-qa-execution`, `qa-review-learning`.

### [2026-11-20] Mutasi via koordinat & elemen tanpa identifier
- **Kategori**: Keamanan eksekusi & testability.
- **After**: mutasi tidak pernah lewat koordinat mentah; koordinat ber-anchor (relatif ke elemen ber-ID) hanya di mode full
  dengan evidence sebelum/sesudah; elemen penting tanpa label/ID dilaporkan sebagai temuan testability ke dev.
- **Target**: `mobile-qa-execution`.

### [2026-11-20] Verifikasi visual/fisik butuh langkah manual terstruktur
- **Kategori**: Eksekusi mobile.
- **After**: aspek yang bergantung posisi fisik device atau media diverifikasi dengan langkah `manual` di plan dan bukti
  frame/metadata; status maksimal `PASSED (LOW CONFIDENCE)` sampai direview.
- **Target**: `mobile-qa-execution`.

### [2026-11-23] Evidence harus jujur & verdict dibatasi scope
- **Kategori**: Integritas evidence (Phase 8).
- **Before**: generator laporan mengisi hasil exploratory default; verdict tidak pernah NO-GO walau ada FAILED; scorecard
  menganggap semua risiko tercover.
- **After**: tidak ada nilai default yang menyerupai hasil; status & verdict mengikuti
  `.agents/shared/standards/status-verdict-evidence.md`; setiap laporan memuat pernyataan scope.
- **Target**: semua skill eksekusi & konversi.
