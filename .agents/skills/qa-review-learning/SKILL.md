---
name: qa-review-learning
description: >-
  Standard operating procedure for reviewing QA PRD analysis, test case suites, and test execution results against
  review files in knowledge-review/ (Excel .xlsx/.csv, Markdown .md, Word .docx) or feedback from Product Managers,
  Tech Leads, QA Leads, and bug escape reports. Enforces a mandatory pre-review input confirmation gate, 3-way triangulation
  re-review (Analysis vs Test Cases vs Supporting Docs vs Review Notes), feedback authority weighting (4/3/2/1),
  systematic miss-path root cause diagnosis, Few-Shot Before-vs-After logging into Testcase-support/qa-learnings.md,
  and universal rule anti-regression calibration across all QA skills.
  Activate when the user asks to review results, evaluate walkthrough feedback, or improve QA skills based on findings.
---

# Continuous QA Learning & Retrospective Review Skill (`qa-review-learning`)

> [!IMPORTANT]
> **Kepatuhan Pondasi (wajib dibaca sebelum menjalankan skill ini):** `.agents/shared/FOUNDATION.md` adalah acuan tertinggi; bila ada aturan di bawah yang bertentangan, Pondasi yang berlaku.
> - **Profil aktif:** jalankan `python3 scripts/qa_feature.py where` untuk mengetahui alias `<ALIAS>`; artefak fitur ada di `work/<ALIAS>/<fitur>/` (buat dengan `python3 scripts/qa_feature.py init <fitur>` bila belum ada). Bila fitur sudah punya `00-scope.md`, alias di file itu yang dipakai.
> - **Kerahasiaan:** nilai asli (URL, package, akun, DSN) hanya dibaca server/runner dari `.secrets/<ALIAS>.env`; AI tidak membuka file itu dan tidak menulis nama aplikasi, host, package, atau akun asli di artefak — pakai alias (`<ALIAS>`, `{{role:owner}}`, `db:main`).
> - **Cakupan:** semua skill (termasuk `mobile-qa-execution` & `database-qa-validation`) dan standar di `.agents/shared/`.
> - **Pemisahan learning:** pelajaran generik (tanpa data aplikasi) → `Testcase-support/qa-learnings.md`; pelajaran spesifik aplikasi → `profiles/<ALIAS>/learnings.md` (lokal). Usulan resep DB atau jebakan UI diajukan ke user sebelum masuk knowledge profil.


Skill ini digunakan untuk menjalankan **Mekanisme Continuous Learning, Retrospective Review Loop, & Targeted Skill Calibration**. Setiap kali tim (User, Product Manager, Tech Lead, atau QA Lead) memberikan catatan review walkthrough, berkas feedback di folder `./knowledge-review/`, atau laporan *bug escape*, skill ini akan melakukan evaluasi menyeluruh (3-Way Triangulation), mendiagnosis *miss-path* penyebab kebocoran pengujian, mencatatnya ke knowledge base dengan pola komparasi *Before vs After*, dan menyempurnakan heuristik skill QA terkait secara presisi di bawah **Protokol Anti-Regresi Universal**.

---

## 1. Direktori & Lokasi Berkas Dinamis

- **Review & Feedback Intake Folder (Drop-Box)**: `./knowledge-review/`
  - Berisi berkas masukan review dalam format Excel (`.xlsx`, `.csv`), Markdown (`.md`), Word (`.docx`), atau teks (`.txt`).
  - Template acuan:
    - Spreadsheet: `./knowledge-review/TEMPLATE_Review_Feedback_Sample.xlsx`
    - Narasi Markdown: `./knowledge-review/TEMPLATE_Review_Feedback_Sample.md`
- **Persistent QA Knowledge Base (SSOT)**: generik → `Testcase-support/qa-learnings.md` (tanpa data aplikasi, di-commit); spesifik aplikasi → `profiles/<ALIAS>/learnings.md` (lokal)
- **Target Skills yang Dikalibrasi**:
  - SOP Analisis PRD Bisnis: `.agents/skills/prd-analyzer-business/SKILL.md`
  - SOP Master Test Case Suite: `.agents/skills/generate-testcase/SKILL.md`
  - SOP Konversi Dokumen & Calculation: `.agents/skills/convert-with-calculation/SKILL.md` & `.agents/skills/convert-document/SKILL.md`
  - SOP Eksekusi Pengujian Browser Staging: `.agents/skills/browser-qa-execution/SKILL.md`
  - SOP Eksekusi Mobile: `.agents/skills/mobile-qa-execution/SKILL.md` (+ knowledge `profiles/<ALIAS>/knowledge/mobile/` lewat `seed.json`)
  - SOP Validasi Database: `.agents/skills/database-qa-validation/SKILL.md` (+ usulan resep `profiles/<ALIAS>/knowledge/db/` setelah disetujui user)
  - Standar bersama: `.agents/shared/FOUNDATION.md` & `.agents/shared/standards/*.md` (perubahan standar wajib persetujuan user)
- **Dokumen Input Triangulasi**:
  - Dokumen Hasil Analisis PRD (`work/<ALIAS>/<fitur>/PRD_Analysis_*.md`)
  - Dokumen Test Case Suite (`work/<ALIAS>/<fitur>/Test_Cases_*.xlsx` / `.md`)
  - Laporan & evidence run (`work/<ALIAS>/<fitur>/reports/`, `runs/index.json`, `runs/run_*/` termasuk `run_results.json`, `actions.jsonl`, `review.json`, dan run lama yang dirujuk index)
  - Dokumen Pendukung Asli (PRD Asli `.docx`/`.pdf`, folder `profiles/<ALIAS>/knowledge/`, `profiles/<ALIAS>/knowledge/api/` (kontrak) / `knowledge/db/` (skema), API Spec, Diagram Arsitektur)

---

### Pemicu wajib (selain permintaan manual)
- Setiap `review.json` / laporan `_REVIEWED` yang mengoreksi status hasil runner.
- Setiap `FAILED` kategori `script` atau `environment` yang berulang ≥ 2 run pada fitur yang sama.
- Setiap defect yang lolos ke environment berikutnya setelah verdict GO/CONDITIONAL GO.
- Setiap jawaban PM yang mengubah aturan bisnis setelah test case dibuat.

## 2. Alur Kerja Continuous Learning Loop

```mermaid
graph TD
    A["<b>Gate 0: Mandatory Input Confirmation Gate</b><br/>Scan ./knowledge-review/ & Konfirmasi Berkas ke User"] --> B["<b>Langkah 1: Triangulasi 3-Way Re-Review</b><br/>Cross-check: Feedback Review vs Hasil Analisa vs Test Case vs PRD Asli"]
    B --> C["<b>Langkah 2: Miss-Path Root Cause Diagnostic</b><br/>Petakan fase kebocoran, Severity (4/3/2/1) & Otoritas Sumber"]
    C --> D["<b>Langkah 3: Knowledge Base Logging (qa-learnings.md)</b><br/>Catat SSOT dengan format Few-Shot Before vs After"]
    D --> E["<b>Langkah 4: Targeted Skill Calibration (Anti-Regresi)</b><br/>Update aturan skill target secara presisi & cek konflik aturan"]
    E --> F["<b>Langkah 5: Transparency & Verification Report</b><br/>Laporkan temuan, akar masalah & patch aturan baru ke User"]
```

---

## 3. Langkah Kerja Bertahap (SOP Review & Learning)

### Gate 0: Mandatory Input Confirmation Gate (Anti-Asumsi & Verifikasi Input)
> [!IMPORTANT]
> **DILARANG melakukan review secara sembarangan atau berasumsi tanpa konfirmasi data!**
> Sebelum memulai analisa review, agen **WAJIB memvalidasi variabel dan dokumen input** kepada user:
> 1. **Pindai Folder `./knowledge-review/`**: Periksa apakah ada berkas review baru (Excel/Markdown/Word). Tanyakan dan konfirmasi ke user apakah berkas tersebut yang menjadi acuan review.
> 2. **Dokumen Hasil Analisis**: Pastikan path/nama berkas analisis PRD yang ditinjau (misal: `work/<ALIAS>/<fitur>/01-analysis.md`).
> 3. **Dokumen Test Case**: Pastikan berkas test case yang diuji (misal: `work/<ALIAS>/<fitur>/02-testcases.xlsx` / `.md`).
> 4. **Dokumen Pendukung Asli**: Pastikan dokumen acuan awal yang digunakan (PRD `.docx`/`.pdf`, folder visual `profiles/<ALIAS>/knowledge/`, atau API contract di `profiles/<ALIAS>/knowledge/api/` (kontrak) / `knowledge/db/` (skema)).
> 5. **Konteks & Catatan Masukan**: Pastikan sumber catatan review (hasil sprint walkthrough, catatan PM/Tech Lead, atau bug escape staging/production).
>
> *Jika salah satu variabel belum teridentifikasi dengan jelas, tanyakan dan konfirmasi terlebih dahulu ke user sebelum melanjutkan.*

---

### Langkah 1: Triangulasi 3-Way Re-Review (Cross-Verification)
Lakukan evaluasi silang tiga arah secara komprehensif antara **Catatan Review (`./knowledge-review/`)** terhadap seluruh dokumen artefak:

1. **Re-Review Hasil Analisis (PRD Analysis Doc)**:
   - Apakah ada aturan bisnis, batasan kuota, formula kalkulasi, atau invariant state yang belum tertangkap?
   - Apakah dimensi SFDIPOT, Decision Table, atau Business Risk Consequence Chain memiliki *blind spot*?
   - Apakah tabel pertanyaan klarifikasi (`Open Questions`) melewatkan asumsi yang berisiko?
2. **Re-Review Test Case Suite (Test Cases Doc & Excel)**:
   - Apakah skenario Happy Path, Boundary Edge Cases, dan Exploratory Charters mencakup kondisi yang dikoreksi?
   - Apakah Boundary Value Analysis (BVA 3-value) diterapkan pada limit yang dipermasalahkan?
   - Apakah Assertion telah menerapkan *Triple-Layer* (UI state, API Contract payload, dan DB Persistence)?
3. **Re-Review Dokumen Pendukung (Supporting Documents)**:
   - Bandingkan dengan PRD asli: Apakah ada terminologi atau alur bisnis yang ambigu di PRD tetapi tidak diklarifikasi?
   - Bandingkan dengan `profiles/<ALIAS>/knowledge/`: Apakah navigasi menu, button trigger, atau modal pop-up sudah ter-grounding dengan tangkapan layar nyata?
   - Bandingkan dengan `profiles/<ALIAS>/knowledge/api/` (kontrak) / `knowledge/db/` (skema): Apakah ada detail OpenAPI atau DB DDL yang terlewatkan?

---

### Langkah 2: Miss-Path Root Cause Diagnostic & Feedback Authority Weighting

#### A. Matriks Otoritas & Pembobotan Sumber Feedback

| Sumber Feedback (*Source*) | Domain Otoritas Utama | Tingkat Severity & Bobot | Target Skill yang Dikalibrasi |
| :--- | :--- | :--- | :--- |
| **Product Manager (PM) / Business Owner** | Scope fitur, logika bisnis, aturan kuota/pricing, user flow, terminologi bisnis | **HIGH (Weight 3) - CRITICAL (Weight 4)** | `prd-analyzer-business`<br/>• Clarification Checklist<br/>• Business Risk Chains |
| **Tech Lead / Backend / Architect** | API contract, DB persistence, konsistensi data, concurrency, idempotency, NFR, error code | **HIGH (Weight 3) - CRITICAL (Weight 4)** | `prd-analyzer-business` & `generate-testcase`<br/>• Triple-Layer Assertions<br/>• Narasi kontrak API/DB |
| **QA Lead / Senior QA Reviewer** | Test coverage, boundary value (BVA), exploratory charters, negative test scenarios | **MEDIUM (Weight 2) - HIGH (Weight 3)** | `generate-testcase`<br/>• Adversarial Edge Cases<br/>• Standar BVA 3-Value depth |
| **QA Automation / Browser Execution Lead** | Flakiness eksekusi, selector drift, dynamic DOM, delay render dropdown, session reset antar role | **HIGH (Weight 3) - CRITICAL (Weight 4)** | `browser-qa-execution`<br/>• Smart Locators & Dropdown Timing<br/>• Session Reset & Multi-Credential |
| **Mobile Execution / Device Lead** | Locator LOW, guard event (app keluar), knowledge stale, setting device, flakiness device | **HIGH (Weight 3) - CRITICAL (Weight 4)** | `mobile-qa-execution`<br/>• Knowledge & seed per package<br/>• Plan & status |
| **Data / DB Reviewer** | Asersi DB salah, query tidak tepat, timing async, PII | **HIGH (Weight 3) - CRITICAL (Weight 4)** | `database-qa-validation`<br/>• DB check & polling<br/>• Resep cheatsheet |
| **Bug Escape (Incident Staging / Prod)** | Kebocoran bug nyata yang lolos ke staging/production | **CRITICAL (Weight 4)** *(Mandatory RCA)* | **Semua Skill Terkait**<br/>• Wajib 5-Whys RCA<br/>• Tambah Anti-Miss Guardrail permanen |

#### B. Skala Pembobotan Severity (4 / 3 / 2 / 1)
- **CRITICAL (Weight 4)**: Kerugian finansial langsung, celah keamanan/RBAC bypass, korupsi data, sistem crash/down.
- **HIGH (Weight 3)**: Alur transaksi utama terblokir, perhitungan biaya/limit salah, desinkronisasi status antar service.
- **MEDIUM (Weight 2)**: Skenario edge-case terlewat, boundary limit tidak diuji 3 titik, pesan error ambigu.
- **LOW (Weight 1)**: Typo label, inkonsistensi format penomoran ID, perapian minor format dokumen.

#### C. Pemetaan Fase Miss-Path (5-Whys Framework)
| Fase Miss Path | Karakteristik Masalah | Contoh Akar Masalah |
| :--- | :--- | :--- |
| **Phase 1: PRD Intake & Grounding** | Halusinasi UI / Mengarang menu fiktif / Salah kutip teks PRD | Tidak membaca `profiles/<ALIAS>/knowledge/` atau melewatkan catatan kaki dokumen PRD. |
| **Phase 2: Clarification Gate** | Asumsi sepihak tanpa bertanya ke PM | Menemukan formula ambigu tetapi langsung berasumsi tanpa mencatatnya di tabel Open Questions. |
| **Phase 3: Deep Modeling & Heuristic** | Blind spot pada Concurrency, State Transition, atau NFR | Model SFDIPOT tidak mengeksplorasi kondisi koneksi terputus, timeout, idempotency, atau RBAC. |
| **Phase 4: Test Case Generation** | Assertion dangkal atau skenario pengujian bolong | Hanya memvalidasi respon UI tanpa memverifikasi field payload API atau tabel database. |
| **Phase 5: Browser QA Execution** | Selector drift / Dropdown delay / Session contamination / Mutasi tak sengaja | Locator kaku terhadap dynamic DOM, timing polling dropdown terlalu pendek, cookies role lama belum di-clear, atau mutasi aktif di mode aman. |
| **Phase 6: Mobile QA Execution** | Locator ambigu/LOW, knowledge stale, plan salah target, guard event | Selector dari app lain, knowledge belum diperbarui setelah build baru, langkah navigasi tanpa ID. |
| **Phase 7: Database Validation** | Asersi DB keliru / terlalu cepat | Tidak ada `DB check`, tabel ditebak, pengecekan sebelum consumer async selesai. |
| **Phase 8: Review & Verdict** | Status/verdict salah dilaporkan | Charter default, FAILED skrip dihitung defect, verdict tanpa pernyataan scope. |
| **Phase 0: Environment & Data** | Gagal karena device/staging/data, bukan produk | Data precondition belum siap, akun tidak ada, staging down, pop-up/overlay device. |

---

### Langkah 3: Pencatatan ke Persistent Knowledge Base (`qa-learnings.md`)

Catat entri pembelajaran terstruktur ke `Testcase-support/qa-learnings.md` (generik) atau `profiles/<ALIAS>/learnings.md` (spesifik aplikasi) menggunakan pola **Few-Shot Before vs After**:

```markdown
### [YYYY-MM-DD] - [Nama Modul / Fitur]: [Judul Temuan / Feedback]
- **Target Dokumen yang Ditinjau**:
  - Berkas Feedback: `knowledge-review/<nama-file>`
  - Hasil Analisa: `work/<ALIAS>/<fitur>/01-analysis.md`
  - Test Case: `work/<ALIAS>/<fitur>/02-testcases.xlsx`
  - Dokumen Pendukung: PRD Asli & `profiles/<ALIAS>/knowledge/`
- **Sumber Feedback & Severity**: [PM / Tech Lead / QA Lead / Bug Escape] | [CRITICAL (Weight 4) / HIGH (Weight 3) / MEDIUM (Weight 2) / LOW (Weight 1)]
- **Fase Miss Path**: [Phase 0: Environment & Data / Phase 1: Intake / Phase 2: Clarification / Phase 3: Modeling / Phase 4: Test Suite / Phase 5: Browser / Phase 6: Mobile / Phase 7: DB / Phase 8: Review & Verdict]
- **Lokasi entri**: generik (`Testcase-support/qa-learnings.md`) / spesifik aplikasi (`profiles/<ALIAS>/learnings.md`)
- **Kategori Gap**: [Business Logic / NFR & Concurrency / Boundary & Data / Security & RBAC / Assertion / UI Grounding]

---
🔴 KONDISI SEBELUMNYA (BEFORE / MISS PATH):
[Jika Miss Testcase: Tuliskan 'KOSONG / TIDAK ADA TEST CASE' beserta alasan mengapa terlewat]
[Jika Flawed Testcase: Tuliskan kutipan step / assertion lama yang dangkal atau mengarang]

---
🟢 KONDISI HASIL PEMBELAJARAN (AFTER / CALIBRATED RESULT):
[Tuliskan skenario test case ideal dengan ID, Precondition, Steps, dan Triple-Layer Assertions (UI + API/Contract + DB Persistence)]

---
🛡️ GUARDRAIL & HEURISTIK BARU:
- Aturan / checklist baru yang wajib dipatuhi pada proses berikutnya.
- Target Skill yang Dikalibrasi: [`prd-analyzer-business`, `generate-testcase`, dll.]
```

---

### Langkah 4: Targeted Skill Calibration & Universal Anti-Regression Protocol

> [!CAUTION]
> **PROTOKOL ANTI-REGRESI & PENCEGAHAN KONFLIK ATURAN (UNIVERSAL GUARDRAIL):**
> 1. **Dilarang Mengubah/Menghapus Rule Tanpa Persetujuan**: Seluruh aturan fundamental yang sudah stabil pada skill (`prd-analyzer-business`, `generate-testcase`, `convert-document`, `convert-with-calculation`, `qa-review-learning`) **TIDAK BOLEH diubah, diganti, atau dihapus sepihak oleh AI**, kecuali penambahan aturan baru tersebut terbukti objektif lebih baik dan telah disetujui oleh User.
> 2. **Pre-Calibration Sanity & Conflict Check**: Sebelum menyuntikkan aturan baru ke skill target:
>    - Pastikan aturan baru **TIDAK BERTENTANGAN** dengan guardrail fundamental (seperti: *Zero-Wild-Guess Policy*, grounding visual `profiles/<ALIAS>/knowledge/`, penegakan *Triple-Layer Assertions*, dan *Mandatory Clarification Gate*).
>    - Jika terjadi potensi tumpang tindih (*overlap*), aturan baru harus bersifat **memperketat / melengkapi (additive/enriching)**, bukan membatalkan aturan dasar.
> 3. **Pemberlakuan Universal**: Protokol ini berlaku mengikat di seluruh berkas `.agents/skills/*/SKILL.md`.

#### Panduan Kalibrasi ke Skill Target:
1. **Update ke `prd-analyzer-business/SKILL.md`**:
   - Tambahkan item spesifik pada *Clarification Checklist* atau *SFDIPOT Heuristic*.
   - Perketat aturan *UI Navigation Grounding* berbasis `profiles/<ALIAS>/knowledge/`.
   - Tambahkan *guardrail* mitigasi resiko pada tabel dampak bisnis.
2. **Update ke `generate-testcase/SKILL.md`**:
   - Tambahkan pola *Exploratory Charters* atau *Adversarial Edge-Case Candidates*.
   - Perjelas aturan *Triple-Layer Assertion* untuk field atau status transaksi yang rawan desinkronisasi.
3. **Update ke `convert-with-calculation/SKILL.md`**:
   - Sesuaikan bobot kalkulasi resiko jika ada kategori resiko baru yang perlu dimasukkan ke executive scorecard.

---

### Langkah 5: Transparency & Verification Report
Sajikan laporan ringkas dan transparan kepada user yang mencakup:
1. **Rangkuman Evaluasi Triangulasi**: Hasil cross-check berkas review `./knowledge-review/` vs dokumen analisis, test case, dan PRD asli.
2. **Identifikasi Miss Path & Root Cause**: Fase kebocoran, tingkat severity, dan akar masalah (5-Whys).
3. **Pembaruan Knowledge Base**: Konfirmasi penambahan entri log baru di `qa-learnings.md` dengan format Before vs After.
4. **Bukti Kalibrasi Skill**: Rincian aturan baru yang diusulkan / ditambahkan ke skill target sesuai protokol anti-regresi.
