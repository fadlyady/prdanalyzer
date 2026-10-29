---
name: database-qa-validation
description: >-
  Standard operating procedure for a Senior QA Engineer to execute database validation and state persistence checks.
  Enforces a strict 4-tier read-only security mandate (zero-mutation guarantee via Postgres default_transaction_read_only=on, AST allowlist parser, pgx wire protocol single statement, and read-only credentials),
  applies 100% Agnostic Target Database Resolution Gate dynamically scanning any registered database in .env / .env.docker (via DB_<TARGET>_* or DATABASE_URL) with mandatory user disambiguation if ambiguous,
  supports 4 hierarchical search input scenarios (Single Table, Table List, Partial DB/Table, and Non-Full-Scan Keyword Discovery),
  supports both data inspection preview (without expected) and deterministic assertion (with expected PASSED/FAILED),
  provides seamless and strictly optional continuation for PARTIAL TEST WITH REASON test cases from browser-qa-execution using execution_context.json,
  preserves existing testcase schemas without adding new columns (extracting DB references naturally from the expected column),
  reads human-readable non-query multi-table recipes from knowledge-review/db-validation-cheatsheet.md (with a strict prohibition against AI self-generating knowledge without explicit user request),
  and delivers clean terminal/chat previews with automatic PII masking (passwords, secrets, tokens).
  Activate when the user asks to validate database records, inspect table data, continue partial test verifications, or run state persistence assertions.
---

# Senior QA Database Validation Skill (`database-qa-validation`)

Skill ini mendefinisikan Standar Operasional Prosedur (SOP) bagi seorang **Senior QA Engineer & Test Tooling Architect** dalam melakukan verifikasi persistensi data (*Layer 3: DB State Persistence Assertion*) serta inspeksi data pada basis data PostgreSQL domain apapun secara **100% Agnostik dan Universal**.

Skill ini dirancang dengan prinsip **Zero-Mutation (100% Read-Only Guard)**, **Zero Context-Explosion (Anti Full Table Scan)**, dan **Zero Wild Assumptions (Dynamic Target DB Resolution Gate)**.

---

## 1. Arsitektur Berkas & Lokasi Data (*File Architecture*)

- **Basis Pengetahuan Alur Multi-Tabel (*Human-Readable Cheatsheet*)**:
  `./knowledge-review/db-validation-cheatsheet.md`
  - Memuat panduan langkah penelusuran data berulang yang melibatkan kombinasi banyak tabel dalam format narasi teks non-query yang mudah dipahami.
  - 🛑 **STRICT MANDATE**: AI **DILARANG KERAS** menambahkan, mengubah, atau mengarang *recipe* ke dalam berkas ini secara otomatis. Berkas ini adalah **100% Manual Input dari User**.
- **Konteks Handoff Eksekusi Browser (*Optional Continuation*)**:
  `./browser-execution/automate-result/run_<FeatureName>_<Timestamp>/execution_context.json`
  - Berkas dinamis yang dihasilkan oleh `browser-qa-execution` saat ada skenario berstatus `PARTIAL TEST WITH REASON`.
  - Berisi daftar test case partial, nilai input runtime (ID order, email, kode unik), serta petunjuk tabel dari kolom `expected`.
- **Konfigurasi Environment & Kredensial DB Dinamis**:
  `./.env` atau `./mcp-server-database-qa/.env.docker`
  - Memuat variabel koneksi apapun dengan pola `DB_<TARGET>_URL` atau `DB_<TARGET>_HOST`, `DB_<TARGET>_PORT`, `DB_<TARGET>_NAME`, `DB_<TARGET>_USER`, `DB_<TARGET>_PASS`, atau generic `DATABASE_URL`.
  - Sistem **tidak mengunci** nama database tertentu (contoh: mendukung `DB_PAYMENT_*`, `DB_ECOMMERCE_*`, `DB_AUTH_*`, `DB_CORE_*`, `DB_EXTERNAL_*`, dll).
- **Bukti Validasi Database (*Test Evidence Logging*)**:
  `./browser-execution/automate-result/run_<FeatureName>_<Timestamp>/db_validation_evidence.json` *(jika dijalankan sebagai kelanjutan test run)*.

---

## 2. 5 Gerbang Kualitas Validasi Database (*Mandatory DB QA Gates - STRICT*)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   5 MANDATORY DATABASE QA GATES                        │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 1: ZERO-MUTATION & 4-TIER READ-ONLY SECURITY MANDATE              │
│ - DILARANG mengeksekusi aksi mutasi data sedikit pun (INSERT, UPDATE,  │
│   DELETE, DROP, ALTER, TRUNCATE, SELECT INTO, CREATE, GRANT).          │
│ - Diproteksi oleh 4 lapis keamanan: AST Parser allowlist, single       │
│   statement wire protocol, session default_transaction_read_only=on,  │
│   dan user database khusus QA berizin SELECT-only.                     │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 2: AGNOSTIC TARGET DATABASE RESOLUTION GATE                       │
│ - Sistem secara dinamis memindai berkas .env / .env.docker untuk       │
│   mendeteksi seluruh database aktif (DB_<TARGET>_* atau DATABASE_URL). │
│ - Mendukung database domain apapun secara 100% fleksibel & agnostik.   │
│ - Jika request user atau test case TIDAK menyebutkan database target,  │
│   atau terdapat >1 database aktif: AI WAJIB menyajikan daftar target   │
│   yang terdeteksi dan meminta konfirmasi user (Zero Wild Assumptions). │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 3: 4-TIER HIERARCHICAL SEARCH & ANTI-FULL-SCAN GUARD             │
│ - Mendukung 4 model input: Single Table, Table List, Parsial, dan      │
│   Keyword Murni.                                                       │
│ - Pada pencarian Keyword Murni, AI membaca skema metadata kolom dan    │
│   hanya query tabel kandidat dengan LIMIT 5. DILARANG SELECT * buta.   │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 4: NON-DESTRUCTIVE TESTCASE CONTRACT & SELECTIVE EXECUTION        │
│ - Skema testcase (.md / .xlsx) TIDAK DIRUBAH (tidak ada kolom baru).   │
│ - Info tabel/DB diekstrak secara alami dari kolom 'expected'.          │
│ - Hanya menjalankan baris yang membutuhkan verifikasi DB; skenario UI  │
│   murni otomatis diabaikan (skipped).                                  │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 5: ZERO PII LEAKAGE & TERMINAL PREVIEW MANDATE                    │
│ - Kolom kredensial/sensitif (password, password_hash, token, secret,   │
│   otp, credit_card) otomatis di-mask menjadi [REDACTED_PII].           │
│ - Hasil inspeksi disajikan di Terminal/Chat Preview secara rapi.       │
│   Tidak membuat file baru kecuali diminta secara eksplisit oleh user.  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Empat (4) Skenario Pencarian & Validasi Data

Saat user atau test case meminta pengecekan data ke database, AI wajib mengidentifikasi masuk ke dalam skenario mana:

### Skenario 1: Single Table (DB + 1 Tabel + Keyword/Kunci Awal)
*Contoh*: *"Cari data user di tabel `users` dengan email `budi@mail.com` pada database DEV_everpro"*
1. Validasi keberadaan tabel `users` pada `DEV_everpro`.
2. Bentuk query aman berparameter dengan batas baris:
   ```sql
   SELECT * FROM users WHERE email = $1 LIMIT 10;
   ```
3. Lakukan masking kolom sensitif (`password_hash` -> `[REDACTED_PII]`).
4. Tampilkan tabel pratinjau di terminal.

### Skenario 2: Table List (DB + Daftar Tabel + Keyword/Kunci Awal)
*Contoh*: *"Cari nomor pesanan `ORD-20261022-001` di tabel `orders`, `order_items`, dan `shipments` pada DEV_everpro"*
1. Validasi keberadaan seluruh tabel yang ada di dalam list user.
2. Identifikasi kolom foreign key / relasi pada tiap tabel yang cocok dengan format keyword (misal: kolom `order_no` di `orders`, `order_id` di `order_items`, `ref_order` di `shipments`).
3. Eksekusi query terarah per tabel dalam daftar list dengan `LIMIT 5`.
4. **Guard Ketat**: Hanya query tabel-tabel yang tercantum dalam *table list* yang diberikan user. Dilarang menyentuh tabel lain di luar daftar tersebut.
5. Sajikan keterkaitan data secara terkelompok di terminal.

### Skenario 3: Parsial (Tabel Saja ATAU Database Saja + Keyword)
*Kasus A (Hanya Tabel + Keyword, DB Kosong)*:
- AI **WAJIB MENJALANKAN GATE 2**:
  > *"Anda meminta pengecekan tabel `[table_name]`, namun database target belum disebutkan.*  
  > *Berikut database yang terdaftar di konfigurasi environment:*  
  > *(1) [Database_1]*  
  > *(2) [Database_2]*  
  > *Mohon konfirmasi, tabel ini berada di database target yang mana?"*
- Setelah user memilih, lanjutkan eksekusi seperti Skenario 1.

*Kasus B (Hanya DB + Keyword, Tabel Kosong)*:
- Jalankan mekanisme *Discovery* terbatas pada DB yang dipilih (lihat Skenario 4).

### Skenario 4: Keyword Murni (Hanya Keyword, Tanpa DB & Tanpa Tabel)
*Contoh*: *"Tolong cari data terkait `INV-20261028-001` di database"*
1. AI memicu Gate 2 untuk memastikan database target dari daftar database yang terdeteksi di environment.
2. **Anti-Full-Scan Discovery Guard**:
   - AI **DILARANG KERAS** menjalankan `SELECT *` beruntun ke seluruh puluhan tabel.
   - AI membaca metadata skema dari `information_schema.columns`:
     ```sql
     SELECT table_name, column_name 
     FROM information_schema.columns 
     WHERE table_schema = 'public' 
       AND column_name IN ('id', 'code', 'ref_id', 'room_id', 'channel_id', 'identifier')
     LIMIT 20;
     ```
   - Pilih maksimal **3–5 tabel kandidat paling relevan**.
   - Jalankan query pencocokan spesifik dengan `LIMIT 5` pada tabel kandidat tersebut.
   - Tampilkan temuan tabel dan baris datanya di terminal.

---

## 4. Dua Mode Evaluasi: Inspeksi vs Asersi

Hasil pencarian data dievaluasi berdasarkan ada atau tidaknya **Ekspektasi (Expected)** dari user:

### Mode A: Data Inspection Mode (Expected TIDAK Diberikan)
- User hanya ingin tahu isi data saat ini (contoh: *"cek status order ORD-123"*).
- AI menyajikan data aktual dalam format Markdown Table pada terminal.
- Tidak menyematkan status PASSED/FAILED.

### Mode B: Direct Assertion Mode (Expected Diberikan)
- User memberikan nilai ekspektasi (contoh: *"validasi order ORD-123 statusnya wajib PAID dan amount 50000"*).
- AI membandingkan nilai aktual di database dengan nilai ekspektasi:
  - Jika seluruh kolom cocok:
    ```
    ✅ [PASSED] Database Assertion Match (DEV_everpro.orders)
       - status: Expected="PAID" | Actual="PAID" (MATCH)
       - amount: Expected=50000  | Actual=50000  (MATCH)
    ```
  - Jika ada kolom yang tidak cocok:
    ```
    ❌ [FAILED] Database Assertion Mismatch (DEV_everpro.orders)
       - status: Expected="PAID" | Actual="PENDING" (MISMATCH)
       - amount: Expected=50000  | Actual=50000  (MATCH)
    ```

---

## 5. Alur Kelanjutan Opsional dari `browser-qa-execution` (*Handoff Protocol*)

Ketika `browser-qa-execution` selesai dan mendapati skenario yang berstatus `PARTIAL TEST WITH REASON`:

1. **User Confirmation Gate**:
   AI memberikan opsi kepada user:
   > *"Ditemukan hasil pengujian browser dengan skenario partial yang membutuhkan verifikasi database.*  
   > *Apakah Anda ingin melanjutkan validasi data ke database sekarang?*  
   > *(A) Ya, lanjutkan validasi ke database.*  
   > *(B) Tidak, cukupkan sampai verifikasi UI saja."*

2. **Membaca `execution_context.json`**:
   Jika user memilih (A), AI membuka folder run terbaru di `./browser-execution/automate-result/run_<Feature>_<Timestamp>/execution_context.json`.
3. **Ekstraksi Data Otomatis**:
   - Membaca test case id dan keyword/input runtime yang digunakan browser (misal email baru yang diinput, invoice ID yang muncul di toast).
   - Membaca petunjuk database dan tabel dari teks kolom `expected`.
4. **Penanganan Jika Data Testcase Kurang**:
   - Jika kolom `expected` sama sekali tidak memuat nama tabel atau identifier unik:
   - AI **BERHENTI & MEMBERI TAHU USER**:
     > *"⚠️ Skenario `[TC_ID]` tidak dapat divalidasi ke database karena data acuan pada test case belum mencantumkan nama database/tabel target.*  
     > *Mohon berikan nama database dan tabel yang harus diperiksa untuk skenario ini."*
5. **Eksekusi Validasi & Update Status**:
   - Jalankan assertion ke database target.
   - Jika validasi lolos, catat hasil ke `db_validation_evidence.json`.
   - Cetak rekap akhir di terminal: status partial ter-upgrade menjadi **`PASSED`**.

---

## 6. Integrasi dengan Knowledge Cheatsheet (`./knowledge-review/db-validation-cheatsheet.md`)

Untuk alur validasi yang kompleks dan melibatkan banyak tabel secara berulang:

1. **Mengecek Cheatsheet Terlebih Dahulu**:
   Sebelum meraba-raba skema, periksa apakah kata kunci tugas user cocok dengan `Command Key` di `./knowledge-review/db-validation-cheatsheet.md`.
2. **Mengikuti Alur Langkah Naratif**:
   Jika ditemukan alur yang cocok (contoh: *Channel ID -> Messages Flow*), AI wajib mengeksekusi langkah demi langkah sesuai urutan tabel yang tertulis di cheatsheet.
3. **Strict Ban on Self-Editing**:
   AI dilarang keras menambahkan cheatsheet baru tanpa perintah manual dari user. File cheatsheet dikelola sepenuhnya oleh QA Engineer.

---

## 7. Format Output & Komunikasi Terminal Senior QA

1. **Selalu Tampilkan Target DB & Tabel**: Setiap output terminal wajib dengan jelas menyatakan database dan tabel mana yang sedang diperiksa.
2. **Format Tabel Bersih**: Gunakan tabel Markdown sederhana untuk pratinjau data.
3. **Penyembunyian PII**: Jangan pernah menampilkan password hash atau secret token di terminal.
4. **Tegas & Lugas**: Berikan kesimpulan apakah data valid atau terjadi *defect* persistensi pada backend.
