## Pre-Condition & Authentication Guard

### 1. Subscription Inactive Guard
1. User login dengan akun merchant berstatus subscription Inactive / Expired.
2. User membuka halaman `/chat/broadcast` atau `/chat/chatroom`.
3. User melihat banner / modal peringatan paket subscription tidak aktif.
4. User melihat seluruh input pengiriman pesan dinonaktifkan dan muncul CTA perpanjang langganan.

### 2. WABA Not Registered / Invalid Guard
1. User login sebagai Owner / Supervisor dengan subscription aktif namun belum mendaftarkan nomor WABA.
2. User membuka halaman `/chat/broadcast`.
3. User melihat pesan peringatan bahwa nomor WABA belum terhubung.
4. User melihat tombol kirim pesan / broadcast tidak dapat diklik.

### 3. WABA Unassigned Agent Guard
1. User login sebagai Owner / Supervisor pada organisasi yang memiliki nomor WABA aktif tanpa agen yang di-assign.
2. User membuka halaman `/chat/chatroom`.
3. User melihat peringatan bahwa nomor WABA belum memiliki agen operasional.
4. User diarahkan untuk melakukan penugasan agen sebelum memulai percakapan.

---

## Role-Based Access Control (RBAC)

### 4. CS Role Forbidden to Admin Pricing
1. User login sebagai CS Operasional atau CS Closing.
2. User mencoba membuka direct URL `/admin/pricing`.
3. User melihat halaman error `403 Forbidden` atau dialihkan ke halaman dashboard utama.

### 5. CS Role Forbidden to WhatsApp Credit Management
1. User login sebagai CS Operasional atau CS Closing.
2. User memeriksa sidebar navigasi menu.
3. User melihat menu `WhatsApp Credit` tidak tampil di sidebar.
4. User mencoba membuka direct URL `/whatsapp-credit`.
5. User melihat halaman error `403 Forbidden` atau dialihkan kembali.

### 6. CS Role Forbidden to Edit Default Flat Session Limit
1. User login sebagai CS Operasional atau CS Closing.
2. User membuka halaman `/chat/chatroom`.
3. User melihat tombol / menu pengaturan default `Flat Session Limit` tidak tersedia atau dalam keadaan disabled.

---

## Modul 1: Admin Paid Message Pricing Management

### 7. Biz Ops Admin Update Meta Base Price with Effective Date
1. User login sebagai Everpro Biz Ops Admin.
2. User membuka halaman `/admin/pricing/base-price`.
3. User memilih Kategori `Service` dan Negara `Indonesia (ID)`.
4. User mengisi base price baru (misal: Rp300).
5. User mengatur `Effective Date` pada tanggal dan jam mendatang (T+1).
6. User klik `Simpan`.
7. User melihat toast `Base price berhasil diperbarui`.
8. User melihat data baru tercatat di tabel base price dengan status pending effective date.

### 8. Biz Ops Admin Configure General Markup Price
1. User login sebagai Everpro Biz Ops Admin.
2. User membuka halaman `/admin/pricing/markup-general`.
3. User memilih Kategori `Marketing` dan Negara `Indonesia (ID)`.
4. User mengisi nilai markup (misal: Rp50).
5. User klik `Simpan`.
6. User melihat toast `Markup general berhasil disimpan`.
7. User melihat tabel markup general menampilkan nilai Rp50 untuk Marketing ID.

### 9. Biz Ops Admin Set Custom Markup Price per User ID
1. User login sebagai Everpro Biz Ops Admin.
2. User membuka halaman `/admin/pricing/custom-user`.
3. User memasukkan `User ID` target (misal: `USR_9901`).
4. User memilih Kategori `Utility` dan mengisi custom markup (misal: Rp20).
5. User klik `Simpan`.
6. User melihat toast `Custom pricing untuk USR_9901 berhasil disimpan`.
7. User melihat data tarif kustom muncul di tabel kustom user.

### 10. Audit Log on Price Changes
1. User login sebagai Everpro Biz Ops Admin.
2. User melakukan perubahan pada tarif markup general atau custom user.
3. User membuka halaman `/admin/pricing/audit-logs`.
4. User melihat entri log baru yang memuat Admin ID, Old Price, New Price, Kategori, Negara, Target User ID, dan Timestamp.

---

## Modul 2: Execution, Free Entry Point & Credit Lifecycle

### 11. Free Entry Point (FEP) Active - CTWA / WTWA 0 Charge
1. User login sebagai CS Operasional / Owner.
2. Customer mengirim pesan inbound melalui iklan Click-to-WhatsApp (CTWA) atau Website-to-WhatsApp (WTWA).
3. User melihat indikator / badge `Free Entry Point Active` pada header chatroom percakapan tersebut.
4. User mengirim pesan balasan (Template / Service Message).
5. User melihat pesan langsung terkirim tanpa adanya isolasi / pemotongan saldo WhatsApp Credit organisasi (Charge Rp0).

### 12. Normal Outbound - Instant Credit Isolation (Hold)
1. User login sebagai Owner / Supervisor dengan saldo WhatsApp Credit mencukupi di luar window FEP.
2. User membuka halaman `/chat/broadcast` dan membuat campaign broadcast ke 100 kontak (biaya per pesan Rp500).
3. User klik `Kirim Broadcast`.
4. User melihat saldo WhatsApp Credit terisolasi seketika sebesar Rp50.000 (100 x Rp500).
5. User melihat saldo available berkurang sementara sebesar Rp50.000.

### 13. Immediate Credit Rollback on Meta Explicit FAILED
1. User login sebagai CS Operasional / Owner.
2. User mengirim template message ke nomor tujuan yang tidak valid / terblokir di luar window FEP.
3. User melihat saldo awal terisolasi sebesar tarif pesan (misal: Rp500).
4. Meta mengembalikan respons status pesan `FAILED`.
5. User melihat saldo yang terisolasi Rp500 seketika di-rollback utuh 100% ke saldo aktif organisasi.
6. User melihat status pengiriman pesan di chatroom berubah menjadi `Gagal Terkirim` dengan ikon retry.

### 14. Nett Deduction on Meta DELIVERED Status
1. User login sebagai CS Operasional / Owner.
2. User mengirim pesan berbayar ke kontak valid di luar window FEP.
3. User melihat saldo terisolasi sebesar tarif pesan (Rp500).
4. Meta mengembalikan status webhook `DELIVERED`.
5. User melihat saldo yang terisolasi berubah menjadi saldo terpotong definitif (*Nett Deducted*).
6. User melihat mutasi saldo tercatat di riwayat penggunaan kredit.

### 15. Insufficient Credit Balance Block Outbound
1. User login sebagai Owner / CS dengan saldo organisasi Rp0 atau lebih kecil dari biaya pesan yang akan dikirim.
2. User membuka chatroom atau form broadcast.
3. User klik `Kirim Pesan`.
4. User melihat modal / toast error `Saldo WhatsApp Credit tidak mencukupi`.
5. User melihat pesan tidak dikirimkan dan tidak ada request ke Meta.

### 16. Chatroom Outside 24h Window Requires Template Message
1. User login sebagai CS Operasional.
2. User membuka chatroom dengan customer yang belum membalas pesan > 24 jam / percakapan baru.
3. User mencoba mengetik di kotak input free text.
4. User melihat input free text dinonaktifkan dengan panduan `Kirim Template Pesan untuk memulai percakapan`.
5. User memilih template pesan Marketing / Utility dan mengirimkannya.
6. User melihat pesan terkirim dengan tarif sesuai template.
7. Customer mengirim balasan pesan.
8. User melihat input free text kini aktif dan balasan CS berikutnya dikenakan tarif `Service Message`.

---

## Modul 3: WhatsApp Credit Management & Monthly Limit

### 17. WhatsApp Credit Monthly Expense Includes Service Messages
1. User login sebagai Owner / Supervisor.
2. User membuka halaman `/whatsapp-credit`.
3. User memeriksa card `Pengeluaran Bulan Ini`.
4. User melihat nominal pengeluaran menghitung total akumulasi dari Marketing, Utility, Authentication, dan Service Message.

### 18. Set Monthly Credit Limit by Owner / Supervisor
1. User login sebagai Owner / Supervisor.
2. User membuka halaman `/whatsapp-credit`.
3. User klik `Atur Limit Bulanan`.
4. User memasukkan nominal limit (misal: Rp1.000.000).
5. User klik `Simpan`.
6. User melihat toast `Monthly credit limit berhasil diperbarui` dan progress bar penggunaan kredit tampil sesuai limit baru.

### 19. Monthly Credit Limit Exhausted Blocking
1. Akumulasi pengeluaran WABA telah mencapai atau melebihi Monthly Credit Limit (misal: Rp1.000.000 dari limit Rp1.000.000).
2. User (Owner / CS) membuka chatroom atau broadcast dan mencoba mengirim pesan berbayar.
3. User melihat sistem memblokir pengiriman pesan.
4. User melihat pesan error `Monthly credit limit has exhausted. Silakan naikkan limit bulanan Anda`.

### 20. Export Credit History Contains Service Message Type
1. User login sebagai Owner / Supervisor.
2. User membuka halaman `/whatsapp-credit/history`.
3. User klik tombol `Download / Ekspor Riwayat`.
4. User membuka file Excel / CSV hasil unduhan.
5. User melihat baris transaksi memuat kolom `TEMPLATE TYPE` dengan nilai `Service` untuk transaksi customer care dan nominal potongan yang akurat.

---

## Modul 4: Chatroom Cost Visibility, Session Limit & Top-Up

### 21. Real-Time Running Cost Update in Active Chatroom
1. User login sebagai CS Operasional / Owner.
2. User membuka percakapan aktif di chatroom.
3. User melihat widget `Running Cost: Rp0` pada header chatroom.
4. User mengirim 1 pesan berbayar Service Message (tarif Rp350).
5. User melihat widget running cost seketika berubah menjadi `Running Cost: Rp350`.
6. User mengirim 1 pesan berbayar lagi.
7. User melihat widget running cost bertambah secara real-time menjadi `Running Cost: Rp700`.

### 22. Reset Running Cost on Chatroom Closed and New Session Trigger
1. User login sebagai CS Operasional pada percakapan dengan running cost Rp1.500.
2. User klik tombol `Selesaikan Chat / Close Chat`.
3. User melihat status chatroom berubah menjadi `Closed`.
4. Customer mengirim pesan baru dari WhatsApp untuk memulai percakapan baru.
5. User membuka kembali percakapan tersebut.
6. User melihat widget running cost telah ter-reset kembali menjadi `Running Cost: Rp0`.

### 23. Owner / Supervisor Configure Flat Session Limit
1. User login sebagai Owner / Supervisor.
2. User membuka quick-access pengaturan limit di header chatroom.
3. User mengisi `Flat Session Limit` (misal: Rp5.000).
4. User klik `Simpan`.
5. User melihat toast `Batas biaya sesi percakapan berhasil disimpan`.
6. Seluruh percakapan generic kini memiliki batas maksimal biaya Rp5.000 per sesi.

### 24. Chatroom Limit-Reached Enforcement and Inbound Message Persistence
1. Sesi percakapan chatroom telah mencapai batas flat session limit (misal: cost Rp5.000 dari limit Rp5.000).
2. User membuka chatroom tersebut.
3. User melihat banner status `Limit Sesi Tercapai (Limit-Reached)`.
4. User melihat input balasan chat dinonaktifkan (disabled).
5. Customer mengirim pesan masuk baru dari WhatsApp.
6. User melihat pesan customer berhasil masuk, muncul di list chat, dan dapat dibaca.
7. User mencoba membalas chat dan melihat aksi tetap diblokir hingga limit dinaikkan.

### 25. Agent Manual Top-Up Session Limit (Preset Rp2.000 / Rp5.000 / Rp10.000) - Success
1. User login sebagai CS Operasional pada percakapan berstatus `Limit-Reached` dengan saldo organisasi mencukupi.
2. User klik tombol `Tambah Limit Sesi`.
3. User memilih preset `+Rp5.000` dari dropdown.
4. User klik `Konfirmasi Top-up`.
5. User melihat toast `Limit sesi berhasil ditambah sebesar Rp5.000`.
6. User melihat banner limit-reached hilang dan input balasan chat kembali aktif.
7. User mengirim pesan balasan ke customer dengan sukses.

### 26. Agent Manual Top-Up Session Limit - Insufficient Org Balance Fail
1. User login sebagai CS Operasional pada percakapan berstatus `Limit-Reached`.
2. Saldo WhatsApp Credit organisasi saat ini adalah Rp1.000.
3. User klik tombol `Tambah Limit Sesi` dan memilih preset `+Rp5.000`.
4. User klik `Konfirmasi Top-up`.
5. User melihat pesan error `Gagal menambah limit: Saldo organisasi tidak mencukupi`.
6. User melihat limit sesi tidak bertambah dan chatroom tetap dalam status terblokir.

### 27. Cumulative Manual Top-Up and Audit Logging
1. User login sebagai CS Operasional pada percakapan dengan limit awal Rp5.000.
2. User melakukan top-up pertama sebesar `+Rp2.000`.
3. User melakukan top-up kedua sebesar `+Rp5.000` dalam sesi yang sama.
4. User melihat total batas limit sesi menjadi Rp12.000 (Rp5.000 + Rp2.000 + Rp5.000).
5. User membuka panel riwayat aktivitas percakapan / audit log.
6. User melihat 2 entri log terpisah yang mencantumkan Nama/ID CS, Nominal Top-Up, dan Timestamp penambahan limit.
