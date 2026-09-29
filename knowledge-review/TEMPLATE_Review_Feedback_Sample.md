# Template Catatan Walkthrough & Review Hasil Analisis / Testcase (`knowledge-review`)

File ini dapat digunakan sebagai acuan pengisian masukan (review feedback) dalam format **Narasi Markdown** ketika melakukan sprint review, walkthrough meeting, atau investigasi bug escape.

---

## 1. Metadata Sesi Review
- **Nama Fitur / Modul**: [Contoh: Everpro Chat - Meta New Pricing 2026]
- **Tanggal Sesi Review**: YYYY-MM-DD
- **Daftar Reviewer & Role**:
  - [Nama PM] - Product Manager
  - [Nama Tech Lead] - Backend / System Architect
  - [Nama QA Lead] - QA Lead / Senior QA

---

## 2. Rincian Temuan Review / Missed Coverage (Daftar Poin Masukan)

### Poin 1: [Judul Temuan / Missed Case]
- **Modul / Submodul**: [Contoh: WhatsApp Credit / Top-Up Modal]
- **Sumber Feedback**: [Tech Lead / PM / QA Lead / Bug Escape Incident]
- **Severity**: `CRITICAL (Weight 4)` / `HIGH (Weight 3)` / `MEDIUM (Weight 2)` / `LOW (Weight 1)`
- **Uraian Masalah / Celah yang Terlewat**:
  [Jelaskan kondisi nyata atau skenario yang belum tercakup di dokumen PRD_Analysis atau Testcase Suite. Contoh: Tombol konfirmasi Top-Up dapat diklik ganda secara cepat saat koneksi lambat, berpotensi memicu duplicate invoice.]
- **Expected Behavior yang Seharusnya**:
  - *UI*: [Tombol langsung berstatus loading/disabled setelah 1x klik]
  - *API/Service*: [Request kedua ditolak dengan status HTTP 409 atau Idempotency Key validation]
  - *Database*: [Tabel invoice hanya bertambah 1 row, saldo terpotong 1x]
- **Rekomendasi Guardrail / Action Item**:
  [Wajib menambahkan skenario idempotency double-click untuk setiap tombol transaksi mutasi dana/kuota.]

---

### Poin 2: [Judul Temuan / Missed Case]
- **Modul / Submodul**: [Contoh: Dashboard CRM / Filter Dropdown]
- **Sumber Feedback**: [Product Manager]
- **Severity**: `MEDIUM (Weight 2)`
- **Uraian Masalah / Celah yang Terlewat**:
  [Filter periode tanggal hanya menyediakan opsi default 7 hari dan 30 hari. Belum ada pengujian untuk opsi Custom Date Range yang melebihi 1 tahun.]
- **Expected Behavior yang Seharusnya**:
  - *UI*: [Datepicker membatasi rentang maksimal 365 hari atau menampilkan pesan validasi]
  - *API/Service*: [API mengembalikan error 400 jika date range > 365 days]
- **Rekomendasi Guardrail / Action Item**:
  [Menambahkan boundary check 3-value pada semua input filter tanggal.]

---

## 3. Catatan Tambahan & Dokumen Pendukung Baru (Jika Ada)
- Lampiran PRD Revisi: `./[PRD] Feature_Name_v2.docx`
- Lampiran OpenAPI / TRD Baru: `./adhoc-document/openapi_v2.json`
- Screenshot UI Tambahan: `./strukturmenu/new-modal/`
