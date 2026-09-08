# Automation-Ready Test Cases: Everpro Chat Meta New Pricing 2026

## Pre-Condition & Authentication Guard

### 1. Verifikasi pencegahan akses fitur Everpro Chat ketika Subscription tidak aktif / expired
1. User login menggunakan akun Everpro dengan status paket Subscription "Inactive" atau "Expired".
2. User membuka halaman `/whatsapp-credit` atau `/broadcast`.
3. User melihat banner/modal peringatan bahwa paket subscription tidak aktif dan seluruh aksi pengiriman pesan berbayar terblokir.

### 2. Verifikasi kegagalan pengiriman pesan saat nomor WABA belum terdaftar atau berstatus non-aktif
1. User login sebagai Owner / Supervisor dengan WABA yang berstatus "Disconnected" / belum terverifikasi di Meta.
2. User membuka halaman `/broadcast`.
3. User memilih nomor WABA yang tidak aktif dan mencoba klik `Kirim Broadcast`.
4. User melihat error toast "Nomor WABA tidak aktif" dan saldo kredit tidak mengalami pemotongan/isolasi.

### 3. Verifikasi kegagalan pengiriman pesan pada WABA yang belum memiliki agent yang di-assign
1. User login sebagai Agent / CS yang belum di-assign ke nomor WABA target.
2. User membuka halaman `/chatroom`.
3. User memilih percakapan dan mencoba mengetik serta mengirim pesan balasan.
4. User melihat sistem memblokir form pengiriman dan menampilkan notifikasi perlunya assignment agent oleh Owner/Supervisor.

---

## Role-Based Access Control (RBAC)

### 4. Verifikasi pembatasan hak akses role CS Operasional / CS Closing terhadap menu Credit Management & Monthly Limit
1. User login sebagai Agent / CS Operasional.
2. User mencoba mengakses direct URL `/whatsapp-credit/settings` untuk mengatur Monthly Limit.
3. User melihat halaman dialihkan (redirect) atau menampilkan pesan `403 Forbidden`.
4. User membuka halaman `/chatroom`.
5. User memverifikasi tombol/menu setting `Flat Session Limit` tersembunyi (hidden) untuk role Agent/CS.

---

## Modul 1: Pricing & Calculation Engine (Database Level)

### 5. Verifikasi perhitungan tarif pesan berbayar berbasis konfigurasi Master Data DB dalam satuan Rupiah (IDR)
1. Konfigurasi tarif di Database telah diset dalam mata uang IDR untuk kategori `Service Message` negara Indonesia (+62).
2. User login sebagai Agent / Owner dengan saldo WABA mencukupi.
3. User membuka halaman `/chatroom` dan mengirimkan 1 Service Message ke nomor WhatsApp Indonesia (+62).
4. User melihat sistem mengisolasi saldo kredit WABA tepat sebesar nominal tarif IDR yang terdaftar di database tanpa konversi kurs.

### 6. Verifikasi isolasi tarif khusus (Customizable Markup) untuk User ID spesifik yang terdaftar di Database
1. Database telah dikonfigurasi dengan tarif khusus (custom markup) untuk User ID merchant tertentu.
2. User login menggunakan akun merchant dengan User ID khusus tersebut.
3. User mengirimkan pesan template / service melalui `/broadcast` atau `/chatroom`.
4. User melihat saldo kredit yang diisolasi dihitung berdasarkan margin custom User ID terkait, bukan margin general.

### 7. Verifikasi masa transisi harga sebelum vs sesudah Effective Date yang tersimpan di Database
1. Database mencatat jadwal perubahan harga baru dengan timestamp `Effective Date` tertentu.
2. User mengirimkan pesan berbayar sebelum timestamp `Effective Date` tercapai.
3. User melihat pesan diisolasi menggunakan tarif lama.
4. User mengirimkan pesan berbayar tepat setelah timestamp `Effective Date` tercapai.
5. User melihat pesan diisolasi menggunakan tarif baru secara otomatis.

---

## Modul 2: Execution, Free Entry Point & Credit Lifecycle

### 8. Verifikasi pesan inbound dari CTWA (Click-to-WhatsApp Ads) mengaktifkan Free Entry Point (FEP) window
1. Customer mengklik iklan CTWA dan mengirimkan pesan WhatsApp inbound pertama ke nomor WABA merchant.
2. User Agent membuka `/chatroom` untuk melihat percakapan customer tersebut.
3. User melihat flag status percakapan aktif ditandai sebagai `Free Entry Point` aktif.

### 9. Verifikasi pesan inbound dari WTWA (Website-to-WhatsApp) mengaktifkan Free Entry Point (FEP) window
1. Customer mengklik widget WhatsApp resmi di website/landing page (WTWA) dan mengirim pesan inbound ke WABA.
2. User Agent membuka `/chatroom` pada percakapan tersebut.
3. User melihat status sesi percakapan berhasil mengenali trigger WTWA dan mengaktifkan Free Entry Point window.

### 10. Pengiriman pesan Template via Broadcast selama window FEP aktif tanpa pemotongan kredit
1. User login sebagai Owner / Supervisor.
2. User membuka halaman `/broadcast` dan membuat kampanye baru dengan target penerima yang memiliki status FEP aktif.
3. User klik `Kirim Broadcast`.
4. User melihat pesan broadcast berhasil terkirim dan saldo kredit WABA tetap utuh (Biaya = Rp0).
5. User melihat riwayat mutasi mencatat transaksi berstatus Free Entry Point dengan pemotongan Rp0.

### 11. Pengiriman pesan balasan via Chatroom (Human / AI Bot) dan Open API selama window FEP aktif bebas biaya
1. Customer dalam status FEP aktif mengirim pesan di Chatroom.
2. User Agent mengetik pesan balasan di `/chatroom` dan klik `Kirim Pesan` (atau pemicuan via Open API).
3. User melihat pesan terkirim secara instan tanpa ada isolasi maupun pemotongan saldo kredit WABA.

### 12. Verifikasi pengiriman pesan setelah FEP window kedaluwarsa (Expired) kembali dikenakan pemotongan kredit normal
1. Window Free Entry Point (FEP) pada customer telah kedaluwarsa (expired).
2. User Agent membuka percakapan customer tersebut di `/chatroom`.
3. User mengetik pesan balasan atau memilih template pesan dan klik `Kirim`.
4. User melihat sistem kembali mengisolasi dan memotong saldo kredit WABA sesuai tarif normal kategori pesan.

### 13. Verifikasi isolasi kredit instan saat CS mengklik tombol balas di Chatroom atau pemicuan Open API (Non-FEP)
1. User Agent membuka percakapan Non-FEP di `/chatroom` dengan saldo kredit WABA mencukupi.
2. User mengetik pesan dan klik tombol `Kirim` (atau trigger API kirim pesan).
3. Sistem secara instan menahan (mengisolasi) saldo sebesar `Base Price + Margin` dengan status `Temporary Deducted / Isolated` tepat saat pesan berstatus In-Flight.

### 14. Verifikasi Credit Rollback otomatis saat pesan menerima sinyal respon eksplisit "failed" dari Meta
1. User Agent mengirim pesan berbayar dari `/chatroom` dan saldo kredit telah diisolasi sementara.
2. Webhook Meta mengembalikan callback respon gagal eksplisit (`status: "failed"`).
3. User melihat sistem secara instan memicu `Credit Rollback` sebesar 100% nominal yang diisolasi.
4. User melihat saldo kredit WABA kembali utuh dan nett deduction log tercatat Rp0.

### 15. Verifikasi perhitungan Nett Credit Log pada status akhir pesan DELIVERED
1. User Agent mengirim pesan berbayar dan saldo kredit telah diisolasi sementara.
2. Webhook Meta mengembalikan callback status berhasil (`status: "delivered"`).
3. User melihat status isolasi kredit difinalisasi menjadi pemotongan permanen (`Nett Log = Full Cost`).
4. User melihat catatan mutasi saldo resmi tercantum pada riwayat transaksi kredit.

### 16. Chatroom: Kirim Pesan di Luar Window Aktif Wajib Menggunakan Template Message
1. User Agent membuka percakapan dengan customer yang tidak memiliki interaksi aktif selama >24 jam (window sesi tutup).
2. User melihat form input teks biasa (free text) dinonaktifkan atau memunculkan peringatan window expired.
3. User klik tombol `Pilih Template Message`, memilih template resmi, dan klik `Kirim`.
4. User melihat pesan template berhasil terkirim dan saldo diisolasi sesuai tarif kategori template.

---

## Modul 3: Credit Management & Monthly Limit

### 17. Verifikasi "Pengeluaran bulan ini" pada WhatsApp Credit Page mengikutsertakan biaya Service Message
1. User login sebagai Owner / Supervisor.
2. User membuka halaman `/whatsapp-credit`.
3. User melihat widget `Pengeluaran bulan ini` mengakumulasikan total biaya pesan dari 4 kategori: Marketing, Utility, Authentication, dan Service Message dalam satuan IDR.

### 18. Owner / Supervisor mengatur Monthly Credit Limit pada nomor WABA
1. User login sebagai Owner / Supervisor.
2. User membuka halaman `/whatsapp-credit/settings`.
3. User mengisi field `Monthly Credit Limit` dengan nilai `5000000` (Rp5.000.000).
4. User klik tombol `Simpan`.
5. User melihat toast sukses `Pengaturan batas kredit bulanan berhasil disimpan`.

### 19. Verifikasi pemblokiran pengiriman pesan saat akumulasi biaya mencapai Monthly Credit Limit
1. Akumulasi pengeluaran bulanan nomor WABA telah mencapai nilai Monthly Credit Limit (Total Spend >= Limit).
2. User mencoba mengirim pesan broadcast baru di `/broadcast` atau mengirim pesan di `/chatroom`.
3. User melihat pengiriman diblokir dan sistem memunculkan error message `monthly credit limit has exhausted`.
4. User melihat saldo kredit tidak mengalami pemotongan.

### 20. Verifikasi ekspor file Riwayat Kredit (Credit History Download) memuat baris Service Message
1. User login sebagai Owner / Supervisor.
2. User membuka halaman `/whatsapp-credit/history`.
3. User klik tombol `Unduh Riwayat`.
4. User membuka file spreadsheet hasil unduhan dan memverifikasi kolom `TEMPLATE TYPE` mencantumkan nilai `Service` untuk transaksi Service Message beserta nominal biaya IDR yang sesuai.

---

## Modul 4: Chatroom Cost Visibility, Session Limit & Top-Up

### 21. Verifikasi running cost sesi aktif di Chatroom ter-update secara real-time saat pesan berbayar terkirim
1. User Agent membuka percakapan aktif di `/chatroom`.
2. User mengirim 1 pesan berbayar.
3. User melihat widget `Running Cost` di header percakapan bertambah secara real-time sebesar tarif pesan dalam IDR tanpa perlu refresh halaman.

### 22. Verifikasi reset running cost saat chatroom di-closing oleh Agent dan customer memulai sesi baru
1. Sesi percakapan di chatroom memiliki akumulasi running cost berjalan (misal: Rp1.500).
2. User Agent klik tombol aksi `Close Chat` / Closing Room.
3. Status percakapan berhasil diselesaikan (closed).
4. Customer mengirim pesan baru yang membuka sesi percakapan kembali.
5. User Agent membuka ruang chat tersebut dan melihat running cost telah ter-reset menjadi `Rp0`.

### 23. Verifikasi running cost TIDAK di-reset jika chatroom belum di-closing oleh Agent meskipun window Meta berakhir
1. Percakapan chatroom memiliki running cost berjalan (misal: Rp2.000).
2. Window rolling 24 jam dari Meta telah berakhir tanpa adanya aksi closing dari Agent.
3. User Agent membuka kembali percakapan tersebut di `/chatroom`.
4. User melihat indikator running cost tetap mempertahankan nilai berjalan sebelumnya (tidak reset ke Rp0).

### 24. Owner / Supervisor mengatur Flat Non-Segmented Session Limit melalui quick-access di Chatroom
1. User login sebagai Owner / Supervisor.
2. User membuka halaman `/chatroom`.
3. User klik menu cepat `Session Limit` di header chatroom.
4. User mengisi nominal flat limit `5000` (Rp5.000) dan klik `Simpan`.
5. User melihat toast sukses `Batas limit sesi berhasil diperbarui`.

### 25. Verifikasi percakapan ditandai limit-reached dan pemblokiran balasan saat session cost mencapai limit
1. Running cost percakapan aktif telah mencapai Flat Session Limit yang dikonfigurasi.
2. User Agent membuka percakapan tersebut di `/chatroom`.
3. User melihat badge/banner status `Limit Reached` pada header chatroom.
4. User melihat form input pesan dan tombol kirim terkunci (disabled).
5. User melihat dropdown aksi penambahan limit (`Top-Up Limit`) tampil aktif.

### 26. Verifikasi pesan masuk dari customer tetap tersimpan dan dapat dibaca saat status limit-reached
1. Percakapan berada dalam status `Limit Reached`.
2. Customer mengirimkan pesan baru via WhatsApp ke WABA.
3. User Agent memantau timeline chatroom.
4. User melihat pesan customer berhasil masuk dan tampil di timeline chatroom secara real-time tanpa ada pesan yang hilang.

### 27. Agent/CS melakukan manual top-up plafon limit sesi via preset dropdown dengan saldo utama mencukupi
1. Percakapan dalam status `Limit Reached` dan saldo kredit WABA utama mencukupi.
2. User Agent membuka dropdown preset top-up di `/chatroom` dan memilih nominal `Rp5.000`.
3. User klik tombol `Konfirmasi Tambah Limit`.
4. User melihat plafon batas sesi bertambah sebesar Rp5.000, banner limit-reached hilang, dan form kirim pesan kembali aktif (unblocked).
5. User memverifikasi bahwa saldo utama WABA TIDAK terpotong saat konfirmasi top-up, melainkan baru terpotong saat pesan baru berhasil dikirim.

### 28. Verifikasi peringatan kegagalan saat saldo WhatsApp Credit organisasi tidak mencukupi saat hendak mengirim pesan pada limit yang di-top-up
1. Percakapan dalam status `Limit Reached` dan saldo kredit WABA utama organisasi bernilai Rp0 / tidak cukup untuk 1 pesan.
2. User Agent mencoba mengirim pesan berbayar pada limit yang di-top-up.
3. User melihat sistem menampilkan notifikasi/alert bahwa `Saldo WhatsApp Credit utama tidak mencukupi`.
4. User melihat pengiriman pesan berbayar tetap dicegah hingga saldo utama WABA diisi ulang.

### 29. Verifikasi sifat kumulatif pada multiple manual top-up oleh Agent/CS dalam satu sesi berjalan
1. Percakapan mencapai limit sesi berjalan.
2. User Agent melakukan top-up pertama sebesar `Rp2.000` dan mengonfirmasi.
3. User Agent melakukan top-up kedua sebesar `Rp5.000` pada sesi yang sama dan mengonfirmasi.
4. User melihat plafon total sesi terakumulasi secara kumulatif (+Rp7.000) dan pengiriman pesan diizinkan hingga akumulasi baru tercapai.

### 30. Verifikasi pencatatan Audit Log Top-up Sesi (Agent Identity, Timestamp, Amount)
1. User Agent telah selesai melakukan penambahan limit sesi sebesar Rp5.000 pada percakapan customer tertentu.
2. User Owner / Admin memeriksa log audit mutasi sesi.
3. User melihat entri log mencatat detail lengkap: ID & Nama Agent, Timestamp persis, ID Percakapan/Customer, dan Nominal penambahan limit (+Rp5.000).
