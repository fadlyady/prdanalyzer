# Automation & QA Master Test Case Suite: Meta New Pricing 2026

Dokumen ini berisi seluruh skenario pengujian komprehensif (*Master Test Case Suite*) yang diturunkan langsung dari [PRD_Analysis_Meta_New_Pricing_2026.md](file:///Users/fadlyady/Documents/Eldo%20Work/prdAnalyzer/result-testcase/PRD_Analysis_Meta_New_Pricing_2026.md). Format disusun dengan standar **Layered Pragmatic BDD (Gherkin untuk UI/E2E & Structured AAA untuk Backend/API)**, **Injeksi Payload Webhook Eksplisit**, **Relative Timestamp Seeding**, dan **Triple-Layer Assertions**.

---

## 📊 Ringkasan Distribusi Test Case

| Kategori Pengujian | P1 (Critical) | P2 (High) | P3 (Normal/Low) | Total |
| :--- | :---: | :---: | :---: | :---: |
| **Tier 1: Happy Path (Golden Journey)** | 5 | 6 | 0 | **11** |
| **Tier 2: Boundary, Negative, Security & Concurrency** | 4 | 5 | 1 | **10** |
| **Tier 3: Heuristic Exploratory Testing Charters** | 2 | 1 | 1 | **4** |
| **TOTAL KESELURUHAN** | **11** | **12** | **2** | **25** |

---

## Modul 1: Manajemen Harga & Konfigurasi Tarif (Pricing Management)

### API-PRIC-BASE-POS-001: Verifikasi update Base Price per kategori dan negara tujuan di database `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] US-01: Base Price Management (Covers: AC-1)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Akses internal API endpoint pricing aktif.
  2. Parameter category ('SERVICE') dan country ('ID') valid.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Siapkan payload JSON update base price: {"category": "SERVICE", "country": "ID", "base_price": 300, "effective_at": "2026-10-01T00:00:00Z"}.
  2. [Act] Kirim request POST /api/v1/admin/pricing/base dengan header Authorization: Bearer <bizops_token>.
  3. [Assert] Query tabel meta_base_prices untuk memvalidasi persistensi data.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Response merespons HTTP 200 OK dengan payload {"status": "SUCCESS", "updated_rows": 1, "data": {"category": "SERVICE", "country": "ID", "base_price": 300, "effective_at": "2026-10-01T00:00:00Z"}}.
  2. [DB] Record tersimpan di tabel meta_base_prices dengan base_price = 300, status 'ACTIVE', dan effective_at tersimpan sesuai timestamp UTC.

---

### API-PRIC-GEN-POS-002: Verifikasi penetapan General Markup Price untuk seluruh pengguna `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-01: General Markup Price (Covers: AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Base Price Meta SERVICE = Rp 300 sudah aktif di DB.
  2. Akun merchant USR-STD-001 tidak memiliki custom markup.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Siapkan payload general markup: {"category": "SERVICE", "country": "ID", "markup_price": 150, "effective_at": "2026-10-01T00:00:00Z"}.
  2. [Act] Kirim request POST /api/v1/admin/pricing/general dan request POST /api/v1/messages/estimate-rate untuk user USR-STD-001.
  3. [Assert] Verifikasi perhitungan tarif pesan dan persistensi record.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Endpoint estimate-rate merespons HTTP 200 OK dengan {"category": "SERVICE", "base_price": 300, "markup_price": 150, "final_rate": 450, "pricing_source": "GENERAL"}.
  2. [DB] Record tersimpan di tabel general_markups dan audit_logs mencatat event SET_GENERAL_MARKUP.

---

### API-PRIC-CUST-POS-003: Verifikasi Custom Markup Price memprioritaskan override General Markup `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-01: Customizable Pricing (Covers: AC-3)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. General markup MARKETING = Rp 250, Base Price = Rp 650.
  2. User USR-VIP-001 memiliki custom markup MARKETING = Rp 100.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Pastikan user USR-VIP-001 memiliki custom markup Rp 100 dan user umum USR-STD-001 menggunakan general markup Rp 250.
  2. [Act] Kirim request POST /api/v1/messages/estimate-rate dengan payload {"user_id": "USR-VIP-001", "category": "MARKETING", "country": "ID"}.
  3. [Assert] Verifikasi response kalkulasi tarif dan sumber harga yang diterapkan.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Response merespons HTTP 200 OK dengan {"base_price": 650, "markup_price": 100, "final_rate": 750, "pricing_source": "CUSTOM", "applied_user_id": "USR-VIP-001"}.
  2. [DB] Query pricing engine mengembalikan custom record dari user_custom_markups dan tidak melakukan fallback ke general_markups.

---

### API-PRIC-TIME-BVA-004: Verifikasi Boundary Timestamp Pergantian Harga (Relative Timestamp Seeding) `[Auto-Critical]` `[High-Complexity]`
- **User Story**: [Priority: Critical] US-01: Pricing Configuration & Activation (Covers: AC-4)
- **Tipe**: Boundary / Boundary
- **Precondition**:
  1. Akses DB untuk seeding fixture pricing.
  2. Record A (Old Rate = 300) dan Record B (New Rate = 400).
- **Test Steps (Structured AAA)**:
  1. [Arrange] Seed Record A (base_price = 300, effective_at = now() - 10 days) dan Record B (base_price = 400, effective_at = now() + 1 hour).
  2. [Act - Step 1] Request POST /api/v1/messages/estimate-rate sebelum boundary transition.
  3. [Act - Step 2] Update relative timestamp Record B menjadi effective_at = now() - 1 minute (simulasi pasca boundary transition) dan request estimate-rate ulang.
  4. [Assert] Evaluasi tarif pada kedua pemanggilan.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API - Step 1] HTTP 200 OK dengan final_rate = 300 (pricing_version: 'OLD_RATE').
  2. [API - Step 2] HTTP 200 OK dengan final_rate = 400 (pricing_version: 'NEW_RATE').
  3. [DB] Query SELECT * FROM meta_base_prices WHERE effective_at <= NOW() ORDER BY effective_at DESC LIMIT 1 mengambil Record B secara deterministik.

---

### API-PRIC-RND-POS-005: Verifikasi pembulatan harga ke atas (Ceil Rounding) mata uang IDR `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-01: Pricing Currency & Rounding (Covers: AC-5)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Base price desimal = Rp 320,50 dan markup = Rp 79,25 (Total raw = Rp 399,75).
- **Test Steps (Structured AAA)**:
  1. [Arrange] Set konfigurasi pricing dengan komponen desimal: Base Price = 320.50, Markup = 79.25.
  2. [Act] Kirim request POST /api/v1/messages/estimate-rate untuk kalkulasi tarif per broadcast IDR.
  3. [Assert] Verifikasi nilai output kalkulasi dan tipe data amount.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Response HTTP 200 OK menghasilkan {"raw_rate": 399.75, "final_rate": 400, "currency": "IDR", "rounding_mode": "CEIL"}.
  2. [DB] Nilai yang dipotong pada payment ledger adalah integer 400 tanpa angka pecahan desimal.

---

### JOB-PRIC-AUDT-POS-006: Verifikasi sinkronisasi perubahan harga dan pencatatan audit log `[Auto-Normal]` `[Low-Complexity]`
- **User Story**: [Priority: Normal] US-01: Audit Log Configuration (Covers: AC-6)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Sesi Biz Ops Admin ADMIN-OPS-007 aktif.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Siapkan batch payload pembaruan 4 kategori tarif pesan oleh ADMIN-OPS-007.
  2. [Act] Eksekusi endpoint batch POST /api/v1/admin/pricing/batch-update.
  3. [Assert] Query tabel pricing_audit_logs.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Endpoint merespons HTTP 200 OK dengan {"status": "SUCCESS", "processed_items": 4}.
  2. [DB] Tabel pricing_audit_logs mencatat 4 baris baru dengan detail actor_id = 'ADMIN-OPS-007', previous_price, new_price, action = 'UPDATE_BASE_PRICE', dan timestamp UTC.

---

## Modul 2: Eksekusi Broadcast & Saldo Terkunci (Broadcast Execution & Deduction)

### WEB-BRD-ISOL-POS-007: Verifikasi pembuatan broadcast dengan deduksi saldo nominal dan isolasi pesan `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-02: Broadcast Execution & Credit Isolation (Covers: AC-1, AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. User login sebagai Merchant Admin dengan saldo awal Rp 1.000.000.
  2. Berada di dashboard broadcast /broadcast/list.
  3. File CSV contacts_100.csv (100 nomor valid) tersedia.
- **Test Steps (Gherkin BDD)**:
  1. [Given] User berada di /broadcast/list dengan saldo Rp 1.000.000.
  2. [When - Step 1] Klik [+ Buat Broadcast Baru] (#btn-create-broadcast).
  3. [When - Step 2] Pada Wizard Step 1, pilih template 'Promo Diskon Gajian' (Kategori: MARKETING, Rp 750/pesan).
  4. [When - Step 3] Pada Wizard Step 2, upload CSV contacts_100.csv (100 penerima).
  5. [When - Step 4] Pada Wizard Step 3, pilih opsi radio 'Kirim Sekarang'.
  6. [When - Step 5] Pada Wizard Step 4 (Review), periksa ringkasan 'Total Estimasi: Rp 75.000' lalu klik [Kirim Broadcast] (#btn-submit-broadcast) dan konfirmasi modal [Ya, Eksekusi].
- **Expected Results (Triple-Layer Assertions)**:
  1. [Then - UI] Modal tertutup, muncul toast alert hijau: 'Broadcast berhasil dibuat dan sedang diproses', dan tabel menampilkan baris baru dengan badge [Processing].
  2. [Then - UI] Widget saldo di header terpotong real-time dari Rp 1.000.000 menjadi Rp 925.000.
  3. [And - API] POST /api/v1/broadcasts merespons HTTP 201 Created dengan {"broadcast_id": "BRD-9001", "total_contacts": 100, "locked_credits": 75000, "status": "PROCESSING"}.
  4. [And - DB] Saldo di tabel wallets berkurang Rp 75.000 dan tercatat 100 record di broadcast_recipients dengan status 'LOCKED'.

---

### WEB-BRD-PART-NEG-008: Verifikasi penanganan broadcast saat saldo tidak mencukupi untuk seluruh penerima `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] US-02: Insufficient Balance Handling (Covers: AC-3)
- **Tipe**: Negative / Negative
- **Precondition**:
  1. User login dengan saldo Rp 30.000 (hanya cukup untuk 40 pesan @ Rp 750).
  2. Berada di form wizard /broadcast/create.
- **Test Steps (Gherkin BDD)**:
  1. [Given] User berada di wizard /broadcast/create dengan saldo Rp 30.000.
  2. [When - Step 1] Pilih template MARKETING (@ Rp 750).
  3. [When - Step 2] Upload CSV contacts_100.csv (100 penerima, kebutuhan biaya = Rp 75.000).
  4. [When - Step 3] Klik [Lanjut ke Review].
- **Expected Results (Triple-Layer Assertions)**:
  1. [Then - UI] Wizard terkunci di Step Review dengan error banner merah: 'Saldo kredit tidak mencukupi. Dibutuhkan Rp 75.000, saldo Anda Rp 30.000'.
  2. [Then - UI] Tombol CTA [Kirim Broadcast] berstatus disabled dan muncul CTA sekunder [Top Up Saldo].
  3. [And - API] POST /api/v1/broadcasts/validate merespons HTTP 422 Unprocessable Entity dengan error code 'INSUFFICIENT_CREDITS'.
  4. [And - DB] Saldo di tabel wallets tetap utuh Rp 30.000 tanpa mutasi.

---

## Modul 3: Mekanisme Rollback & Failure Handling (Rollback & Failure Recovery)

### API-ROLL-FAIL-POS-009: Verifikasi refund saldo saat menerima webhook status Failed dari Meta `[Auto-Critical]` `[High-Complexity]`
- **User Story**: [Priority: Critical] US-03: Failed Message Credit Rollback (Covers: AC-1)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Pesan broadcast MSG-BC-8801 berstatus 'SENT', saldo terpotong Rp 750, wamid = 'wamid.HBgL12345'.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Siapkan payload webhook WhatsApp failed: {"object": "whatsapp_business_account", "entry": [{"changes": [{"value": {"statuses": [{"id": "wamid.HBgL12345", "status": "failed", "timestamp": "1726050000", "recipient_id": "6281299990001", "errors": [{"code": 131026, "title": "Message undeliverable"}]}]}}]}]}.
  2. [Act] Kirim request internal webhook POST /api/v1/webhooks/whatsapp dengan payload tersebut.
  3. [Assert] Query API mutasi saldo dan status pesan.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Webhook endpoint merespons HTTP 200 OK ({"status": "EVENT_RECEIVED"}).
  2. [DB] Status record di broadcast_recipients terupdate menjadi 'FAILED' dengan error code 131026.
  3. [DB] Saldo merchant di wallets bertambah kembali + Rp 750 dengan transaction_type = 'CREDIT_REFUND' dan reference_id = 'wamid.HBgL12345'.

---

### JOB-ROLL-RD-POS-010: Verifikasi status Delivered dari Meta mengunci kredit secara permanen (No Rollback) `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-03: Delivered Message Credit Settlement (Covers: AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Pesan MSG-BC-8802 berstatus 'SENT', saldo terpotong Rp 750, wamid = 'wamid.HBgL12346'.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Siapkan payload webhook WhatsApp delivered: {"statuses": [{"id": "wamid.HBgL12346", "status": "delivered", "timestamp": "1726050005"}]}.
  2. [Act] Inject payload webhook ke POST /api/v1/webhooks/whatsapp.
  3. [Assert] Query record broadcast_recipients dan wallet ledger.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Webhook merespons HTTP 200 OK.
  2. [DB] Status pesan berubah menjadi 'DELIVERED'.
  3. [DB] Saldo wallet tidak mengalami penambahan refund (refund_amount = 0), dan transaksi terkunci dengan status 'SETTLED'.

---

### API-ROLL-LATE-NEG-011: Verifikasi webhook status Delivered yang datang setelah refund (Late Webhook Idempotency) `[Auto-Normal]` `[High-Complexity]`
- **User Story**: [Priority: Normal] US-03: Late Delivery Handling (Covers: AC-3)
- **Tipe**: Negative / Negative
- **Precondition**:
  1. Pesan MSG-BC-8803 sudah berstatus 'FAILED' dan kredit Rp 750 telah di-refund ke merchant 2 jam lalu.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Siapkan payload webhook late delivered untuk wamid.HBgL12347 (pesan sudah pernah di-refund).
  2. [Act] Kirim request POST /api/v1/webhooks/whatsapp dengan payload delivered tersebut.
  3. [Assert] Verifikasi idempotency handler pada server log dan DB.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Webhook handler memproses idempotently dan mengembalikan HTTP 200 OK dengan warning log: 'Late delivered event received for already refunded message'.
  2. [DB] Sistem TIDAK melakukan pemotongan saldo ulang (mencegah silent double deduction).
  3. [DB] Saldo merchant tetap utuh dan audit log mencatat anomali late status update.

---

### JOB-ROLL-RECON-POS-012: Verifikasi job rekonsiliasi berkala untuk pesan berstatus menggantung (Stuck in Sent) `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] US-03: Reconciliation Cron Job (Covers: AC-4)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Seed 5 record pesan berstatus 'SENT' dengan sent_at = now() - 25 hours di database.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Pastikan 5 record pesan menggantung > 24 jam tersedia di tabel broadcast_recipients.
  2. [Act] Trigger cron reconciliation command via CLI: python -m jobs.reconcile_broadcast_status --timeout-hours=24.
  3. [Assert] Evaluasi return code CLI dan state tabel database.
- **Expected Results (Triple-Layer Assertions)**:
  1. [CLI/JOB] Worker selesai dengan exit code 0 dan output: 'Reconciled 5 stuck messages -> Status updated to TIMEOUT_FAILED, 5 refunds executed'.
  2. [DB] 5 record pesan terupdate statusnya menjadi 'TIMEOUT_FAILED'.
  3. [DB] Saldo merchant ter-refund otomatis sebesar total nilai 5 pesan tersebut di tabel wallet_transactions.

---

## Modul 4: Free Entry Point (FEP) & Sesi Bebas Biaya (FEP & Zero-Cost Messaging)

### WEB-FEP-WIN-POS-013: Verifikasi identifikasi jendela 72 jam FEP aktif dan penandaan biaya Rp 0 pada UI Chatroom `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-04: FEP 72-Hour Window & UI Tagging (Covers: AC-1, AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Sesi customer dari WhatsApp Ad (CTWA) aktif dengan fep_expires_at = now() + 71 hours.
  2. User login sebagai Agent/Admin.
- **Test Steps (Gherkin BDD)**:
  1. [Given] Sesi FEP aktif untuk chatroom CR-FEP-001 dengan sisa waktu 71 jam.
  2. [When] User membuka direct URL /chatrooms/CR-FEP-001 atau memfilter chat list dengan label 'Free Entry Point'.
  3. [Then] Periksa tampilan visual header chatroom dan input bubble area.
- **Expected Results (Triple-Layer Assertions)**:
  1. [Then - UI] Header chatroom menampilkan visual badge toska: [Free Entry Point Active] dengan countdown '71h 58m tersisa'.
  2. [Then - UI] Di atas input box chat tampil label info: 'Tarif Pesan: Rp 0 (Bebas Biaya Meta)'.
  3. [And - API] GET /api/v1/chatrooms/CR-FEP-001 mengembalikan {"fep_active": true, "fep_expires_at": "...", "rate_per_message": 0}.
  4. [And - DB] Kolom fep_session_status pada chat_sessions bernilai 'ACTIVE'.

---

### WEB-FEP-SEND-POS-014: Verifikasi pengiriman pesan dalam jendela FEP tidak memotong saldo kredit merchant `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-04: Zero Deduction in FEP Window (Covers: AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Berada di dalam chatroom aktif /chatrooms/CR-FEP-001 dengan saldo wallet Rp 500.000.
- **Test Steps (Gherkin BDD)**:
  1. [Given] User berada di chatroom FEP aktif /chatrooms/CR-FEP-001 dengan saldo Rp 500.000.
  2. [When - Step 1] Ketik pesan: 'Halo, terima kasih telah menghubungi kami dari iklan promo!'.
  3. [When - Step 2] Klik tombol kirim [Send] (#btn-send-message).
  4. [Then] Periksa saldo di navbar dan status pesan di bubble chat.
- **Expected Results (Triple-Layer Assertions)**:
  1. [Then - UI] Pesan muncul di bubble chat dengan status checklist delivered.
  2. [Then - UI] Indikator saldo di header navbar TETAP Rp 500.000 (tidak berkurang).
  3. [And - API] POST /api/v1/chatrooms/CR-FEP-001/messages merespons HTTP 200 OK dengan payload {"message_id": "MSG-FEP-101", "deducted_credits": 0, "is_fep": true}.
  4. [And - DB] Record chat_messages tersimpan dengan cost = 0, is_fep = TRUE, dan tidak ada mutasi debit di wallet_transactions.

---

### API-FEP-EXP-BVA-015: Verifikasi Boundary Transisi Kadaluarsa Jendela FEP (Relative Timestamp Seeding) `[Auto-High]` `[High-Complexity]`
- **User Story**: [Priority: High] US-04: FEP Expiry Boundary (Covers: AC-3)
- **Tipe**: Boundary / Boundary
- **Precondition**:
  1. Sesi A: FEP aktif dengan fep_expires_at = now() + 1 minute.
  2. Sesi B: FEP expired dengan fep_expires_at = now() - 1 minute.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Setup Sesi A (fep_expires_at = now() + 1m) dan Sesi B (fep_expires_at = now() - 1m) di tabel chat_sessions.
  2. [Act] Kirim pesan ke Sesi A via POST /api/v1/chatrooms/CR-FEP-A/messages dan ke Sesi B via POST /api/v1/chatrooms/CR-FEP-B/messages.
  3. [Assert] Bandingkan deducted_credits pada kedua response API.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API - Sesi A] HTTP 200 OK, deducted_credits = 0, is_fep = true.
  2. [API - Sesi B] HTTP 200 OK, deducted_credits = 300 (tarif normal Service message), is_fep = false.
  3. [DB] Sesi B mencatat mutasi debit Rp 300 di wallet_transactions dan status sesi terupdate menjadi 'EXPIRED'.

---

### API-FEP-TEMP-POS-016: Verifikasi pengiriman Template Marketing di dalam sesi FEP tetap gratis `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] US-04: Marketing Template within FEP (Covers: AC-4)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Sesi FEP aktif untuk customer 6281234567890.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Pastikan customer 6281234567890 terasosiasi dengan sesi FEP aktif.
  2. [Act] Kirim template pesan kategori MARKETING melalui POST /api/v1/messages/send-template.
  3. [Assert] Verifikasi response payload dan persistensi audit billing.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] HTTP 200 OK dengan payload {"status": "SENT", "category": "MARKETING", "billed_cost": 0, "fep_override": true}.
  2. [DB] Record chat_messages mencatat template terkirim dengan cost = 0 dan flag fep_override = TRUE.

---

## Modul 5: Monitoring Pengeluaran & Peringatan Saldo (Credit Threshold & Alerts)

### API-ALRT-DEF-POS-017: Verifikasi default threshold batas pengeluaran berlaku untuk seluruh user `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-05: Global Default Credit Threshold (Covers: AC-1)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Konfigurasi DEFAULT_LOW_CREDIT_THRESHOLD = 50000 aktif di DB.
  2. Akun merchant USR-NEW-001 baru terdaftar.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Kurangi saldo USR-NEW-001 hingga bernilai Rp 49.000 (< Rp 50.000).
  2. [Act] Panggil endpoint evaluator threshold POST /api/v1/wallets/check-threshold.
  3. [Assert] Query notifikasi in-app untuk USR-NEW-001.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Evaluator merespons {"is_low_balance": true, "threshold_applied": 50000, "current_balance": 49000}.
  2. [DB] Record notifikasi low balance terbentuk di in_app_notifications dengan pesan 'Saldo Anda berada di bawah batas minimum Rp 50.000'.

---

### WEB-ALRT-POP-POS-018: Verifikasi in-app pop-up / modal warning saat saldo mendekati batas minimum `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] US-05: Low Balance Modal Trigger (Covers: AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. User login dengan saldo Rp 45.000 (threshold default = Rp 50.000).
- **Test Steps (Gherkin BDD)**:
  1. [Given] User memiliki saldo Rp 45.000.
  2. [When] User mengakses halaman /broadcast/list atau /chatrooms.
  3. [Then] Periksa modal pop-up dialog dan navbar badge.
- **Expected Results (Triple-Layer Assertions)**:
  1. [Then - UI] Muncul modal dialog kuning: 'Peringatan: Saldo Kredit Menipis!' berisi rincian 'Sisa Saldo: Rp 45.000. Segera lakukan top-up agar broadcast tidak terhenti'.
  2. [Then - UI] Terdapat tombol CTA [Top Up Sekarang] dan tombol [Nanti Saja], serta icon saldo di navbar berkedip oranye [Low Balance Warning].
  3. [And - API] GET /api/v1/user/notifications/unread mengembalikan item tipe LOW_BALANCE_ALERT.
  4. [And - DB] Kolom alert_shown_at di user_notification_states terupdate timestamp sekarang.

---

### JOB-ALRT-MAIL-POS-019: Verifikasi pengiriman email alert otomatis saat saldo mencapai threshold `[Auto-Normal]` `[Medium-Complexity]`
- **User Story**: [Priority: Normal] US-05: Automated Email Notification (Covers: AC-3)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Saldo merchant USR-STD-002 (email: merchant@store.com) bernilai Rp 20.000 (< Rp 50.000).
- **Test Steps (Structured AAA)**:
  1. [Arrange] Pastikan merchant USR-STD-002 berstatus low balance dan belum menerima email dalam 24 jam terakhir.
  2. [Act] Eksekusi worker CLI: python -m jobs.send_low_balance_emails.
  3. [Assert] Periksa email queue dan tabel email_logs.
- **Expected Results (Triple-Layer Assertions)**:
  1. [JOB] Worker selesai dengan 1 email dispatched ke provider SMTP/SendGrid.
  2. [DB] Record tersimpan di tabel email_logs dengan recipient = 'merchant@store.com', subject = 'Peringatan Saldo Everpro Chat Menipis', status = 'SENT'.

---

### WEB-ALRT-DISM-POS-020: Verifikasi fungsionalitas dismiss alert dan banner reminder persistent `[Auto-Low]` `[Low-Complexity]`
- **User Story**: [Priority: Low] US-05: Alert Dismissal & Persistent Banner (Covers: AC-4)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Modal dialog low balance sedang terbuka di layar.
- **Test Steps (Gherkin BDD)**:
  1. [Given] Modal low balance aktif di layar.
  2. [When] User mengklik tombol [Nanti Saja] (#btn-dismiss-alert) atau ikon close (X).
  3. [Then] Navigasi ke halaman lain dan amati UI.
- **Expected Results (Triple-Layer Assertions)**:
  1. [Then - UI] Modal dialog tertutup seketika dan tidak muncul kembali saat berpindah rute halaman selama sesi aktif.
  2. [Then - UI] Banner info kuning persistent berukuran ramping tetap menempel di header: '⚠️ Saldo Anda Rp 45.000. Klik di sini untuk Top Up'.
  3. [And - Client] State lowBalanceModalDismissed = true tersimpan di sessionStorage.

---

### API-ALRT-EDGE-BVA-021: Verifikasi Boundary Nilai Saldo Tepat pada Threshold (Saldo == 50.000 vs 49.999) `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-05: Exact Threshold Boundary (Covers: AC-5)
- **Tipe**: Boundary / Boundary
- **Precondition**:
  1. Threshold default = Rp 50.000.
  2. User X saldo = Rp 50.000. User Y saldo = Rp 49.999.
- **Test Steps (Structured AAA)**:
  1. [Arrange] Setup User X (saldo 50.000) dan User Y (saldo 49.999).
  2. [Act] Panggil POST /api/v1/wallets/evaluate-threshold untuk kedua user.
  3. [Assert] Bandingkan response payload evaluasi.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Response User X: {"alert_triggered": false, "status": "NORMAL"}.
  2. [API] Response User Y: {"alert_triggered": true, "status": "LOW_BALANCE"}.
  3. [DB] Record notifikasi hanya terbentuk untuk User Y di in_app_notifications.

---

## Modul 6: Concurrency, Security & Exploratory Charters (Security & Exploratory)

### API-CONC-RACE-CON-022: Verifikasi Concurrency & Race Condition saat Eksekusi Simultan Menguras Saldo Terakhir `[Auto-Critical]` `[High-Complexity]`
- **User Story**: [Priority: Critical] US-02: Balance Locking & Concurrency (Covers: AC-2, NFR-Integrity)
- **Tipe**: Concurrency / Concurrency
- **Precondition**:
  1. User USR-RACE-001 memiliki sisa saldo tepat Rp 750 (hanya cukup 1 pesan).
- **Test Steps (Structured AAA)**:
  1. [Arrange] Set saldo USR-RACE-001 = Rp 750.
  2. [Act] Tembak 2 request paralel POST /api/v1/broadcasts pada timestamp milidetik yang sama untuk pesan @ Rp 750.
  3. [Assert] Periksa HTTP response dari kedua request dan saldo akhir database.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Request 1 sukses dengan HTTP 201 Created ({"status": "SUCCESS"}).
  2. [API] Request 2 gagal dengan HTTP 422 Unprocessable Entity ({"error": "INSUFFICIENT_CREDITS"}) atau HTTP 409 Conflict.
  3. [DB] Saldo akhir wallet tepat Rp 0 (TIDAK PERNAH bernilai negatif - Rp 750), dan mutasi tercatat tepat 1 baris.

---

### API-SEC-TAMPR-SEC-023: Verifikasi Security & Authorization: Upaya Manipulasi Harga atau IDOR pada Endpoint Broadcast `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-01 & US-02: Pricing Integrity & RBAC (Covers: NFR-Security)
- **Tipe**: Security / Security
- **Precondition**:
  1. User role Merchant Admin (bukan Biz Ops).
- **Test Steps (Structured AAA)**:
  1. [Arrange] Siapkan payload broadcast dengan manipulasi tarif buatan: {"template_id": "TMP-01", "custom_rate": 0, "category": "MARKETING"}.
  2. [Act] Kirim request POST /api/v1/broadcasts dengan payload tersebut.
  3. [Assert] Evaluasi kalkulasi pemotongan saldo pada database.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Backend mengabaikan field custom_rate client-side atau merespons HTTP 400 Bad Request / 403 Forbidden.
  2. [DB] Sistem tetap menghitung biaya dari master database pricing (Rp 750), saldo terpotong sesuai tarif resmi, dan audit log security mencatat upaya tampering.

---

### E2E-EXP-FEDEX-EXP-024: Exploratory Charter: The FedEx Tour (Melacak Lifecycle Saldo & Mutasi dari Broadcast hingga Webhook) `[Auto-Normal]` `[High-Complexity]`
- **User Story**: [Priority: High] US-02 & US-03: End-to-End Data Lifecycle (Covers: NFR-Reliability)
- **Tipe**: Exploratory / Positive
- **Precondition**:
  1. Saldo awal merchant Rp 500.000.
  2. Berada di /broadcast/create.
- **Test Steps (Gherkin BDD)**:
  1. [Given] User membuat broadcast 10 nomor (@ Rp 750, total Rp 7.500) dari /broadcast/create.
  2. [When - Step 1] Saldo terpotong Rp 7.500 saat inisiasi.
  3. [When - Step 2] Sistem mengirim pesan ke Meta API.
  4. [When - Step 3] Inject webhook Meta: 8 pesan status 'delivered' dan 2 pesan status 'failed'.
  5. [When - Step 4] User membuka halaman /billing/history dan /broadcast/detail/BRD-FEDEX-01.
- **Expected Results (Triple-Layer Assertions)**:
  1. [Then - UI] Halaman detail broadcast menampilkan statistik: Terkirim: 8, Gagal: 2.
  2. [Then - UI] Mutasi saldo di /billing/history menampilkan kredit refund: + Rp 1.500 dengan keterangan 'Refund Broadcast BRD-FEDEX-01'.
  3. [And - DB] Saldo akhir terpotong bersih Rp 6.000 (8 x Rp 750), tabel wallet_transactions memiliki 1 baris debit Rp 7.500 dan 1 baris refund kredit Rp 1.500.

---

### E2E-EXP-CHAOS-EXP-025: Exploratory Charter: The Chaos / Network Drop Tour saat Eksekusi Broadcast Berjalan `[Auto-Normal]` `[High-Complexity]`
- **User Story**: [Priority: Normal] US-02: Network Resilience (Covers: NFR-Resilience)
- **Tipe**: Exploratory / Positive
- **Precondition**:
  1. Form wizard broadcast 50 kontak siap di-submit.
- **Test Steps (Gherkin BDD)**:
  1. [Given] User berada pada modal konfirmasi broadcast di /broadcast/create (50 penerima).
  2. [When - Step 1] Klik [Konfirmasi Kirim].
  3. [When - Step 2] Tepat saat spinner berputar (< 100ms), simulasikan pemutusan koneksi internet (Network Offline).
  4. [When - Step 3] Sambungkan kembali internet setelah 15 detik dan refresh halaman (F5).
- **Expected Results (Triple-Layer Assertions)**:
  1. [Then - UI] Saat offline, muncul toast peringatan: 'Koneksi terputus. Memeriksa status transaksi...'.
  2. [Then - UI] Setelah online dan refresh, halaman /broadcast/list menampilkan status broadcast yang valid ([Processing] / [Completed]), bukan duplicate atau error blank.
  3. [And - API] Idempotency Key pada header X-Idempotency-Key mencegah server memproses request broadcast dua kali.
  4. [And - DB] Saldo wallet hanya dipotong tepat 1 kali untuk 50 pesan.

---
