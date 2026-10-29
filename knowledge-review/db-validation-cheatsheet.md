# Database QA Validation Cheatsheet (Non-Query Knowledge Base)

> **PANDUAN PENTING**:
> 1. Berkas ini adalah **Catatan Alur Penelusuran Data Berulang** yang ditulis dalam format bahasa naratif non-query agar mudah dipahami oleh seluruh tim (QA, PM, Developer, maupun AI).
> 2. 🛑 **ATURAN KETAT UNTUK AI AGENT**:
>    - AI **DILARANG KERAS** menambahkan, mengubah, atau mengarang *recipe* ke dalam berkas ini secara otomatis.
>    - Penambahan atau pembaruan isi berkas ini **100% merupakan hak dan input manual dari QA Engineer (User)**.
>    - AI hanya bertindak sebagai pembaca acuan (*consumer*) ketika menjalankan tugas validasi.

---

## Daftar Alur Validasi Berulang (*Validation Recipes*)

### 1. Validasi Riwayat Pesan dari Data Channel ID
- **Command Key**: Cari pesan ID ini berdasarkan data Channel ID yang saya punya
- **Target Database**: `DEV_everpro`
- **Tabel Terkait**: `channels`, `conversations`, `messages`
- **Alur Langkah Penelusuran**:
  1. Buka database `DEV_everpro`, akses tabel `channels`.
  2. Filter berdasarkan `channel_id` yang diberikan oleh user.
  3. Urutkan berdasarkan `created_at` DESC untuk mendapatkan channel yang paling aktif/terbaru.
  4. Ambil nilai kolom `id` paling atas.
  5. Pindah ke tabel `conversations`, filter kolom `channel_id` menggunakan nilai ID yang didapat dari langkah 4.
  6. Urutkan berdasarkan `created_at` DESC, lalu ambil nilai kolom `conversation_id`.
  7. Pindah ke tabel `messages`, filter kolom `conversation_id` menggunakan ID dari langkah 6.
  8. Ambil data pesan terbaru (kolom `id`, `sender_type`, `content`, `status`, dan `created_at`).
  9. Tampilkan pratinjau pesan di terminal.

---

### 2. Validasi Akun Pengguna Baru & Hak Akses Role
- **Command Key**: Validasi pendaftaran user baru beserta rolenya
- **Target Database**: `DEV_everpro`
- **Tabel Terkait**: `users`, `user_roles`, `roles`
- **Alur Langkah Penelusuran**:
  1. Buka database `DEV_everpro`, akses tabel `users`.
  2. Filter kolom `email` sesuai email user yang baru didaftarkan.
  3. Ambil nilai `id` user dan pastikan kolom `status` bernilai `'ACTIVE'`.
  4. Pindah ke tabel `user_roles`, filter kolom `user_id` dengan ID user tadi.
  5. Ambil nilai `role_id`.
  6. Pindah ke tabel `roles`, filter kolom `id` dengan `role_id` tadi untuk memastikan nama role (misal `'OWNER'`, `'CS'`, `'ADMIN'`).
  7. Sajikan ringkasan data user dan role aktifnya di terminal.

---

### 3. Template Alur Baru (Salin Bagian Ini untuk Menambah Alur Baru)
```markdown
### [Nomor]. [Judul Alur Pengujian / Validasi]
- **Command Key**: [Kalimat perintah / kata kunci yang sering Anda ketikkan]
- **Target Database**: [Pilih: DEV_everpro / DEV_db-external-dev]
- **Tabel Terkait**: [Daftar tabel yang terlibat, contoh: table_a, table_b, table_c]
- **Alur Langkah Penelusuran**:
  1. Buka database [Target DB], akses tabel [Tabel 1].
  2. Filter berdasarkan [Keyword Input].
  3. Ambil nilai kolom [ID / Kunci Relasi].
  4. Pindah ke tabel [Tabel 2], filter kolom [Foreign Key] dengan nilai dari langkah sebelumnya.
  5. [Lanjutkan langkah berikutnya hingga data target ditemukan...]
  6. Tampilkan ringkasan kolom [Kolom A, Kolom B, Kolom C] di terminal.
```
