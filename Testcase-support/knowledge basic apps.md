# Knowledge Basic Apps

## 1. CHAT CRM

- **Persyaratan Langganan (Subscription):**
  - Untuk dapat menggunakan fitur ini, pengguna wajib memiliki paket langganan aktif: **Chat** dan **CRM**.

- **Struktur Dashboard & Path Navigasi:**
  - **Dashboard Utama (CRM):** Mengacu pada struktur menu di `./strukturmenu/dashboard-crm/` (jika aplikasi bertipe CRM).
  - **Dashboard Chatroom:** Mengacu pada struktur menu di `./strukturmenu/chatroom-web/` (jika aplikasi bertipe Chatroom/Agent).

- **Fungsi Dashboard CRM:**
  - Berfungsi untuk melakukan berbagai aksi dan konfigurasi manajemen operasional seperti:
    - Melakukan action Broadcast
    - Pengaturan chat masuk (Routing / Assignment Rule)
    - Pengelolaan Template Broadcast
    - Manajemen Agent yang bertugas
    - Pendaftaran nomor WhatsApp Official
    - Dan konfigurasi lainnya sesuai dengan daftar menu yang tertera pada path struktur menu dashboard CRM.

- **Akses & Visibilitas Chatroom Web:**
  - **Akses Masuk:** Hanya Agent yang sudah di-assign/diberi tugas yang dapat mengakses dashboard Chatroom Web.
  - **Visibilitas Role Agent:** Agent hanya dapat melihat dan mengakses chatroom yang secara spesifik di-assign ke dirinya. Jika tidak di-assign, chatroom tersebut tidak akan muncul di antarmuka Agent.
  - **Visibilitas Role Owner & Supervisor:** Dapat melihat, memantau, dan mengakses seluruh chatroom yang ada (semua room percakapan).
  - **Ketentuan Role Lainnya:** Untuk aturan permission dan pembagian hak akses (RBAC) pada role lainnya, mengacu pada file master: `[SSOT] Requirement for RBAC Customer Dashboard.xlsx` di `./Testcase-support/`.

## 2. Broadcast Official Rule

- **Hak Akses Pembuatan Broadcast:**
  - Pembuatan dan pengiriman broadcast melalui dashboard hanya dapat dilakukan oleh role **Owner** dan **Supervisor**.

- **Target / Penerima Broadcast:**
  - Target audience/penerima dapat dipilih/ditentukan melalui:
    - **Segmentasi** kontak/pelanggan yang telah dimiliki.
    - **Upload file CSV** yang sesuai dengan format/template yang ditentukan.
    - **Memilih data pelanggan** yang sudah tersedia di database/aplikasi.
    - **Input manual** data pelanggan baru berdasarkan nomor teleponnya.

- **Ketentuan Template Broadcast:**
  - **Relasi Template & Nomor WhatsApp:** Template yang dapat dipilih dan digunakan terikat khusus pada nomor WhatsApp Official yang dipilih (tidak bisa menggunakan sembarang template di luar nomor tersebut).
  - **Status Approval Template:** Hanya template pesan yang statusnya sudah **Approved oleh pihak Meta** yang dapat digunakan untuk broadcast.

- **Jadwal Pengiriman (Scheduling):**
  - Broadcast yang dibuat hanya bisa dijadwalkan/dijalankan untuk **waktu yang akan datang (future date & time)**; tidak dapat membuat broadcast dengan jadwal/tanggal yang sudah terlewat (past date).

- **Estimasi Biaya & Pemotongan Kredit (Pricing & Billing):**
  - **Tampilan Estimasi Biaya:** Sebelum broadcast disimpan/dibuat, sistem akan menampilkan perkiraan total biaya pengiriman.
  - **Database Pricing:** Penentuan harga per pesan mengacu pada daftar harga (pricing matrix) yang tersimpan di database berdasarkan negara tujuan nomor penerima.
  - **Mekanisme Perhitungan Estimasi vs Aktual:**
    - Saat tahap estimasi, perhitungan biaya akan diratakan menggunakan standar tarif **Indonesia**.
    - Saat pengiriman aktual dan pemotongan saldo credit terjadi, biaya akan disesuaikan secara presisi dengan tarif negara tujuan masing-masing nomor pelanggan.
  - **Validasi Saldo Credit:** Jika nilai estimasi biaya broadcast melebihi limit/sisa saldo credit yang dimiliki akun, maka sistem akan **menggagalkan/menolak proses penyimpanan** broadcast tersebut.
