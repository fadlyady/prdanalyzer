# Analisis Komprehensif PRD & Perancangan Test Matrix: Everpro Chat Meta New Pricing 2026

Dokumen ini merupakan hasil analisis mendalam terhadap PRD **`[PB & PRD] Everpro Chat Meta New Pricing 2026.docx`**, yang diintegrasikan dengan:
- **Aturan Hak Akses (SSOT RBAC Customer Dashboard)**
- **Struktur Menu & Alur UI (`strukturmenu/`)**
- **Prasyarat Sistem (*System Pre-requisites*)**
- **Aturan Bisnis & Konfirmasi Spesifikasi (Clarification Answers)**

---

## 1. Fondasi Arsitektur & Konteks Bisnis

### A. Perubahan Utama Meta New Pricing 2026
Meta memperkenalkan penagihan per-pesan resmi WhatsApp Business API (WABA) untuk:
1. **Service Message (Customer Care / Inbound response)**: Dikenakan biaya per pesan terkirim saat merespons pesan pelanggan.
2. **Template Messages**:
   - **Marketing** (Broadcast, Promosi)
   - **Utility** (Notifikasi pesanan, Update akun)
   - **Authentication** (OTP, Verifikasi)

### B. Prasyarat Mutlak (Mandatory Pre-conditions)
Sebelum skenario pengujian operasional dijalankan, sistem wajib memenuhi:
1. **Subscription Aktif**: Akun Everpro memiliki paket langganan aktif.
2. **WABA Terdaftar & Terverifikasi**: Nomor WABA aktif di dashboard Everpro.
3. **Agent Ditugaskan ke WABA**: Akun penguji/agen telah di-assign ke nomor WABA terkait.

### C. Keputusan Bisnis & Aturan Alur Terkonfirmasi
1. **Siklus Sesi Percakapan (*Session Window*)**:
   - Running cost percakapan di-reset kembali ke Rp0 saat **chatroom ditutup/di-closing**.
   - Sesi baru yang di-trigger kembali oleh customer akan memulai akumulasi *running cost* dari awal (default: Rp0).
2. **Kondisi Rollback Kredit**:
   - Rollback saldo kredit dieksekusi seketika sistem menerima respons status **`FAILED`** dari Meta.
3. **Pesan Bebas (*Free Text*) vs Template di Chatroom**:
   - Jika di luar jendela interaksi aktif pelanggan, agen **wajib mengirim Template Message** (dikenakan biaya sesuai template: Marketing/Utility/Auth).
   - Setelah pelanggan memberikan respons/balasan, agen dapat mengirim pesan balasan bebas yang dikenakan biaya sebagai **Service Message**.
4. **Mekanisme Top-Up Limit Sesi**:
   - Penambahan limit sesi (+Rp2.000, +Rp5.000, +Rp10.000) menaikkan batas limit pada percakapan tersebut.
   - Tetap terikat validasi saldo WhatsApp Credit organisasi: Jika saldo utama tidak mencukupi, sistem menampilkan error *"Saldo organisasi tidak mencukupi"*.
5. **Perilaku *Limit-Reached***:
   - Pesan masuk (*inbound*) dari customer tetap masuk, tersimpan, dan dapat dibaca oleh CS.
   - Kotak input balasan agen diblokir total hingga limit sesi dinaikkan / diperbarui.

---

## 2. Matriks Hak Akses (RBAC) & Pemetaan Menu

| Menu / Sub-Menu / Aksi | SSOT Access Code | Biz Ops Admin | Owner / Supervisor | CS Closing / CS Operasional |
| :--- | :--- | :---: | :---: | :---: |
| **Pricing Management (Base, Markup, Custom)** | `admin-pricing-*` | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Price Logging & Audit Trail** | `admin-price-log` | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **WhatsApp Credit Page** | `whatsapp-credit-view` | ❌ Forbidden | ✅ Full Access | ❌ Forbidden (Menu Hidden/Block) |
| **Monthly Spend View (Pengeluaran Bulan Ini)** | `whatsapp-credit-expense` | ❌ Forbidden | ✅ Full Access | ❌ Forbidden |
| **Set Monthly Credit Limit** | `whatsapp-credit-limit` | ❌ Forbidden | ✅ Full Access | ❌ Forbidden |
| **Export Credit Usage History** | `whatsapp-credit-export` | ❌ Forbidden | ✅ Full Access | ❌ Forbidden |
| **Broadcast Campaign (Daftar & Buat Broadcast)**| `crm-broadcast-*` | ❌ Forbidden | ✅ Full Access | ❌ Forbidden (kecuali didelegasikan) |
| **Chatroom - View Running Cost** | `crm-chatroom-view-cost`| ❌ Forbidden | ✅ Full Access | ✅ Full Access |
| **Chatroom - Set Flat Session Limit** | `crm-chatroom-set-limit`| ❌ Forbidden | ✅ Full Access | ❌ Forbidden |
| **Chatroom - Manual Top-Up Session Limit** | `crm-chatroom-topup-limit`| ❌ Forbidden | ✅ Full Access | ✅ Full Access (Preset only) |
| **Chatroom - Kirim Template / Service Message**| `crm-chatroom-send-msg` | ❌ Forbidden | ✅ Full Access | ✅ Full Access (Sesuai kuota limit) |

---

## 3. Metodologi Pengujian (Testing Methods) & Skala Prioritas

### Testing Methods
1. **Decision Table Testing (DT)**: Memvalidasi kombinasi aturan bisnis (FEP vs Non-FEP, Saldo Cukup vs Kurang, Sesi Open vs Closed, Limit Tercapai vs Belum).
2. **State Transition Testing (ST)**: Memvalidasi siklus status kredit (`Available` ➔ `Isolated/Hold` ➔ `Deducted (Nett)` atau `Rolled Back (Failed)`).
3. **Boundary Value Analysis (BVA)**: Pengujian nilai ambang batas (Saldo Rp0, Saldo pas-pasan, Limit Sesi Rp0, Akumulasi = Monthly Limit, Akumulasi = Monthly Limit + 1).
4. **Equivalence Partitioning (EP)**: Pengujian partisi valid/invalid untuk kategori pesan (Marketing, Utility, Auth, Service) dan negara tujuan.
5. **Access Control Testing (AC)**: Memastikan otorisasi RBAC tertutup rapat untuk role yang tidak berhak.
6. **Negative / Error Handling Testing (NEG)**: Memvalidasi pesan error saat saldo habis, limit tercapai, jaringan timeout, atau respons failed dari Meta.

### Prioritas
- **P1 (Critical / Blocker)**: Alur transaksi keuangan, isolasi kredit, rollback saat Meta failed, penegakan blokir limit sesi & limit bulanan, proteksi Free Entry Point.
- **P2 (High)**: Validasi RBAC per role, kalkulasi running cost real-time di chatroom, top-up limit sesi + validasi saldo organisasi, filter export history.
- **P3 (Medium)**: Audit log perubahan harga admin, log top-up agen, formatting tampilan mata uang, estetika UI.

---

## 4. Test Matrix & Scenario Flow Detail

```
                                    +------------------------------------------+
                                    |        Trigger Pengiriman Pesan          |
                                    +------------------------------------------+
                                                         |
                                       [Apakah Window FEP Aktif?]
                                      /                          \
                               (Ya)  /                            \ (Tidak)
                                    v                              v
               +-----------------------------+        +-----------------------------+
               |  Bypass Deduct / 0 Charge   |        |  Validasi Saldo & Limit:    |
               |  Pesan Langsung Terkirim    |        |  1. Monthly Limit Habis?    |
               +-----------------------------+        |  2. Session Limit Habis?    |
                                                      |  3. Saldo Organisasi Cukup? |
                                                      +-----------------------------+
                                                                     |
                                                                (Memenuhi)
                                                                     v
                                                      +-----------------------------+
                                                      | Credit Isolation (Hold)     |
                                                      | Base Price + Markup         |
                                                      +-----------------------------+
                                                                     |
                                                          [Respons dari Meta]
                                                         /                 \
                                               (DELIVERED)                  (FAILED)
                                                     /                       \
                                                    v                         v
                                      +--------------------+    +--------------------+
                                      | Nett Deduction     |    | Immediate Rollback |
                                      | Saldo Terpotong    |    | Saldo Utuh 100%    |
                                      +--------------------+    +--------------------+
```

---

### MODUL 1: Admin Paid Message Pricing Management (User Story 1)

| TC ID | Skenario Pengujian | Pre-conditions | Test Steps | Expected Result | Method | Role | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **TC-ADM-001** | Update Base Price Meta untuk 4 Kategori x Negara Tujuan | Login sebagai Biz Ops Admin | 1. Masuk menu Admin Pricing.<br>2. Pilih Kategori (Marketing/Utility/Auth/Service).<br>3. Masukkan negara & harga baru.<br>4. Atur Effective Date.<br>5. Simpan. | Base Price tersimpan di database dan aktif sesuai Effective Date. | EP, DT | Biz Ops Admin | **P1** |
| **TC-ADM-002** | Pengujian Effective Date Harga Baru (Before vs After) | Base price baru diset aktif tanggal T+1 | 1. Kirim pesan pada tanggal T (sebelum effective date).<br>2. Kirim pesan pada tanggal T+1 (setelah effective date). | Pesan pada tanggal T memakai harga lama; pesan pada tanggal T+1 memakai harga baru. | BVA, ST | System | **P1** |
| **TC-ADM-003** | Konfigurasi General Markup Price Everpro | Login sebagai Biz Ops Admin | 1. Atur general markup per kategori x negara.<br>2. Simpan perubahan. | Pengguna umum yang mengirim pesan dikenakan harga: `Base Price + General Markup`. | EP | Biz Ops Admin | **P2** |
| **TC-ADM-004** | Konfigurasi Custom Markup Price per User ID Spesifik | Login sebagai Biz Ops Admin | 1. Input User ID khusus (misal: VIP client).<br>2. Atur custom markup rate khusus.<br>3. Simpan. | User dengan User ID tersebut dikenakan tarif kustom; user lain tetap memakai general markup. | DT, EP | Biz Ops Admin | **P1** |
| **TC-ADM-005** | Verifikasi Audit Trail Price Logging | Base/Markup diubah oleh Admin | 1. Buka audit log harga.<br>2. Periksa detail log perubahan terakhir. | Log mencatat: Actor/Admin ID, New Price, Kategori, Negara, User ID (jika kustom), & Timestamp valid. | EP | Biz Ops Admin | **P3** |
| **TC-ADM-006** | RBAC Protection: Akses Halaman Admin Pricing oleh Non-Admin | Login sebagai Owner / Supervisor / CS | 1. Coba navigasi via URL langsung ke endpoint/halaman admin pricing. | Akses ditolak (403 Forbidden / Redirect ke Dashboard). | AC | Owner, CS | **P2** |

---

### MODUL 2: Execution, Free Entry Point & Credit Lifecycle (User Story 2)

| TC ID | Skenario Pengujian | Pre-conditions | Test Steps | Expected Result | Method | Role | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **TC-EXE-001** | Pengiriman Pesan dalam Window Free Entry Point (CTWA / WTWA) | FEP window pelanggan aktif (inbound CTWA/WTWA) | 1. Kirim pesan (Marketing/Utility/Auth/Service) via chatroom/broadcast/API. | Validasi & pemotongan saldo di-bypass (0 charge). Pesan langsung terkirim. | DT, EP | Owner/Supv, CS | **P1** |
| **TC-EXE-002** | Isolasi Kredit saat Trigger Pengiriman Pesan (Non-FEP) | Saldo cukup, di luar FEP | 1. Kirim template/service message.<br>2. Cek status saldo kredit seketika. | Saldo kredit terisolasi (*hold*) sebesar `Base Price + Markup`. Pesan diteruskan ke Meta. | ST | Owner/Supv, CS | **P1** |
| **TC-EXE-003** | Rollback Kredit Otomatis saat Meta Memberikan Respons `FAILED` | Pesan terisolasi dikirim ke nomor tidak valid/terblokir | 1. Kirim pesan hingga kredit terisolasi.<br>2. Meta mengembalikan status `FAILED`. | Saldo yang terisolasi otomatis di-rollback utuh (100%) ke saldo aktif organisasi. | ST, NEG | System | **P1** |
| **TC-EXE-004** | Nett Deduction saat Pesan Sukses Terkirim (`DELIVERED`) | Pesan terisolasi dikirim ke nomor valid | 1. Kirim pesan.<br>2. Meta mengembalikan status `DELIVERED`. | Saldo terisolasi didebit permanen (*Nett Deduction*) dan tercatat di riwayat mutasi kredit. | ST | System | **P1** |
| **TC-EXE-005** | Proteksi Saldo Organisasi Tidak Mencukupi (Insufficient Balance) | Saldo organisasi < biaya pesan yang akan dikirim | 1. Buka chatroom/broadcast.<br>2. Coba kirim pesan berbayar. | Pengiriman dicegah, muncul notifikasi error bahwa saldo kredit tidak mencukupi. | BVA, NEG | Owner/Supv, CS | **P1** |
| **TC-EXE-006** | Chatroom: Kirim Pesan di Luar Window Aktif Wajib Menggunakan Template | Chatroom di luar 24h CS window / sesi baru | 1. CS membuka chatroom.<br>2. Coba kirim free text.<br>3. Pilih template message lalu kirim.<br>4. Customer membalas, lalu CS mengirim free text balasan. | - Free text sebelum ada respons customer dicegah / diarahkan memilih template.<br>- Template dikenakan tarif template.<br>- Balasan setelah respon customer dikenakan tarif Service Message. | DT, ST | CS, Owner | **P1** |

---

### MODUL 3: WhatsApp Credit Management & Monthly Limit (User Story 3)

| TC ID | Skenario Pengujian | Pre-conditions | Test Steps | Expected Result | Method | Role | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **TC-CRD-001** | Tampilan Pengeluaran Bulan Ini (*Monthly Expense*) Mencakup Service Message | Transaksi Marketing, Utility, Auth, dan Service telah terjadi | 1. Masuk menu WhatsApp Credit.<br>2. Lihat card "Pengeluaran bulan ini". | Total pengeluaran menghitung akumulasi seluruh kategori termasuk Service Message. | EP | Owner, Supv | **P2** |
| **TC-CRD-002** | Pengaturan Batas Pengeluaran Bulanan (*Monthly Credit Limit*) | Login sebagai Owner/Supervisor | 1. Masuk pengaturan WhatsApp Credit.<br>2. Input batas kredit bulanan.<br>3. Simpan. | Monthly limit aktif dan menjadi batas acuan akumulasi bulanan WABA. | EP, BVA | Owner, Supv | **P2** |
| **TC-CRD-003** | Blokir Pengiriman saat Batas Kredit Bulanan Tercapai (*Limit Exhausted*) | Akumulasi pemakaian bulan berjalan >= Monthly Limit | 1. Coba kirim pesan berbayar (Broadcast/Chatroom/API). | Pengiriman diblokir total, sistem memunculkan pesan error: *"monthly credit limit has exhausted"*. | BVA, NEG | Owner/Supv, CS | **P1** |
| **TC-CRD-004** | Ekspor Riwayat Penggunaan Kredit (*Credit History Download*) | Terdapat transaksi beragam tipe pesan | 1. Klik tombol Download/Export History pada WABA.<br>2. Buka file hasil export. | File export memuat baris transaksi Service Message dengan nilai `TEMPLATE TYPE = "Service"` dan nominal potongan yang valid. | EP, DT | Owner, Supv | **P2** |
| **TC-CRD-005** | RBAC Protection: Akses Menu WhatsApp Credit oleh CS | Login sebagai CS Operasional / CS Closing | 1. Periksa sidebar menu navigasi.<br>2. Coba akses direct URL `/whatsapp-credit`. | Menu WhatsApp Credit tidak tampil di sidebar; akses direct URL menghasilkan 403 Forbidden. | AC | CS Operasional, CS Closing | **P2** |

---

### MODUL 4: Chatroom Cost Visibility, Session Limit & Top-Up (User Story 4)

| TC ID | Skenario Pengujian | Pre-conditions | Test Steps | Expected Result | Method | Role | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **TC-CHT-001** | Running Cost Visibility Real-Time dalam Percakapan Aktif | Chatroom aktif dengan customer | 1. Buka percakapan.<br>2. Kirim pesan berbayar pertama.<br>3. Kirim pesan berbayar kedua. | Running cost tampil di header chatroom dan bertambah secara real-time setiap pesan berbayar terkirim. | UI Dynamic, EP | CS, Owner, Supv | **P2** |
| **TC-CHT-002** | Reset Running Cost saat Chatroom Ditutup (*Closing*) & Trigger Sesi Baru | Sesi lama memiliki running cost > Rp0 | 1. CS melakukan "Close/Selesaikan Chat".<br>2. Customer mengirim pesan baru (trigger sesi baru).<br>3. Buka percakapan. | Running cost kembali ter-reset menjadi nilai awal (Rp0). | ST | CS, Owner, Supv | **P1** |
| **TC-CHT-003** | Pengaturan Flat Session Limit dari Chatroom oleh Owner/Supervisor | Login sebagai Owner/Supervisor | 1. Buka shortcut setting session limit di chatroom.<br>2. Input nilai limit flat (misal: Rp10.000).<br>3. Simpan. | Limit flat berlaku secara generik untuk seluruh percakapan tanpa bergantung label/segmentasi. | EP, BVA | Owner, Supv | **P2** |
| **TC-CHT-004** | Blokir Pengiriman saat Sesi Mencapai Flat Limit (*Limit-Reached*) | Running cost sesi percakapan mencapai Flat Session Limit | 1. Kirim pesan hingga cost = limit.<br>2. Amati tampilan chatroom.<br>3. Coba ketik dan kirim pesan keluar. | - Chatroom diberi flag *limit-reached*.<br>- Input balasan CS dinonaktifkan/diblokir.<br>- Pesan masuk dari customer tetap dapat diterima dan dibaca. | ST, BVA | CS, Owner, Supv | **P1** |
| **TC-CHT-005** | Manual Limit Top-Up oleh Agen (Preset Rp2.000 / Rp5.000 / Rp10.000) - Saldo Cukup | Percakapan berstatus *limit-reached*, saldo organisasi cukup | 1. CS membuka chat yang terblokir.<br>2. Buka dropdown top-up limit (+Rp2.000 / +Rp5.000 / +Rp10.000).<br>3. Konfirmasi penambahan limit. | - Limit sesi bertambah sesuai nominal preset.<br>- Flag blokir terbuka & CS dapat kembali mengirim pesan.<br>- Aksi tercatat di log (Agent ID, Timestamp, Nominal). | ST, EP | CS Operasional, CS Closing | **P1** |
| **TC-CHT-006** | Manual Limit Top-Up oleh Agen - Saldo Organisasi Tidak Cukup | Percakapan berstatus *limit-reached*, saldo organisasi < nominal top-up | 1. CS memilih preset top-up Rp10.000.<br>2. Konfirmasi penambahan limit. | Top-up ditolak, muncul notifikasi *"Saldo organisasi tidak mencukupi"*, chatroom tetap terblokir. | NEG, BVA | CS Operasional, CS Closing | **P1** |
| **TC-CHT-007** | Inbound Message Persistence saat Chatroom *Limit-Reached* | Percakapan berstatus *limit-reached* | 1. Customer mengirim pesan chat dari WhatsApp.<br>2. Amati tampilan chatroom CS. | Pesan customer sukses masuk, bubble chat muncul, unread badge bertambah, namun CS tetap tidak bisa membalas sebelum top-up. | DT, ST | System, CS | **P1** |
| **TC-CHT-008** | RBAC Protection: Pengaturan Default Flat Session Limit oleh CS | Login sebagai CS Operasional / CS Closing | 1. Buka chatroom.<br>2. Cari opsi pengaturan default flat session limit. | Opsi setting default limit tidak tersedia/disabled untuk role CS. | AC | CS Operasional, CS Closing | **P2** |

---

## 5. Ringkasan Kesiapan & Rekomendasi Pengujian

Dokumen analisis ini telah mencakup seluruh dimensi pengujian:
- **Coverage Fungsional**: User Story 1 s.d. 4 (Admin Pricing, Execution & Rollback, WhatsApp Credit & Monthly Limit, Chatroom Session Limit & Top-up).
- **Security & Authorization**: Pengujian matriks RBAC ketat (Owner, Supervisor, CS Operasional, CS Closing, Biz Ops Admin).
- **Integritas Transaksi & Keuangan**: Validasi saldo isolasi, pembatalan/rollback saat Meta gagal, dan pencegahan over-spend melalui limit bulanan/sesi.
