# Analisis PRD & Perancangan Test Matrix: Everpro Chat Meta New Pricing 2026

## 1. Ringkasan Fitur & Scope Guardrails

- **Tujuan Fitur**: 
  Menyesuaikan skema pemotongan dan pengelolaan WhatsApp Credit di Everpro Chat menjelang berlakunya aturan *Meta New Pricing 2026* (khususnya pembebanan biaya pada kategori *Service Message* selain Marketing, Utility, dan Authentication). Fitur ini mencakup mekanisme *Credit Isolation & Rollback* saat pesan gagal, pelacakan *Running Session Cost* dan *Flat Session Limit* langsung dari Chatroom, perlindungan saldo melalui *WhatsApp Credit & Monthly Limit*, serta pencatatan audit log / history transaksi yang dapat diunduh.

- **Domain Aplikasi Target**:
  1. **Dashboard CRM (`dashboard-crm`)**: Modul `Whatsapp Credit` dan `Daftar Broadcast / Kirim Broadcast`.
  2. **Chatroom Web (`chatroom-web`)**: Modul `Chat Room` (interaksi pesan outbound, running cost indicator, quick-setting session limit, and limit top-up).
  3. **Backend / Database Layer**: Penyesuaian konfigurasi harga base price & mark-up per kategori per negara via direct database update.

- **Referensi Struktur UI (`strukturmenu/`)**:
  - `strukturmenu/dashboard-crm/Whatsapp Credit.png` (Pengaturan Monthly Limit, tampilan pengeluaran bulan ini, download credit history).
  - `strukturmenu/dashboard-crm/Daftar Broadcast 01.png` & `Daftar Broadcast 02.png` (Status pengiriman broadcast, alokasi kredit).
  - `strukturmenu/dashboard-crm/Form Create Broadcast.png` & `Form Create Broadcast 02.png` (Pemilihan template berbayar & estimasi penerima).
  - `strukturmenu/chatroom-web/chatroom01.png` (Tampilan chat list, room percakapan, action banner/top-up modal).

- **In-Scope**:
  1. **Pengaturan Harga & Kategori Pesan**: Dukungan tarif multi-kategori (Marketing, Utility, Authentication, Service) x negara tujuan di level database.
  2. **Pengecualian Free Entry Point (FEP)**: Pesan inbound dari CTWA/WTWA tidak memotong saldo kredit.
  3. **Mekanisme Credit Isolation & Rollback**:
     - Isolasi saldo saat pesan di-trigger (Broadcast, Chatroom, API).
     - Rollback kredit otomatis secara instan saat Meta mengembalikan respon *Explicit Failed*.
     - Pencatatan nett deduction log (`Isolated - Rolled Back`).
  4. **WhatsApp Credit Management (Dashboard CRM)**:
     - Tampilan *"Pengeluaran bulan ini"* mencakup Service Message.
     - Penegakan *Monthly Credit Limit* per nomor WABA.
     - Export Excel *Credit History* dengan template type *"Service"*.
  5. **Chatroom Running Cost & Flat Session Limit (Chatroom Web)**:
     - Indikator real-time biaya berjalan per sesi percakapan.
     - Konfigurasi *Flat Session Limit* non-segmentasi.
     - Pemblokiran pesan *outbound* saat limit tercapai (pesan *inbound* customer tetap masuk normal).
     - Top-up manual session limit oleh Agent (preset: Rp2.000, Rp5.000, Rp10.000) dengan validasi kecukupan total saldo WhatsApp Credit.
     - Reset session limit saat chatroom di-closing oleh CS/Owner.

- **Out-of-Scope**:
  - UI Web Portal khusus Internal Ops Admin untuk edit harga (dilakukan via manual direct database).
  - Segmentasi dinamis session limit per label/kategori pelanggan (fase rilis mendatang).
  - Integrasi payment gateway top-up saldo utama (menggunakan modul billing eksisting).

---

## 2. Prasyarat Sistem & Konfigurasi Lingkungan (Pre-requisites)

1. Akun bisnis Everpro dengan status langganan aktif dan memiliki nomor WABA resmi (WhatsApp Official).
2. Saldo WhatsApp Credit utama tersedia (> Rp 0) pada akun merchant.
3. Master data harga Meta New Pricing (Base Price + Margin) telah terkonfigurasi pada tabel basis data.
4. Role pengguna memiliki izin akses yang sesuai (Owner, Supervisor, Admin, Agent CS).

---

## 3. Matriks Hak Akses (RBAC Matrix)

Mengacu pada `Testcase-support/[SSOT] Requirement for RBAC Customer Dashboard.xlsx`:

| Modul / Fitur / Aksi | Owner | Supervisor / Admin | CS Closing / Operasional | Keterangan & Expected Behavior |
| :--- | :---: | :---: | :---: | :--- |
| **View WhatsApp Credit Dashboard** | ✅ | ✅ | ❌ | CS tidak memiliki menu WhatsApp Credit (Hidden). |
| **Set Monthly Credit Limit per WABA** | ✅ | ✅ | ❌ | Disabled/Hidden untuk role selain Owner/Supervisor. |
| **Download Credit History (.xlsx)** | ✅ | ✅ | ❌ | Export file history usage lengkap. |
| **Kirim Broadcast Berbayar** | ✅ | ✅ | ❌ | Inisiasi isolasi saldo kredit kampanye broadcast. |
| **View Running Cost di Chatroom** | ✅ | ✅ | ✅ | Muncul indikator biaya berjalan di header/sidebar room. |
| **Configure Flat Session Limit (Global)**| ✅ | ✅ | ❌ | Akses setting batas per sesi percakapan. |
| **Top-up Session Limit (Rp2k/5k/10k)** | ✅ | ✅ | ✅ | **Semua Agent** dapat top-up jika limit sesi tercapai. |
| **Kirim Pesan Outbound di Chatroom** | ✅ | ✅ | ✅ | Terisolasi jika Service/Template, diblokir jika limit habis. |

---

## 4. Logika Bisnis, Aturan Validasi & Decision Matrix

### A. Decision Table: Credit Isolation, Delivery & Rollback Flow

| Kondisi Masukan (Conditions) | Rule 1 (FEP Active) | Rule 2 (Normal Sent) | Rule 3 (Meta Failed) | Rule 4 (Saldo Kurang) | Rule 5 (Limit Exceeded) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Free Entry Point Window Aktif? | **TRUE** | **FALSE** | **FALSE** | **FALSE** | **FALSE** |
| Saldo WhatsApp Credit Mencukupi? | - | **TRUE** | **TRUE** | **FALSE** | **TRUE** |
| Monthly / Session Limit Tercapai? | - | **FALSE** | **FALSE** | - | **TRUE** |
| Respon Pengiriman dari Meta | Success | Delivered | **Explicit Failed** | - | - |
| **Aksi & Hasil (Actions / Assertions)** | | | | | |
| **Kredit Diisolasi / Dipotong Sementara** | ❌ (Rp 0) | ✅ (Base + Margin)| ✅ (Base + Margin)| ❌ | ❌ |
| **Pesan Terkirim ke Penerima** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Eksekusi Rollback Kredit** | ❌ | ❌ | ✅ **(100% Instant)**| ❌ | ❌ |
| **Log History Transaksi Tercatat** | Free (Rp 0) | Deducted (Nett) | Rolled Back (Nett 0)| - | Blocked Alert |

### B. Decision Table: Chatroom Session Limit & Top-Up Matrix

| Skenario / Kondisi | Status Limit Sesi | Saldo Utama WA Credit | Aksi User | Expected System Behavior |
| :--- | :---: | :---: | :--- | :--- |
| **Normal Outbound** | < Flat Limit | Cukup | CS kirim pesan template/service | Pesan terkirim, running cost bertambah, saldo terpotong. |
| **Limit Reached Inbound** | >= Flat Limit | Cukup | Customer kirim pesan ke CS | Pesan masuk & terlihat normal di chatroom. |
| **Limit Reached Outbound**| >= Flat Limit | Cukup | CS mencoba kirim pesan keluar | Pengiriman diblokir; alert *"Batas limit sesi tercapai"*. |
| **Top-Up Valid** | >= Flat Limit | >= Nilai Top-Up (e.g. 5k)| CS klik Top-up Rp5.000 | Limit sesi bertambah Rp5.000, blokir terbuka, log tercatat. |
| **Top-Up Saldo Kurang** | >= Flat Limit | < Nilai Top-Up (e.g. 1k)| CS klik Top-up Rp5.000 | Gagal top-up; muncul toast *"Saldo WhatsApp Credit tidak mencukupi"*. |
| **Closing Room Reset** | >= Flat Limit | Cukup | CS klik tombol `Closing / Selesaikan Chat` | Room tertutup. Saat customer chat lagi, limit sesi di-reset default. |

### C. Boundary Value Analysis (BVA): Monthly Limit & Top-Up Presets

| Variabel Uji | Nilai Batas / Kasus Uji | Expected Result |
| :--- | :--- | :--- |
| **Monthly Credit Limit** | `Limit = Rp 1.000.000` / Total terpakai `Rp 999.000` | Pesan seharga Rp 1.500 berhasil terkirim sebagian/terisolasi. |
| **Monthly Credit Limit** | `Limit = Rp 1.000.000` / Total terpakai `Rp 1.000.000` | Pesan berikutnya ditolak: *"Monthly credit limit has exhausted"*. |
| **Top-Up Presets** | Pilihan dropdown: Rp2.000, Rp5.000, Rp10.000 | Hanya nilai preset yang dapat dipilih (tidak ada input custom liar). |

---

## 5. Integrasi Teknis, Penanganan Kegagalan & Edge Cases

1. **Error Handling & Validations**:
   - Respon penolakan ketika saldo kredit tidak mencukupi untuk mengisolasi pengiriman broadcast massal.
   - Pesan error jelas di chatroom ketika CS mencoba mengirim pesan saat session limit tercapai.
2. **Third-Party & Meta Webhook Failure**:
   - Jika Meta mengembalikan status *Explicit Failed* (e.g. Nomor tidak terdaftar di WA, template ditolak, akun tujuan diblokir), sistem wajib langsung merollback kredit seketika tanpa jeda waktu buffer.
3. **Database & Data Integrity**:
   - Transaksi pemotongan, isolasi, dan rollback menggunakan database atomic transaction untuk mencegah ketidaksesuaian saldo (*race condition* saat concurrent broadcast dan chatroom outbound).
   - Log history pencatatan mencakup: `Actor`, `WABA Number`, `Message Category`, `Template Type (Service/Marketing/Utility)`, `Gross Deducted`, `Rolled Back`, dan `Nett Amount`.

---

## 6. Dampak Regresi (Impact & Regression Scope)

- **Modul Broadcast Existing**: Pengiriman broadcast reguler & interaktif harus tetap berjalan normal dengan skema isolasi kredit baru.
- **Chatroom Web CS Flow**: Pengiriman pesan teks biasa, quick reply, dan media tidak boleh mengalami lag/delay akibat kalkulasi real-time running cost.
- **Export Data & Reporting**: Format export credit history tidak boleh merusak kolom existing pada parser reporting keuangan.

---

## 7. Catatan Klarifikasi & Keputusan Produk (Clarification & Alignment Log)

| No | Topik Pertanyaan | Hasil Konfirmasi & Keputusan |
| :---: | :--- | :--- |
| 1 | **Internal Admin Portal** | Tidak ada portal UI web khusus ops; update harga base & markup dilakukan langsung di database. |
| 2 | **Mekanisme Buffer Time Rollback** | Tidak ada timer buffer tunggu; rollback dieksekusi instan saat Meta mengembalikan respon *Explicit Failed*. |
| 3 | **Pesan Masuk saat Limit Tercapai** | Pesan *inbound* dari customer tetap masuk normal; hanya pesan *outbound* dari agen yang dibatasi. |
| 4 | **Siklus Reset Flat Session Limit** | Limit sesi di-reset kembali ke nilai default saat percakapan di-closing oleh CS/Owner. |
| 5 | **Validasi Saldo pada Top-Up Limit** | Validasi mengacu pada ketersediaan saldo utama WhatsApp Credit; jika saldo < nominal top-up, sistem memunculkan pesan error saldo tidak mencukupi. |
