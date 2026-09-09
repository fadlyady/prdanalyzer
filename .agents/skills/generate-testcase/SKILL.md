---
name: generate-testcase
description: >-
  Standard operating procedure for generating production-ready, comprehensive Master Test Case Suites
  (both structured 15-column Excel spreadsheets and automation-ready Gherkin/Markdown files) based on approved PRD analysis.
  Applies 3-Tier Coverage Matrix (Happy Path, Boundary/Systemic Edge Cases, Heuristic Exploratory Charters),
  Triple-Layer Assertions (UI, API Contract, DB Persistence), and Universal Unique ID format for any platform.
  Activate when the user asks to generate, produce, or export detailed test cases from an approved PRD analysis.
---

# Universal Master Test Case Suite Skill (`generate-testcase`)

Skill ini digunakan untuk mentransformasikan hasil analisis PRD (`PRD_Analysis_<Feature_Name>.md`) menjadi **Master Test Case Suite Berstandar Industri** yang komprehensif, terukur, siap eksekusi manual/evidence development, dan siap diotomasi oleh automation framework (Playwright, Cypress, Appium, Pytest, Robot Framework).

Tujuan utama: Menghasilkan test case dengan **Coverage 3-Dimensi (Happy Path, Boundary & Systemic Edge Cases, Exploratory Charters)** dan **Triple-Layer Assertions (UI + API Contract + Data Persistence)** yang bersifat universal untuk platform Web, Mobile Native, Backend API, maupun Microservices.

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

## 3. Standar Triple-Layer Assertions (AAA Pattern)

Langkah pengetesan (`step_desc`) dan ekspektasi hasil (`expected_desc`) tidak boleh hanya sekadar mengecek tampilan UI dangkal, melainkan wajib mencakup verifikasi pada **3 Layer**:

| Layer Verifikasi | Target Verifikasi | Contoh Penulisan pada `expected_desc` |
| :--- | :--- | :--- |
| **Layer 1: Client / UI State** | Visual components, button states, toasts, modals, badges, responsive. | 1. Button CTA berubah menjadi `Disabled (Loading Spinner)`.<br>2. Modal form tertutup otomatis.<br>3. Muncul toast alert hijau: `"Data berhasil disimpan"`.<br>4. Status badge berubah menjadi `"Active"`. |
| **Layer 2: Network / API Contract** | HTTP status codes, payload contract schema, response time SLA. | 5. API request `POST /api/v1/orders` merespons dengan HTTP `201 Created`.<br>6. Response payload berisi `{ "success": true, "order_id": "ORD-12345", "status": "ACTIVE" }`. |
| **Layer 3: DB / State Persistence** | Database tables, timestamps, audit logs, event bus triggers. | 7. Data tersimpan di tabel `orders` dengan kolom `status = 'ACTIVE'` dan `created_at` berformat UTC.<br>8. Record baru terbentuk di tabel `audit_logs` dengan `action = 'CREATE_ORDER'` dan `user_id = 'USR-001'`. |

---

## 4. Format Penomoran ID Universal (`unique_id`)

Format penomoran `unique_id` disusun secara modular dan konsisten untuk semua platform:

$$\mathbf{\langle PLATFORM\rangle\text{-}\langle MODULE\rangle\text{-}\langle SUBMODULE\rangle\text{-}\langle TYPE\rangle\text{-}\langle SEQ\rangle}$$

- **`<PLATFORM>` (3-4 Huruf)**: 
  - `WEB` (Web Application / Dashboard)
  - `MOB` (Mobile iOS / Android)
  - `API` (Backend Service / Microservice)
  - `JOB` (Cron Job / Worker / Event-Driven)
  - `CLI` (Command Line Tool)
- **`<MODULE>` (3-4 Huruf)**: Modul Utama (misal: `AUTH`, `BILL`, `CHAT`, `CUST`, `PROD`, `SETT`).
- **`<SUBMODULE>` (3-4 Huruf)**: Sub-modul Fitur (misal: `PRIC`, `FLOW`, `NOTF`, `USER`, `IMPT`).
- **`<TYPE>` (3-4 Huruf)**:
  - `POS` : Positive / Happy Path
  - `NEG` : Negative / Validation Failure
  - `BVA` : Boundary Value Analysis
  - `SEC` : Security / RBAC / Authorization / BOLA
  - `CON` : Concurrency / Race Condition
  - `EXP` : Heuristic Exploratory Charter
- **`<SEQ>` (3 Digit Angka)**: Nomor urut sekuensial per suite (`001`, `002`, `003`, dst.).

*Contoh*: `WEB-BILL-PRIC-POS-001`, `API-AUTH-TOKN-SEC-002`, `MOB-CHAT-SYNC-CON-001`, `WEB-FLOW-ORCH-EXP-001`.

---

## 5. Spesifikasi Master Test Case Excel (`result-testcase/Test_Cases_<Feature_Name>.xlsx`)

File Excel dibuat menggunakan script Python (`openpyxl`) dengan spesifikasi 15 kolom standar:

- **Sheet Name**: `Test Cases`
- **15 Kolom Standar & Lebar Kolom (Column Width)**:
  1. `project_id` (width: 12) — Kode proyek sistem (misal: `FINTECH_CORE`, `CHAT_PLATFORM`).
  2. `suite_id` (width: 12) — Kode modul/suite (misal: `BILLING`, `CHAT_FLOW`).
  3. `unique_id` (width: 22) — Format: `<PLATFORM>-<MODULE>-<SUBMODULE>-<TYPE>-<SEQ>`.
  4. `title` (width: 45) — Judul spesifik skenario pengujian.
  5. `decription` (width: 45) — Deskripsi tujuan dan cakupan uji.
  6. `precondition` (width: 45) — Prasyarat akun, token, environment flag, dan state awal data bernomor (1. ..., 2. ...).
  7. `priority` (width: 15) — `Critical` (P1), `High` (P2), `Normal` (P2), `Low` (P3).
  8. `type` (width: 15) — `Functional`, `Negative`, `Boundary`, `Security`, `Concurrency`, `Exploratory`, `Regression`.
  9. `status` (width: 12) — `Draft` / `Ready`.
  10. `tags` (width: 15) — `Smoke`, `Regression`, `RBAC`, `Integration`, `E2E`, `P1-Core`.
  11. `steps` (width: 10) — Total langkah (integer).
  12. `step_desc` (width: 50) — Langkah tindakan terinci bernomor (1. ..., 2. ...) dengan data uji konkret.
  13. `expected_desc` (width: 50) — Ekspektasi hasil terukur bernomor mengacu pada *Triple-Layer Assertions*.
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

## 6. Matriks & Tagging Automation Feasibility pada Markdown

Setiap skenario pada file markdown **wajib diberi tagging prioritas dan tingkat kompleksitas automasi**:

1. **Tagging Prioritas Automasi**:
   - `[Auto-Critical]` : Core Business Flow & Blocker Path (Wajib Paling Awal diotomasi).
   - `[Auto-High]` : Validasi mutasi kritis, BVA, dan kontrol otorisasi RBAC.
   - `[Auto-Normal]` : Flow sekunder, filtering, sorting, pagination, dan ekspor report.
   - `[Auto-Low]` : Validasi visual, tooltip, dan micro-animations.
2. **Tagging Tingkat Kompleksitas (Automation Complexity)**:
   - `[Low-Complexity]` : Alur navigasi lurus, form input standar, CRUD sederhana (*Quick Wins*).
   - `[Medium-Complexity]` : Multi-step modal, file upload/download parsing, dynamic datepicker, dropdown berjenjang.
   - `[High-Complexity]` : Async worker, real-time WebSocket, multi-browser concurrency, mock 3rd-party webhook, OTP bypass.

---

## 7. Format Markdown Automation-Ready (`result-testcase/test-cases-<feature-name>.md`)

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

---

### WEB-BILL-PRIC-CON-002: [Judul Skenario Double-Click CTA] `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-01: Pembelian Paket Berlangganan (Covers: AC-03 - Idempotency)
- **Tipe**: Concurrency / Idempotency
- **Precondition**:
  1. User berada pada halaman konfirmasi checkout.
- **Test Steps**:
  1. User melakukan double-click secara cepat (< 100ms) pada tombol `[Konfirmasi Pembayaran]`.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Tombol langsung disabled pada klik pertama dan tidak merespons klik kedua.
  2. [API] Hanya 1 request checkout yang dieksekusi atau request kedua menerima status `409 Conflict / 422 Unprocessable` dengan header `Idempotency-Key` yang sama.
  3. [DB] Saldo user hanya terpotong 1 kali dan tidak terjadi duplicate transaction record.

---

### WEB-BILL-PRIC-EXP-003: [Exploratory Charter: The Saboteur & Network Drop Tour] `[Auto-Normal]` `[High-Complexity]`
- **User Story**: [Priority: High] US-01: Pembelian Paket Berlangganan (Covers: NFR - Resilience)
- **Tipe**: Exploratory / Chaos
- **Charter Goal**: Menyelidiki ketahanan transaksi saat jaringan terputus tepat saat payload pembayaran dikirim ke payment gateway.
- **Exploration Steps**:
  1. Trigger pembayaran paket.
  2. Simulasikan network drop / disconnect Wi-Fi saat status request berada di fase `Pending Gateway`.
  3. Reconnect network setelah 10 detik.
  4. Refresh halaman billing.
- **Observed Assertions**:
  1. Sistem menampilkan status transaksi `"Menunggu Konfirmasi Pembayaran"` dan tidak langsung menyatakan transaksi gagal/hang.
  2. Mekanisme background reconciliation query status ke payment gateway dan meng-update status akhir tanpa intervensi manual.
```

---

## 8. Urutan Proses Eksekusi Wajib (*Execution SOP*)

1. **Baca dan Validasi Input**: Baca dokumen `./result-testcase/PRD_Analysis_<Feature_Name>.md`. Pastikan tidak ada data yang kurang.
2. **Review Knowledge UI & API Specs**: Cek `./strukturmenu/` (atau UI mockup) dan `./adhoc-document/` untuk penamaan field, tombol CTA, dan endpoint nyata.
3. **Eksekusi Tahap 1 (Master Excel Spreadsheet)**:
   - Buat script Python `openpyxl` untuk menghasilkan `./result-testcase/Test_Cases_<Feature_Name>.xlsx`.
   - Jalankan script dan pastikan file Excel dibuat dengan styling 15 kolom rapi dan valid.
4. **Eksekusi Tahap 2 (Automation-Ready Markdown)**:
   - Buat file `./result-testcase/test-cases-<feature-name>.md` dengan struktur 3-Tier Coverage, Triple-Layer Assertions, dan tagging prioritas + kompleksitas automasi.
5. **Verifikasi & Pelaporan**:
   - Hitung distribusi prioritas (P1/P2/P3), breakdown tipe test (Positive/Negative/Boundary/Security/Concurrency/Exploratory), dan laporkan ringkasan ke user.
