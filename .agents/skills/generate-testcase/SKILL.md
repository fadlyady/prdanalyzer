---
name: generate-testcase
description: >-
  Standard operating procedure for generating production-ready, comprehensive Master Test Case Suites
  (both structured 15-column Excel spreadsheets and automation-ready Gherkin/Markdown files) based on approved PRD analysis.
  Applies 3-Tier Coverage Matrix (Happy Path, Boundary/Systemic Edge Cases, Heuristic Exploratory Charters),
  Mandatory Adversarial Edge-Case Review (min 5 extreme candidates), Risk-Driven BVA Depth (3-value vs 2-value vs EP),
  Redundancy Prevention Rules, Triple-Layer Assertions (UI, API Contract, DB Persistence), and Universal Unique ID format for any platform.
  Activate when the user asks to generate, produce, or export detailed test cases from an approved PRD analysis.
---

# Universal Master Test Case Suite Skill (`generate-testcase`)

Skill ini digunakan untuk mentransformasikan hasil analisis PRD (`PRD_Analysis_<Feature_Name>.md`) menjadi **Master Test Case Suite Berstandar Industri** yang komprehensif, terukur, siap eksekusi manual/evidence development, dan siap diotomasi oleh automation framework (Playwright, Cypress, Appium, Pytest, Robot Framework).

Tujuan utama: Menghasilkan test case dengan **Coverage 3-Dimensi**, **Mandatory Adversarial Edge-Case Review**, **Risk-Driven BVA Depth & Redundancy Prevention**, dan **Triple-Layer Assertions (UI + API Contract + Data Persistence)** yang bersifat universal untuk platform Web, Mobile Native, Backend API, maupun Microservices.

---

## 1. Direktori & Lokasi Berkas Dinamis (*File Architecture*)

- **Input Analisis PRD (SSOT)**: `./result-testcase/PRD_Analysis_<Feature_Name>.md` (dihasilkan dari skill `prd-qa-analyzer` atau `prd-analyzer-business`).
- **Support & Knowledge Base**: `./Testcase-support/`
  - Template spreadsheet Excel acuan (15 kolom standar), template Markdown otomasi, dan `qa-learnings.md`.
- **UI & Interface Knowledge**: `./strukturmenu/` atau `./ui-references/<app-name>/` (jika ada interface).
- **Technical & API Contracts**: `./adhoc-document/` (OpenAPI, Postman, DB schema).
- **Target Output Test Cases**:
  1. **Master Spreadsheet Excel (Tahap 1)**: `./result-testcase/Test_Cases_<Feature_Name>.xlsx`
  2. **Automation-Ready Markdown (Tahap 2)**: `./result-testcase/test-cases-<feature-name>.md`

---

## 2. Model Cakupan Uji 3-Tier (3-Tier Test Coverage Engine)

Setiap fitur yang diuji **WAJIB** mencakup 3 tingkatan coverage pengujian berikut:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        3-TIER TEST COVERAGE MATRIX                     │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 1: HAPPY PATH (Golden Business Journey)                          │
│  - End-to-end nominal user journey dari inisiasi hingga selesai       │
│  - Valid inputs, standard payment, default configuration               │
│  - Standard CRUD state lifecycles & authorized role access             │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 2: BOUNDARY, SYSTEMIC & SECURITY EDGE CASES                      │
│  - Data Boundaries: Min-1, Min, Max, Max+1, UTF-8/Emoji, Precision    │
│  - Concurrency & Race: Double-click CTA, simultaneous multi-user edit  │
│  - Network & Resiliency: 3G throttling, 504 Timeout, offline reconnect │
│  - Security & RBAC: Direct URL access, IDOR/BOLA tampering, exp token │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 3: EXPLORATORY TESTING CHARTERS (Heuristic Tours)                │
│  - The FedEx Tour: Melacak data melintasi event queue, 3rd party & DB  │
│  - The Saboteur / Chaos Tour: Injeksi payload rusak, abort di tengah   │
│  - The Impatient / Rushed User: Multi-tab, fast clicks, back-button loop│
│  - The Rogue / Security Tour: Privilege escalation & parameter mutate  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Disiplin Desain Test ISTQB: BVA Depth & Redundancy Prevention

Untuk menjaga agar test suite tetap **tajam, berdaya uji tinggi, dan tidak membengkak secara sia-sia (lean & high ROI)**, terapkan disiplin berikut:

### 1. Risk-Driven BVA Depth (Kedalaman BVA Berbasis Level Risiko)
Kedalaman pengujian nilai batas (BVA) ditentukan secara langsung oleh tingkat risiko dari AC/modul terkait:

| Level Risiko | Kedalaman BVA | Titik Nilai yang Wajib Diuji |
| :--- | :--- | :--- |
| **Critical Risk** | **3-Value BVA** | $\text{Min}-1, \text{Min}, \text{Min}+1, \text{Max}-1, \text{Max}, \text{Max}+1$ |
| **High Risk** | **3-Value BVA** | $\text{Min}-1, \text{Min}, \text{Min}+1, \text{Max}-1, \text{Max}, \text{Max}+1$ |
| **Medium Risk** | **2-Value BVA** | $\text{Min}-1, \text{Min}, \text{Max}, \text{Max}+1$ |
| **Low Risk** | **EP Only** | 1 Valid Partition, 1 Invalid Partition (tanpa BVA kecuali diminta eksplisit) |

### 2. Aturan Pencegahan Redundansi (Redundancy Prevention Rules)
1. **BVA adalah bagian dari Partisi EP**: Nilai valid pada BVA (misal: $\text{Min}$ dan $\text{Max}$) sudah mencakup valid equivalence partition. Jangan membuat test case "Happy Path" terpisah jika nilai BVA valid sudah mengujinya.
2. **Kombinasi Validasi Multi-Field**: Gabungkan validasi form standar dalam 1 test case terstruktur jika logis, alih-alih membuat 10 test case terpisah untuk field kosong pada form yang sama.
3. **Pemberian Skor Prioritas**:
   - Critical Path / Critical Risk $\longrightarrow$ `Critical` (P1) / `High` (P2)
   - Medium Risk Happy Path $\longrightarrow$ `Normal` (P2)
   - Low Risk / Cosmetic / Rare Edge $\longrightarrow$ `Low` (P3)

---

## 4. 🛑 Gerbang Wajib: Adversarial Edge-Case Review (Min. 5 Kandidat)

Sebelum menghasilkan berkas Excel dan Markdown final, Agent **WAJIB berperan skeptis/adversarial** untuk mencari celah yang berpotensi merusak integritas sistem atau luput dari dokumen PRD.

Agent **WAJIB merumuskan dan menyajikan minimal 5 kandidat Adversarial Edge Cases** kepada User dengan format:

| # | AC / Modul Terkait | Skenario Adversarial Edge Case | Mengapa Ini Kritis (Potensi Dampak Kegagalan) |
|---|---|---|---|
| 1 | Billing / Checkout | User klik Bayar bersamaan pada 2 tab browser berbeda dengan sisa saldo hanya cukup untuk 1 transaksi | Mencegah negative balance (saldo minus) |
| 2 | Pricing Engine | Injeksi angka desimal tak hingga / floating-point precision (contoh: Rp 99.99999) | Mencegah selisih pembulatan akuntansi pada mutasi DB |
| 3 | Order Lifecycle | Network timeout tepat saat third-party gateway memproses webhook sukses | Mencegah order berstatus pending selamanya (zombie order) |
| 4 | RBAC / Permission | User role Viewer melakukan direct POST request ke endpoint mutasi menggunakan session cookie yang valid | Mencegah privilege escalation / BOLA vulnerability |
| 5 | Data Lifecycle | Transaksi di-cancel saat status sudah berpindah ke fase In-Progress | Mencegah state invariant violation di DB |

> **Konfirmasi User**: User memilih nomor kandidat mana saja yang disetujui untuk dimasukkan ke dalam suite (`Semua`, `1, 2, 4`, atau `Lewati`). Kandidat yang disetujui akan diikutsertakan ke dalam Master Suite.

---

## 5. Standar Triple-Layer Assertions (AAA Pattern) & Strict Zero-Wild-Guess

Langkah pengetesan (`step_desc`) dan ekspektasi hasil (`expected_desc`) **WAJIB** mencakup verifikasi pada **3 Layer**:

| Layer Verifikasi | Target Verifikasi | Contoh Penulisan pada `expected_desc` |
| :--- | :--- | :--- |
| **Layer 1: Client / UI State** | Visual components, button states, toasts, modals, badges, responsive. | 1. Button CTA berubah menjadi `Disabled (Loading Spinner)`.<br>2. Modal form tertutup otomatis.<br>3. Muncul toast alert hijau: `"Data berhasil disimpan"`.<br>4. Status badge berubah menjadi `"Active"`. |
| **Layer 2: Network / API Contract** | HTTP status codes, payload contract schema, response time SLA. | 5. API request / Contract Service merespons dengan HTTP `201 Created` (atau jika endpoint belum ada spesifikasi resmi di `./adhoc-document/`, gunakan **narasi pendekatan fungsional kontrak service**: `[Service/Contract] Pricing Engine memproses parameter user_id, category, country...`). |
| **Layer 3: DB / State Persistence** | Database tables, timestamps, audit logs, event bus triggers. | 7. Data tersimpan di tabel persistensi data dengan kolom `status = 'ACTIVE'` dan `created_at` berformat UTC.<br>8. Record baru terbentuk di log audit transaksi. |

> ⚠️ **STRICT ZERO-WILD-GUESS POLICY (API & UI/MENU)**:
> 1. **Dilarang Mengarang Endpoint API**: Dilarang mengarang/mengasumsikan path URL endpoint API (misal mengarang `GET /api/v1/pricing/resolve` atau `/api/v1/sessions/...` jika tidak ada file OpenAPI/TRD resmi di `./adhoc-document/`). Gunakan **narasi pendekatan fungsional** yang netral dan deskriptif.
> 2. **Dilarang Mengarang Hierarki Menu UI**: Dilarang mengarang pohon hierarki menu (misal mengarang `Admin > Pricing Management > Meta Base Price` jika tidak ada bukti visual di `./strukturmenu/` atau teks PRD).

---

## 6. Standar Navigasi Menu & Grounding UI (`./strukturmenu/` & Teks PRD)

Untuk memastikan penulisan prasyarat (`precondition`) dan langkah pengetesan (`step_desc`) 100% akurat dan siap dieksekusi oleh tester manual maupun automation QA:

1. **Pemeriksaan Bukti Menu (Menu Existence Verification)**:
   - Periksa informasi tertulis pada PRD/TRD dan seluruh berkas tangkapan layar di `./strukturmenu/` (contoh: `./strukturmenu/dashboard-crm/`, `./strukturmenu/chatroom-web/`, `./strukturmenu/customer-dashboard/`).
   - Tentukan apakah suatu menu, tombol CTA, tab, atau modal popup **benar-benar ada** atau **tidak ada**.
2. **Penyusunan Alur Navigasi Eksak (Exact Navigation Flow)**:
   - Susun urutan aksi klik yang presisi dan realistis berdasarkan tangkapan layar yang tersedia:
     - *Format*: `1. Buka menu [Menu Utama] > [Submenu]. 2. Klik tombol CTA [Nama Tombol]. 3. Pada modal [Nama Modal], pilih/isi [Data] lalu klik [Submit].`
     - *Contoh Nyata*: `1. User membuka menu Dashboard CRM > WhatsApp Credit.` atau `1. User membuka Chatroom > Klik ikon 'Setting Panel' di pojok kanan atas > Aktifkan toggle 'Service Message Cost Limit'.`
3. **🛑 Preventative Clarification Gate: Penanganan Area Abu-Abu & Opsi User**:
   - Jika terdapat informasi yang masih **abu-abu** (ambigu/kurang lengkap), baik mengenai **aturan requirement bisnis** maupun **keberadaan menu/UI**, Agent **WAJIB BERTANYA KE USER** terlebih dahulu sebagai tindakan preventif.
   - **Pilihan Tindakan User**:
     - **User Melengkapi Informasi**: Terapkan informasi valid yang diberikan user ke dalam langkah pengujian.
     - **User Memilih Skip / Belum Menjawab**: Simpan seluruh pertanyaan yang di-skip ke berkas terpisah `./result-testcase/questions-for-pm-<feature_name>.md` agar dapat di-follow up kemudian.
     - **User Meminta Default / Data Memang Belum Ada**: Terapkan **Standar Nilai Default**:
       - *Default UI/Menu*: Gunakan modul fungsional netral `[Nama Modul - Role]` (contoh: `[Credit Management - Admin]`) tanpa mengarang hierarki menu fiktif.
       - *Default API*: Gunakan narasi kontrak fungsional `[Service/Contract] <Service> mengeksekusi...` tanpa mengarang path URL fiktif.
4. **Penanganan Modul Non-Terdokumentasi (Internal / Backend / Non-Mockup)**:
   - Jika suatu modul (misal modul internal Biz Ops Admin) **tidak memiliki screen capture** di `./strukturmenu/` dan **tidak memiliki wireframe/mockup** di PRD, gunakan penamaan modul fungsional resmi PRD secara netral:
     - *Contoh*: `1. Login sebagai user internal role 'Biz Ops Admin'. 2. Akses modul fungsional [Credit Management - Admin].`
     - *Dilarang*: Mengarang struktur menu fiktif seperti `Admin > Pricing Management > Meta Base Price`.

---

## 7. Format Penomoran ID Universal (`unique_id`)

Format penomoran `unique_id` disusun secara modular, konsisten, dan **immutable** (tidak boleh diubah nomornya saat iterasi revisi):

$$\mathbf{\langle PLATFORM\rangle\text{-}\langle MODULE\rangle\text{-}\langle SUBMODULE\rangle\text{-}\langle TYPE\rangle\text{-}\langle SEQ\rangle}$$

- **`<PLATFORM>`**: `WEB`, `MOB`, `API`, `JOB`, `CLI`.
- **`<MODULE>`**: Kode Modul Utama (misal: `AUTH`, `BILL`, `CHAT`, `CUST`, `PROD`, `SETT`).
- **`<SUBMODULE>`**: Kode Sub-modul (misal: `PRIC`, `FLOW`, `NOTF`, `USER`, `IMPT`).
- **`<TYPE>`**: `POS` (Positive), `NEG` (Negative), `BVA` (Boundary), `SEC` (Security/RBAC), `CON` (Concurrency), `EXP` (Exploratory).
- **`<SEQ>`**: Nomor urut sekuensial 3 digit (`001`, `002`, `003`, dst.).

---

## 8. Spesifikasi Master Test Case Excel (`result-testcase/Test_Cases_<Feature_Name>.xlsx`)

File Excel dibuat menggunakan script Python (`openpyxl`) dengan spesifikasi 15 kolom standar:

- **Sheet Name**: `Test Cases`
- **15 Kolom Standar & Lebar Kolom (Column Width)**:
  1. `project_id` (12) — Kode proyek sistem (misal: `FINTECH_CORE`, `CHAT_PLATFORM`).
  2. `suite_id` (12) — Kode modul/suite (misal: `BILLING`, `CHAT_FLOW`).
  3. `unique_id` (22) — Format: `<PLATFORM>-<MODULE>-<SUBMODULE>-<TYPE>-<SEQ>`.
  4. `title` (45) — Judul spesifik skenario pengujian.
  5. `decription` (45) — Deskripsi tujuan dan cakupan uji.
  6. `precondition` (45) — Prasyarat akun, token, environment flag, dan state awal data bernomor (1. ..., 2. ...).
  7. `priority` (15) — `Critical` (P1), `High` (P2), `Normal` (P2), `Low` (P3).
  8. `type` (15) — `Functional`, `Negative`, `Boundary`, `Security`, `Concurrency`, `Exploratory`, `Regression`.
  9. `status` (12) — `Draft` / `Ready`.
  10. `tags` (15) — `Smoke`, `Regression`, `RBAC`, `Integration`, `E2E`, `P1-Core`.
  11. `steps` (10) — Total langkah (integer).
  12. `step_desc` (50) — Langkah tindakan terinci bernomor (1. ..., 2. ...) dengan data uji konkret.
  13. `expected_desc` (50) — Ekspektasi hasil terukur bernomor mengacu pada *Triple-Layer Assertions*.
  14. `is_automated` (14) — `TRUE` / `FALSE`.
  15. `user_story` (45) — Format: `[Priority: Critical/High/Normal/Low] US-xx: <Judul Story> (Covers: AC-1, AC-2)`.

- **Styling Header (Row 1)**:
  - Background Fill: Navy Solid (`#1F4E78`)
  - Font: Putih (`#FFFFFF`), Bold, Ukuran 11pt, Font Family Arial/Calibri
  - Alignment: Horizontal Center, Vertical Center
- **Styling Data Rows**:
  - `wrap_text = True` untuk kolom `title`, `decription`, `precondition`, `step_desc`, `expected_desc`, dan `user_story`.
  - Alignment Vertical: `top`.
  - Border: Thin Border abu-abu (`#D3D3D3`) pada setiap cell.

---

## 9. Format Markdown Automation-Ready (`result-testcase/test-cases-<feature-name>.md`)

```markdown
# Automation & QA Test Case Suite: [Nama Fitur]

## Modul: [Nama Modul / User Story]

### WEB-BILL-PRIC-POS-001: [Judul Skenario Nominal] `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] US-01: Pembelian Paket Berlangganan (Covers: AC-01, AC-02)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. User login dengan akun role `Merchant Admin`.
  2. Saldo akun mencukupi (Rp 500.000).
- **Test Steps**:
  1. User membuka menu `/billing/packages`.
  2. User memilih paket `"Pro Enterprise 1 Bulan"` seharga `Rp 350.000`.
  3. User klik tombol CTA `[Beli Sekarang]`.
  4. User memilih metode pembayaran `"Saldo Akun"`.
  5. User klik `[Konfirmasi Pembayaran]`.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Button CTA berubah menjadi `Loading Spinner` lalu modal tertutup.
  2. [UI] Muncul toast alert hijau: `"Pembayaran Berhasil. Paket Pro Enterprise aktif"`.
  3. [API] Request `POST /api/v1/billing/checkout` merespons HTTP `200 OK` dengan payload `{ "status": "SUCCESS", "package_id": "PRO-ENT" }`.
  4. [DB] Saldo user berkurang menjadi `Rp 150.000` dan record baru tercatat di tabel `subscriptions` dengan `status = 'ACTIVE'`.
```

---

## 10. Urutan Proses Eksekusi Wajib (*Execution SOP*)

1. **Baca dan Validasi Input (Exhaustive Source Parsing)**:
   - Baca dokumen `./result-testcase/PRD_Analysis_<Feature_Name>.md` dan dokumen PRD/TRD sumber dari awal hingga akhir.
   - **Ekstraksi Skenario Eksplisit Sumber**: Jika dokumen sumber (PRD/TRD) memuat tabel skenario/sampel uji resmi, seluruh skenario tersebut **WAJIB dimasukkan 100%** ke dalam Master Test Suite sebagai baseline pengujian (Tier 1).
   - **Proactive Combinatorial Extension**: Kembangkan skenario dasar tersebut secara proaktif ke permutasi kondisi batas (*in-transit rate changes*, *downgrades*, *out-of-order webhooks*, *debt accumulation*).
2. **Review Knowledge UI & Screen Captures (`./strukturmenu/`) & Technical Specs (`./adhoc-document/`)**:
   - Periksa seluruh berkas tangkapan layar di `./strukturmenu/` (contoh: `chatroom-web/`, `dashboard-crm/`, `customer-dashboard/`) serta teks tertulis PRD untuk memverifikasi keberadaan menu, tombol CTA, modal dialog, dan alur antarmuka nyata.
   - **Tentukan Alur Navigasi Nyata**: Susun alur klik Menu A $\rightarrow$ Submenu B $\rightarrow$ CTA C yang 100% grounded pada tangkapan layar.
   - **Menu Non-Terdokumentasi**: Jika suatu modul tidak ada di `./strukturmenu/` dan tidak memiliki mockup di PRD, gunakan penamaan modul fungsional resmi PRD (misal `[Credit Management - Admin]`) tanpa mengarang hierarki menu fiktif.
3. **Adversarial Edge-Case Review (Mandatory Gate)**:
   - Rumuskan minimal **5 kandidat edge case ekstrim**.
   - Ajukan ke User di chat dan tunggu pilihan skenario yang disetujui.
4. **Terapkan Risk-Driven BVA & Redundancy Prevention**:
   - Susun data uji BVA (3-value untuk Critical/High, 2-value untuk Medium, EP untuk Low).
   - Pastikan partisi valid BVA melebur ke dalam Happy Path.
5. **Eksekusi Tahap 1 (Master Excel Spreadsheet)**:
   - Buat script Python `openpyxl` untuk menghasilkan `./result-testcase/Test_Cases_<Feature_Name>.xlsx`.
   - Jalankan script dan pastikan file Excel dibuat dengan styling 15 kolom rapi dan valid.
6. **Eksekusi Tahap 2 (Automation-Ready Markdown)**:
   - Buat file `./result-testcase/test-cases-<feature-name>.md` dengan struktur 3-Tier Coverage, Triple-Layer Assertions, dan tagging prioritas + kompleksitas automasi.
7. **🛑 Cross-File Consistency Verification Gate & Pelaporan**:
   - **Verifikasi Integritas 1-ke-1**: Jalankan skrip audit untuk memastikan bahwa seluruh baris di Excel (`Test_Cases_*.xlsx`) memiliki ID, Title, Priority, Type, dan Step yang identik 100% dengan heading dan konten di file Markdown (`test-cases-*.md`).
   - **Strict Grep-Before-Answer**: Dilarang menyebutkan kode Test Case ID, nomor baris, atau nama tabel dalam percakapan tanpa melakukan pencarian eksak (`grep_search` / `view_file`) ke file fisik terlebih dahulu untuk mencegah halusinasi kode ID.
   - Pastikan tidak ada orphan test cases (semua test case memiliki referensi AC/Story yang sah).
   - Hitung distribusi prioritas (P1/P2/P3), breakdown tipe test, dan laporkan ringkasan ke user.

---

## 11. Protokol Anti-Regresi & Pencegahan Konflik Aturan (Universal Guardrail)

> [!CAUTION]
> **PRINSIP KEKEBALAN DAN KONSISTENSI SKILL (ANTI-REGRESSION POLICY):**
> 1. **Dilarang Mengubah/Menghapus Rule Tanpa Persetujuan**: Seluruh aturan fundamental yang sudah stabil pada skill ini **TIDAK BOLEH diubah, diganti, atau dihapus sepihak oleh AI**, kecuali penambahan aturan baru tersebut terbukti objektif lebih baik dan telah disetujui oleh User.
> 2. **Pre-Calibration Sanity & Conflict Check**: Setiap pembaruan atau penambahan aturan baru harus dipastikan **TIDAK BERTENTANGAN** dengan guardrail fundamental (*Triple-Layer Assertions*, *3-Tier Coverage Matrix*, grounding visual `./strukturmenu/`, *Adversarial Edge-Case Review*, *Risk-Driven BVA*). Aturan baru harus bersifat memperketat / melengkapi (*additive/enriching*), bukan membatalkan aturan dasar.

