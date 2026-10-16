---
name: browser-qa-execution
description: >-
  Standard operating procedure for a Senior QA Engineer to execute feature testing directly on Google Chrome browser in a staging environment.
  Enforces automatic browser lifecycle management (detects and auto-launches Chrome QA on port 9222 if not opened, and automatically closes Chrome upon test completion),
  enforces a strict Markdown (.md) testcase file mandate (with mandatory user confirmation/conversion gate if .md is not found or in .xlsx),
  integrates supplementary test data from automate-support/ with mandatory scenario-data mapping gates,
  verifies credentials against .env with 3-tier checks (multi-credential disambiguation gate for duplicate role prefixes, missing credential alert instructing user to update .env, and active session mismatch gate to switch user vs stay on current role), applies domain-agnostic universal step execution,
  mandates pre-flight confirmation asking user whether CREATE/EDIT/DELETE mutation actions are permitted (if yes, runs all actions without guard; if no, executes in safe mode flagging mutation steps as PARTIAL TEST WITH REASON), handles multi-role RBAC execution,
  applies transparent status flagging (PASSED, FAILED, SKIP WITH REASON, PARTIAL TEST WITH REASON for backend/DB steps and safe-mode skipped mutations),
  executes 5 mandatory exploratory testing charters, archives screenshots into timestamped run directories,
  and compiles executive corporate Word (.docx) audit reports without embedded images into automate-result/.
  Activate when the user asks to run browser testing, execute test cases live in staging browser, or perform automated QA verification.
---

# Senior QA Browser Execution Skill (`browser-qa-execution`)

Skill ini mendefinisikan Standar Operasional Prosedur (SOP) bagi seorang **Senior QA Engineer** dalam menjalankan pengujian fitur secara langsung pada **browser Google Chrome (Staging Environment)** yang terhubung via Chrome DevTools Protocol (CDP port 9222).

Skill ini dilengkapi **Manajemen Siklus Hidup Browser Otomatis (Browser Lifecycle Management)**:
1. **Pre-flight Auto-Launch**: Memeriksa apakah browser Chrome sudah dibuka pada port 9222; jika belum, mesin akan membuka Google Chrome QA profile secara otomatis.
2. **Post-flight Auto-Close**: Setiap kali pengujian selesai dieksekusi (baik sukses maupun terdapat defek), mesin akan menutup browser secara otomatis dan bersih menggunakan perintah native CDP `Browser.close`.

Skill ini dirancang bersifat **Universal & Domain-Agnostic** (dapat digunakan untuk Web E-Commerce, CRM, Portal Admin, ERP, SaaS, maupun Internal Tools), dengan penegakan aturan **STRICT** yang wajib dipatuhi.

---

## 1. Lokasi Berkas & Arsitektur Direktori (*File Architecture*)

- **Sumber Test Case (Wajib Berformat `.md`)**:
  `./result-testcase/` (atau direktori kustom yang diberikan oleh user).
  - 🛑 **STRICT MANDATE**: File test case **WAJIB** berformat Markdown (`.md`).
  - Jika berkas yang tersedia berformat Excel (`.xlsx`) atau format non-MD lainnya, **WAJIB melalui Gerbang Konversi/Konfirmasi** sebelum dapat dieksekusi.
- **Penyimpanan Data Pendukung Uji (*Supplementary Test Data*)**:
  `./automate-support/`
  - Menyimpan berkas data pengujian beragam: data katalog produk, daftar kontak CSV upload, template caption, file DOCX/PDF sampel, payload JSON.
- **Konfigurasi Environment & Kredensial Role**:
  `./.env` (memuat `E2E_BASE_URL_STAGING`, `USER_<ROLE>_<NAME>`, `PASS_<ROLE>_<NAME>`).
- **Skrip & Mesin Eksekusi Universal**:
  - Universal Agnostic Executor: `./.agents/skills/browser-qa-execution/scripts/universal_executor.js`
  - Test Case Parser: `./.agents/skills/browser-qa-execution/scripts/parse_testcase.py`
  - Excel to Markdown Converter: `./.agents/skills/browser-qa-execution/scripts/convert_to_md_testcase.py`
  - Generator Laporan Word DOCX: `./.agents/skills/browser-qa-execution/scripts/generate_docx_report.py`
  - Bridge Controller: `./scripts/browser_bridge.js`
- **Target Output Hasil Uji**:
  - **Laporan Dokumen Word (Executive DOCX)**:
    `./automate-result/Report_<FeatureName>_<YYYYMMDD_HHMMSS>.docx`
    *(Tanpa embedded screenshot agar ringan, profesional, dan mudah dibaca stakeholder).*
  - **Arsip Screenshot Evidence (Folder per Run)**:
    `./automate-result/run_<FeatureName>_<YYYYMMDD_HHMMSS>/`
    *(Setiap screenshot diberi nama unik: `<TC_ID>_<step>_<status>.png`).*

---

## 2. 6 Gerbang Kualitas Mandatori (*Mandatory QA Gates - STRICT*)

Sebelum dan selama menjalankan pengujian, Senior QA **WAJIB** mematuhi 6 gerbang validasi berikut tanpa kompromi:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   6 MANDATORY QA VALIDATION GATES                      │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 1: STRICT MARKDOWN (.MD) & FILE SELECTION GATE                    │
│ - File test case WAJIB berformat Markdown (.md).                       │
│ - Jika pada result-testcase/ TIDAK DITEMUKAN file .md (misal hanya     │
│   tersedia .xlsx): Agent WAJIB BERHENTI & BERTANYA kepada user:        │
│   (A) Konversi otomatis berkas ke format .md standar.                  │
│   (B) User menyediakan/memformat file .md sendiri.                     │
│ - Jika terdapat >1 file .md, WAJIB bertanya file mana yang dipilih.   │
│   DILARANG mengeksekusi semua file tanpa konfirmasi!                   │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 2: SUPPLEMENTARY TEST DATA GATE (automate-support/)               │
│ - Jika skenario testcase menyebutkan penggunaan test data tambahan     │
│   (misal data produk, file upload, payload, dsb.), baca ke direktori   │
│   ./automate-support/.                                                 │
│ - Jika informasi belum spesifik atau ada >1 kandidat file di           │
│   automate-support/: WAJIB BERTANYA kepada user untuk memastikan:      │
│   "File test data apa yang akan digunakan untuk skenario [Nama TC]?"   │
│   DILARANG menebak atau mengambil file secara acak!                    │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 3: CREDENTIAL VERIFICATION, DISAMBIGUATION & SESSION GATE         │
│ - Multi-Credential Disambiguation: Jika skenario menyebut role umum    │
│   (misal: "sebagai CS", "sebagai Owner") & di .env ada >1 kredensial   │
│   ber-prefix serupa (misal USER_CS_A & USER_CS_B, atau                 │
│   USER_OWNER_CHATREBORN & USER_OWNER_EVERPRO):                         │
│   WAJIB BERHENTI & BERTANYA ke user kredensial mana yang digunakan.    │
│   DILARANG memilih sepihak atau acak!                                  │
│ - Missing Credential Alert: Jika skenario membutuhkan role tertentu    │
│   namun TIDAK DITEMUKAN satupun kredensial di .env: WAJIB MEMBERI      │
│   INFO ke user untuk update .env (USER_<ROLE>_<NAME> & PASS_...)       │
│   dan menunda eksekusi role tersebut sampai .env diperbarui.           │
│ - Active Session Mismatch Gate: Jika browser sudah dalam status login  │
│   tetapi user/role aktif BERBEDA dengan role skenario test case:       │
│   WAJIB BERTANYA ke user opsi penanganan:                              │
│   (A) Logout dan login ulang ke role skenario, ATAU                    │
│   (B) Tetap lanjut dengan role aktif saat ini (konfirmasi eksplisit).  │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 4: PRE-FLIGHT ACTION PERMISSION GATE (CREATE / EDIT / DELETE)     │
│ - SEBELUM eksekusi dijalankan, Agent WAJIB BERTANYA kepada user:       │
│   "Apakah diperbolehkan melakukan aksi create/edit/delete pada proses  │
│    run testcase ini?"                                                  │
│ - Jika IYA (Diizinkan): Jalankan SEMUA skenario secara penuh TANPA     │
│   GUARD (aksi create/edit/delete dieksekusi nyata di staging).         │
│ - Jika TIDAK (Mode Aman): Aksi mutasi (create/edit/delete) dilewati,   │
│   dan skenario tersebut WAJIB DITANDAI DENGAN FLAG:                    │
│   PARTIAL TEST WITH REASON: Aksi mutasi data ("...") dilewati sesuai   │
│   izin mode aman user. (Seperti kondisi partial passed).               │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 5: TRANSPARENT STATUS FLAGGING GATE                               │
│ - PASSED: Skenario UI selesai dan seluruh assertion terpenuhi.         │
│ - FAILED: Assertion UI gagal atau elemen/opsi tidak ditemukan.         │
│ - SKIP WITH REASON: Skenario ambigu atau terhalang blocker aktif.      │
│ - PARTIAL TEST WITH REASON: Skenario melibatkan API/DB/Webhook.        │
│   Part UI dieksekusi, lalu ditandai PARTIAL TEST agar verifikasi       │
│   database/backend dilanjutkan secara manual oleh QA/User.             │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 6: RBAC STRICT EXECUTION GATE                                     │
│ - HANYA jalankan role yang tertulis dalam testcase. Dilarang menguji   │
│   role yang tidak tertera pada dokumen!                                │
│ - Laporan hasil pengujian terkelompok rapi per user/role.              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Alur Kerja Eksekusi Lengkap (*Execution Workflow Phases*)

### Fase 1: Validasi Input, Format, & Resolusi File (Gate 1 & Gate 2)
1. **Pemeriksaan Keberadaan File `.md`**:
   Cari file test case di `./result-testcase/` atau path yang diberikan user.
   * *Kasus 1: Ditemukan file `.xlsx` tetapi tidak ada `.md`*:
     Panggil gerbang konfirmasi:
     > *"Format file saat ini adalah Excel (.xlsx). Sesuai SOP, pengujian wajib menggunakan format Markdown (.md). Apakah Anda ingin saya bantu konversi ke format `.md` standar sekarang?"*
     Jika disetujui, jalankan `python3 convert_to_md_testcase.py <file.xlsx>`.
   * *Kasus 2: Ditemukan lebih dari 1 file `.md`*:
     Tanyakan kepada user file `.md` mana yang ingin dieksekusi.
2. **Pemeriksaan Test Data di `automate-support/`**:
   Jika langkah uji membutuhkan data eksternal (misal: *"upload data produk"*, *"isi form dengan data pelanggan baru"*):
   * Periksa isi `./automate-support/`.
   * Jika nama file belum jelas atau terdapat banyak file, ajukan pertanyaan konfirmasi pemetaan file data ke skenario.

### Fase 2: Validasi Kredensial & Lingkungan (Gate 3 - Zero-Ambiguity Policy)

Senior QA wajib menjalankan validasi 3 tingkat (*3-Tier Credential & Session Check*) terhadap kredensial pengujian guna mengeliminasi potensi kesalahan akun:

1. **Pemetaan Role Skenario terhadap `.env`**:
   - Ekstrak role yang disyaratkan oleh test case (misal: `Owner`, `Admin`, `CS`, `Agent`, `Finance`).
   - Cari kredensial relevan di file `./.env` dengan format:
     `USER_<ROLE>_<IDENTIFIER>` dan `PASS_<ROLE>_<IDENTIFIER>`.

2. **Aturan 1: Multi-Credential Disambiguation Gate (Wajib Bertanya)**:
   - Jika skenario hanya menyebutkan role secara umum (misal: *"sebagai CS"* atau *"sebagai Owner"*), dan pada file `.env` ditemukan **lebih dari 1 kredensial** dengan prefix serupa (contoh: terdapat `USER_OWNER_CHATREBORN` dan `USER_OWNER_EVERPRO`, atau `USER_CS_WHATSAPP` dan `USER_CS_ORDER`):
   - **WAJIB BERHENTI & BERTANYA KEPADA USER** dengan menyajikan daftar opsi pilihan:
     > *"Pada file `.env` ditemukan lebih dari 1 kredensial untuk role **[ROLE]**:*
     > *1. `[KEY_1]` ([username_1])*
     > *2. `[KEY_2]` ([username_2])*
     > *Mohon konfirmasi, akun/kredensial mana yang akan digunakan untuk menjalankan skenario ini?"*
   - **DILARANG KERAS** menebak atau mengambil salah satu akun secara sepihak!

3. **Aturan 2: Missing Credential Gate (Info & Panduan Update `.env`)**:
   - Jika skenario membutuhkan role tertentu (misal: `Admin` atau `CS`), namun pada `.env` **TIDAK DITEMUKAN** satu pun kredensial dengan prefix role tersebut:
   - **WAJIB MEMBERI TAHU USER** untuk memperbarui file `.env` terlebih dahulu dan menunda eksekusi role tersebut:
     > *"⚠️ **Kredensial Tidak Ditemukan**: Skenario ini membutuhkan role **[ROLE]**, namun kredensial untuk role tersebut belum terdaftar di file `.env`.*
     > *Mohon tambahkan konfigurasi berikut ke file `.env` Anda:*
     > ```env
     > USER_[ROLE]_[IDENTIFIER]=email_atau_username
     > PASS_[ROLE]_[IDENTIFIER]=password
     > ```
     > *Silakan konfirmasikan kembali setelah file `.env` diperbarui agar pengujian dapat dilanjutkan."*

4. **Aturan 3: Active Session Mismatch Gate (Deteksi Perbedaan Role Aktif)**:
   - Saat browser dibuka dan terhubung:
   - Mesin memeriksa status sesi aktif pada browser (apakah sudah login, dan siapa user/role yang sedang aktif).
   - Jika browser **sudah dalam kondisi login**, namun user/role yang aktif **BERBEDA** dengan role yang dibutuhkan skenario test case (contoh: browser sedang aktif dengan akun `Owner`, tetapi skenario test case mengharuskan pengujian *"sebagai CS"*):
   - **WAJIB BERTANYA KEPADA USER**:
     > *"⚠️ **Perbedaan Sesi Login Terdeteksi**:*
     > *Browser saat ini sedang login dengan akun **[Role_Aktif / Username_Aktif]**, sedangkan skenario pengujian mensyaratkan role **[Role_Skenario]**.*
     > *Pilihan tindakan:*
     > *(A) Logout dan login ulang menggunakan kredensial `[Role_Skenario]` dari `.env`.*
     > *(B) Tetap melanjutkan pengujian menggunakan akun `[Role_Aktif]` yang saat ini sedang aktif.*
     > *Mohon konfirmasi opsi mana yang Anda pilih."*
   - Hanya lakukan perpindahan akun atau melanjutkan pengujian setelah user memberikan jawaban eksplisit.

5. **Pemeriksaan & Auto-Launch Browser Chrome (Port 9222)**:
   - Mesin secara otomatis mendeteksi apakah Google Chrome dengan remote debugging port 9222 sudah aktif:
   - Jika belum terbuka: Mesin otomatis membuka Google Chrome dengan flag `--remote-debugging-port=9222` dan `--user-data-dir="$HOME/chrome-qa-profile"`.
   - Melakukan self-healing target tab untuk memastikan halaman siap dieksekusi oleh Playwright.

### Fase 2b: Pre-Flight Action Permission Gate (Izin Mutasi CREATE / EDIT / DELETE - Gate 4)
SEBELUM runner pengujian dieksekusi, Senior QA / Agent **WAJIB BERTANYA KEPADA USER**:
> *"Sebelum pengujian dijalankan, apakah Anda memperbolehkan eksekusi aksi mutasi data (**CREATE / EDIT / DELETE**) secara langsung pada staging selama proses run testcase ini?"*
> *(A) **Ya, Izinkan Semua (Full Execution)**: Jalankan seluruh skenario dan aksi mutasi data secara penuh tanpa guard.*
> *(B) **Tidak, Mode Aman (Safe Mode)**: Lewati aksi mutasi data, ambil screenshot bukti awal, dan tandai skenario tersebut sebagai `PARTIAL TEST WITH REASON`.*

- **Jika User Menjawab Ya (Izinkan)**:
  Gunakan flag `--allow-mutation` (atau set `ALLOW_MUTATION=true`). Mesin mengeksekusi semua aksi manipulasi data (create, edit, update, delete, aktivasi/deaktivasi, aksi massal) secara nyata di staging tanpa guard.
- **Jika User Menjawab Tidak (Mode Aman)**:
  Jalankan default runner tanpa `--allow-mutation`. Saat mendeteksi aksi mutasi data, mesin otomatis melewati klik tombol mutasi, mengambil screenshot evidence kondisi awal (`${tc.id}_partial_mutation.png`), dan menyematkan status **`PARTIAL TEST WITH REASON`** (seperti kondisi partial passed).

### Fase 3: Eksekusi Universal & Heuristik Aksi
Jalankan pengujian menggunakan mesin agnostic `scripts/universal_executor.js`. Mesin akan menerjemahkan langkah bahasa alami secara dinamis dan sekuensial:
1. **Pencegahan / Izin Aksi Mutasi Data (Gate 4 Pre-flight Safety Gate)**:
   - Mesin secara otomatis mendeteksi kata kunci mutasi data pada langkah pengujian (`create`, `edit`, `ubah`, `update`, `tambah data`, `delete`, `hapus`, `aktifkan`, `deaktifkan`, `aksi massal`, `simpan perubahan`, `potong kuota`, `kirim broadcast`).
   - **Jika Izin Mutasi Aktif (`--allow-mutation` / `ALLOW_MUTATION=true`)**:
     * Mesin mengeksekusi aksi mutasi secara penuh tanpa guard, mencatat log `[MUTATION PERMITTED]`, dan memverifikasi hasil interaksi UI secara langsung.
   - **Jika Mode Aman Aktif (Default / Mutasi Ditolak)**:
     * Mesin **DILARANG mengeklik tombol mutasi** demi menjaga integritas data staging.
     * Mengambil screenshot evidence kondisi awal (`${tc.id}_partial_mutation.png`).
     * Menandai status test case sebagai **`PARTIAL TEST WITH REASON`** (seperti status partial passed) dengan catatan:
       `PARTIAL TEST: Aksi mutasi data ("<step>") dilewati sesuai izin mode aman user. Verifikasi create/edit/delete lanjutan perlu dilakukan manual.`
     * Melanjutkan eksekusi ke testcase berikutnya secara lancar tanpa memicu error FAILED pada scorecard.
2. **Aksi Navigasi (`Akses menu X > Y`) - Prioritas Utama**:
   - Dieksekusi paling awal dalam skenario sehingga browser dipastikan telah berpindah ke halaman target sebelum langkah input/interaksi form dimulai.
   - Dilengkapi direct URL fallback (misal `/customers`) jika dropdown sidebar tertutup.
3. **Aksi Checkbox / Checklist (`Tekan box checklist ...` / `Centang checkbox ...`)**:
   - Menemukan checkbox pada baris data tabel atau header, dan melakukan klik toggle secara aman.
4. **Aksi Input Form (`Pada field X, masukkan Y`)**:
   - Menemukan elemen input berdasarkan label, placeholder, name, ID, atau aria-label.
   - **Type Guard**: Fallback selector secara ketat mengecualikan `<input type="number">`, checkbox, radio, dan hidden input agar tidak terjadi error salah sasaran pada field pagination/angka.
5. **Aksi Dropdown Popover (`Klik dropdown X dan pilih opsi Y`)**:
   * Membuka combobox/dropdown trigger.
   * **Fast Dropdown Fallback**: Mencari opsi dengan batas toleransi 3–4 detik.
   * Jika opsi TIDAK ADA: Jangan freeze/hang! Ambil screenshot popover yang terbuka seketika sebagai bukti defek, tekan tombol `Escape`, dan catat status `FAILED (DEFECT: Opsi Y tidak ditemukan pada dropdown X)`.
6. **Aksi Klik Tombol (`Klik tombol X`)**:
   - Mencari tombol aksi berdasarkan teks, role button, link, atau form submit dan mengekliknya secara presisi.
7. **Pemisahan Assertion Backend (Gate 5)**:
   - Jika ekspektasi memuat kata kunci database/webhook/API backend, selesaikan assertion UI lalu sematkan flag `PARTIAL TEST WITH REASON`.

### Fase 4: Eksekusi 5 Skenario Exploratory Mandatori
Di akhir setiap test suite, Senior QA **WAJIB** mengeksekusi 5 skenario exploratory berikut untuk menguji stabilitas aplikasi:

1. ⚡ **Charter 1: The Impatient User (Rapid Double Click CTA)**:
   Klik cepat 2–3 kali berturut-turut pada tombol submit/action utama. Pastikan tombol otomatis *disabled* dan tidak terjadi *duplicate submission* / *double charge*.
2. 🔤 **Charter 2: The Boundary & Extreme Input Tester**:
   Input string panjang (256 karakter), karakter khusus (`<script>`, SQL quotes `' OR 1=1`), dan emoji multi-byte pada field text. Pastikan UI tidak rusak (*no layout overflow*) dan validasi sanitasi berfungsi.
3. 🔄 **Charter 3: The Refresh & State Retention Tour**:
   Reload halaman (Cmd+R) saat sedang membuka drawer/modal atau form terisi sebagian. Pastikan aplikasi kembali ke state aman tanpa error *React hydration / white screen*.
4. 🚪 **Charter 4: The Backdrop & Modal Escape Tour**:
   Buka modal/drawer/popover, tekan tombol keyboard `Escape` dan klik area luar backdrop. Pastikan modal tertutup bersih tanpa memicu submit yang tidak disengaja.
5. 📑 **Charter 5: The Reset Filter & Pagination Consistency**:
   Clear seluruh filter pencarian dan pastikan tabel me-reset daftar data default secara utuh dan konsisten.

### Fase 5: Penyusunan Laporan Word (DOCX)
1. Ekspor seluruh ringkasan uji, metrik pass/fail, catatan defek, dan daftar bukti screenshot ke format JSON.
2. Jalankan konverter laporan:
   ```bash
   python3 .agents/skills/browser-qa-execution/scripts/generate_docx_report.py <data.json> ./automate-result/Report_<FeatureName>_<Timestamp>.docx
   ```
3. Laporan Word berstandar TIW korporat memuat:
   - Metadata Box lengkap.
   - Executive Summary Scorecard.
   - Tabel Hasil Pengujian per Role.
   - Tabel 5 Skenario Exploratory.
   - Index Direktori Bukti Screenshot (path folder run).
   - Release Verdict ([GO] / [CONDITIONAL GO] / [NO-GO]).

### Fase 6: Post-Flight Cleanup & Auto-Close Browser (Mandatory Lifecycle)
Setiap kali pengujian selesai dieksekusi (baik pengujian sukses, conditional go, maupun terjadi penghentian):
1. Mesin otomatis mengeksekusi blok `finally`.
2. Menutup koneksi Playwright client.
3. Mengirimkan sinyal WebSocket CDP native `{ id: 1, method: "Browser.close" }` ke `webSocketDebuggerUrl`.
4. Memastikan browser Google Chrome tertutup secara bersih dan port 9222 kembali bebas (*idle*).

---

## 4. Format Laporan DOCX Berstandar TIW Korporat

Laporan hasil pengujian dibuat dalam format Microsoft Word (`.docx`) dengan prinsip:
- **Clean & Lightweight**: Tidak membenamkan puluhan gambar screenshot ke dalam file agar ukuran file tetap kecil (<50 KB), tidak membuat lemot pembaca dokumen, dan mudah dikirim melalui email/Slack.
- **Auditable Evidence Index**: Semua screenshot disimpan terorganisir di subfolder `./automate-result/run_<FeatureName>_<Timestamp>/` dan diindeks dalam tabel referensi pada laporan Word.
- **Strong Technical Metrics**: Menampilkan metrik kelulusan, rincian per role, catatan teknis, dan alasan conditional go/no-go secara lugas.

---

## 5. Pedoman Komunikasi Senior QA

1. **Jujur dan Objektif**:
   Jangan pernah melaporkan status `PASSED` jika baru memvalidasi tampilan UI sementara backend belum terverifikasi; gunakan `PARTIAL TEST WITH REASON`.
2. **Proaktif Menjaga Keamanan Data**:
   Selalu ingatkan user jika ada tombol yang berpotensi menghapus atau mengubah data penting di staging.
3. **Penyajian Ringkas & Terarah**:
   Setelah pengujian selesai, sampaikan ringkasan eksekutif (Pass Rate, Verdict, Path Laporan Word, dan Path Folder Screenshot) kepada user dengan format GitHub markdown yang rapi.
