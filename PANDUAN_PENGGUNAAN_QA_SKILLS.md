# PANDUAN LENGKAP PENGGUNAAN AGENT QA SKILLS
## Panduan Praktis Step-by-Step untuk Seluruh Tim (Senior, Junior, & Non-Teknikal)

---

## 1. PENDAHULUAN & GAMBARAN BESAR (*EXECUTIVE OVERVIEW*)

Selamat datang di repositori **PRD-ANALYZER & QA Automation Suite**. Toolkit ini dirancang sebagai asisten cerdas berbasis kecerdasan buatan (AI Agent) yang memandu tim lintas disiplin—mulai dari **Product Manager (PM)**, **Business Analyst (BA)**, **Software Quality Assurance (QA)**, hingga **Software Engineer (SWE)**—dalam merancang, menguji, dan memvalidasi perangkat lunak dengan standar kualitas perusahaan (*enterprise-grade*).

### Mengapa Repositori Ini Ada? (Analogi Sederhana untuk Non-Teknikal)
Bayangkan Anda sedang membangun sebuah gedung bertingkat:
1. **PRD (Product Requirement Document)** adalah cetak biru (*blueprint*) dari arsitek. Jika cetak birunya memiliki celah logika atau risiko bisnis yang terlewat, seluruh bangunan bisa berbahaya.
2. **Test Case** adalah daftar periksa inspeksi keselamatan bagi para pengawas konstruksi untuk memastikan setiap pilar dan instalasi listrik kokoh.
3. **Browser Execution** adalah inspektur yang berjalan langsung di lapangan, mencoba membuka setiap pintu dan saklar di gedung secara nyata.
4. **Mobile Execution** adalah inspektur yang sama, tetapi menguji "gedung versi mobile": aplikasi Android asli di HP sungguhan.
5. **Database Validation** adalah teknisi struktur yang mengecek pondasi di bawah tanah untuk memastikan data benar-benar tersimpan dengan aman tanpa mengubah atau merusak pondasi yang ada.
6. **Review & Learning** adalah catatan evaluasi berkala agar kesalahan yang sama tidak pernah terulang di proyek berikutnya.

Toolkit ini mengotomasi dan mendisiplinkan seluruh proses tersebut menggunakan **8 Skill Utama**.

### Pondasi: Agnostik, Profil Aplikasi & Rahasia
- Acuan tertinggi: `.agents/shared/FOUNDATION.md` + standar di `.agents/shared/standards/` (analisa, test case, status/verdict/evidence, rancangan modul API).
- **Satu repo untuk banyak aplikasi.** Setiap aplikasi punya alias (`APP_A`, `APP_B`, ...) dan folder profil lokal `profiles/<ALIAS>/` (knowledge web/mobile/API/DB, glosarium, RBAC, data uji). Hanya `profiles/_template/` yang di-commit.
- **Rahasia** (URL, package, akun, DSN) hanya di `.secrets/<ALIAS>.env` (lokal, di-gitignore) dan dibaca server/runner lewat `scripts/lib/qa-env.cjs`. `.env` di root hanya berisi `QA_ACTIVE_PROFILE=<ALIAS>`.
- **Artefak kerja per fitur** di `work/<ALIAS>/<fitur>/` (`00-scope.md`, `01-analysis.md`, `01-questions.md`, `02-testcases.md/.xlsx`, `03-plan.md`, `plans/`, `runs/`, `reports/`) — lokal, tidak di-commit.
- **Mulai fitur**: `python3 scripts/qa_feature.py where` (cek profil aktif) → `python3 scripts/qa_feature.py init <fitur>`. Runner browser/mobile otomatis menulis evidence ke `runs/` fitur itu.
- **Penjaga commit**: `scripts/qa_guard_scan.py` dijalankan otomatis oleh pre-commit (`git config core.hooksPath .githooks`) dan menolak rahasia, istilah di `.secrets/denylist.txt`, serta artefak/evidence.
- **Alur fleksibel**: yang wajib hanya Intake → Analisa → Test case; eksekusi (web, mobile, API, DB) dipilih sesuai kebutuhan dan verdict selalu menyebut scope.

---

## 2. PETA ALUR KERJA END-TO-END (*END-TO-END QA WORKFLOW*)

Berikut adalah urutan alur kerja dari saat dokumen PRD pertama kali diterima hingga pengujian selesai:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ALUR KERJA QA BERBASIS SKILL                    │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
       1. ANALISIS KEBUTUHAN & BISNIS ➔ [prd-analyzer-business]
          - Membedah PRD dengan kerangka SFDIPOT
          - Menghitung 6 Pilar Risiko Bisnis (Financial, Operational, dll)
          - Crawling menu/UI staging opsional
          - Menghasilkan: PRD_Analysis_<Fitur>.md & questions-for-pm.md
                                    │
                                    ▼
       2. REVIU & KLARIFIKASI DOKUMEN ➔ [qa-review-learning]
          - Reviu catatan dari PM / Tech Lead
          - Update & sinkronisasi dokumen analisis
                                    │
                                    ▼
       3. GENERASI SUITE TEST CASE    ➔ [generate-testcase]
          - Membuat Master Test Case Excel (15 kolom standar industri)
          - Membuat file testcase Markdown (.md)
          - Menghasilkan: Test_Cases_<Fitur>.xlsx & test-cases-<fitur>.md
                                    │
                                    ▼
       4. KONVERSI LAPORAN FORMAL     ➔ [convert-document] / [convert-with-calculation]
          - Mengonversi analisis/testcase .md menjadi dokumen Word (.docx) / PDF
          - Menghitung formula Risk Coverage & Release Recommendation Gate
          - Menghasilkan: Dokumen audit eksekutif siap cetak/kirim
                                    │
                                    ▼
       5. EKSEKUSI BROWSER STAGING    ➔ [browser-qa-execution]
          - Menjalankan Chrome via CDP port 9222
          - Menjalankan 6 Skenario Inti + 5 Charter Exploratory Testing
          - Mengambil tangkapan layar (screenshot evidence)
          - Menghasilkan: Laporan Word (.docx) + execution_context.json
                                    │
                                    │
       5b. EKSEKUSI MOBILE (ANDROID)  ➔ [mobile-qa-execution]
          - Menjalankan app staging di HP Android fisik via Appium (MCP mobile-qa-guard)
          - Build Guard, Safe Mode, 5 Charter Exploratory Mobile
          - Menghasilkan: screenshot, logcat, rekaman layar + Laporan Word (.docx)
                                    │
                                    ▼
       6. VALIDASI PERSISTENSI DATA   ➔ [database-qa-validation]
          - Validasi data di level database PostgreSQL
          - 100% Zero-Mutation (Hanya SELECT, dilarang UPDATE/DELETE)
          - Melanjutkan verifikasi data dari hasil browser test (Handoff)
                                    │
                                    ▼
       7. PEMBELAJARAN & RETROSPEKSI  ➔ [qa-review-learning]
          - Mencatat bug escape / feedback baru ke qa-learnings.md
          - Memperkuat aturan pengujian agar tidak terjadi regresi
```

---

## 3. PANDUAN STRUKTUR DIREKTORI WORKSPACE

Memahami struktur folder membantu siapa saja menemukan berkas dengan cepat:

| Nama Folder | Fungsi & Isi Berkas |
| :--- | :--- |
| **`.agents/shared/`** | Pondasi & standar bersama (analisa, test case, status/verdict/evidence, rancangan modul API). |
| **`profiles/<ALIAS>/`** | Profil aplikasi lokal: `profile.yaml`, glosarium, RBAC, knowledge web/mobile/API/DB, data uji. Template: `profiles/_template/`. |
| **`.secrets/<ALIAS>.env`** | Rahasia aplikasi (URL, package, akun, DSN) — lokal, di-gitignore, hanya dibaca runner/MCP. |
| **`work/<ALIAS>/<fitur>/`** | Artefak kerja per fitur: scope, analisa, pertanyaan PM, test case, plan, runs, reports (lokal). |
| **`doc-analyzer/`** | Lokasi lama (kompatibilitas); dokumen lama sudah dipindah ke `work/`. |
| ↳ `work/<ALIAS>/<fitur>/` | Tempat penyimpanan file analisis (`PRD_Analysis_*.md`), daftar pertanyaan PM (`questions-for-pm-*.md`), dan test case Markdown (`test-cases-*.md`). |
| ↳ `profiles/<ALIAS>/knowledge/` | Aset visual struktur menu web, mobile, dan log crawler UI live. |
| **`browser-execution/`** | Folder kerja untuk pengujian browser otomatis. |
| ↳ `browser-execution/automate-result/` | Evidence run lama & run fitur yang belum di-`init` (fitur terdaftar → `work/<ALIAS>/<fitur>/runs/`). |
| ↳ `browser-execution/automate-support/` | File pendukung tes (data CSV dummy, template unggah, dll). |
| **`knowledge-review/`** | Drop-box berkas review manual & template feedback. Cheatsheet DB kini di `profiles/<ALIAS>/knowledge/db/`. |
| **`Testcase-support/`** | Catatan pembelajaran QA (`qa-learnings.md`) dan referensi pendukung lainnya. |
| **`mcp-server-database-qa/`** | Mesin gateway PostgreSQL dengan sistem pertahanan 4-Tier Read-Only Security. |
| **`mcp-server-browser-qa/`** | Mesin browser guard & automasi Chrome berbasis CDP. |
| **`mobile-execution/`** | Folder kerja pengujian aplikasi mobile (Android). |
| ↳ `mobile-execution/build-apk/` | APK staging yang akan diuji. |
| ↳ `mobile-execution/probe/` | Installer Mac (`install_mac.sh`), pengecek kesiapan (`setup_check.sh`), dan probe pemetaan UI (`probe.mjs`). |
| ↳ `mobile-execution/plans/` | Lokasi lama; plan baru disimpan di `work/<ALIAS>/<fitur>/plans/`. |
| ↳ `mobile-execution/automate-result/` | Evidence run lama & fitur yang belum di-`init` (fitur terdaftar → `work/<ALIAS>/<fitur>/runs/`). |
| ↳ `mobile-execution/automate-support/` | File pendukung tes mobile (mis. file untuk diunggah). |
| **`mcp-server-mobile-qa/`** | Mesin pengaman & automasi HP Android (Appium) beserta self-test, smoke test, dan plan runner. |

---

## 4. PANDUAN STEP-BY-STEP PER SKILL

---

### SKILL 1: `prd-analyzer-business`
> **Kategori**: Analisis Kebutuhan & Pemodelan Risiko Bisnis  
> **Target Pengguna**: Product Manager, Business Analyst, QA Lead, Senior QA, Junior QA.

#### A. Apa itu Skill Ini? (Analogi Sederhana)
Bayangkan Anda adalah auditor independen yang membaca rencana peluncuran produk baru. Skill ini tidak hanya mengecek fitur berjalan secara teknis ("apakah tombol bisa diklik?"), tetapi juga membedah **dampak bisnisnya jika fitur itu gagal** (misal: "jika fitur diskon ini bocor, perusahaan rugi berapa rupiah?").

Skill ini menggunakan kerangka analitik kelas dunia:
- **SFDIPOT Heuristic**: Menganalisis Struktur, Fungsi, Data, Integrasi, Platform, Operasi, dan Waktu (*Time*).
- **6 Pilar Dampak Risiko Bisnis**: Finansial, Operasional, Pengalaman Pengguna (*Customer*), Kepatuhan (*Compliance*), Reputasi, dan Dukungan Teknis (*Support*).
- **Live UI Crawler Opsional**: Kemampuan AI untuk mengecek langsung tampilan menu di staging dan membandingkannya dengan isi PRD (*drift detection*).

#### B. Kapan Harus Digunakan?
- Ketika tim menerima dokumen PRD, BRD, atau User Story baru.
- Sebelum QA menuliskan satu baris pun skenario pengujian.
- Saat PM ingin memvalidasi apakah ada *edge case* bisnis yang belum terdefinisi dalam spesifikasi produk.

#### C. Prasyarat & Persiapan
1. Dokumen PRD dalam format teks, Markdown, Word (`.docx`), atau tautan Google Docs.
2. (Opsional) Akun dan URL staging jika ingin menyinkronkan analisis dengan UI asli di browser.

#### D. Panduan Langkah demi Langkah (Step-by-Step)
1. **Langkah 1: Siapkan Dokumen PRD**: Letakkan dokumen kebutuhan di folder proyek (misalnya di root atau berikan teksnya langsung ke obrolan).
2. **Langkah 2: Panggil Skill**: Ketikkan prompt analisis bisnis ke asisten AI (lihat contoh prompt di bawah).
3. **Langkah 3: Proses Klarifikasi Interaktif (Gate 1)**: Jika ada kebutuhan yang ambigu atau kontradiktif, AI **wajib berhenti dan bertanya** (tidak boleh berasumsi liar). Jawablah pertanyaan klarifikasi tersebut.
4. **Langkah 4: Pemeriksaan Hasil**: AI akan menghasilkan 2 berkas utama di folder `work/<ALIAS>/<fitur>/`:
   - `PRD_Analysis_<NamaFitur>.md`: Dokumen lengkap berisi dekomposisi kebutuhan, tabel keputusan (*decision table*), state invariants, matriks RBAC, dan rantai risiko bisnis.
   - `questions-for-pm-<namafitur>.md`: Daftar pertanyaan penting yang belum terjawab untuk ditanyakan langsung kepada Product Manager.

#### E. Contoh Prompt Siap Pakai
```text
Tolong lakukan analisis PRD mendalam menggunakan skill /prd-analyzer-business 
untuk fitur "Reservasi via Formulir Chat" berdasarkan dokumen [Sebutkan nama file PRD].
Sertakan rantai risiko bisnis dengan bobot dampak finansial dan operasional.
```

#### F. Hal Penting & Pantangan
- ✅ **Boleh**: Menyediakan screenshot wireframe atau meminta AI memeriksa menu live di staging.
- 🛑 **Pantangan**: Dilarang memaksa AI membuat test case sebelum dokumen analisis disetujui (analisis adalah fondasi mutlak).

---

### SKILL 2: `generate-testcase`
> **Kategori**: Desain Skenario & Master Test Case Suite  
> **Target Pengguna**: QA Engineer, QA Lead, Software Engineer.

#### A. Apa itu Skill Ini? (Analogi Sederhana)
Jika analisis PRD adalah resep dokter, maka `generate-testcase` adalah petunjuk dosis dan jadwal minum obat yang sangat terperinci. Skill ini mengubah konsep kebutuhan menjadi daftar pengujian terstruktur siap uji.

Keunggulan standar yang diterapkan:
- **3-Tier Coverage Matrix**: Happy Path (Alur Normal), Boundary/Systemic Edge Cases (Batas Ekstrem), dan Heuristic Exploratory Charters (Uji Acak & Stres).
- **Triple-Layer Assertion**: Menguji 3 lapisan sekaligus: Tampilan UI, Kontrak API/Payload, dan Persistensi Database.
- **Standar 15 Kolom Excel**: Kompatibel dengan sistem manajemen tes enterprise (Jira, Zephyr, TestRail, Xray).

#### B. Kapan Harus Digunakan?
- Setelah dokumen analisis PRD dari `prd-analyzer-business` selesai dan disepakati.
- Saat tim membutuhkan suite pengujian formal sebelum memulai sprint testing.

#### C. Prasyarat & Persiapan
- Telah ada file analisis `PRD_Analysis_<NamaFitur>.md` di folder `work/<ALIAS>/<fitur>/`.

#### D. Panduan Langkah demi Langkah (Step-by-Step)
1. **Langkah 1: Panggil Perintah**: Minta AI membuatkan test case dari dokumen analisis yang sudah ada.
2. **Langkah 2: Tinjauan Skenario Ekstrem (Adversarial Review)**: AI akan secara otomatis mengajukan minimal 5 skenario ekstrem (misal: koneksi putus tiba-tiba, input karakter aneh/SQL injection, multi-klik tombol dalam 1 detik).
3. **Langkah 3: Generasi File**: AI akan memproses dan menuliskan 2 berkas di folder `work/<ALIAS>/<fitur>/`:
   - `Test_Cases_<NamaFitur>.xlsx`: File spreadsheet Excel 15 kolom rapi dengan styling header biru korporat.
   - `test-cases-<namafitur>.md`: File Markdown berformat Gherkin (`Given-When-Then`) yang siap dibaca oleh mesin automasi browser.

#### E. Contoh Prompt Siap Pakai
```text
Berdasarkan dokumen `work/<ALIAS>/<fitur>/`PRD_Analysis_WhatsApp_Flow.md, 
tolong buatkan Master Test Case Suite lengkap menggunakan skill /generate-testcase. 
Pastikan menghasilkan file Excel 15 kolom dan Markdown untuk keperluan automasi.
```

#### F. Hal Penting & Pantangan
- ✅ **Boleh**: Menentukan batasan nilai (BVA) seperti panjang karakter maksimal atau batas kuota transaksi.
- 🛑 **Pantangan**: Dilarang membuat test case yang redundan (skenario duplikat yang hanya mengulang pengujian yang sama tanpa menambah nilai coverage).

---

### SKILL 3: `convert-document`
> **Kategori**: Dokumentasi Eksekutif & Ekspor Dokumen  
> **Target Pengguna**: QA Lead, PM, Technical Writer, Manajemen.

#### A. Apa itu Skill Ini? (Analogi Sederhana)
Mengubah file catatan teknis Markdown (`.md`) yang biasa dibaca oleh programmer menjadi berkas formal Word (`.docx`) atau PDF (`.pdf`) yang rapi, elegan, dan siap dipresentasikan di rapat direksi atau audit ISO/kepatuhan.

Fitur dokumen yang dihasilkan:
- Halaman judul formal dan tabel metadata RACI (siapa pembuat, peninjau, dan approver).
- Tabel dengan pewarnaan zebra (*alternating row*), border elegan, dan font Arial formal.
- Blockquote catatan dan peringatan berstandar korporat.

#### B. Kapan Harus Digunakan?
- Saat dokumen analisis atau test walkthrough perlu dikirimkan ke pihak eksternal, manajemen, atau klien.
- Ketika tim membutuhkan dokumentasi versi arsip (*evidence-grade audit*).

#### C. Prasyarat & Persiapan
- Berkas Markdown input (misalnya dokumen analisis PRD).
- Python 3 dengan pustaka `python-docx` sudah terinstal di sistem.

#### D. Panduan Langkah demi Langkah (Step-by-Step)
1. **Cara 1 (Melalui Chat AI)**:
   Cukup minta AI mengonversi file yang diinginkan.
   ```text
   Tolong konversi file `work/<ALIAS>/<fitur>/`PRD_Analysis_WhatsApp_Flow.md 
   menjadi dokumen Word (.docx) formal menggunakan skill /convert-document.
   ```
2. **Cara 2 (Langsung via Terminal)**:
   ```bash
   python3 .agents/skills/convert-document/scripts/md_to_docx.py \
     "`work/<ALIAS>/<fitur>/`PRD_Analysis_WhatsApp_Flow.md" \
     "work/<ALIAS>/<fitur>/reports/01-analysis.docx" \
     --contributor "Nama Anda" \
     --approver "Nama QA Lead / PM"
   ```

---

### SKILL 4: `convert-with-calculation`
> **Kategori**: Audit Kualitas Kuantitatif & Release Gate Scorecard  
> **Target Pengguna**: QA Lead, Engineering Manager, Product Director.

#### A. Apa itu Skill Ini? (Analogi Sederhana)
Mirip dengan `convert-document`, namun dilengkapi dengan **kalkulator matematis otomatis**. Skill ini membaca seluruh skenario tes, menghitung persentase risiko yang ter-cover, dan secara matematis memberikan rekomendasi rilis produk: **GO**, **CONDITIONAL GO**, atau **NO-GO**.

Formula Matematis yang Dihitung:
1. **Basic Risk Coverage (%)**: Rasio jumlah risiko yang teruji dibandingkan total risiko yang teridentifikasi.
2. **Weighted Risk Coverage (%)**: Pembobotan risiko berdasarkan tingkat keparahan:
   - *Critical* (Bobot 4)
   - *High* (Bobot 3)
   - *Medium* (Bobot 2)
   - *Low* (Bobot 1)
3. **Logika Release Recommendation**:
   - **GO**: Weighted Coverage $\ge 90\%$ dan TIDAK ADA risiko Critical/High yang gagal.
   - **CONDITIONAL GO**: Weighted Coverage $75\% - 89\%$ dengan mitigasi risiko terdokumentasi.
   - **NO-GO**: Weighted Coverage $< 75\%$ atau ada defect pada fungsi Critical.

#### B. Kapan Harus Digunakan?
- Sebelum pertemuan keputusan rilis ke production (*Release Go/No-Go Meeting*).
- Ketika manajemen membutuhkan metrik numerik nyata mengenai kesiapan rilis produk, bukan sekadar opini subjektif.

#### C. Panduan Penggunaan
```text
Gunakan skill /convert-with-calculation untuk mengonversi hasil analisis dan walkthrough 
menjadi laporan Word lengkap dengan Quality Scorecard dan Release Gate Recommendation.
```
*Atau via terminal*:
```bash
python3 .agents/skills/convert-with-calculation/scripts/calc_engine.py input.md output.json
python3 .agents/skills/convert-with-calculation/scripts/md_to_docx.py input.md Laporan_Quality_Gate.docx
```

---

### SKILL 5: `browser-qa-execution`
> **Kategori**: Eksekusi Otomatis Browser & Pengujian Live Staging  
> **Target Pengguna**: QA Automation Engineer, Manual QA.

#### A. Apa itu Skill Ini? (Analogi Sederhana)
Bayangkan memiliki robot tester yang duduk di depan browser Google Chrome asli, membuka halaman web staging, mengisi formulir satu per satu, mengklik tombol, memotret setiap langkah sebagai barang bukti (*screenshot evidence*), dan mencatat apakah ada tombol yang macet atau error.

Fitur Unggulan & Gerbang Keamanan:
- **Zero Browser Management Overhead**: Menghubungkan atau membuka Chrome port 9222 secara otomatis, dan menutupnya setelah tes selesai.
- **Safe Mode Mutation Guard**: Bertanya kepada user sebelum melakukan aksi ubah data (CREATE/EDIT/DELETE) agar database staging tidak terkotori jika pengujian hanya bersifat *read-only*.
- **Anti Tab Hijacking**: Memastikan URL aktif di browser cocok dengan aplikasi yang ingin diuji sebelum aksi dijalankan.
- **Zero Password Leak**: Password diinjeksi langsung ke form HTML tanpa pernah dikirimkan ke dalam prompt/teks chat LLM.

#### B. Kapan Harus Digunakan?
- Saat fitur sudah ter-deploy di server staging/development dan siap diverifikasi langsung di antarmuka web.
- Saat ingin memverifikasi file testcase Markdown secara otomatis tanpa perlu mengklik manual berulang-ulang.

#### C. Prasyarat & Persiapan
1. Browser Google Chrome terinstal di komputer.
2. File kredensial login telah terdaftar di `.secrets/<ALIAS>.env` lokal (misal: `USER_OWNER_MAIN=xxx`, `PASS_OWNER_MAIN=yyy`).
3. File testcase berformat Markdown (`.md`) yang ingin dijalankan telah tersedia di `work/<ALIAS>/<fitur>/`.

#### D. Panduan Langkah demi Langkah (Step-by-Step)
1. **Langkah 1: Jalankan Perintah**:
   ```text
   Tolong jalankan pengujian live staging menggunakan skill /browser-qa-execution 
   untuk file `work/<ALIAS>/<fitur>/`test-cases-filter-data.md.
   ```
2. **Langkah 2: Konfirmasi Target URL & Izin Mutasi**:
   AI akan mengonfirmasi URL target dan bertanya:
   > *"Apakah aksi CREATE/EDIT/DELETE diizinkan pada sesi pengujian ini? (Ya: Full Test / Tidak: Safe Mode Read-Only)"*
   Jawab sesuai kebutuhan Anda.
3. **Langkah 3: Eksekusi Berjalan**: Chrome akan terbuka dan menjalankan aksi secara otomatis.
4. **Langkah 4: Hasil & Bukti**:
   Semua screenshot disimpan di folder bertanda waktu:
   `work/<ALIAS>/<fitur>/runs/run_<Fitur>_<Timestamp>/` (fitur belum di-`init`: `browser-execution/automate-result/`)
   Laporan audit eksekutif Word dibuat otomatis:
   `Report_<Fitur>_<Timestamp>.docx`

---

### SKILL 6: `database-qa-validation`
> **Kategori**: Validasi Persistensi Basis Data (*Layer 3 QA Verification*)  
> **Target Pengguna**: Database QA, Backend QA, Data Engineer, Senior QA.

#### A. Apa itu Skill Ini? (Analogi Sederhana)
Ketika Anda selesai berbelanja online dan layar mengatakan "Pembayaran Sukses", bagaimana kita tahu bahwa saldo benar-benar terpotong di database dan nomor resi terbuat dengan benar di tabel belakang layar? Skill ini adalah alat verifikasi yang melihat langsung ke dalam database PostgreSQL.

Prinsip Keamanan Absolut (*Zero Mutation Mandate*):
- 🛑 **100% Read-Only**: Server MCP dirancang secara permanen menolak aksi `UPDATE`, `INSERT`, `DELETE`, `DROP`, atau `ALTER`. Database Anda aman dari kerusakan atau perubahan yang tidak disengaja.
- **Engine-Level PII Masking**: Kolom sensitif seperti password hash, secret token, nomor kartu kredit, dan OTP otomatis disensor menjadi `[REDACTED_PII]`.
- **Anti-Full-Scan Guard**: Mencegah query buta yang bisa membebani kinerja database staging.

#### B. Kapan Harus Digunakan?
- Memvalidasi apakah data yang diinput lewat browser benar-benar tersimpan di database (*state persistence*).
- Menjalankan inspeksi data spesifik (misal: "apakah user dengan email X aktif?").
- Melanjutkan pengujian parsial dari hasil `browser-qa-execution` (fitur Handoff).

#### C. Prasyarat & Persiapan
- Kredensial koneksi database staging telah dikonfigurasi di file rahasia profil `.secrets/<ALIAS>.env` root atau `mcp-server-database-qa/.env.docker` (contoh: `DB_PRIMARY_HOST`, `DB_PRIMARY_PORT`, `DB_PRIMARY_USER`, dll).

#### D. Panduan Langkah demi Langkah (Step-by-Step)
1. **Mode A: Inspeksi Data (Melihat Data Aktual Tanpa Ekspektasi)**:
   ```text
   /database-qa-validation
   Cari data di tabel "users" dengan email "user@example.com" pada database target primary.
   ```
2. **Mode B: Asersi Data (Mencocokkan Nilai Aktual dengan Ekspektasi)**:
   ```text
   /database-qa-validation
   Validasi data di tabel "orders" untuk nomor "ORD-123" pada database primary. 
   Ekspektasi: status harus "PAID" dan total_amount harus 150000.
   ```
   AI akan membandingkan nilai dan memberikan hasil:
   - ✅ `[PASSED] Database Assertion Match` jika cocok.
   - ❌ `[FAILED] Database Assertion Mismatch` jika berbeda.

3. **Mode C: Menggunakan Script CLI Cepat di Terminal**:
   ```bash
   # Melihat daftar tabel
   npm run db:validate -- --target-db=primary --list-tables

   # Inspeksi baris data tertentu
   npm run db:validate -- --target-db=primary --scenario=single --table=users --query=budi@mail.com

   # Menjalankan resep dari cheatsheet
   npm run db:validate -- --target-db=primary --recipe="Cari pesan ID ini berdasarkan data Channel ID"
   ```

---

### SKILL 7: `qa-review-learning`
> **Kategori**: Continuous Improvement & Anti-Regression Feedback Loop  
> **Target Pengguna**: Seluruh Tim (QA Lead, PM, SWE, Junior QA).

#### A. Apa itu Skill Ini? (Analogi Sederhana)
Di dunia penerbangan, setiap kali ada insiden, tim menganalisis "kotak hitam" agar kesalahan yang sama tidak pernah terjadi lagi. `qa-review-learning` adalah kotak hitam bagi tim QA.

Fungsi Utama:
- **Triangulasi Review**: Mengkaji feedback dari Product Manager, Tech Lead, atau insiden bug escape di production.
- **Diagnosis Miss-Path**: Mencari tahu mengapa sebuah bug bisa lolos (apakah karena PRD tidak lengkap? Test case kurang tajam? Atau tes browser terlewat?).
- **Few-Shot Learning**: Mencatat pelajaran berharga dalam format perbandingan nyata *Sebelum vs Sesudah* (*Before-vs-After*) ke dalam berkas `Testcase-support/qa-learnings.md`.
- **Anti-Regresi**: Menjadikan pelajaran tersebut sebagai aturan permanen sehingga AI tidak akan mengulangi kesalahan tersebut di masa depan.

#### B. Kapan Harus Digunakan?
- Setiap kali sprint selesai (*Sprint Retrospective*).
- Ketika ada revisi dokumen dari PM atau Tech Lead.
- Ketika ditemukan bug di lingkungan staging atau production (*post-mortem analysis*).

#### C. Panduan Penggunaan
1. **Langkah 1**: Letakkan file review atau feedback di folder `knowledge-review/` (misalnya file Excel review atau catatan teks).
2. **Langkah 2**: Panggil skill untuk memproses feedback tersebut:
   ```text
   Tolong evaluasi catatan review dari PM pada file knowledge-review/Review_Notes_Fitur_A.xlsx 
   menggunakan skill /qa-review-learning. Perbarui dokumen analisis dan catat pembelajaran 
   ke qa-learnings.md agar tidak terulang.
   ```
3. **Langkah 3**: AI akan memperbarui aturan dan mencatat akar masalah secara sistematis.

---

### SKILL 8: `mobile-qa-execution`
> **Kategori**: Eksekusi Pengujian Aplikasi Mobile di HP Android Fisik (Staging)  
> **Target Pengguna**: QA Mobile, QA Automation Engineer, Manual QA.  
> **Status Platform**: Android (siap pakai). iOS menyusul (fase 2) — TC khusus iOS otomatis ditandai `SKIP WITH REASON`.

#### A. Apa itu Skill Ini? (Analogi Sederhana)
Kalau `browser-qa-execution` adalah robot tester yang duduk di depan Chrome, skill ini adalah **robot tester yang memegang HP Android sungguhan**. Robot membuka aplikasi staging, login, mengetuk tombol, mengetik, menggeser layar, memutar HP, mematikan internet, lalu memotret setiap langkah sebagai bukti dan menulis laporan Word.

Fitur unggulan & gerbang keamanan:
- **Build Guard**: hanya aplikasi **staging** (mis. `com.example.app.staging`) yang boleh diuji. Aplikasi production di HP yang sama tidak akan pernah disentuh. Versi app tidak pernah di-downgrade otomatis.
- **Zero Password Leak**: password dibaca dari `.secrets/<ALIAS>.env` dan diketik langsung oleh server, tidak pernah dikirim ke AI.
- **Safe Mode Mutation Guard**: aksi ubah data (buat/edit/hapus/kirim/logout) hanya dijalankan bila diizinkan. Aksi ubah data **tidak pernah** dilakukan lewat tap koordinat buta.
- **Status jujur**: `PASSED`, `PASSED (LOW CONFIDENCE)`, `FAILED`, `PARTIAL TEST WITH REASON`, `SKIP WITH REASON`.
- **5 Charter Exploratory Mobile**: double tap, background & kill-relaunch, rotasi/font besar/dark mode, offline, tombol back.
- **Setting HP otomatis dikembalikan** (jaringan, ukuran font, dark mode, orientasi, notifikasi) setelah pengujian.

#### B. Kapan Harus Digunakan?
- Saat build APK staging baru tersedia dan perlu smoke test / regression di HP sungguhan.
- Saat menjalankan file test case mobile (`.md`) hasil skill `generate-testcase`.
- Saat perlu bukti visual (screenshot, rekaman layar, logcat) untuk laporan bug mobile.

#### C. Komponen yang Terlibat

| Komponen | Lokasi | Fungsi |
| :--- | :--- | :--- |
| SOP skill | `.agents/skills/mobile-qa-execution/SKILL.md` | Aturan kerja AI (gate, status, charter) |
| Parser test case mobile | `.agents/skills/mobile-qa-execution/scripts/parse_mobile_testcase.py` | Validasi format TC mobile |
| Mesin pengaman (MCP) | `mcp-server-mobile-qa/` | Mengendalikan HP lewat Appium dengan guard |
| Plan runner | `mcp-server-mobile-qa/runner/run_plan.mjs` | Menjalankan rencana eksekusi dengan 1 perintah |
| Installer & probe | `mobile-execution/probe/` | Setup Mac, cek kesiapan, pemetaan UI app |
| APK staging | `mobile-execution/build-apk/` | Build yang akan diuji |
| Data uji pendukung | `mobile-execution/automate-support/` | File untuk skenario upload |
| Rencana eksekusi | `work/<ALIAS>/<fitur>/plans/` | Terjemahan TC menjadi langkah konkret |
| Hasil pengujian | `work/<ALIAS>/<fitur>/runs/` & `reports/` | Evidence per run + laporan Word |
| Peta UI app (mentah) | `profiles/<ALIAS>/knowledge/mobile/live-analyzer/<package>/` | Struktur menu & ID elemen hasil probe |
| **UI Knowledge per app** | `profiles/<ALIAS>/knowledge/mobile/<package>/ui-knowledge.md` | Kumpulan selector, cara mencapai layar, jebakan & known issue — 1 folder per aplikasi, bertambah otomatis setiap run |

#### D. Gambaran Tahapan

```
 SEKALI SAJA (per laptop/HP)           SETIAP BUILD BARU             SETIAP PENGUJIAN
 ─────────────────────────────         ───────────────────           ─────────────────────────
 TAHAP 1  Setup Mac                    TAHAP 5  Probe peta UI        TAHAP 6  Siapkan test case
 TAHAP 2  Setup HP Android             (opsional, bila UI berubah)   TAHAP 7  Jalankan pengujian
 TAHAP 3  Konfigurasi project                                        TAHAP 8  Baca & review hasil
 TAHAP 4  Validasi instalasi                                         TAHAP 9  Selesai & rapikan
```

---

#### TAHAP 1 — Setup Mac (sekali per laptop, ±10–15 menit)

**Langkah 1.1 — Ambil versi terbaru repositori**

```bash
cd ~/Documents/PRD-ANALYZER/prdanalyzer
git pull
```

**Langkah 1.2 — Jalankan installer otomatis**

```bash
cd mobile-execution/probe
bash install_mac.sh
```
Installer akan memasang Android command-line tools, `adb`, build-tools, Appium + driver `uiautomator2`, serta dependency MCP mobile. Aman dijalankan berulang. Homebrew mungkin meminta password Mac.

> Jika muncul `npm error code EACCES` saat memasang Appium: jalankan ulang `bash install_mac.sh`. Script otomatis memindahkan lokasi instalasi global npm ke `~/.npm-global` (tanpa `sudo`). **Jangan** memakai `sudo npm install -g appium`.

**Langkah 1.3 — Buka terminal BARU**

Tutup terminal lalu buka lagi (atau jalankan `source ~/.zshrc`) agar `ANDROID_HOME`, `JAVA_HOME`, dan PATH aktif.

**Langkah 1.4 — Cek kesiapan**

```bash
cd ~/Documents/PRD-ANALYZER/prdanalyzer/mobile-execution/probe
bash setup_check.sh
```
Hasil yang diharapkan: tidak ada baris `[FAIL]`. Baris `[WARN]` boleh. Di bagian bawah muncul `Ringkasan: ... 0 FAIL`. Setiap baris `[FAIL]` selalu disertai perintah perbaikannya.

---

#### TAHAP 2 — Setup HP Android (sekali per HP, ±5 menit)

> Gunakan **HP khusus QA**. Data aplikasi staging di HP bisa di-reset saat pengujian berganti role.

**Langkah 2.1 — Aktifkan Developer options**

Settings → About phone → Software information → ketuk **Build number** 7 kali sampai muncul "Developer mode has been enabled".

**Langkah 2.2 — Atur Developer options**

- **USB debugging**: ON
- **Stay awake**: ON (layar tidak mati saat dicas)

**Langkah 2.3 — Pengaturan khusus merek**

| Merek | Pengaturan tambahan |
| :--- | :--- |
| Samsung | Settings → Security and privacy → **Auto Blocker: OFF** (jika ON, install & perintah lewat kabel diblokir) |
| Xiaomi / Redmi / POCO | Developer options → **USB debugging (Security settings): ON** dan **Install via USB: ON** |
| Oppo / Realme / Vivo | Developer options → **Disable permission monitoring** (jika ada) dan **Install via USB: ON** |

**Langkah 2.4 — Colok HP ke Mac**

Gunakan kabel data (bukan kabel charge saja). Di HP akan muncul dialog **Allow USB debugging?** → centang **Always allow from this computer** → tap **Allow**.

**Langkah 2.5 — Pastikan HP terdeteksi**

```bash
adb devices -l
```

| Output | Arti | Tindakan |
| :--- | :--- | :--- |
| `R58X...  device  model:SM_A266B ...` | ✅ Siap | Catat serial (kolom pertama) untuk dipakai sebagai `--udid` |
| `... unauthorized` | Mac belum diizinkan | Buka kunci HP, tap Allow. Jika dialog tidak muncul: `adb kill-server && adb devices` |
| `... offline` | Koneksi macet | `adb kill-server && adb start-server`, cabut-colok kabel |
| Daftar kosong | HP tidak terdeteksi | Cek kabel data, port lain, mode USB "File transfer", USB debugging ON |
| `127.0.0.1:xxxx offline` | Emulator/perangkat virtual lama | Abaikan atau lepas: `adb disconnect 127.0.0.1:xxxx` |

---
#### TAHAP 3 — Konfigurasi Project (sekali per project/aplikasi)

**Langkah 3.1 — Taruh APK staging**

Salin file APK staging ke `mobile-execution/build-apk/` (contoh: `app-staging_<build>.apk`). Sebaiknya hanya 1 APK di folder ini; jika lebih dari 1, AI akan bertanya APK mana yang dipakai.

**Langkah 3.2 — Siapkan profil & rahasia aplikasi** (tidak ikut ter-commit)

1. `cp -R profiles/_template profiles/<ALIAS>` lalu lengkapi `profiles/<ALIAS>/profile.yaml`.
2. `cp profiles/_template/secrets.env.example .secrets/<ALIAS>.env` lalu isi nilai asli (contoh di bawah).
3. Set `QA_ACTIVE_PROFILE=<ALIAS>` di `.env` root, lalu cek dengan `python3 scripts/qa_feature.py where`.
4. Tambahkan istilah identitas aplikasi ke `.secrets/denylist.txt` agar penjaga commit menolaknya.

Isi `.secrets/<ALIAS>.env`:

```bash
# Aplikasi staging yang boleh diuji (Build Guard)
MOBILE_APP_PACKAGE_STAGING=com.example.app.staging

# Kredensial per role: USER_<ROLE>_<n> & PASS_<ROLE>_<n>
USER_OWNER_1=email-owner@contoh.com
PASS_OWNER_1=********
USER_CS_1=email-agent@contoh.com
PASS_CS_1=********

# Opsional
# ANDROID_DEVICE_SERIAL=R58X...          (serial HP default)
# MOBILE_QUIET_NOTIFICATIONS=false       (jangan matikan pop-up notifikasi selama tes)
# APPIUM_URL=http://127.0.0.1:4723       (HANYA jika memakai Appium eksternal; kosongkan = dikelola otomatis)
```

**Langkah 3.3 — Pasang dependency MCP mobile** (sudah dilakukan installer; ulangi bila ada update)

```bash
cd ~/Documents/PRD-ANALYZER/prdanalyzer/mcp-server-mobile-qa
npm install
```

**Langkah 3.4 — Aktifkan MCP di IDE**

MCP `mobile-qa-guard` sudah terdaftar di `.agents/mcp_config.json` (Antigravity) dan `.cursor/mcp.json` (Cursor). Cukup **restart IDE** agar tool `qa_*` mobile muncul.

---

#### TAHAP 4 — Validasi Instalasi (sekali, dan setiap ada update skill)

**Langkah 4.1 — Self-test tanpa HP** (±30 detik)

```bash
cd ~/Documents/PRD-ANALYZER/prdanalyzer/mcp-server-mobile-qa
npm run selftest
```
Harus berakhir dengan `19 PASS, 0 FAIL`.

**Langkah 4.2 — Smoke test di HP** (±2 menit, read-only, tidak mengubah data)

Pastikan HP **tidak terkunci** dan layar menyala, lalu:
```bash
node test/device_smoke.mjs --udid <SERIAL_HP>
```
Harus berakhir dengan **`SMOKE PASSED`**. Jika `SMOKE FAILED`, daftar langkah yang gagal tercetak di bawahnya — lihat tabel Troubleshooting (bagian E di akhir Skill 8).

> Smoke test memakai sesi login yang sedang aktif di app. Jika app belum login, smoke akan login otomatis memakai `OWNER_1` (ubah dengan `--role owner --suffix <n>`).

---

#### TAHAP 5 — Probe Peta UI Aplikasi (setiap build dengan perubahan UI besar)

Probe membuka app, melewati layar izin, login, lalu menjelajahi menu secara **read-only** untuk mencatat ID elemen dan struktur menu. Hasilnya dipakai AI sebagai "peta" saat menerjemahkan test case.

```bash
cd ~/Documents/PRD-ANALYZER/prdanalyzer/mobile-execution/probe
node probe.mjs --udid <SERIAL_HP> --login
```

| Opsi | Kapan dipakai |
| :--- | :--- |
| `--install` | App staging belum terpasang / APK di folder lebih baru |
| `--use-installed` | Versi di HP lebih baru dari APK di folder (probe tidak pernah downgrade) |
| `--fresh` | Mulai dari kondisi bersih (data app staging di-reset) |
| `--open-chat 0` | Ikut memetakan layar chatroom (efek: chat teratas jadi terbaca) |

Hasil: `mobile-execution/probe-result/probe_<waktu>/probe_report.md` dan salinan peta di `profiles/<ALIAS>/knowledge/mobile/live-analyzer/<package>/<waktu>/` (`app_structure.md`, `locator_map.json`).

---

#### TAHAP 5b — UI Knowledge per Aplikasi (otomatis bertambah)

Setiap aplikasi punya folder knowledge sendiri berdasarkan **package name**, sehingga selector satu app tidak pernah terpakai untuk app lain:

```
`profiles/<ALIAS>/knowledge/mobile/
├── <package-staging>/            ← app profil aktif (staging)
│   ├── ui-knowledge.md            ← dibaca QA & AI (layar, ID elemen, cara mencapai, jebakan, known issue)
│   ├── ui-knowledge.json          ← data mesin (jangan diedit manual)
│   └── seed.json                  ← kurasi manual (judul layar, jebakan baru, known issue)
├── <package app lain>/            ← dibuat otomatis saat app lain diuji
└── _system/                       ← komponen OS yang dipanggil app (picker Files, Kamera)
    └── com.google.android.documentsui/
```

**Langkah 5b.1 — Tidak perlu dijalankan manual.** Plan runner dan probe otomatis memperbarui knowledge setelah selesai. Hanya data dari package yang sedang diuji yang masuk; layar picker/kamera OS masuk ke `_system/`.

**Langkah 5b.2 — Membaca knowledge.** Buka `ui-knowledge.md` app terkait sebelum menulis test case atau meminta AI menjalankan pengujian. Perhatikan bagian **Jebakan yang Diketahui** dan **Known Issues**.

**Langkah 5b.3 — Menambah pengetahuan manual (opsional).** Tambahkan jebakan/known issue/judul layar di `seed.json`, lalu jalankan:
```bash
cd ~/Documents/PRD-ANALYZER/prdanalyzer
python3 .agents/skills/mobile-qa-execution/scripts/update_ui_knowledge.py \
  --seed `profiles/<ALIAS>/knowledge/mobile/<package>/seed.json
```

**Langkah 5b.4 — Membangun ulang knowledge dari semua run & probe** (bila file rusak/terhapus):
```bash
python3 .agents/skills/mobile-qa-execution/scripts/update_ui_knowledge.py --rebuild
```

> Elemen tidak pernah dihapus otomatis. Elemen yang tidak terlihat 2 run berturut-turut ditandai `stale` → artinya UI kemungkinan berubah dan perlu dicek ulang.

---

#### TAHAP 6 — Siapkan Test Case Mobile

**Langkah 6.1 — Pakai format berikut** (dihasilkan `generate-testcase`, atau tulis manual):

```markdown
### MOB-XXX-001: Judul skenario
- **Tipe**: Functional | **Prioritas**: High | **Status**: Ready
- **Tags**: `Smoke, Mobile, Android`
- **Role**: Owner
- **Platform**: Android
- **Data Setup (API/DB)**: (opsional, informasi saja — tidak dieksekusi AI)
- **Precondition**:
  1. Data yang harus disiapkan manual sebelum tes.
- **Test Steps**:
  1. Buka menu ☰ > Pengaturan.
  2. Pada field Nama lengkap, masukkan QA Test.
  3. Klik tombol Simpan. [MUTATION]
- **Expected Results**:
  1. [UI] Judul halaman "Pengaturan" tampil.
  2. [Network] Request update profil berstatus 200.
  3. [DB/Persistence] Nama tersimpan di tabel user.
```

Aturan penting:
- **`Role`** wajib diisi agar AI tidak perlu bertanya.
- Tandai langkah ubah data dengan **`[MUTATION]`**.
- **`[UI]`** divalidasi di HP. **`[Network]` dan `[DB]`** tidak divalidasi oleh skill ini → TC menjadi `PARTIAL TEST WITH REASON` (validasi DB bisa dilanjutkan dengan `database-qa-validation`).
- Langkah yang terjadi **di luar app** (dikirim sistem/API, dilakukan pelanggan di kanal eksternal) tidak dieksekusi AI → tuliskan sebagai **Precondition** dan siapkan manual.
- **Jangan** menulis URL/route seperti web. Navigasi ditulis lewat menu ("Buka menu ☰ > Riwayat Order"). `Deeplink:` hanya boleh diisi jika route sudah dikonfirmasi dev.

**Langkah 6.2 — Cek format sebelum dijalankan**

```bash
cd ~/Documents/PRD-ANALYZER/prdanalyzer
python3 .agents/skills/mobile-qa-execution/scripts/parse_mobile_testcase.py \
  `work/<ALIAS>/<fitur>/`<file>.md --platform android
```
Pastikan `"contract_status": "PASSED"`. Perhatikan bagian `lint`: TC tanpa role, langkah yang dicurigai mutasi tanpa `[MUTATION]`, dan TC yang butuh data manual.

---
#### TAHAP 7 — Jalankan Pengujian

**Langkah 7.1 — Siapkan HP**

- HP tercolok, **tidak terkunci**, layar menyala, tidak dipakai selama tes.
- Tutup pop-up/notifikasi yang sedang tampil. (Selama tes, pop-up notifikasi otomatis dimatikan dan DND diaktifkan, lalu dikembalikan.)

**Langkah 7.2 — Kirim prompt ke AI (Antigravity/Cursor)**

```text
Jalankan skill mobile-qa-execution untuk file
work/<ALIAS>/mobile-smoke/02-testcases.md
di device <SERIAL_HP>.
```

**Langkah 7.3 — Jawab pertanyaan gate dari AI**

| Gate | Pertanyaan AI | Panduan menjawab |
| :--- | :--- | :--- |
| 1 Test case | Rekap TC valid / invalid / skip iOS | Perbaiki TC invalid atau setujui lanjut dengan yang valid |
| 2 Device & Build | Pilih HP (jika >1), pilih APK (jika >1), install/upgrade? | HP lebih baru dari APK → pilih **pakai build terpasang** atau taruh APK terbaru |
| 3 Kredensial | Akun mana untuk role X (jika >1 di `.secrets/<ALIAS>.env`)? / Sesi aktif beda role? | Pilih akun sesuai TC. Jika sesi aktif beda role → pilih **reset & login ulang** |
| 4 Mode mutasi | `QA_MUTATION_MODE` di `.secrets/<ALIAS>.env` sudah diset? Jika ya, agent tidak bertanya (hanya banner). Jika belum: `full` / `full_external` / `safe` | Regression penuh → `full` (update/delete hanya data ber-TAG, finansial diblokir). Perlu kirim pesan/broadcast → `full_external` + isi `QA_TEST_RECIPIENT_ALLOWLIST`. Belum yakin → `safe` |
| 5 Data precondition | Data per TC sudah siap? | Jawab jujur; TC yang datanya belum siap → SKIP |

**Langkah 7.4 — Biarkan berjalan**

Durasi kira-kira 1 menit per TC + 5 menit charter. Jangan menyentuh HP. Jika AI mengatakan tool MCP tidak tersedia di sesinya, lanjut ke Opsi B.

**Opsi B — Plan Runner (fallback 1 perintah)**

Dipakai bila AI tidak bisa memanggil tool MCP secara langsung (mis. sesi AI berjalan di cloud). AI tetap menanyakan semua gate, lalu membuat file rencana `work/<ALIAS>/<fitur>/plans/<fitur>.plan.json`. Anda cukup menjalankan:
```bash
cd ~/Documents/PRD-ANALYZER/prdanalyzer/mcp-server-mobile-qa
node runner/run_plan.mjs ../work/<ALIAS>/<fitur>/plans/<fitur>.plan.json
```
Di awal output harus muncul `READY ...`, `NOTES ... heads-up OFF, DND ON`, dan `HOME OK`. Jika runner berhenti dengan pesan "Pre-flight home gagal" atau "UI tree app kosong", buka kunci HP / tutup pop-up lalu ulangi.

---

#### TAHAP 8 — Baca & Review Hasil

**Langkah 8.1 — Buka folder hasil**

`work/<ALIAS>/<fitur>/runs/run_<fitur>_<waktu>/` berisi:

| File | Isi |
| :--- | :--- |
| `<TC>_final_<STATUS>.png` | Screenshot akhir setiap TC |
| `<TC>_..._logcat.txt` | Log app & crash (otomatis untuk FAILED) |
| `<TC>_recording.mp4` | Rekaman layar (TC Critical/High) |
| `actions.jsonl` | Jejak setiap aksi & assertion |
| `guard_events.json` | Kejadian app keluar ke launcher/app lain |
| `run_results.json`, `report_data.json` | Data hasil untuk laporan |

Laporan Word: `work/<ALIAS>/<fitur>/reports/Report_<fitur>_<waktu>.docx`.

**Langkah 8.2 — Pahami status**

| Status | Arti |
| :--- | :--- |
| `PASSED` | Semua langkah & assertion UI lolos dengan elemen ber-ID/berlabel jelas |
| `PASSED (LOW CONFIDENCE)` | Lolos, tetapi ada langkah via tap posisi/teks mirip (mis. ikon tanpa label) atau verifikasi visual — cek screenshot |
| `FAILED` | Expected tidak terpenuhi (assertion gagal, error tampil, crash, app keluar sendiri). Wajib `failure_category`: product / script / environment / data |
| `PARTIAL TEST WITH REASON` | Layer dalam scope dicoba tetapi tidak tuntas (mutasi diblokir Safe Mode, target ambigu) |
| `BLOCKED` | Data belum siap, kredensial tidak ada, pertanyaan PM terbuka, binding/knowledge belum ada, device/staging bermasalah |
| `NOT IN SCOPE` | Layer yang tidak dipilih untuk run ini (mis. [API]/[DB] saat run hanya UI mobile) |
| `SKIP WITH REASON` | Dikeluarkan atas keputusan user (mis. TC khusus iOS di fase Android) |

Verdict rilis (standar bersama `.agents/shared/standards/status-verdict-evidence.md`), selalu disertai pernyataan scope:
**NO-GO** bila ada FAILED kategori product pada P1/P2 atau risiko Critical/High tanpa TC lulus; **CONDITIONAL GO** bila ada FAILED product P3/P4 atau LOW CONFIDENCE/PARTIAL/BLOCKED pada P1/P2 (dengan mitigasi & pemilik); **GO** selain itu. Reviewer & pemutus verdict adalah user yang menjalankan workflow.

**Langkah 8.3 — Wajib review sebelum melapor**

Runner/AI bisa keliru menilai (contoh nyata: error state "Terjadi kesalahan" terbaca sebagai empty state, atau charter gagal diturunkan menjadi OBSERVATION). Sebelum hasil dikirim ke tim:
1. Buka screenshot setiap TC `FAILED` dan `LOW CONFIDENCE`.
2. Buka screenshot charter (landscape, font besar, dark mode, offline).
3. Minta AI: *"Review hasil run `<folder run>` dan buat laporan REVIEWED."* AI akan mengoreksi status dan menghasilkan `Report_<fitur>_<waktu>_REVIEWED.docx`.
4. Temuan yang **tidak konsisten** antar run → laporkan sebagai *intermiten* dan jalankan ulang untuk konfirmasi.

---

#### TAHAP 9 — Selesai & Rapikan

- Setting HP (jaringan, font, dark mode, orientasi, notifikasi) **otomatis dikembalikan**. Jika run terhenti paksa (Ctrl+C), cek manual: airplane mode OFF, ukuran font normal, DND OFF.
- Jika TC logout dijalankan, app berada di layar login; run berikutnya otomatis login ulang dari `.env`.
- Folder `run_*` dan laporan tidak ikut ter-commit ke git (sudah diatur di `.gitignore`).

---
#### E. Troubleshooting (Masalah yang Sering Terjadi)

| Gejala | Penyebab | Solusi |
| :--- | :--- | :--- |
| `npm error code EACCES ... /usr/local/bin/appium` | Folder global npm milik sistem | Jalankan ulang `bash install_mac.sh` (otomatis pakai `~/.npm-global`). Jangan pakai `sudo` |
| `Neither ANDROID_HOME nor ANDROID_SDK_ROOT ...` | Appium lama berjalan tanpa env Android | `pkill -f appium` lalu ulangi. MCP menjalankan Appium sendiri di port 4733 |
| `Cannot find module '/Users/.../probe.mjs'` | Perintah dijalankan dari folder yang salah | `cd` ke folder yang benar dulu (lihat setiap langkah) |
| `adb: command not found` | Terminal belum memuat env | Buka terminal baru / `source ~/.zshrc` |
| `adb server version doesn't match` | Ada 2 adb terpasang | `brew uninstall --cask android-platform-tools` |
| `Build di HP LEBIH BARU dari APK` | APK di folder lebih lama | Pilih pakai build terpasang (`--use-installed` / jawab gate), atau taruh APK terbaru |
| `INSTALL_FAILED_...` di Samsung | Auto Blocker aktif | Matikan Auto Blocker (Tahap 2.3) |
| `READY_WITH_WARNING` / "UI tree app kosong" | HP terkunci atau pop-up/overlay menutupi app | Buka kunci HP, tutup pop-up, ulangi |
| Semua TC gagal di langkah "Kembali ke home" | Layar awal tidak terbaca sebagai home | Pastikan app terbuka di home saat mulai, HP tidak terkunci, lalu ulangi |
| `Target ambigu: 2 kandidat` | Ada 2 elemen bernama sama (mis. tab "Semua" & chip "Semua") | Normal — pengaman. AI memilih dengan `index`/`ref` sesuai konteks TC |
| Status `PARTIAL ... Safe Mode` | Mode mutasi `safe` | Sesuai desain. Ulangi dengan `QA_MUTATION_MODE=full` bila memang diperlukan |
| Status `PARTIAL ... data ber-TAG` | Edit/hapus pada data tanpa TAG run | Buat data uji dengan `{{TAG}}` dulu di TC, atau longgarkan `QA_REQUIRE_DATA_TAG` |
| Status `PARTIAL ... full_external` / penerima | Kirim/broadcast di mode `full`, atau penerima tidak di allowlist | Pakai `full_external` + isi `QA_TEST_RECIPIENT_ALLOWLIST` dengan nomor/kontak uji |
| Status `PARTIAL ... finansial` | Bayar/top up/potong kuota | Aturan keras. Hanya `QA_FINANCIAL_SANDBOX=true` bila staging memakai payment sandbox |
| Guard: "App keluar ke launcher" | App tertutup saat tombol back ditekan | App dikembalikan otomatis. Bila terjadi pada langkah yang diuji → kandidat defek, verifikasi manual |

#### F. Hal Penting & Pantangan
- ✅ **Boleh**: Menjalankan ulang run untuk mengonfirmasi temuan intermiten; meminta AI menjelaskan status tiap TC.
- ✅ **Boleh**: Memakai Safe Mode untuk run pertama pada build baru.
- 🛑 **Pantangan**: Menguji aplikasi **production**. Build Guard akan menolak, jangan diakali dengan mengubah allowlist.
- 🛑 **Pantangan**: Menuliskan password di prompt, test case, atau dokumen. Selalu lewat `.env`.
- 🛑 **Pantangan**: Menyentuh HP saat pengujian berjalan.
- 🛑 **Pantangan**: Melaporkan hasil ke tim tanpa review screenshot (Tahap 8.3).

#### G. Contoh Prompt Siap Pakai
```text
# Jalankan suite
Jalankan skill mobile-qa-execution untuk file `work/<ALIAS>/<fitur>/`<file>.md
di device <SERIAL_HP>. Gunakan akun OWNER_1, Safe Mode.

# Jalankan sebagian TC
Jalankan skill mobile-qa-execution hanya untuk TC MOB-SMOKE-004 sampai MOB-SMOKE-007
dari file work/<ALIAS>/mobile-smoke/02-testcases.md.

# Review hasil
Review hasil run work/<ALIAS>/<fitur>/runs/<folder run> dan buat laporan REVIEWED.

# Perbarui peta UI setelah build baru
Build APK baru sudah saya taruh di mobile-execution/build-apk. Bantu jalankan probe
dan bandingkan perubahan struktur UI dengan peta sebelumnya.
```

---

## 5. MATRIKS RINGKASAN: KAPAN MENGGUNAKAN SKILL APA?

| Pertanyaan / Kebutuhan Anda | Skill yang Tepat | Berkas yang Dihasilkan |
| :--- | :--- | :--- |
| *"Saya baru dapat dokumen PRD dari PM, harus mulai dari mana?"* | **`prd-analyzer-business`** | `PRD_Analysis_*.md`, `questions-for-pm-*.md` |
| *"Analisis sudah disetujui, saya butuh file Excel test case untuk di-upload ke Jira/TestRail."* | **`generate-testcase`** | `Test_Cases_*.xlsx`, `test-cases-*.md` |
| *"Saya butuh dokumen Word formal untuk dibagikan ke manajemen/stakeholder."* | **`convert-document`** | Dokumen `.docx` formal dengan format RACI |
| *"Manajemen meminta skor kesiapan rilis (Go / No-Go) sebelum deployment."* | **`convert-with-calculation`** | Laporan `.docx` dengan Release Gate Scorecard |
| *"Saya ingin mengetes web staging langsung di Chrome secara otomatis dan merekam buktinya."* | **`browser-qa-execution`** | Folder screenshot `automate-result/` & Laporan Word |
| *"Saya ingin mengetes aplikasi Android staging langsung di HP dan merekam buktinya."* | **`mobile-qa-execution`** | Folder `mobile-execution/automate-result/` & Laporan Word |
| *"Saya ingin memastikan data tersimpan di PostgreSQL tanpa risiko merusak data staging."* | **`database-qa-validation`** | Terminal preview aman (Read-Only & PII Masked) |
| *"Ada bug yang bocor ke staging/production, bagaimana agar kita tidak kecolongan lagi?"* | **`qa-review-learning`** | `Testcase-support/qa-learnings.md` ter-update |

---

## 6. TIPS & PRAKTIK TERBAIK (*BEST PRACTICES*)

1. **Jaga Kerahasiaan Kredensial**:
   - Jangan pernah menuliskan password atau kunci rahasia di dalam dokumen PRD atau prompt chat.
   - Selalu gunakan file rahasia profil `.secrets/<ALIAS>.env` lokal atau `mcp-server-database-qa/.env.docker` yang sudah dilindungi oleh `.gitignore`.
2. **Jangan Lewati Tahap Analisis**:
   - Godaan terbesar adalah langsung membuat test case tanpa menganalisis PRD. Melompati analisis PRD sering kali menyebabkan skenario batas (*edge cases*) dan risiko bisnis terlewat.
3. **Mobile: Selalu Review Sebelum Melapor**:
   - Untuk `mobile-qa-execution`, cek screenshot TC `FAILED`/`LOW CONFIDENCE` dan charter sebelum laporan dibagikan; jalankan ulang untuk temuan yang tidak konsisten.
4. **Manfaatkan Format Markdown untuk Automasi**:
   - File testcase berekstensi `.md` yang dihasilkan oleh `generate-testcase` dirancang agar dapat langsung dibaca dan dieksekusi oleh mesin `browser-qa-execution` maupun `mobile-qa-execution` tanpa perlu konversi manual.
5. **Kolaborasi Multi-Role yang Sehat**:
   - **PM**: Cukup membaca ringkasan eksekutif dan menjawab file `questions-for-pm-*.md`.
   - **Junior QA**: Dapat mengikuti langkah demi langkah pada file `test-cases-*.md` atau menjalankan script validator database.
   - **Senior QA**: Mengawasi kualitas cakupan risiko pada `convert-with-calculation` dan memastikan integritas *learning loop* di `qa-review-learning`.

---

*Dokumen ini disusun sebagai panduan standar operasional resmi untuk seluruh tim pengembang dan penjamin kualitas perangkat lunak.*

