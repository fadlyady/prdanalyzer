# Automation Test Cases: Everpro Chat Meta New Pricing 2026

> Dokumen ini dihasilkan otomatis sebagai turunan dari Master Test Case Excel (`result-testcase/Test_Cases_Meta_New_Pricing_2026.xlsx`) dan disesuaikan untuk instruksi test automation (Playwright / Cypress / Robot Framework).

## Suite: PRECONDITION

### CRC-GEN-PRE-001: Verifikasi pencegahan akses fitur Everpro Chat ketika Subscription tidak aktif / kedaluwarsa `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] Global Pre-condition
- **Tipe**: Functional
- **Deskripsi**: Memastikan akun merchant yang tidak memiliki paket subscription aktif dicegah untuk mengakses fitur Everpro Chat, WABA, dan pengiriman pesan berbayar.
- **Preconditions**:
  1. Akun pengguna terdaftar di Everpro.
  2. Status paket Subscription akun adalah "Inactive" atau "Expired".
- **Test Steps & Assertions**:
  1. Login ke Everpro menggunakan akun dengan subscription inactive.
  2. Navigasikan ke menu Everpro Chat / WhatsApp Credit / Broadcast.
  3. Coba lakukan inisiasi pengiriman pesan atau broadcast.
  **Expected Results**:
  - 1. Sistem menampilkan banner/modal bahwa paket subscription tidak aktif.
  - 2. Pengguna diblokir untuk mengakses menu Everpro Chat dan tidak dapat mengirim pesan berbayar.
  - 3. Muncul CTA untuk mengaktifkan/memperpanjang subscription.

---

### CRC-GEN-PRE-002: Verifikasi kegagalan pengiriman pesan saat nomor WABA belum terdaftar atau berstatus non-aktif `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] Global Pre-condition
- **Tipe**: Functional
- **Deskripsi**: Memastikan sistem memvalidasi status WABA sebelum pengiriman pesan dilakukan (tidak ada proses isolasi/pengiriman jika WABA tidak valid).
- **Preconditions**:
  1. Subscription akun berstatus Aktif.
  2. Organisasi belum mendaftarkan nomor WABA atau status WABA dalam peninjauan/banned.
- **Test Steps & Assertions**:
  1. Login sebagai Owner/Supervisor.
  2. Akses halaman Broadcast atau Chatroom.
  3. Coba kirim pesan template atau pesan chatroom ke kontak customer.
  **Expected Results**:
  - 1. Sistem menampilkan pesan error bahwa nomor WABA belum terdaftar/tidak aktif.
  - 2. Tombol pengiriman pesan dinonaktifkan.
  - 3. Tidak ada saldo kredit yang diisolasi.

---

### CRC-GEN-PRE-003: Verifikasi kegagalan pengiriman pesan pada WABA yang belum memiliki agent yang di-assign `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] Global Pre-condition
- **Tipe**: Functional
- **Deskripsi**: Memastikan pesan tidak dapat diproses jika pada nomor WABA aktif belum ditugaskan (assigned) agent operasional.
- **Preconditions**:
  1. Subscription akun Aktif.
  2. WABA terdaftar dan aktif.
  3. Belum ada CS/Agent yang di-assign ke nomor WABA tersebut.
- **Test Steps & Assertions**:
  1. Login sebagai Owner/Supervisor.
  2. Buka menu Chatroom untuk nomor WABA tanpa agent tersebut.
  3. Coba lakukan inisiasi percakapan/kirim pesan.
  **Expected Results**:
  - 1. Sistem memberikan notifikasi bahwa nomor WABA belum memiliki agen yang ditugaskan.
  - 2. Pengguna diarahkan ke pengaturan Tim/Agen untuk melakukan assignment sebelum dapat beroperasi.

---

## Suite: RBAC

### CRC-RBAC-AUTH-004: Verifikasi pembatasan hak akses role CS Operasional / CS Closing terhadap menu Admin Biz Ops & Credit Management `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] RBAC Authorization
- **Tipe**: RBAC
- **Deskripsi**: Memastikan role CS tidak memiliki akses ke halaman Biz Ops Pricing, konfigurasi WhatsApp Credit, Monthly Credit Limit, dan Broadcast Management.
- **Preconditions**:
  1. Subscription Aktif, WABA Aktif dengan agent assigned.
  2. Akun pengguna memiliki role "CS Operasional" atau "CS Closing".
- **Test Steps & Assertions**:
  1. Login sebagai CS Operasional / CS Closing.
  2. Periksa menu navigasi yang tersedia.
  3. Coba akses direct URL halaman Admin Pricing (/admin/pricing) atau Credit Management (/whatsapp-credit).
  **Expected Results**:
  - 1. Menu WhatsApp Credit dan Admin Pricing tidak tampil di sidebar navigasi CS.
  - 2. Percobaan akses via direct URL menghasilkan respons 403 Forbidden atau redirect otomatis ke Chatroom.

---

## Suite: PRICING_CONFIG

### DB-PRC-CFG-005: Biz Ops Admin memperbarui Meta Base Price per Kategori x Negara Penerima dengan Effective Date `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] User Story 1: Admin Paid Message Pricing Management
- **Tipe**: Functional
- **Deskripsi**: Memastikan Biz Ops Admin dapat memperbarui base price resmi dari Meta untuk setiap kategori pesan (Marketing, Utility, Auth, Service) per negara tujuan beserta tanggal efektif berlakunya.
- **Preconditions**:
  1. Login sebagai Everpro Biz Ops Admin.
  2. Memiliki otorisasi manajemen harga di database/admin dashboard.
- **Test Steps & Assertions**:
  1. Buka dashboard Credit Management Admin > Base Price.
  2. Pilih Kategori Pesan: "Service", Negara Tujuan: "Indonesia (ID)".
  3. Masukkan harga dasar baru (misal: Rp300).
  4. Set Effective Date (misal: H+1 jam 00:00 WIB).
  5. Klik "Simpan".
  **Expected Results**:
  - 1. Base price baru berhasil tersimpan di database dengan status "Scheduled / Pending Effective Date".
  - 2. Muncul toast konfirmasi keberhasilan update.

---

### DB-PRC-CFG-006: Biz Ops Admin mengatur General Markup Price per Kategori x Negara Penerima untuk seluruh user umum `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] User Story 1: Admin Paid Message Pricing Management
- **Tipe**: Functional
- **Deskripsi**: Memastikan Biz Ops Admin dapat menentukan margin/markup per pesan untuk seluruh general users berdasarkan kombinasi kategori pesan dan negara tujuan.
- **Preconditions**:
  1. Login sebagai Everpro Biz Ops Admin.
  2. Base price untuk kategori & negara terkait sudah terkonfigurasi.
- **Test Steps & Assertions**:
  1. Buka menu Admin > Markup Price General.
  2. Pilih Kategori: "Marketing", Negara: "Indonesia (ID)".
  3. Input nilai markup (misal: Rp50).
  4. Set Effective Date.
  5. Klik "Simpan".
  **Expected Results**:
  - 1. Nilai markup general berhasil tersimpan dan akan berlaku bagi seluruh merchant non-kustom saat effective date tiba.

---

### DB-PRC-CFG-007: Biz Ops Admin mengatur Customizable Markup Price untuk User ID spesifik (Special Merchant) `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] User Story 1: Admin Paid Message Pricing Management
- **Tipe**: Functional
- **Deskripsi**: Memastikan Biz Ops Admin dapat memberikan harga markup khusus (custom pricing) untuk merchant tertentu berdasarkan User ID.
- **Preconditions**:
  1. Login sebagai Everpro Biz Ops Admin.
  2. Target User ID merchant valid dan terdaftar di database.
- **Test Steps & Assertions**:
  1. Buka menu Admin > Custom User Pricing.
  2. Masukkan target User ID (misal: USR_100234).
  3. Pilih Kategori: "Utility", Negara: "Indonesia".
  4. Masukkan Custom Markup (misal: Rp20, lebih rendah dari General Markup Rp50).
  5. Set Effective Date dan simpan.
  **Expected Results**:
  - 1. Custom pricing untuk User ID tersebut berhasil disimpan.
  - 2. Merchant dengan User ID terkait akan dikenakan tarif custom, sedangkan merchant lain tetap dikenakan general markup.

---

### DB-PRC-CFG-008: Verifikasi masa transisi harga sebelum vs sesudah Effective Date tercapai `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] User Story 1: Admin Paid Message Pricing Management
- **Tipe**: Functional
- **Deskripsi**: Memastikan sistem menerapkan harga lama sebelum Effective Date dan beralih ke harga baru secara otomatis tepat saat Effective Date tiba.
- **Preconditions**:
  1. Konfigurasi harga baru dengan Effective Date: 2026-10-01 00:00:00 WIB.
  2. Harga lama: Rp500, Harga baru: Rp600.
- **Test Steps & Assertions**:
  1. Kirim pesan berbayar pada 2026-09-30 23:59:50 WIB.
  2. Cek nominal kredit yang diisolasi/dipotong.
  3. Kirim pesan berbayar pada 2026-10-01 00:00:05 WIB.
  4. Cek nominal kredit yang diisolasi/dipotong.
  **Expected Results**:
  - 1. Pesan sebelum Effective Date dikenakan tarif lama (Rp500).
  - 2. Pesan sesudah Effective Date dikenakan tarif baru (Rp600) secara otomatis tanpa perlu restart server.

---

### DB-PRC-CFG-009: Verifikasi kelengkapan pencatatan Audit Log saat terjadi perubahan harga oleh Biz Ops Admin `[Auto-Normal]` `[Low-Complexity]`
- **User Story**: [Priority: Normal] User Story 1: Admin Paid Message Pricing Management
- **Tipe**: Functional
- **Deskripsi**: Memastikan setiap perubahan pada Base Price, General Markup, dan Custom Pricing tercatat lengkap dalam log audit.
- **Preconditions**:
  1. Telah dilakukan aktivitas penambahan atau perubahan harga oleh Biz Ops Admin.
- **Test Steps & Assertions**:
  1. Akses menu Admin > Audit Log Pricing.
  2. Cari log transaksi perubahan harga terakhir.
  3. Verifikasi kolom data yang tercatat.
  **Expected Results**:
  - 1. Log audit mencatat detail lengkap: ID/Nama Actor, New Price, Kategori Pesan, Negara Tujuan, Target User ID (jika ada), dan Timestamp validitas.

---

## Suite: EXECUTION_FEP

### CRC-BRD-EXEC-010: Verifikasi pesan inbound dari CTWA (Click-to-WhatsApp Ads) mengaktifkan Free Entry Point (FEP) window `[Auto-Critical]` `[High-Complexity]`
- **User Story**: [Priority: Critical] User Story 2: Execution, Free Entry Point & Credit Lifecycle
- **Tipe**: Functional
- **Deskripsi**: Memastikan interaksi pelanggan yang berasal dari iklan CTWA mengaktifkan status Free Entry Point sehingga pesan respons bebas biaya.
- **Preconditions**:
  1. Nomor WABA terintegrasi dengan Meta Ads.
  2. Customer mengklik iklan CTWA dan mengirim pesan pertama ke WABA.
- **Test Steps & Assertions**:
  1. Terima pesan inbound dari customer via link CTWA.
  2. Periksa status window percakapan di sistem backend / header chatroom.
  **Expected Results**:
  - 1. Sistem menandai percakapan tersebut berada dalam status Free Entry Point (FEP) aktif sesuai durasi kebijakan Meta.

---

### CRC-BRD-EXEC-011: Verifikasi pesan inbound dari WTWA (Website-to-WhatsApp) mengaktifkan Free Entry Point (FEP) window `[Auto-Critical]` `[High-Complexity]`
- **User Story**: [Priority: Critical] User Story 2: Execution, Free Entry Point & Credit Lifecycle
- **Tipe**: Functional
- **Deskripsi**: Memastikan interaksi pelanggan yang berasal dari tombol WhatsApp di Facebook Page / Website (WTWA) mengaktifkan FEP window.
- **Preconditions**:
  1. Customer memulai chat melalui tombol call-to-action WTWA resmi.
- **Test Steps & Assertions**:
  1. Terima pesan inbound customer via WTWA.
  2. Periksa status window percakapan.
  **Expected Results**:
  - 1. Sistem mendeteksi referral source WTWA dan mengaktifkan window Free Entry Point.

---

### CRC-BRD-EXEC-012: Pengiriman pesan Template via Broadcast selama window FEP aktif tanpa pemotongan kredit `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 2: Execution, Free Entry Point & Credit Lifecycle
- **Tipe**: Functional
- **Deskripsi**: Memastikan pengiriman pesan broadcast ke nomor yang sedang berada dalam window FEP tidak melakukan isolasi atau pemotongan saldo kredit.
- **Preconditions**:
  1. Kontak target broadcast memiliki status FEP aktif.
- **Test Steps & Assertions**:
  1. Jadwalkan / kirim broadcast campaign ke target kontak FEP.
  2. Amati proses validasi kredit dan pengiriman ke Meta.
  **Expected Results**:
  - 1. Sistem mem-bypass proses validasi dan isolasi kredit (0 charge).
  - 2. Pesan terkirim langsung ke Meta tanpa mengurangi saldo kredit organisasi.

---

### CRC-BRD-EXEC-013: Pengiriman pesan balasan via Chatroom (Human / AI Bot) dan Open API selama window FEP aktif bebas biaya `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 2: Execution, Free Entry Point & Credit Lifecycle
- **Tipe**: Functional
- **Deskripsi**: Memastikan seluruh pengiriman pesan chatroom dan Open API dalam window FEP tidak mendebet saldo kredit.
- **Preconditions**:
  1. Sesi percakapan customer berada dalam window FEP aktif.
- **Test Steps & Assertions**:
  1. Kirim balasan manual oleh CS di Chatroom.
  2. Kirim balasan otomatis oleh bot/AI.
  3. Trigger pengiriman pesan via Open API.
  **Expected Results**:
  - 1. Seluruh pesan terkirim dengan sukses tanpa pemotongan saldo kredit.
  - 2. Nilai running cost sesi tetap Rp0.

---

### CRC-BRD-EXEC-014: Verifikasi pengiriman pesan setelah FEP window kedaluwarsa (Expired) kembali dikenakan pemotongan kredit normal `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 2: Execution, Free Entry Point & Credit Lifecycle
- **Tipe**: Functional
- **Deskripsi**: Memastikan setelah durasi window FEP berakhir, pengiriman pesan berikutnya otomatis kembali ke alur penagihan normal.
- **Preconditions**:
  1. Window FEP pada kontak customer telah kedaluwarsa.
- **Test Steps & Assertions**:
  1. Kirim pesan ke customer tersebut setelah masa FEP habis.
  2. Periksa mutasi saldo WhatsApp Credit.
  **Expected Results**:
  - 1. Sistem mengeksekusi validasi dan isolasi saldo kredit normal (Base Price + Margin).
  - 2. Saldo kredit terpotong sesuai tarif kategori pesan.

---

### CRC-BRD-EXEC-015: Verifikasi isolasi kredit instan saat CS mengklik tombol balas di Chatroom atau pemicuan Open API (Non-FEP) `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 2: Execution, Free Entry Point & Credit Lifecycle
- **Tipe**: Functional
- **Deskripsi**: Memastikan saldo kredit diisolasi seketika saat tombol kirim ditekan sebelum status pesan dikonfirmasi oleh Meta.
- **Preconditions**:
  1. Di luar window FEP, saldo kredit mencukupi.
- **Test Steps & Assertions**:
  1. Buka Chatroom dan kirim pesan berbayar.
  2. Amati saldo available dan saldo isolated seketika.
  **Expected Results**:
  - 1. Saldo kredit sebesar (Base Price + Margin) langsung masuk ke status terisolasi/hold.
  - 2. Saldo available berkurang seketika.

---

### CRC-BRD-EXEC-016: Verifikasi Credit Rollback otomatis saat pesan menerima sinyal eksplisit status "failed" dari Meta `[Auto-Critical]` `[High-Complexity]`
- **User Story**: [Priority: Critical] User Story 2: Execution, Free Entry Point & Credit Lifecycle
- **Tipe**: Functional
- **Deskripsi**: Memastikan saldo terisolasi dikembalikan 100% secara utuh ke saldo aktif seketika Meta mengembalikan status failed.
- **Preconditions**:
  1. Pesan telah di-trigger dan kredit sebesar Rp500 telah diisolasi.
- **Test Steps & Assertions**:
  1. Provider Meta mengembalikan webhook status "failed" (misal: nomor tidak terdaftar / banned).
  2. Amati mutasi saldo kredit organisasi.
  **Expected Results**:
  - 1. Sistem membatalkan isolasi dan mengembalikan kredit Rp500 ke saldo aktif (Rollback 100%).
  - 2. Status pesan di UI menampilkan "Gagal Terkirim".

---

### CRC-BRD-EXEC-017: Verifikasi perhitungan Nett Credit Log pada status akhir pesan DELIVERED `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 2: Execution, Free Entry Point & Credit Lifecycle
- **Tipe**: Functional
- **Deskripsi**: Memastikan saldo terisolasi didebit permanen dan log mutasi nett tercatat rapi saat pesan berstatus DELIVERED.
- **Preconditions**:
  1. Pesan terisolasi berhasil dikirim ke Meta.
- **Test Steps & Assertions**:
  1. Meta mengirimkan webhook status "delivered".
  2. Periksa mutasi saldo kredit.
  **Expected Results**:
  - 1. Saldo terisolasi diubah menjadi pemotongan definitif (Nett Deduction).
  - 2. Mutasi tercatat permanen di credit history log.

---

### CRC-BRD-EXEC-018: Chatroom: Kirim Pesan di Luar Window Aktif Wajib Menggunakan Template Message `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 2: Execution, Free Entry Point & Credit Lifecycle
- **Tipe**: Functional
- **Deskripsi**: Memastikan CS tidak dapat mengirim free text jika customer belum membalas pesan > 24 jam / sesi baru, dan wajib menggunakan template.
- **Preconditions**:
  1. Percakapan chatroom baru atau di luar 24 jam interaksi customer.
- **Test Steps & Assertions**:
  1. Buka chatroom.
  2. Coba kirim pesan teks bebas (free text).
  3. Pilih template message lalu kirim.
  4. Tunggu customer membalas, lalu kirim teks bebas.
  **Expected Results**:
  - 1. Teks bebas sebelum ada respons customer ditolak/dinonaktifkan.
  - 2. Pesan template berhasil dikirim dengan tarif template.
  - 3. Setelah customer membalas, CS dapat mengirim teks bebas dengan tarif Service Message.

---

## Suite: WA_CREDIT

### CRC-DSH-CRD-019: Verifikasi "Pengeluaran bulan ini" pada WhatsApp Credit Page mengikutsertakan biaya Service Message `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] User Story 3: Credit Management & Monthly Limit
- **Tipe**: Functional
- **Deskripsi**: Memastikan total pengeluaran bulanan mencakup biaya Service Message bersama Marketing, Utility, dan Authentication.
- **Preconditions**:
  1. Login sebagai Owner/Supervisor.
  2. Telah terjadi pengiriman Marketing, Utility, Auth, dan Service Message dalam bulan berjalan.
- **Test Steps & Assertions**:
  1. Buka halaman WhatsApp Credit.
  2. Amati kartu informasi "Pengeluaran Bulan Ini".
  3. Bandingkan dengan total kalkulasi individual tiap kategori.
  **Expected Results**:
  - 1. Nominal pengeluaran bulan ini merefleksikan total penjumlahan seluruh kategori termasuk Service Message secara akurat.

---

### CRC-DSH-CRD-020: Owner / Supervisor mengatur Monthly Credit Limit pada nomor WABA `[Auto-High]` `[Low-Complexity]`
- **User Story**: [Priority: High] User Story 3: Credit Management & Monthly Limit
- **Tipe**: Functional
- **Deskripsi**: Memastikan Owner/Supervisor dapat menentukan batas maksimal pemakaian kredit bulanan.
- **Preconditions**:
  1. Login sebagai Owner/Supervisor.
- **Test Steps & Assertions**:
  1. Buka pengaturan WhatsApp Credit.
  2. Masukkan limit bulanan (misal: Rp2.000.000).
  3. Klik Simpan.
  **Expected Results**:
  - 1. Batas limit bulanan berhasil disimpan dan progress penggunaan kredit ter-update.

---

### CRC-DSH-CRD-021: Verifikasi pemblokiran pengiriman pesan saat akumulasi biaya mencapai Monthly Credit Limit `[Auto-Critical]` `[Low-Complexity]`
- **User Story**: [Priority: Critical] User Story 3: Credit Management & Monthly Limit
- **Tipe**: Functional
- **Deskripsi**: Memastikan sistem memblokir pengiriman pesan berbayar berikutnya ketika total pengeluaran bulanan telah mencapai limit.
- **Preconditions**:
  1. Total pengeluaran bulan berjalan = Monthly Credit Limit (misal: Rp2.000.000 / Rp2.000.000).
- **Test Steps & Assertions**:
  1. Coba lakukan pengiriman pesan via Chatroom, Broadcast, atau Open API.
  **Expected Results**:
  - 1. Sistem memblokir pengiriman pesan.
  - 2. Menampilkan pesan error: "monthly credit limit has exhausted. Silakan naikkan limit bulanan Anda".

---

### CRC-DSH-CRD-022: Verifikasi ekspor file Riwayat Kredit (Credit History Download) memuat baris Service Message `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] User Story 3: Credit Management & Monthly Limit
- **Tipe**: Functional
- **Deskripsi**: Memastikan file hasil unduhan riwayat penggunaan kredit memuat transaksi Service Message dengan kolom TEMPLATE TYPE = "Service".
- **Preconditions**:
  1. Terdapat riwayat transaksi Service Message pada nomor WABA.
- **Test Steps & Assertions**:
  1. Masuk menu WhatsApp Credit > Riwayat Penggunaan.
  2. Klik tombol Download / Ekspor.
  3. Buka file CSV / Excel yang terunduh.
  **Expected Results**:
  - 1. File unduhan memuat transaksi Service Message.
  - 2. Kolom TEMPLATE TYPE terisi "Service" dan nominal potongan sesuai tarif.

---

## Suite: CHATROOM_COST

### CRW-CHT-ROOM-023: Verifikasi running cost sesi aktif di Chatroom ter-update secara real-time saat pesan berbayar terkirim `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] User Story 4: Chatroom Cost Visibility, Session Limit & Top-Up
- **Tipe**: Functional
- **Deskripsi**: Memastikan indikator running cost di header chatroom bertambah secara dinamis setiap ada pesan berbayar yang sukses dikirim.
- **Preconditions**:
  1. CS membuka percakapan aktif dengan customer.
- **Test Steps & Assertions**:
  1. Cek running cost awal (Rp0).
  2. Kirim 1 Service Message (tarif Rp350).
  3. Kirim 1 Service Message berikutnya.
  **Expected Results**:
  - 1. Setelah pesan pertama, running cost menjadi Rp350.
  - 2. Setelah pesan kedua, running cost berubah real-time menjadi Rp700.

---

### CRW-CHT-ROOM-024: Verifikasi reset running cost saat chatroom di-closing dan customer memulai sesi baru `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 4: Chatroom Cost Visibility, Session Limit & Top-Up
- **Tipe**: Functional
- **Deskripsi**: Memastikan running cost kembali ke Rp0 setelah percakapan diselesaikan (closed) dan dimulai kembali oleh pelanggan.
- **Preconditions**:
  1. Percakapan chatroom memiliki running cost Rp1.400.
- **Test Steps & Assertions**:
  1. CS mengklik tombol Selesaikan Chat / Close Chat.
  2. Customer mengirim pesan chat baru dari WhatsApp.
  3. CS membuka kembali percakapan tersebut.
  **Expected Results**:
  - 1. Sesi baru terinisiasi dan running cost otomatis ter-reset kembali ke nilai default (Rp0).

---

### CRW-CHT-ROOM-025: Owner / Supervisor mengatur Flat Non-Segmented Session Limit melalui quick-access di Chatroom `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] User Story 4: Chatroom Cost Visibility, Session Limit & Top-Up
- **Tipe**: Functional
- **Deskripsi**: Memastikan Owner/Supervisor dapat mengatur batas biaya sesi per percakapan secara generic tanpa tergantung segmentasi pelanggan.
- **Preconditions**:
  1. Login sebagai Owner / Supervisor.
- **Test Steps & Assertions**:
  1. Buka Chatroom.
  2. Klik ikon/menu pengaturan limit sesi di header.
  3. Masukkan batas limit flat (misal: Rp5.000).
  4. Simpan.
  **Expected Results**:
  - 1. Flat Session Limit berhasil disimpan dan diterapkan sebagai batas default untuk seluruh percakapan.

---

### CRW-CHT-ROOM-026: Verifikasi percakapan ditandai limit-reached dan pemblokiran balasan saat session cost mencapai limit `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 4: Chatroom Cost Visibility, Session Limit & Top-Up
- **Tipe**: Functional
- **Deskripsi**: Memastikan ketika running cost mencapai Flat Session Limit, chatroom diberi flag limit-reached dan CS diblokir membalas pesan.
- **Preconditions**:
  1. Flat Session Limit = Rp5.000.
  2. Running cost percakapan telah mencapai Rp5.000.
- **Test Steps & Assertions**:
  1. CS membuka percakapan yang telah mencapai limit.
  2. Periksa tampilan UI dan coba ketik/kirim pesan balasan.
  **Expected Results**:
  - 1. Chatroom menampilkan banner status "Limit Sesi Tercapai (Limit-Reached)".
  - 2. Kotak input balasan chat dinonaktifkan (disabled).

---

### CRW-CHT-ROOM-027: Verifikasi pesan masuk dari customer tetap tersimpan dan dapat dibaca saat status limit-reached `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 4: Chatroom Cost Visibility, Session Limit & Top-Up
- **Tipe**: Functional
- **Deskripsi**: Memastikan pesan inbound pelanggan tidak hilang atau ditolak ketika percakapan mencapai limit sesi.
- **Preconditions**:
  1. Percakapan chatroom dalam status limit-reached.
- **Test Steps & Assertions**:
  1. Customer mengirim pesan teks/gambar dari WhatsApp.
  2. CS mengamati chatroom di dashboard Everpro.
  **Expected Results**:
  - 1. Pesan customer sukses masuk, bubble chat tampil di timeline, dan badge unread bertambah.
  - 2. CS tetap tidak dapat membalas sebelum limit dinaikkan.

---

### CRW-CHT-ROOM-028: Agent/CS melakukan manual top-up limit sesi via preset dropdown (Rp2.000 / Rp5.000 / Rp10.000) dengan saldo cukup `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 4: Chatroom Cost Visibility, Session Limit & Top-Up
- **Tipe**: Functional
- **Deskripsi**: Memastikan CS dapat menaikkan limit sesi pada percakapan yang terblokir menggunakan pilihan preset nominal jika saldo organisasi cukup.
- **Preconditions**:
  1. Chatroom berstatus limit-reached.
  2. Saldo WhatsApp Credit organisasi mencukupi.
- **Test Steps & Assertions**:
  1. CS mengklik tombol "Tambah Limit Sesi".
  2. Pilih preset "+Rp5.000" dari dropdown.
  3. Klik Konfirmasi.
  **Expected Results**:
  - 1. Limit sesi bertambah Rp5.000.
  - 2. Banner limit-reached hilang dan input chat kembali aktif sehingga CS dapat membalas pesan.

---

### CRW-CHT-ROOM-029: Verifikasi kegagalan manual top-up limit sesi saat saldo WhatsApp Credit organisasi tidak mencukupi `[Auto-Critical]` `[Medium-Complexity]`
- **User Story**: [Priority: Critical] User Story 4: Chatroom Cost Visibility, Session Limit & Top-Up
- **Tipe**: Functional
- **Deskripsi**: Memastikan penambahan limit sesi ditolak jika saldo kredit utama organisasi lebih kecil dari nominal preset yang dipilih.
- **Preconditions**:
  1. Chatroom berstatus limit-reached.
  2. Saldo organisasi = Rp1.000, CS memilih top-up +Rp5.000.
- **Test Steps & Assertions**:
  1. CS memilih preset top-up +Rp5.000.
  2. Klik Konfirmasi.
  **Expected Results**:
  - 1. Sistem menolak top-up limit.
  - 2. Menampilkan error "Saldo WhatsApp Credit organisasi tidak mencukupi".
  - 3. Chatroom tetap berstatus limit-reached.

---

### CRW-CHT-ROOM-030: Verifikasi sifat kumulatif pada multiple manual top-up oleh Agent/CS dalam satu sesi `[Auto-High]` `[Medium-Complexity]`
- **User Story**: [Priority: High] User Story 4: Chatroom Cost Visibility, Session Limit & Top-Up
- **Tipe**: Functional
- **Deskripsi**: Memastikan penambahan limit berkali-kali dalam satu sesi percakapan terakumulasi secara benar.
- **Preconditions**:
  1. Limit awal = Rp5.000.
- **Test Steps & Assertions**:
  1. Lakukan top-up pertama +Rp2.000.
  2. Lakukan top-up kedua +Rp5.000 dalam sesi yang sama.
  3. Periksa total batas limit sesi.
  **Expected Results**:
  - 1. Total batas limit sesi terakumulasi menjadi Rp12.000 (Rp5.000 + Rp2.000 + Rp5.000).

---

### CRW-CHT-ROOM-031: Verifikasi pencatatan Audit Log Top-up Sesi (Agent Identity, Timestamp, Amount) `[Auto-Normal]` `[Medium-Complexity]`
- **User Story**: [Priority: Normal] User Story 4: Chatroom Cost Visibility, Session Limit & Top-Up
- **Tipe**: Functional
- **Deskripsi**: Memastikan setiap aksi penambahan limit sesi dicatat secara detail pada log audit percakapan.
- **Preconditions**:
  1. Telah dilakukan top-up limit sesi oleh CS.
- **Test Steps & Assertions**:
  1. Buka riwayat log audit percakapan / aktivitas sesi.
  **Expected Results**:
  - 1. Log mencatat: Identitas/ID CS yang melakukan top-up, Waktu/Timestamp persis, dan Nominal limit yang ditambahkan.

---

