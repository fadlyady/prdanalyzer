# Automation & QA Master Test Case Suite: Meta New Pricing 2026

Dokumen ini berisi seluruh skenario pengujian komprehensif (*Master Test Case Suite*) yang diturunkan langsung dari [PRD_Analysis_Meta_New_Pricing_2026.md](file:///Users/fadlyady/Documents/Eldo%20Work/eldoTest/result-testcase/PRD_Analysis_Meta_New_Pricing_2026.md). Format disusun secara deklaratif bernomor (*Action $\rightarrow$ Triple-Layer Assertion*) lengkap dengan **Tagging Prioritas & Kompleksitas Otomasi** untuk framework otomasi (Playwright, Cypress, Pytest, Appium).

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
  1. Akses database / internal API pricing aktif.
  2. Kategori pesan dan kode negara recipient valid.
- **Test Steps**:
  1. Kirim request update base price untuk `category = 'SERVICE'`, `country = 'ID'`, `base_price = 300`, `effective_at = '2026-10-01 00:00:00 UTC'`.
  2. Query tabel `meta_base_prices`.
  3. Periksa nilai kolom `base_price` dan `effective_at`.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Response merespons HTTP `200 OK` dengan payload `{ "status": "SUCCESS", "updated_rows": 1 }`.
  2. [DB] Record tersimpan dengan `base_price = 300` dan status `'ACTIVE'`.
  3. [DB] Kolom `effective_at` tersimpan sesuai timestamp UTC yang ditentukan.

---

### API-PRIC-GEN-POS-002: Verifikasi penetapan General Markup Price untuk seluruh pengguna `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-01: General Markup Price (Covers: AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Data Base Price Meta sudah ada di DB (`SERVICE` = Rp 300).
  2. Akun merchant umum tidak memiliki custom markup.
- **Test Steps**:
  1. Update general markup: `category = 'SERVICE'`, `country = 'ID'`, `markup_price = 150`, `effective_at = '2026-10-01 00:00:00 UTC'`.
  2. Hit API estimasi biaya pesan untuk user general.
  3. Verifikasi total tarif pesan yang dihitung oleh sistem.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] General markup tersimpan di tabel `general_markups`.
  2. [API] Estimasi tarif pesan = Base Price (300) + Markup (150) = `Rp 450` (bulat ke atas).
  3. [DB] Audit log mencatat konfigurasi general markup baru oleh aktor terkait.

---

### API-PRIC-CUST-POS-003: Verifikasi Custom Markup Price memprioritaskan override General Markup `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-01: Customizable Pricing (Covers: AC-3)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. General markup = Rp 150.
  2. Custom markup untuk `user_id = 'USR-VIP-001'` diset = Rp 100.
- **Test Steps**:
  1. Kirim pesan dari akun `'USR-VIP-001'`.
  2. Cek nilai pemotongan saldo / isolasi kredit.
  3. Bandingkan dengan pengiriman dari akun reguler `'USR-REG-002'`.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Tarif pesan untuk USR-VIP-001 = Rp 300 + Rp 100 = `Rp 400`.
  2. [API] Tarif pesan untuk USR-REG-002 = Rp 300 + Rp 150 = `Rp 450`.
  3. [DB] Custom markup memprioritaskan override general markup 100%.

---

### API-PRIC-DATE-BVA-004: Boundary Test: Penegakan tanggal efektif (`effective_at`) pada pricing `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] US-01: Pricing Effective Date (Covers: AC-1, AC-2, AC-3)
- **Tipe**: Boundary / BVA
- **Precondition**:
  1. Tarif lama = Rp 400.
  2. Tarif baru = Rp 500 dengan `effective_at = '2026-10-01 00:00:00 UTC'`.
- **Test Steps**:
  1. Kirim pesan pada waktu T-1 detik (`2026-09-30 23:59:59 UTC`).
  2. Kirim pesan pada waktu T (`2026-10-01 00:00:00 UTC`).
  3. Verifikasi pemotongan saldo pada kedua transaksi.
- **Expected Results (Triple-Layer Assertions)**:
  1. [DB] Transaksi T-1 dipotong tarif lama (`Rp 400`).
  2. [DB] Transaksi T dipotong tarif baru (`Rp 500`).
  3. [UI] Log mutasi saldo mencatat tarif yang tepat per masing-masing timestamp.

---

### API-PRIC-AUDT-POS-005: Verifikasi pencatatan Audit Log saat terjadi perubahan harga `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-01: Price Change Audit Logging (Covers: AC-4)
- **Tipe**: Security / Audit
- **Precondition**:
  1. Biz Ops Admin melakukan update data harga via backend API.
- **Test Steps**:
  1. Eksekusi update harga custom untuk `user_id = 'USR-123'`.
  2. Query tabel `pricing_change_logs`.
- **Expected Results (Triple-Layer Assertions)**:
  1. [DB] Record log terbentuk dengan kolom lengkap: `actor_id`, `new_price`, `category`, `country`, `user_id`, `valid_from`.
  2. [DB] Timestamp log akurat sesuai waktu modifikasi UTC.

---

## Modul 2: Eksekusi Pengiriman Pesan & Siklus Kredit (Delivery & Credit Lifecycle)

### WEB-BRD-FEP-POS-006: Verifikasi pengiriman pesan dalam Free Entry Point (FEP) Window tidak memotong kredit `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-02: Free Entry Point Window (Covers: AC-1)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Customer melakukan inbound chat via CTWA ad.
  2. Sesi FEP Window aktif pada room percakapan.
- **Test Steps**:
  1. Buka Chatroom pelanggan dengan flag FEP aktif.
  2. Kirim pesan template Marketing.
  3. Kirim pesan Service.
  4. Cek saldo utama WhatsApp Credit.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Pesan terkirim sukses tanpa loading isolasi kredit.
  2. [API] Request kirim pesan menyertakan flag `is_fep = true`.
  3. [DB] Tidak ada record pemotongan saldo / mutasi kredit (Biaya `Rp 0`).
  4. [UI] Saldo kredit akun tetap tidak berkurang.

---

### JOB-BRD-ISOL-POS-007: Verifikasi Credit Isolation saat broadcast dijadwalkan dan dieksekusi `[Auto-Critical]` `[High-Complexity]`
- **User Story**: [Priority: Critical] US-02: Credit Isolation (Covers: AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Saldo utama = Rp 100.000.
  2. Target broadcast = 100 nomor (tarif Rp 450/pesan, total Rp 45.000).
- **Test Steps**:
  1. Buat jadwal broadcast untuk 100 nomor pada jam T.
  2. Saat jam T tiba, amati status pemotongan saldo.
  3. Periksa tabel `credit_isolations`.
  4. Tunggu delivery receipt dari Meta.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Status campaign berubah menjadi `'Processing'`.
  2. [DB] Saldo terisolasi sebesar `Rp 45.000` (sisa saldo aktif Rp 55.000).
  3. [DB] 100 record isolasi terbentuk dengan status `'ISOLATED'`.
  4. [API] Request outbound dikirim ke Meta API.

---

### WEB-BRD-PART-NEG-008: Verifikasi penanganan broadcast saat saldo parsial (hanya cukup sebagian target) `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] US-02: Partial Balance Broadcast Handling (Covers: AC-2)
- **Tipe**: Negative / Resiliency
- **Precondition**:
  1. Sisa saldo utama = Rp 27.000.
  2. Target broadcast = 100 nomor @ Rp 450 (kebutuhan Rp 45.000).
- **Test Steps**:
  1. Eksekusi pengiriman broadcast 100 nomor.
  2. Amati proses isolasi dan pengiriman.
  3. Periksa detail log pengiriman per nomor penerima.
  4. Cek sisa saldo akhir.
- **Expected Results (Triple-Layer Assertions)**:
  1. [DB] Sistem mengisolasi dan mengirim 60 pesan (60 x Rp 450 = `Rp 27.000`).
  2. [DB] 40 nomor sisanya berstatus `'FAILED_INSUFFICIENT_BALANCE'`.
  3. [UI] Dashboard Broadcast menampilkan status: `'Completed (60 Sent, 40 Failed - Saldo Kurang)'`.
  4. [DB] Saldo utama menjadi `Rp 0` dan tidak bernilai minus.

---

### API-ROLL-FAIL-POS-009: Verifikasi otomatis Credit Rollback saat menerima status Failed dari Meta `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-02: Credit Rollback (Covers: AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Pesan telah terisolasi Rp 450.
  2. Webhook Meta mengembalikan status failed (error code 131026 / receiver unreachable).
- **Test Steps**:
  1. Kirim webhook status `'failed'` dari Meta untuk `message_id = 'MSG-999'`.
  2. Cek mutasi saldo pada tabel `credit_transactions`.
  3. Periksa saldo utama akun.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Webhook handler memproses event failed dan merespons `200 OK`.
  2. [DB] Status isolasi berubah menjadi `'ROLLED_BACK'`.
  3. [DB] Saldo akun bertambah kembali sebesar `Rp 450`.
  4. [UI] Riwayat mutasi mencatat tipe `'ROLLBACK_REFUND'`.

---

### JOB-ROLL-RDED-POS-010: Resiliency Test: Re-deduct saldo saat webhook Delivered tiba terlambat setelah Rollback `[Auto-High]` `[High-Complexity]`
- **User Story**: [Priority: High] US-02: Late Webhook Re-Deduct (Covers: AC-2)
- **Tipe**: Functional / Resiliency
- **Precondition**:
  1. Pesan `MSG-001` sempat di-rollback karena timeout / initial failure.
  2. Saldo akun mencukupi.
- **Test Steps**:
  1. Kirim late webhook `'delivered'` untuk `MSG-001`.
  2. Amati respon webhook handler.
  3. Verifikasi pencatatan transaksi di DB.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Sistem mendeteksi pesan telah di-rollback sebelumnya.
  2. [DB] Sistem memicu transaksi tipe `'RE_DEDUCTION'` sebesar `Rp 450`.
  3. [DB] Saldo utama terpotong Rp 450 dan status final pesan menjadi `'DELIVERED'`.
  4. [UI] Log riwayat kredit mencatat entri re-deduction.

---

### WEB-CUST-NETT-POS-011: Verifikasi Nett Credit Logging dan ekspor data Credit History `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-02: Nett Credit Logging (Covers: AC-3)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Terdapat 10 pesan: 8 delivered (Rp 3.600) dan 2 failed/rolled back (Rp 900).
- **Test Steps**:
  1. Buka halaman WhatsApp Credit > Credit History.
  2. Periksa ringkasan total deducted.
  3. Klik tombol `[Export History]`.
  4. Unduh dan periksa isi file CSV/Excel.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Tampilan total nett credit deduction = `Rp 3.600`.
  2. [API] Request export mengembalikan file spreadsheet valid.
  3. [File] Data export memuat baris transaksi lengkap dengan status final (`DELIVERED` / `ROLLED_BACK`).
  4. [File] Total nett deduction di file sama persis dengan mutasi database.

---

## Modul 3: Tampilan & Batas Kredit Bulanan (Credit Usage & Limits)

### WEB-CUST-MNTH-POS-012: Verifikasi 'Pengeluaran bulan ini' mencakup biaya Service Message per WABA `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-03: Monthly Expense Service Message (Covers: AC-1)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Pengeluaran Marketing = Rp 50.000, Utility = Rp 20.000, Service Message = Rp 30.000.
- **Test Steps**:
  1. Login sebagai Owner / Supervisor.
  2. Buka menu WhatsApp Credit.
  3. Periksa nominal kartu 'Pengeluaran bulan ini' pada nomor WABA terkait.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Kartu 'Pengeluaran bulan ini' menampilkan total `Rp 100.000`.
  2. [API] Endpoint `/api/v1/waba/monthly-expense` mengembalikan breakdown `service_cost = 30000`.
  3. [UI] Breakdown per kategori (Marketing, Utility, Auth, Service) tertampil jelas.

---

### WEB-CUST-LMEX-NEG-013: Verifikasi pemblokiran pengiriman pesan saat Monthly Credit Limit tercapai `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-03: Monthly Credit Limit Exhausted (Covers: AC-2)
- **Tipe**: Negative / Critical
- **Precondition**:
  1. Monthly Credit Limit diset = Rp 100.000.
  2. Akumulasi pengeluaran bulan ini sudah mencapai Rp 100.000.
- **Test Steps**:
  1. Buat broadcast baru atau kirim pesan template di chatroom.
  2. Klik tombol kirim.
  3. Amati respon sistem.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Muncul alert banner / toast error: `'monthly credit limit has exhausted'`.
  2. [API] Request kirim pesan dibatalkan dengan status `422 Unprocessable Entity`.
  3. [DB] Tidak ada isolasi kredit yang dieksekusi dan pesan tidak terkirim.

---

### WEB-CUST-EXPT-POS-014: Verifikasi ekspor Credit History memuat baris Service Message dengan TEMPLATE TYPE='Service' `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-03: Credit History Download Service Type (Covers: AC-3)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Akun telah mengirimkan pesan Service, Marketing, dan Utility.
- **Test Steps**:
  1. Buka menu WhatsApp Credit > Download Usage History.
  2. Pilih periode bulan aktif dan download file.
  3. Buka file hasil ekspor dan filter kolom 'TEMPLATE TYPE'.
- **Expected Results (Triple-Layer Assertions)**:
  1. [File] Terdapat baris data dengan kolom `TEMPLATE TYPE = 'Service'`.
  2. [File] Kolom biaya per pesan tertera akurat sesuai tarif service message.
  3. [File] Baris service message terbedakan secara jelas dari template Marketing, Utility, dan Authentication.

---

## Modul 4: Ongoing Session Cost & Kontrol Limit Chatroom (Chatroom Limits)

### WEB-CHAT-COST-POS-015: Verifikasi tampilan Ongoing Session Cost real-time pada Chatroom Web `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] US-04: Ongoing Session Cost Visibility (Covers: AC-1)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Agent membuka room percakapan aktif.
  2. Sesi chatroom baru dimulai (Ongoing Cost = Rp 0).
- **Test Steps**:
  1. Kirim 1 pesan Service Message (tarif Rp 450).
  2. Amati label 'Biaya Sesi Ini' di header chatroom.
  3. Kirim 1 pesan template Marketing (tarif Rp 600).
  4. Amati perubahan label biaya.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Label biaya sesi langsung berubah menjadi `'Rp 450'`.
  2. [UI] Setelah pesan kedua, label biaya ter-update menjadi `'Rp 1.050'`.
  3. [API] WebSocket / polling mengembalikan total running cost terkini.
  4. [DB] Record sesi percakapan mencatat `running_cost = 1050`.

---

### WEB-CHAT-FLAT-POS-016: Verifikasi Owner/Supervisor dapat mengatur Flat Session Limit di Chatroom `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-04: Flat Session Limit Setting (Covers: AC-2)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Login sebagai Owner / Supervisor.
  2. Buka pengaturan limit chatroom.
- **Test Steps**:
  1. Akses setting Flat Session Limit dari quick-access chatroom.
  2. Masukkan limit baru: `Rp 10.000`.
  3. Klik `[Simpan Pengaturan]`.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Muncul toast sukses: `'Pengaturan limit sesi berhasil disimpan'`.
  2. [API] Request PUT `/api/v1/chatroom/flat-limit` mengembalikan `200 OK` dengan value `10000`.
  3. [DB] Seluruh room aktif menerapkan default limit Rp 10.000.

---

### WEB-CHAT-RBAC-SEC-017: Security Test: Agent tidak memiliki akses untuk mengubah Flat Session Limit utama `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] US-04: RBAC Flat Limit Protection (Covers: AC-2)
- **Tipe**: Security / RBAC
- **Precondition**:
  1. Login sebagai Agent (CS).
  2. Buka dashboard Chatroom Web.
- **Test Steps**:
  1. Periksa header dan sidebar chatroom untuk menu pengaturan limit.
  2. Coba kirim request PUT `/api/v1/chatroom/flat-limit` via Postman/Direct API.
  3. Amati respon sistem.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Tombol/menu pengaturan Flat Session Limit utama tersembunyi (Hidden).
  2. [API] Direct API call menghasilkan response HTTP `403 Forbidden`.
  3. [DB] Nilai flat session limit di database tidak berubah.

---

### WEB-CHAT-BLCK-NEG-018: Verifikasi pemblokiran pengiriman pesan saat Session Cost mencapai limit `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-04: Block Message on Limit Reached (Covers: AC-3)
- **Tipe**: Negative / Critical
- **Precondition**:
  1. Flat Session Limit = Rp 5.000.
  2. Running cost sesi percakapan sudah mencapai Rp 5.000.
- **Test Steps**:
  1. Buka room yang telah mencapai limit Rp 5.000.
  2. Periksa status badge di header chatroom.
  3. Coba ketik dan kirim pesan berbayar baru.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Muncul banner peringatan: `'Batas limit sesi percakapan telah tercapai'`.
  2. [UI] Tombol kirim pesan berbayar berubah menjadi disabled.
  3. [UI] Muncul tombol opsi `[+ Tambah Limit Sesi]`.
  4. [API] Request kirim pesan diblokir dengan status `403 / 422`.

---

### WEB-CHAT-TPUP-POS-019: Verifikasi manual Limit Top-up oleh Agent dengan preset nominal (Rp2k, Rp5k, Rp10k) `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] US-04: Manual Session Limit Top-Up (Covers: AC-4)
- **Tipe**: Functional / Positive
- **Precondition**:
  1. Percakapan berstatus limit-reached (limit Rp 5.000, cost Rp 5.000).
  2. Saldo utama akun mencukupi.
- **Test Steps**:
  1. Buka dropdown `[+ Tambah Limit Sesi]`.
  2. Pilih preset `'Rp 5.000'`.
  3. Klik tombol `[Konfirmasi Tambah Limit]`.
  4. Coba kirim pesan berbayar baru.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Limit sesi baru ter-update menjadi `Rp 10.000`.
  2. [UI] Status banner 'Limit Reached' hilang dan input chat unblocked (aktif kembali).
  3. [API] Endpoint `/api/v1/chatroom/session/top-up` mengembalikan status `200 OK`.
  4. [DB] Audit log mencatat: `agent_id`, `room_id`, `amount = 5000`, timestamp UTC.
  5. [UI] Pesan baru berhasil terkirim.

---

### WEB-CHAT-TPFL-NEG-020: Verifikasi penolakan Top-up saat Saldo Utama WhatsApp Credit akun tidak mencukupi `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] US-04: Top-Up Insufficient Main Balance (Covers: AC-4)
- **Tipe**: Negative / Critical
- **Precondition**:
  1. Percakapan berstatus limit-reached.
  2. Saldo utama WhatsApp Credit akun = Rp 1.000.
- **Test Steps**:
  1. Klik `[+ Tambah Limit Sesi]`.
  2. Pilih preset `'Rp 5.000'`.
  3. Klik `[Konfirmasi Tambah Limit]`.
- **Expected Results (Triple-Layer Assertions)**:
  1. [UI] Muncul toast error: `'Saldo utama akun tidak mencukupi untuk top-up limit'`.
  2. [UI] Limit sesi tidak bertambah dan percakapan tetap diblokir.
  3. [API] Request mengembalikan HTTP `422 Insufficient Balance`.
  4. [DB] Tidak ada saldo yang terpotong.

---

### WEB-CHAT-CONC-CON-021: Concurrency Test: Top-up simultan oleh Agent dan Owner pada room yang sama `[Auto-High]` `[High-Complexity]`
- **User Story**: [Priority: High] US-04: Simultaneous Top-Up Concurrency (Covers: AC-4)
- **Tipe**: Concurrency / Con
- **Precondition**:
  1. Room limit awal = Rp 5.000.
  2. Saldo utama akun mencukupi (Rp 500.000).
- **Test Steps**:
  1. Agent klik Top-up Rp 5.000 dan Owner klik Top-up Rp 5.000 secara bersamaan (<50ms).
  2. Amati respon sistem pada kedua klien.
  3. Periksa limit akhir pada database.
- **Expected Results (Triple-Layer Assertions)**:
  1. [API] Kedua request top-up diproses sukses (`200 OK`).
  2. [DB] Total limit sesi bertambah Rp 10.000 (menjadi `Rp 15.000`).
  3. [DB] Tercatat 2 baris log audit mutasi top-up (satu dari Agent, satu dari Owner).
  4. [UI] Kedua antarmuka ter-sinkronisasi menampilkan limit baru Rp 15.000.

---

## Modul 5: Heuristic Exploratory Testing Charters

### E2E-BILL-FDEX-EXP-022: Exploratory Charter: The FedEx Tour (End-to-End Data & Credit Journey) `[Auto-Critical]` `[Manual/Charter]`
- **User Story**: [Priority: Critical] Exploratory: The FedEx Credit Tour
- **Tipe**: Exploratory / E2E
- **Charter Goal**: Melacak siklus penuh mutasi kredit dari broadcast dispatch, isolasi, webhook failure, rollback, hingga verifikasi data audit export.
- **Exploration Steps**:
  1. Trigger broadcast 10 nomor.
  2. Verifikasi isolasi Rp 4.500 di DB.
  3. Simulasikan 5 delivered dan 5 failed dari Meta.
  4. Verifikasi refund Rp 2.250 ke saldo utama.
  5. Download Credit History dan bandingkan baris mutasi.
- **Observed Assertions (Triple-Layer)**:
  1. [DB] Mutasi isolasi $\rightarrow$ deduct $\rightarrow$ rollback tercatat konsisten tanpa selisih 1 Rupiah pun.
  2. [UI] Saldo akhir akun = `Rp 47.750`.
  3. [File] File export memuat 5 status DELIVERED dan 5 status ROLLED_BACK.
  4. [DB] Audit log mencatat seluruh event lifecycle dengan timestamp terurut.

---

### WEB-BRD-CHAO-EXP-023: Exploratory Charter: The Saboteur Tour (Simulasi Network Drop saat Broadcast Trigger) `[Auto-High]` `[Manual/Charter]`
- **User Story**: [Priority: High] Exploratory: The Saboteur Network Chaos Tour
- **Tipe**: Exploratory / Chaos
- **Charter Goal**: Menyelidiki ketahanan sistem saat koneksi jaringan terputus tepat ketika tombol konfirmasi broadcast diklik.
- **Exploration Steps**:
  1. Klik tombol `[Kirim Broadcast Sekarang]`.
  2. Putuskan koneksi jaringan (Airplane Mode) dalam 100ms.
  3. Sambungkan kembali internet setelah 15 detik.
  4. Refresh halaman broadcast dan periksa status campaign.
- **Observed Assertions (Triple-Layer)**:
  1. [UI] Sistem tidak hang / freeze.
  2. [DB] Tidak terjadi duplikasi pengiriman pesan atau duplikasi isolasi kredit.
  3. [UI] Status campaign menampilkan status yang deterministik (antara 'Processing' atau 'Draft').

---

### WEB-CHAT-RUSH-EXP-024: Exploratory Charter: The Impatient User Tour (Rapid Multiple Top-Up Clicks) `[Auto-Normal]` `[Manual/Charter]`
- **User Story**: [Priority: Normal] Exploratory: The Impatient User Rapid Click Tour
- **Tipe**: Exploratory / Stress
- **Charter Goal**: Menguji perilaku sistem saat Agent melakukan spamming click tombol top-up dropdown preset secara cepat.
- **Exploration Steps**:
  1. Pilih preset Rp 10.000.
  2. Klik tombol `[Konfirmasi Tambah Limit]` 5 kali berturut-turut dalam 500ms.
  3. Amati limit akhir dan saldo utama.
- **Observed Assertions (Triple-Layer)**:
  1. [UI] Tombol langsung disabled setelah klik pertama (Loading state).
  2. [API] Hanya request pertama yang diproses atau request berikutnya terblokir idempotency lock.
  3. [DB] Limit sesi hanya bertambah Rp 10.000 (bukan Rp 50.000) dan saldo utama terpotong tepat Rp 10.000.

---

### API-CHAT-SECT-EXP-025: Exploratory Charter: The Rogue / Security Tour (Direct Parameter Tampering) `[Auto-Critical]` `[Manual/Charter]`
- **User Story**: [Priority: Critical] Exploratory: The Rogue Security & BOLA Tour
- **Tipe**: Exploratory / Security-BOLA
- **Charter Goal**: Mencoba membypass limit chatroom dengan memodifikasi payload nominal top-up negatif atau manipulasi room_id milik user lain.
- **Exploration Steps**:
  1. Kirim request top-up dengan payload `amount: -5000`.
  2. Kirim request top-up dengan `amount: 999999999` (melebihi saldo).
  3. Kirim request top-up dengan `room_id` yang tidak di-assign ke Agent.
- **Observed Assertions (Triple-Layer)**:
  1. [API] Input amount negatif ditolak dengan HTTP `422 Invalid Amount`.
  2. [API] Input melebihi saldo ditolak dengan HTTP `422 Insufficient Balance`.
  3. [API] Akses ke unassigned room ditolak dengan HTTP `403 Forbidden` (BOLA/IDOR protection).
