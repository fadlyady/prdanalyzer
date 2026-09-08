# Analisis PRD & Perancangan Test Matrix: Everpro Chat Meta New Pricing 2026

## 1. Ringkasan Fitur & Scope Guardrails
- **Tujuan Fitur**: 
  Mengakomodasi perubahan skema harga WhatsApp Business API (WABA) dari Meta yang mulai mencakup monetisasi untuk *Service Messages* (selain *Marketing, Utility,* dan *Authentication*). Seluruh kalkulasi tarif menggunakan mata uang Rupiah (IDR). Master data tarif tersimpan langsung pada Database (DB) per negara dan kategori broadcast/template. Fitur ini menyediakan mekanisme isolasi/potong saldo kredit sementara (temporary credit isolation) dengan auto-rollback saat pesan gagal/mendapat respon explicit failed dari Meta, pembebasan biaya pada *Free Entry Point* (CTWA/WTWA), integrasi Service Message pada limit kredit & mutasi saldo dashboard, serta kontrol limit biaya sesi percakapan chatroom (flat limit & quick top-up oleh Agent tanpa langsung mendebit saldo utama, dan reset biaya saat sesi di-closing oleh Agent).
- **In-Scope**:
  1. **Credit Calculation & Pricing Data Engine (Database-driven)**:
     - Tarif disimpan langsung di DB berdasarkan kombinasi: Kode Negara Tujuan (Recipient Country) X Kategori Pesan (`Marketing`, `Utility`, `Authentication`, `Service`).
     - Seluruh kalkulasi menggunakan mata uang Rupiah (IDR) secara konsisten di backend dan UI.
  2. **Delivery & Credit Isolation Flow (Broadcast, Chatroom, Open API)**:
     - Bypass validasi & pemotongan kredit selama window *Free Entry Point* aktif (CTWA / WTWA).
     - Isolasi saldo kredit saat pesan dipicu (`Base Price + Margin`).
     - Mekanisme *Credit Rollback* otomatis jika Meta memberikan response *failed* eksplisit.
     - Pencatatan log kredit nett (`Temporary Deducted - Rolled Back`) dan ekspor di riwayat kredit.
  3. **Credit Management (Customer Dashboard - Owner/Supervisor)**:
     - Inklusi biaya Service Message pada widget "Pengeluaran bulan ini" per nomor WABA.
     - Validasi pemblokiran pengiriman pesan berbayar jika akumulasi mencapai *Monthly Credit Limit* ("monthly credit limit has exhausted").
     - Inklusi tipe "Service" pada ekspor riwayat kredit (Credit History Download).
  4. **Chatroom Cost Visibility & Flat Session Limit (Chatroom Web)**:
     - Tampilan biaya berjalan sesi secara real-time (*ongoing session cost*).
     - Pengaturan *flat session spend limit* langsung dari chatroom oleh Owner/Supervisor.
     - Pemblokiran pesan berbayar saat limit sesi tercapai (*limit-reached*).
     - Mekanisme penambahan limit manual (Top-Up) oleh semua Agent via dropdown preset (Rp2.000, Rp5.000, Rp10.000) yang menaikkan plafon batas sesi (saldo utama dipotong saat pesan terkirim, dengan validasi kecukupan saldo utama).
     - Lifecycle Reset Biaya Sesi: Running cost sesi di-reset kembali ke Rp0 saat chatroom di-closing oleh Agent.
- **Out-of-Scope**:
  - Pengaturan harga via antarmuka UI (karena konfigurasi pricing didaftarkan langsung ke DB backend).
  - Customer segmentation dinamis berbasis label/tag (fitur limit sesi pada fase ini murni bersifat *flat & non-segmented*).
  - Mekanisme top-up saldo WhatsApp credit utama via Payment Gateway (hanya menguji konsumsi & isolasi kredit).

---

## 2. Prasyarat Sistem & Konfigurasi Lingkungan (Pre-requisites)
1. **Akun & Role Pengguna**:
   - Akun Customer Everpro Chat dengan role `Owner` / `Supervisor` (konfigurasi limit bulanan, limit sesi chatroom, download history).
   - Akun Customer Everpro Chat dengan role `Agent / CS` (akses chatroom, pengiriman pesan, quick top-up limit sesi, closing room).
2. **Konfigurasi Master Data & Harga (DB Level)**:
   - Data tarif WhatsApp Meta terdaftar di DB dalam satuan IDR per kategori (`Marketing`, `Utility`, `Authentication`, `Service`) dan kode negara tujuan (misal: ID/62, MY/60, dll.).
3. **Environment & Integrasi**:
   - Nomor WABA aktif & terhubung ke Meta Cloud API/BSP.
   - Webhook callback status pengiriman Meta (`sent`, `delivered`, `failed`, `read`).
   - Mocking gateway untuk sinyal Free Entry Point (CTWA / WTWA).

---

## 3. Matriks Hak Akses (RBAC Matrix)

| Modul / Aksi | Owner | Supervisor | Agent / CS | Method | Priority |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Lihat Pengeluaran Bulan Ini (inc. Service Message)** | **Allow** | **Allow** | Forbidden | AC | P2 |
| **Atur & Edit Monthly Credit Limit** | **Allow** | **Allow** | Forbidden | AC | P1 |
| **Download Credit History (inc. Tipe Service)** | **Allow** | **Allow** | Forbidden | AC | P2 |
| **Lihat Running Cost Sesi di Chatroom** | **Allow** | **Allow** | **Allow** | AC | P2 |
| **Atur Flat Session Limit di Chatroom** | **Allow** | **Allow** | Forbidden | AC | P1 |
| **Eksekusi Pengiriman Pesan (Broadcast / Chatroom / API)** | **Allow** | **Allow** | **Allow** | AC | P1 |
| **Top-up Tambahan Plafon Limit Sesi (Rp2k, Rp5k, Rp10k)** | **Allow** | **Allow** | **Allow** | AC | P1 |
| **Closing Chatroom (Trigger Reset Running Cost)** | **Allow** | **Allow** | **Allow** | AC | P1 |

---

## 4. Logika Bisnis, Aturan Validasi & Decision Matrix

### 4.1. Decision Table: Mekanisme Pengiriman Pesan & Deduct/Rollback Saldo (DT-01)

| Rule ID | Free Entry Point (FEP) Window | Saldo WABA Utama Cukup? | Monthly Credit Limit Tercapai? | Chatroom Session Limit Tercapai? | Sinyal Response Meta | Aksi Sistem & Mutasi Saldo | Priority |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **DT01-1** | **Aktif** (CTWA/WTWA) | Apapun | Tidak / Belum | Belum | Delivered / Sent | Pesan terkirim langsung; **Biaya Rp0 (Bypass isolasi kredit)** | P1 |
| **DT01-2** | Tidak Aktif | **Ya** | Belum | Belum | Delivered | Isolasi `Base + Margin`; Finalisasi status deduct; Nett log tercatat | P1 |
| **DT01-3** | Tidak Aktif | **Ya** | Belum | Belum | **Explicit Failed** | Isolasi `Base + Margin`; **Auto-Rollback saldo 100%**; Nett log = Rp0 | P1 |
| **DT01-4** | Tidak Aktif | **Tidak** | Belum | Belum | - | **Blocked**: Gagal kirim dengan alert saldo WABA utama tidak mencukupi | P1 |
| **DT01-5** | Tidak Aktif | Ya | **Sudah Tercapai** | Belum | - | **Blocked**: Muncul pesan *"monthly credit limit has exhausted"* | P1 |
| **DT01-6** | Tidak Aktif | Ya | Belum | **Sudah Tercapai** | - | **Blocked**: Flag *limit-reached*; Input/kirim terkunci hingga plafon sesi di-top-up | P1 |

### 4.2. Decision Table: Top-Up Sesi Chatroom & Unblocking (DT-02)

| Rule ID | Status Sesi | Aktor | Nilai Preset Top-up | Saldo WABA Utama Cukup? | Hasil Aksi | Mutasi Saldo & Log | Priority |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **DT02-1** | Limit-reached | Owner / Supervisor / Agent | Rp 2.000 | Ya | Plafon limit sesi bertambah Rp2.000; Flag unblocked; Pesan dapat dikirim | Saldo utama belum terpotong; Log top-up tercatat (+Rp2.000) | P1 |
| **DT02-2** | Limit-reached | Owner / Supervisor / Agent | Rp 5.000 | Ya | Plafon limit sesi bertambah Rp5.000; Flag unblocked; Pesan dapat dikirim | Saldo utama belum terpotong; Log top-up tercatat (+Rp5.000) | P1 |
| **DT02-3** | Limit-reached | Owner / Supervisor / Agent | Rp 10.000 | Ya | Plafon limit sesi bertambah Rp10.000; Flag unblocked; Pesan dapat dikirim | Saldo utama belum terpotong; Log top-up tercatat (+Rp10.000) | P1 |
| **DT02-4** | Limit-reached | Owner / Supervisor / Agent | Apapun | **Tidak** | Gagal top-up / Muncul peringatan saldo utama tidak mencukupi | Tidak ada penambahan plafon; Percakapan tetap terblokir | P1 |

### 4.3. State Transition: Lifecycle Pesan, Sesi & Saldo Kredit (ST-01)
1. **Pesan Dikirim**:
   - `Triggered` ➔ `Cek FEP & Kuota` ➔ `Isolated / Temporary Deducted` ➔ `Outbound ke Meta`.
   - ➔ **Meta Delivered**: Saldo terpotong permanen (`Nett Log = Full Cost`).
   - ➔ **Meta Explicit Failed**: Saldo di-rollback otomatis 100% (`Nett Log = Rp0`).
2. **Lifecycle Sesi Chatroom**:
   - `Sesi Berjalan`: Running cost bertambah setiap pesan terkirim.
   - `Limit Tercapai`: Flag *limit-reached* aktif ➔ Diblokir kirim pesan.
   - `Top-up Plafon`: Plafon bertambah ➔ Unblocked (Saldo utama terpotong per pesan terkirim).
   - `Closing Room oleh Agent`: Running cost di-reset kembali ke Rp0 untuk sesi berikutnya.

---

## 5. Penanganan Kegagalan, Edge Cases & Third-party Integrations (NEG)

1. **Explicit Failed Response dari Meta**:
   - Saat Meta mengembalikan response failed (misal: nomor tujuan tidak valid / template rejected), sistem memicu auto-rollback saldo secara instan.
2. **Percakapan Chatroom Melewati 24 Jam Tanpa Closing**:
   - Jika window 24 jam Meta telah habis namun Agent belum melakukan closing room, running cost pada UI chatroom tetap dipertahankan dan TIDAK di-reset hingga Agent mengeksekusi closing room.
3. **Top-Up Plafon Sesi saat Saldo WABA Utama Kritis/Habis**:
   - Sistem memvalidasi saldo utama; jika saldo utama tidak mencukupi nilai pesan yang akan dikirim, sistem memberikan alert peringatan dan menolak pengiriman pesan berbayar.
4. **Race Condition pada Pengiriman Massal (Broadcast vs Saldo Minim)**:
   - Jika saldo hanya cukup untuk sebagian penerima, sistem memproses sesuai kuota saldo dan menandai sisanya sebagai gagal saldo secara aman tanpa saldo minus.

---

## 6. Status Klarifikasi & Keputusan Bisnis

> [!NOTE]
> Seluruh ambiguitas telah dikonfirmasi dan diselaraskan dengan keputusan bisnis:
> 1. **Rollback Acuan**: Rollback kredit dilakukan saat Meta memberikan response *failed* eksplisit.
> 2. **Dampak Top-up Sesi**: Menambah plafon batas sesi (tidak langsung memotong saldo utama di depan; saldo utama dipotong per pesan terkirim dengan validasi saldo utama).
> 3. **Reset Biaya Sesi**: Biaya berjalan di-reset ke Rp0 saat chatroom di-closing oleh Agent.
> 4. **Mata Uang & Master Tarif**: Seluruh kalkulasi dalam mata uang IDR; data tarif tersimpan langsung di DB backend per negara dan kategori pesan.
