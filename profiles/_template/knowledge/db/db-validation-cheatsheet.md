# Database Validation Cheatsheet — <ALIAS>

> Resep penelusuran data berulang dalam bahasa naratif (non-query). Diisi manual oleh QA; AI hanya membaca.
> Usulan resep dari learning boleh diajukan, tetapi baru masuk setelah disetujui user.

### 1. [Judul Alur Validasi]
- **Command Key**: [kalimat perintah yang sering dipakai]
- **Target Database**: [db:main / db:external]
- **Tabel Terkait**: [table_a, table_b]
- **Alur Langkah Penelusuran**:
  1. Buka database [target], akses tabel [table_a].
  2. Filter berdasarkan [kunci input].
  3. Ambil nilai kolom [kunci relasi], pindah ke [table_b], filter dengan nilai tersebut.
  4. Tampilkan kolom [a, b, c] (kolom PII otomatis dimasking).
