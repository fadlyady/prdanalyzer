---
name: generate-testcase
description: >-
  Standard operating procedure for generating production-ready, comprehensive Master Test Case Suites
  (both structured 15-column Excel spreadsheets and automation-ready Layered BDD/Markdown files) based on approved PRD analysis.
  Applies 3-Tier Coverage Matrix (Happy Path, Boundary/Systemic Edge Cases, Heuristic Exploratory Charters),
  Triple-Layer Assertions (UI, API Contract, DB Persistence), Layered Pragmatic BDD (Gherkin for UI/E2E & Structured AAA for Backend/API/Jobs),
  Explicit Webhook Payload Injections, Relative Timestamp Seeding, and Universal Unique ID format for any platform.
  Activate when the user asks to generate, produce, or export detailed test cases from an approved PRD analysis.
---

# Universal Master Test Case Suite Skill (`generate-testcase`)

Skill ini digunakan untuk mentransformasikan hasil analisis PRD (`PRD_Analysis_<Feature_Name>.md`) menjadi **Master Test Case Suite Berstandar Industri** yang komprehensif, terukur, siap eksekusi manual/evidence development, dan langsung siap diotomasi oleh automation framework (Playwright, Cypress, Appium, Pytest, Robot Framework).

Tujuan utama: Menghasilkan test case dengan **Coverage 3-Dimensi (Happy Path, Boundary & Systemic Edge Cases, Exploratory Charters)**, **Triple-Layer Assertions (UI + API Contract + Data Persistence)**, **Layered Pragmatic BDD Format (Gherkin untuk UI/E2E & AAA untuk Backend/API)**, **Injeksi Webhook Asynchronous Eksplisit**, dan **Relative Timestamp Seeding** yang berlaku universal untuk Web, Mobile Native, Backend API, maupun Microservices.

---

## 1. Direktori & Lokasi Berkas Dinamis (*File Architecture*)

- **Input Analisis PRD (SSOT)**: `./result-testcase/PRD_Analysis_<Feature_Name>.md` (dihasilkan dari skill `prd-qa-analyzer`).
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
│  - End-to-end nominal user journey dari inisiasi hingga selesai        │
│  - Valid inputs, standard payment, default configuration               │
│  - Standard CRUD state lifecycles & authorized role access             │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 2: BOUNDARY, SYSTEMIC & SECURITY EDGE CASES                      │
│  - Data Boundaries: Min-1, Min, Max, Max+1, UTF-8/Emoji, Precision    │
│  - Time Boundaries: Relative timestamp transition (now - 1m vs now + 1m)│
│  - Concurrency & Race: Double-click CTA, simultaneous multi-user edit  │
│  - Async & Webhook Events: Failed webhook refund, delayed delivery     │
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

## 3. Standar Format Pragmatic Layered BDD & AAA Pattern

Format penulisan langkah pengetesan disesuaikan dengan tipe layer pengujian:

### A. Untuk UI & End-to-End Test Cases (`WEB-*`, `MOB-*`, `E2E-*`): Gunakan Gherkin Syntax
- **`Given`**: State awal data, autentikasi role pengguna, saldo/prasyarat, dan URL/layar aktif.
- **`When`**: Langkah interaksi pengguna yang terinci dengan alur navigasi eksplisit (misal: Step-by-Step Wizard: *Step 1: Pilih Template $\rightarrow$ Step 2: Upload CSV / Pilih Kontak $\rightarrow$ Step 3: Date-Time Picker Jadwal $\rightarrow$ Step 4: Submit Modal Konfirmasi*).
- **`Then`**: Ekspektasi visual UI (**Layer 1: Client/UI State**) seperti perubahan tombol, spinner loading, modal tertutup, toast alert, visual badges (misal: `[Free Entry Point Active]`, `[Processing]`), atau badge biaya `Rp 0 (Bebas Biaya)`.
- **`And`**: Ekspektasi API Contract (**Layer 2: Network/API**) dan Database (**Layer 3: DB / State Persistence**).

### B. Untuk Backend, API, dan Worker Jobs (`API-*`, `JOB-*`, `CLI-*`): Gunakan Structured AAA Pattern
- **`[Arrange]`**: Setup fixture database, pembuatan access token, seed record data relasional, dan penyiapan payload request.
- **`[Act]`**: Eksekusi HTTP Request (`GET`, `POST`, `PUT`, `DELETE`), injeksi webhook payload, pemanggilan cron command CLI, atau publish message ke event queue.
- **`[Assert]`**: Verifikasi mendalam pada **Layer 2: API Contract / HTTP Response** (Status Code, JSON Schema, Error Code) dan **Layer 3: DB State & Audit Logs** (Row status, kolom timestamp UTC, balance mutasi, deduplication lock).

---

## 4. Standar Eksekusi Asynchronous & Webhook Event Injection

Untuk menguji alur asynchronous (misal: Callback Webhook dari 3rd Party seperti WhatsApp/Meta, Payment Gateway, dsb.):
1. **Dilarang Menulis Langkah Abstrak** seperti *"Tunggu webhook masuk"*.
2. **Wajib Menyertakan Payload Injeksi Nyata**: Tuliskan endpoint internal webhook (misal: `POST /api/v1/webhooks/whatsapp`) beserta contoh JSON payload konkret (status `failed`, error code, timestamp, message ID).
3. **Uji Kasus Delayed / Late Webhook**: Buat skenario pengujian di mana webhook callback tiba setelah batas toleransi (out of buffer window) untuk memvalidasi bahwa sistem memproses secara **idempotent** dan **tidak memicu pemotongan saldo / refund ganda**.

---

## 5. Standar Pengujian Boundary Berbasis Waktu (Relative Timestamp Seeding)

Untuk menguji perubahan status atau tarif berbasis tanggal/jam efektif (`effective_at`, `expires_at`):
1. **Dilarang Menunggu Jam Nyata** di server/komputer.
2. **Gunakan Relative Timestamp Seeding**:
   - Skenario Sebelum Transisi: Seed data dengan `effective_at = now() + 1 hour` (memastikan tarif lama yang aktif).
   - Skenario Setelah Transisi: Seed data dengan `effective_at = now() - 1 minute` (memastikan tarif baru yang aktif).
   - Skenario Jendela Aktif (misal: FEP 72 jam): Seed data dengan `fep_expires_at = now() + 1 minute` (masih aktif) vs `fep_expires_at = now() - 1 minute` (sudah expired).

---

## 6. Format Penomoran ID Universal (`unique_id`)

Format penomoran `unique_id` disusun secara modular dan konsisten untuk semua platform:

$$\mathbf{\langle PLATFORM\rangle\text{-}\langle MODULE\rangle\text{-}\langle SUBMODULE\rangle\text{-}\langle TYPE\rangle\text{-}\langle SEQ\rangle}$$

- **`<PLATFORM>` (3-4 Huruf)**: 
  - `WEB` (Web Application / Dashboard)
  - `MOB` (Mobile iOS / Android)
  - `API` (Backend Service / Microservice)
  - `JOB` (Cron Job / Worker / Event-Driven)
  - `CLI` (Command Line Tool)
  - `E2E` (End-to-End Cross Layer)
- **`<MODULE>` (3-4 Huruf)**: Modul Utama (misal: `AUTH`, `BILL`, `CHAT`, `CUST`, `PROD`, `SETT`, `PRIC`, `BRD`, `ROLL`, `FEP`, `ALRT`).
- **`<SUBMODULE>` (3-4 Huruf)**: Sub-modul Fitur (misal: `BASE`, `GEN`, `CUST`, `TIME`, `RND`, `ISOL`, `PART`, `FAIL`, `LATE`, `WIN`, `EXP`, `RACE`).
- **`<TYPE>` (3-4 Huruf)**:
  - `POS` : Positive / Happy Path
  - `NEG` : Negative / Validation Failure
  - `BVA` : Boundary Value Analysis
  - `SEC` : Security / RBAC / Authorization / Tampering
  - `CON` : Concurrency / Race Condition / Idempotency
  - `EXP` : Heuristic Exploratory Charter
- **`<SEQ>` (3 Digit Angka)**: Nomor urut sekuensial per suite (`001`, `002`, `003`, dst.).

*Contoh*: `WEB-BRD-ISOL-POS-007`, `API-ROLL-FAIL-POS-009`, `JOB-ROLL-RD-POS-010`, `API-CONC-RACE-CON-022`, `E2E-EXP-FEDEX-EXP-024`.

---

## 7. Spesifikasi Master Test Case Excel (`result-testcase/Test_Cases_<Feature_Name>.xlsx`)

File Excel dibuat menggunakan script Python (`openpyxl`) dengan spesifikasi 15 kolom standar:

- **Sheet Name**: `Test Cases`
- **15 Kolom Standar & Lebar Kolom (Column Width)**:
  1. `project_id` (width: 12) — Kode proyek sistem (misal: `EVERPRO_CHAT`, `FINTECH_CORE`).
  2. `suite_id` (width: 15) — Kode modul/suite (misal: `PRICING_MGMT`, `BROADCAST_EXEC`, `ROLLBACK_MGMT`).
  3. `unique_id` (width: 24) — Format: `<PLATFORM>-<MODULE>-<SUBMODULE>-<TYPE>-<SEQ>`.
  4. `title` (width: 45) — Judul spesifik skenario pengujian.
  5. `decription` (width: 45) — Deskripsi tujuan dan cakupan uji.
  6. `precondition` (width: 45) — Prasyarat akun, token, environment flag, dan state awal data bernomor (1. ..., 2. ...).
  7. `priority` (width: 15) — `Critical` (P1), `High` (P2), `Normal` (P2), `Low` (P3).
  8. `type` (width: 15) — `Functional`, `Negative`, `Boundary`, `Security`, `Concurrency`, `Exploratory`, `Regression`.
  9. `status` (width: 12) — `Draft` / `Ready`.
  10. `tags` (width: 18) — `Smoke`, `Regression`, `RBAC`, `Integration`, `E2E`, `P1-Core`.
  11. `steps` (width: 10) — Total langkah (integer).
  12. `step_desc` (width: 55) — Langkah tindakan terinci bernomor (1. ..., 2. ...) dengan pola Gherkin (`Given-When`) untuk UI atau AAA (`Arrange-Act`) untuk Backend/API.
  13. `expected_desc` (width: 55) — Ekspektasi hasil terukur bernomor mengacu pada *Triple-Layer Assertions* (`Then-And` untuk UI atau `Assert [API]/[DB]` untuk Backend).
  14. `is_automated` (width: 14) — `TRUE` / `FALSE`.
  15. `user_story` (width: 45) — Format: `[Priority: Critical/High/Normal/Low] US-xx: <Judul Story> (Covers: AC-1, AC-2)`.

- **Styling Header (Row 1)**:
  - Background Fill: Navy Solid (`#1F4E78`)
  - Font: Putih (`#FFFFFF`), Bold, Ukuran 11pt, Font Family Arial/Calibri
  - Alignment: Horizontal Center, Vertical Center
- **Styling Data Rows**:
  - `wrap_text = True` untuk kolom `title`, `decription`, `precondition`, `step_desc`, `expected_desc`, dan `user_story`.
  - Alignment Vertical: `top`.
  - Border: Thin Border abu-abu (`#D3D3D3`) pada setiap cell.

---

## 8. Matriks & Tagging Automation Feasibility pada Markdown

Setiap skenario pada file markdown **wajib diberi tagging prioritas dan tingkat kompleksitas automasi**:

1. **Tagging Prioritas Automasi**:
   - `[Auto-Critical]` : Core Business Flow & Blocker Path (Wajib Paling Awal diotomasi).
   - `[Auto-High]` : Validasi mutasi kritis, BVA, dan kontrol otorisasi RBAC.
   - `[Auto-Normal]` : Flow sekunder, filtering, sorting, pagination, dan ekspor report.
   - `[Auto-Low]` : Validasi visual, tooltip, dan micro-animations.
2. **Tagging Tingkat Kompleksitas (Automation Complexity)**:
   - `[Low-Complexity]` : Alur navigasi lurus, form input standar, CRUD sederhana (*Quick Wins*).
   - `[Medium-Complexity]` : Multi-step wizard modal, file upload CSV parsing, dynamic datepicker, dropdown berjenjang.
   - `[High-Complexity]` : Async worker, real-time WebSocket, multi-browser concurrency race condition, mock 3rd-party webhook injection, OTP bypass.

---

## 9. Format Markdown Automation-Ready (`result-testcase/test-cases-<feature-name>.md`)

```markdown
# Automation & QA Master Test Case Suite: [Nama Fitur]

## Modul: [Nama Modul / User Story]

### WEB-BRD-ISOL-POS-007: [Judul Skenario UI/E2E] `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-02: Broadcast Execution & Credit Isolation (Covers: AC-1, AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. User login sebagai Merchant Admin dengan saldo kredit awal Rp 1.000.000.
  2. Berada pada halaman dashboard broadcast `/broadcast/list`.
- **Test Steps (Gherkin BDD)**:
  - **Given**: User berada di halaman `/broadcast/list` dengan saldo Rp 1.000.000.
  - **When**: 
    1. User klik tombol CTA `[+ Buat Broadcast Baru]` (`#btn-create-broadcast`).
    2. Pada Step 1 Wizard (Pilih Template), user memilih template `"Promo Diskon Gajian"` (Kategori: `MARKETING`, Tarif: `Rp 750/pesan`).
    3. Pada Step 2 Wizard (Kontak), user meng-upload file CSV `contacts_100.csv` berisi 100 nomor telepon valid.
    4. Pada Step 3 Wizard (Jadwal), user memilih opsi radio `"Kirim Sekarang"`.
    5. Pada Step 4 Wizard (Review & Konfirmasi), user melihat ringkasan `"Estimasi Total Biaya: Rp 75.000"` dan klik `[Kirim Broadcast]` (`#btn-submit-broadcast`).
    6. User konfirmasi pada dialog modal `[Ya, Eksekusi]`.
- **Expected Results (Triple-Layer Assertions)**:
  - **Then (UI)**: 
    1. Modal tertutup, muncul toast alert hijau: `"Broadcast berhasil dibuat dan sedang diproses"`.
    2. Tabel broadcast menampilkan baris baru dengan status badge `[Processing]`.
    3. Widget saldo kredit di header terpotong dari `Rp 1.000.000` menjadi `Rp 925.000`.
  - **And (API & DB)**: 
    4. [API] Request `POST /api/v1/broadcasts` merespons HTTP `201 Created` dengan payload `{"broadcast_id": "BRD-9001", "total_contacts": 100, "locked_credits": 75000, "status": "PROCESSING"}`.
    5. [DB] Saldo merchant di tabel `wallets` terpotong Rp 75.000, dan tercatat 100 record di tabel `broadcast_recipients` dengan status `'LOCKED'`.

---

### API-ROLL-FAIL-POS-009: [Judul Skenario Backend/API Webhook] `[Auto-Critical]` `[High-Complexity]`
- **User Story**: [Priority: Critical] US-03: Failed Message Credit Rollback (Covers: AC-1)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Pesan broadcast `MSG-BC-8801` terkirim dengan status `'SENT'`, kredit terpotong `Rp 750`, `wamid = 'wamid.HBgL12345'`.
- **Test Steps (Structured AAA)**:
  - **Arrange**: Siapkan payload simulasi webhook WhatsApp: `{"object": "whatsapp_business_account", "entry": [{"changes": [{"value": {"statuses": [{"id": "wamid.HBgL12345", "status": "failed", "errors": [{"code": 131026, "title": "Message undeliverable"}]}]}}]}]}`.
  - **Act**: Kirim internal webhook request `POST /api/v1/webhooks/whatsapp` dengan payload tersebut.
  - **Assert**: Query API detail pesan dan mutasi saldo di database.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Webhook endpoint merespons HTTP `200 OK` (`{"status": "EVENT_RECEIVED"}`).
  2. [DB] Status pesan di tabel `broadcast_recipients` terupdate menjadi `'FAILED'` dengan error code `131026`.
  3. [DB] Saldo merchant di tabel `wallets` bertambah kembali `+ Rp 750` dengan `transaction_type = 'CREDIT_REFUND'` dan `reference_id = 'wamid.HBgL12345'`.
```

---

## 10. Urutan Proses Eksekusi Wajib (*Execution SOP*)

1. **Baca dan Validasi Input**: Baca dokumen `./result-testcase/PRD_Analysis_<Feature_Name>.md`. Pastikan tidak ada data yang ambigu.
2. **Review Knowledge UI & API Specs**: Cek `./strukturmenu/` (atau UI mockup) dan `./adhoc-document/` untuk penamaan field, tombol CTA, direct URL, visual badge, dan endpoint nyata.
3. **Terapkan Pragmatic Layered BDD & AAA**:
   - Gunakan Gherkin + Multi-step UI Wizard untuk skenario UI (`WEB-*`, `MOB-*`, `E2E-*`).
   - Gunakan Structured AAA + Explicit Payload Injection untuk Backend/API (`API-*`, `JOB-*`, `CLI-*`).
   - Terapkan Relative Timestamp Seeding untuk pengujian boundary waktu.
4. **Eksekusi Tahap 1 (Master Excel Spreadsheet)**:
   - Buat script Python `openpyxl` untuk menghasilkan `./result-testcase/Test_Cases_<Feature_Name>.xlsx`.
   - Jalankan script dan pastikan file Excel dibuat dengan styling 15 kolom rapi dan valid (100% parity dengan Markdown).
5. **Eksekusi Tahap 2 (Automation-Ready Markdown)**:
   - Buat file `./result-testcase/test-cases-<feature-name>.md` dengan struktur 3-Tier Coverage, Triple-Layer Assertions, dan tagging prioritas + kompleksitas automasi.
6. **Verifikasi & Pelaporan**:
   - Hitung distribusi prioritas (P1/P2/P3), breakdown tipe test, dan laporkan ringkasan ke user.

