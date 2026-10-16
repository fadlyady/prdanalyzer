# 📦 Direktori `automate-support/` (Test Data & Supplementary Evidence)

Direktori ini berfungsi sebagai **penyimpanan terpusat data pendukung pengujian (*Supplementary Test Data Store*)** untuk skill `browser-qa-execution`.

---

## 📂 Format & Jenis Berkas yang Didukung

Anda dapat meletakkan berbagai macam berkas data uji di sini:
1. **Spreadsheet Data Uji (`.xlsx` / `.csv`)**:
   - Data katalog produk beragam (SKU, nama produk, harga, varian, bobot).
   - Daftar kontak/pelanggan untuk skenario import/upload massal.
   - Batch data transaksi atau data rekening bank.
2. **Dokumen Format Teks & Deskripsi (`.docx` / `.md` / `.txt`)**:
   - Sampel template pesan panjang, caption promo broadcast, format disclaimer.
   - SOP atau instruksi spesifik skenario tertentu.
3. **Berkas Payload & Konfigurasi (`.json` / `.yaml` / `.xml`)**:
   - Mock data payload webhook atau API request body.
4. **Berkas Media Uji (`.png` / `.jpg` / `.pdf`)**:
   - File bukti transfer, foto produk, file PDF untuk skenario pengujian upload dokumen.

---

## 🛡️ Aturan Penggunaan (*Rules of Engagement*):

1. **Penyebutan dalam Test Case**:
   Jika suatu skenario test case di dalam file `.md` merujuk pada penggunaan data eksternal (contoh: *"Upload berkas katalog produk dari test data"* atau *"Gunakan data varian pada file pendukung"*), agent akan secara otomatis memeriksa direktori `./automate-support/`.
2. **Gerbang Klarifikasi (Mandatory Gate)**:
   Jika di dalam direktori ini terdapat lebih dari satu berkas dan instruksi test case belum menyebutkan nama file secara spesifik, agent **WAJIB bertanya kepada pengguna**:
   > *"File test data mana pada `automate-support/` yang harus digunakan untuk skenario [Nama Skenario]?"*
   Agent **dilarang keras** menebak atau mengambil file secara acak!
