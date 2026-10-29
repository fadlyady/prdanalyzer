---
name: browser-qa-execution
description: >-
  Standard operating procedure for a Senior QA Engineer to execute feature testing directly on Google Chrome browser in a staging environment.
  Enforces automatic browser lifecycle management (multi-path auto-discovery across Mac/Windows/Linux, auto-launches Chrome QA on port 9222 with --start-maximized, and automatically closes Chrome upon test completion),
  enforces a strict Markdown (.md) testcase file mandate (with mandatory user confirmation/conversion gate if .md is not found or in .xlsx),
  integrates supplementary test data from browser-execution/automate-support/ with mandatory scenario-data mapping gates,
  applies Target URL & Browser State Resolution Gate (if browser is open: verifies active tab title & URL before running to prevent tab hijacking; if browser is closed: asks for target URL variable from .env or auto-discovers it, asks for target user variable, and launches Chrome directly to target URL),
  verifies credentials against .env with 3-tier checks (multi-credential disambiguation gate for duplicate role prefixes, missing credential alert instructing user to update .env, and active session mismatch gate to switch user vs stay on current role), applies 100% domain-agnostic universal step execution,
  mandates pre-flight confirmation asking user whether CREATE/EDIT/DELETE mutation actions are permitted (if yes, runs all actions without guard; if no, executes in safe mode flagging mutation steps as PARTIAL TEST WITH REASON), handles multi-role RBAC execution,
  applies transparent status flagging (PASSED, FAILED, SKIP WITH REASON, PARTIAL TEST WITH REASON for backend/DB steps and safe-mode skipped mutations),
  executes 5 mandatory exploratory testing charters, archives screenshots into timestamped run directories,
  and compiles executive corporate Word (.docx) audit reports without embedded images into browser-execution/automate-result/.
  Activate when the user asks to run browser testing, execute test cases live in staging browser, or perform automated QA verification.
---

# Senior QA Browser Execution Skill (`browser-qa-execution`)

Skill ini mendefinisikan Standar Operasional Prosedur (SOP) bagi seorang **Senior QA Engineer** dalam menjalankan pengujian fitur secara langsung pada **browser Google Chrome (Staging Environment)** yang terhubung via Chrome DevTools Protocol (CDP port 9222).

Skill ini dilengkapi **Manajemen Siklus Hidup Browser Otomatis (Browser Lifecycle Management)**:
1. **Pre-flight Auto-Launch**: Memeriksa apakah browser Chrome sudah dibuka pada port 9222; jika belum, mesin mendeteksi path executable Chrome secara lintas-platform (Mac, Windows, Linux) dan membuka Google Chrome QA profile secara otomatis dengan flag `--start-maximized`.
2. **Post-flight Auto-Close**: Setiap kali pengujian selesai dieksekusi (baik sukses maupun terdapat defek), mesin akan menutup browser secara otomatis dan bersih menggunakan perintah native CDP `Browser.close`.

Skill ini dirancang bersifat **100% Universal, Domain-Agnostic, & Cross-Device Portable** (dapat digunakan untuk Web E-Commerce, CRM, Portal Admin, ERP, SaaS, maupun Internal Tools di berbagai sistem operasi), dengan penegakan aturan **STRICT** yang wajib dipatuhi.

---

## 1. Lokasi Berkas & Arsitektur Direktori (*File Architecture*)

- **Sumber Test Case (Wajib Berformat `.md`)**:
  `./doc-analyzer/result-testcase/` (atau direktori kustom yang diberikan oleh user, dengan fallback ke `./result-testcase/`).
  - 🛑 **STRICT MANDATE**: File test case **WAJIB** berformat Markdown (`.md`).
  - Jika berkas yang tersedia berformat Excel (`.xlsx`) atau format non-MD lainnya, **WAJIB melalui Gerbang Konversi/Konfirmasi** sebelum dapat dieksekusi.
- **Penyimpanan Data Pendukung Uji (*Supplementary Test Data*)**:
  `./browser-execution/automate-support/` (dengan fallback ke `./automate-support/`).
  - Menyimpan berkas data pengujian beragam: data katalog produk, daftar kontak CSV upload, template caption, file DOCX/PDF sampel, payload JSON.
- **UI & Navigation Knowledge (Parallel 3-Tier Grounding)**:
  - `./doc-analyzer/strukturmenu/live-analyzer/<app-slug>/<timestamp>/` (hasil live inspection run terbaru berbasis app/host).
  - `./doc-analyzer/strukturmenu/<app-name>/` (tangkapan layar manual offline).
  - Digunakan sebagai referensi letak tombol, selector, atau navigasi menu jika skenario memerlukan klarifikasi visual.
- **Konfigurasi Environment & Kredensial Role**:
  `./.env` (memuat variabel target URL seperti `BASE_URL`, `STAGING_URL`, atau `E2E_BASE_URL_STAGING`, serta kredensial `USER_<ROLE>_<NAME>`, `PASS_<ROLE>_<NAME>`).
- **Mesin Eksekusi & Guard (Dual Engine)**:
  - **Primary Engine (Hard Guardrail via MCP)**: `browser-qa-guard` MCP Server (`mcp-server-browser-qa/src/index.js`)
    * `qa_check_browser_state`: Memeriksa port CDP 9222 & mendaftar tab terbuka (Gate 2).
    * `qa_init_browser`: Peluncuran Chrome & penegakan Domain Allowlist (Gate 2).
    * `qa_list_available_roles`: Deteksi role dari `.env` dengan password ter-masking (Gate 3).
    * `qa_set_mutation_permission`: Mengaktifkan/menonaktifkan Safe Mode mutasi (Gate 4).
    * `qa_login_role`: Injeksi form login DOM langsung tanpa membocorkan password ke prompt AI (Gate 3).
    * `qa_execute_action`: Eksekusi aksi klik/ketik dengan interceptor mutasi otomatis (Gate 4).
    * `qa_assert_element`: Verifikasi UI state visible/contains_text/url_contains (Gate 5).
    * `qa_capture_evidence`: Pengambilan screenshot otomatis berformat terstandar (Gate 5).
    * `qa_reset_session`: Pembersihan cookies & web storage antar role (Gate 6).
    * `qa_close_browser`: Penutupan browser Chrome secara bersih (Post-flight).
  - **Fallback Engine (Local CLI Scripts)**:
    * Universal Agnostic Executor: `./.agents/skills/browser-qa-execution/scripts/universal_executor.js`
    * Test Runner Bridge & Chrome Auto-Discovery: `./.agents/skills/browser-qa-execution/scripts/test_runner_bridge.js`
    * Test Case Parser: `./.agents/skills/browser-qa-execution/scripts/parse_testcase.py`
    * Excel to Markdown Converter: `./.agents/skills/browser-qa-execution/scripts/convert_to_md_testcase.py`
    * Generator Laporan Word DOCX: `./.agents/skills/browser-qa-execution/scripts/generate_docx_report.py`
- **Target Output Hasil Uji**:
  - **Laporan Dokumen Word (Executive DOCX)**:
    `./browser-execution/automate-result/Report_<FeatureName>_<YYYYMMDD_HHMMSS>.docx`
    *(Tanpa embedded screenshot agar ringan, profesional, dan mudah dibaca stakeholder).*
  - **Arsip Screenshot Evidence (Folder per Run)**:
    `./browser-execution/automate-result/run_<FeatureName>_<YYYYMMDD_HHMMSS>/`
    *(Setiap screenshot diberi nama unik: `<TC_ID>_<step>_<status>.png`).*

---

## 2. 6 Gerbang Kualitas Mandatori (*Mandatory QA Gates - STRICT*)

Sebelum dan selama menjalankan pengujian, Senior QA **WAJIB** mematuhi 6 gerbang validasi berikut tanpa kompromi:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   6 MANDATORY QA VALIDATION GATES                      │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 1: UNIVERSAL TEST CASE CONTRACT GUARD (.MD & .XLSX)               │
│ - Mendukung format Markdown (.md) dan Excel (.xlsx) secara transparan. │
│ - MANDATORY TEST CASE SCHEMA CONTRACT: Setiap skenario WAJIB memuat:   │
│   * id: ID Pengujian unik non-kosong (misal: TC-001).                  │
│   * title / scenario: Deskripsi tujuan skenario non-kosong.            │
│   * steps / langkah: Minimal memiliki 1 baris aksi (klik/input/pilih). │
│     JIKA LANGKAH KOSONG: Baris otomatis ditolak (REJECTED).            │
│   * expected: Ekspektasi hasil non-kosong untuk verifikasi assertion.  │
│   * role / actor: Aktor penguji (opsional; jika kosong memicu Gate 3). │
│   * target_url / path: URL spesifik skenario (opsional; memicu Gate 2).│
│ - PRE-FLIGHT LINTING: Jika ditemukan baris cacat, runner menampilkan   │
│   rekap dan alasan kecacatan, serta memberi opsi lanjut skenario valid │
│   atau perbaiki file terlebih dahulu.                                  │
│ - Supplementary Data: Jika skenario menyebutkan data uji tambahan      │
│   (upload file/mock payload), periksa ./browser-execution/             │
│   automate-support/ dan pastikan pemetaan file ke skenario ke user.    │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 2: TARGET URL, BROWSER STATE & DYNAMIC URL RESOLUTION GATE        │
│ - DYNAMIC PER-TESTCASE URL: Jika skenario mendefinisikan URL/path      │
│   spesifik (misal /settings atau URL modul berbeda), runner secara     │
│   otomatis bernavigasi ke halaman tersebut setelah memvalidasi domain  │
│   allowlist staging untuk mencegah pembajakan/kebocoran ke produksi.   │
│ - Kondisi A: BROWSER SUDAH DIBUKA (Port 9222 aktif):                   │
│   * Mesin membaca seluruh tab terbuka via CDP (GET /json).             │
│   * Tampilkan tab aktif saat ini: [Judul Tab] ([URL Tab]).             │
│   * WAJIB BERTANYA KE USER:                                            │
│     "Browser Google Chrome aktif terdeteksi dengan tab saat ini:       │
│      '[Judul Halaman]' ([URL]).                                        │
│      Apakah tab ini yang ingin digunakan untuk pengujian?              │
│      (A) Gunakan tab aktif saat ini.                                   │
│      (B) Buka tab baru dengan URL target pengujian.                    │
│      (C) Pilih dari daftar tab lain yang terbuka."                     │
│   * TAB CLEANUP: Tutup tab-tab sisa pengujian sebelumnya agar memori   │
│     ringan dan hanya menyisakan 1 tab kerja aktif.                     │
│ - Kondisi B: BROWSER BELUM DIBUKA:                                     │
│   * Langkah 1 (Resolusi Variabel URL):                                 │
│     Agent WAJIB bertanya variabel URL mana yang digunakan dari .env    │
│     (misal BASE_URL, STAGING_URL, APP_URL). Scan .env dan sajikan      │
│     kandidat jika ada. Jika belum ada di .env, minta user melengkapi.  │
│   * Langkah 2 (Resolusi Variabel Kredensial User):                     │
│     Agent bertanya variabel kredensial apa yang digunakan untuk role   │
│     skenario (cek USER_<ROLE>_<NAME> di .env, minta update jika tiada).│
│   * Langkah 3 (Peluncuran Chrome Agnostik):                            │
│     Auto-discovery Chrome binary (Mac/Windows/Linux), luncurkan dengan │
│     --start-maximized dan arahkan langsung ke target URL.              │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 3: SMART CREDENTIAL RESOLVER, BILINGUAL SYNONYM & ACTOR GATE      │
│ - BILINGUAL SYNONYM MAPPING: Mesin memetakan sinonim secara cerdas:    │
│   * Pemilik / Owner / Bos -> USER_OWNER_* / USER_PEMILIK_*             │
│   * Anggota / Member / User / Pelanggan -> USER_MEMBER_* / USER_ANGGOTA│
│   * CS / Agent / Staff / Operator -> USER_CS_* / USER_AGENT_*          │
│   * Admin / Superadmin -> USER_ADMIN_*                                 │
│ - 3 PERCABANGAN RESOLUSI KREDENSIAL:                                   │
│   1. KASUS 1 (Actor Cocok di .env): Jika tunggal langsung auto-select; │
│      jika >1 user ber-prefix sama, WAJIB bertanya akun mana dipilih.   │
│   2. KASUS 2 (Actor Disebut tapi TIDAK ADA di .env): Berhenti dan beri │
│      alert ke user: (A) Lengkapi .env (USER_<ROLE>_<NAME>), atau       │
│      (B) Pilih dari role kredensial yang sudah tersedia di .env.       │
│   3. KASUS 3 (Actor KOSONG di Test Case): DILARANG mengasumsikan role  │
│      sepihak! Mesin WAJIB berhenti dan meminta user memilih role login │
│      dari daftar kredensial yang tersedia di .env.                     │
│ - Active Session Mismatch Gate: Jika browser sudah login tetapi role    │
│   aktif BERBEDA: Tanya opsi penanganan (Logout & Re-login vs Lanjut).  │
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
│ - SKIP WITH REASON: Skenario dilewati (misal kredensial belum ada).    │
│ - PARTIAL TEST WITH REASON: Melibatkan API/DB atau mutasi mode aman.   │
├────────────────────────────────────────────────────────────────────────┤
│ GATE 6: RBAC ROLE BATCHING & CLEAN SESSION RESET GATE                  │
│ - ROLE BATCHING PROTOCOL: Kelompokkan skenario per role; login hanya   │
│   1x per batch role (tidak logout-login berulang di tiap baris).       │
│ - CLEAN SESSION RESET: Saat berganti ke role batch lain, jalankan      │
│   clearCookies & storage reset agar tidak terjadi RBAC contamination.  │
│ - Laporan hasil pengujian terkelompok rapi per user/role pada docx.    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Alur Kerja Eksekusi Lengkap (*Execution Workflow Phases*)

### Fase 1: Validasi Input, Format, & Resolusi File (Gate 1)
1. **Pemeriksaan Keberadaan File `.md`**:
   Cari file test case di `./doc-analyzer/result-testcase/` (dengan fallback ke `./result-testcase/`) atau path yang diberikan user.
   * *Kasus 1: Ditemukan file `.xlsx` tetapi tidak ada `.md`*:
     Panggil gerbang konfirmasi:
     > *"Format file saat ini adalah Excel (.xlsx). Sesuai SOP, pengujian wajib menggunakan format Markdown (.md). Apakah Anda ingin saya bantu konversi ke format `.md` standar sekarang?"*
     Jika disetujui, jalankan `python3 convert_to_md_testcase.py <file.xlsx>`.
   * *Kasus 2: Ditemukan lebih dari 1 file `.md`*:
     Tanyakan kepada user file `.md` mana yang ingin dieksekusi.
2. **Pemeriksaan Test Data di `browser-execution/automate-support/`**:
   Jika langkah uji membutuhkan data eksternal (misal: *"upload data produk"*, *"isi form dengan data pelanggan baru"*):
   * Periksa isi `./browser-execution/automate-support/` (atau `./automate-support/`).
   * Jika nama file belum jelas atau terdapat banyak file, ajukan pertanyaan konfirmasi pemetaan file data ke skenario.

### Fase 2: Resolusi Target URL & State Browser (Gate 2 - Zero-Wrong-Tab Policy)

Sebelum runner Playwright mengeksekusi langkah pengujian, Senior QA wajib menyelaraskan lingkungan browser:

1. **Kasus 1: Browser Google Chrome SUDAH Dibuka (Port 9222 Aktif)**:
   - Mesin memindai seluruh tab terbuka melalui endpoint CDP `http://localhost:9222/json`.
   - Mengidentifikasi judul halaman dan URL dari tab aktif saat ini.
   - **WAJIB BERTANYA KEPADA USER**:
     > *"Browser Google Chrome aktif terdeteksi dengan tab saat ini: **[Judul Halaman]** (`[URL]`).*
     > *Apakah tab ini yang ingin digunakan untuk pengujian?*
     > *(A) Ya, gunakan tab aktif saat ini.*
     > *(B) Buka tab baru dengan URL target pengujian.*
     > *(C) Pilih dari daftar tab lain yang sedang terbuka."*
   - Hanya gunakan tab yang telah disetujui eksplisit oleh user untuk mencegah pembajakan tab kerja lain.

2. **Kasus 2: Browser Google Chrome BELUM Dibuka**:
   - **Langkah 1 (Resolusi Variabel URL)**:
     - Mesin memindai file `.env` mencari kandidat variabel URL (`URL`, `HOST`, `DOMAIN`, `BASE_URL`, `STAGING_URL`, `APP_URL`).
     - Jika ditemukan kandidat:
       > *"Ditemukan variabel URL pada file `.env`:*
       > *1. `[KEY_1]` = `[VALUE_1]`*
       > *2. `[KEY_2]` = `[VALUE_2]`*
       > *Variabel mana yang ingin digunakan sebagai target URL pengujian ini?"*
     - Jika file `.env` belum memuat URL atau belum ada `.env`:
       > *"⚠️ **Target URL Belum Ditentukan**: Mohon masukkan nama variabel dan URL target staging aplikasi Anda untuk disimpan ke `.env` (contoh: `BASE_URL=https://staging.myapp.com`)."*
   - **Langkah 2 (Resolusi Variabel Kredensial User)**:
     - Tanyakan variabel kredensial apa di `.env` yang digunakan untuk role pengujian yang disyaratkan skenario.
   - **Langkah 3 (Peluncuran Chrome Lintas-Platform)**:
     - Mesin mencari binary Google Chrome menggunakan mekanisme *Multi-Path Auto-Discovery* (mendukung macOS, Windows Program Files / LocalAppData, dan Linux).
     - Membuka Chrome secara otomatis dengan port remote debugging 9222, profile dedicated, `--start-maximized`, dan mengarahkan langsung ke target URL.

### Fase 2b: Validasi Kredensial & Sesi Pengguna (Gate 3 - Zero-Ambiguity Policy)

Senior QA wajib menjalankan validasi 3 tingkat (*3-Tier Credential & Session Check*) terhadap kredensial pengujian guna mengeliminasi potensi kesalahan akun:

1. **Pemetaan Role Skenario terhadap `.env`**:
   - Ekstrak role yang disyaratkan oleh test case (misal: `Owner`, `Admin`, `CS`, `Agent`, `Finance`).
   - Cari kredensial relevan di file `./.env` dengan format `USER_<ROLE>_<IDENTIFIER>` dan `PASS_<ROLE>_<IDENTIFIER>`.

2. **Aturan 1: Multi-Credential Disambiguation Gate (Wajib Bertanya)**:
   - Jika pada file `.env` ditemukan **lebih dari 1 kredensial** dengan prefix serupa (contoh: terdapat `USER_OWNER_CHATREBORN` dan `USER_OWNER_EVERPRO`):
   - **WAJIB BERHENTI & BERTANYA KEPADA USER**:
     > *"Pada file `.env` ditemukan lebih dari 1 kredensial untuk role **[ROLE]**:*
     > *1. `[KEY_1]` ([username_1])*
     > *2. `[KEY_2]` ([username_2])*
     > *Mohon konfirmasi, akun/kredensial mana yang akan digunakan untuk menjalankan skenario ini?"*

3. **Aturan 2: Missing Credential Gate (Info & Panduan Update `.env`)**:
   - Jika kredensial untuk role tertentu **TIDAK DITEMUKAN** di `.env`:
   - **WAJIB MEMBERI TAHU USER** untuk memperbarui file `.env` terlebih dahulu atau menanyakan apakah skenario tersebut ingin dilewati (`SKIP WITH REASON`).

4. **Aturan 3: Active Session Mismatch Gate (Deteksi Perbedaan Role Aktif)**:
   - Jika browser **sudah dalam kondisi login**, namun user/role yang aktif **BERBEDA** dengan role skenario test case:
   - **WAJIB BERTANYA KEPADA USER**:
     > *"Browser saat ini sedang login dengan akun **[Role_Aktif]**, sedangkan skenario pengujian mensyaratkan role **[Role_Skenario]**.*
     > *Pilihan tindakan:*
     > *(A) Logout dan login ulang menggunakan kredensial `[Role_Skenario]` dari `.env`.*
     > *(B) Tetap melanjutkan pengujian menggunakan akun `[Role_Aktif]` yang saat ini sedang aktif."*

### Fase 2c: Pre-Flight Action Permission Gate (Izin Mutasi CREATE / EDIT / DELETE - Gate 4)
SEBELUM runner pengujian dieksekusi, Senior QA / Agent **WAJIB BERTANYA KEPADA USER**:
> *"Sebelum pengujian dijalankan, apakah Anda memperbolehkan eksekusi aksi mutasi data (**CREATE / EDIT / DELETE**) secara langsung pada staging selama proses run testcase ini?"*
> *(A) **Ya, Izinkan Semua (Full Execution)**: Jalankan seluruh skenario dan aksi mutasi data secara penuh tanpa guard.*
> *(B) **Tidak, Mode Aman (Safe Mode)**: Lewati aksi mutasi data, ambil screenshot bukti awal, dan tandai skenario tersebut sebagai `PARTIAL TEST WITH REASON`.*

- **Jika User Menjawab Ya (Izinkan)**:
  Gunakan flag `--allow-mutation` (atau set `ALLOW_MUTATION=true`). Mesin mengeksekusi semua aksi manipulasi data secara nyata di staging tanpa guard.
- **Jika User Menjawab Tidak (Mode Aman)**:
  Jalankan default runner tanpa `--allow-mutation`. Saat mendeteksi aksi mutasi data, mesin otomatis melewati klik tombol mutasi, mengambil screenshot evidence kondisi awal (`${tc.id}_partial_mutation.png`), dan menyematkan status **`PARTIAL TEST WITH REASON`** (seperti kondisi partial passed).

### Fase 3: Eksekusi Universal & Heuristik Aksi Agnostik
Jalankan pengujian menggunakan mesin agnostic `scripts/universal_executor.js`. Mesin akan menerjemahkan langkah bahasa alami secara dinamis dan sekuensial:
0. **Role Batching & Clean Session Reset (Anti-RBAC Contamination Gate)**:
   - Runner mengelompokkan skenario uji secara otomatis per Role (`Owner`, `CS`, `Admin`, dsb).
   - Login hanya dieksekusi **satu kali per batch role**, mencegah overhead login berulang-ulang di tiap baris.
   - Saat berpindah ke batch role baru, runner mengeksekusi reset sesi bersih (`clearCookies` dan clear storage) agar tidak terjadi kontaminasi hak akses antar role.
1. **Pencegahan / Izin Aksi Mutasi Data (Gate 4 Pre-flight Safety Gate)**:
   - Mesin secara otomatis mendeteksi kata kunci mutasi data pada langkah pengujian (`create`, `edit`, `ubah`, `update`, `tambah data`, `delete`, `hapus`, `aktifkan`, `deaktifkan`, `aksi massal`, `simpan perubahan`, `potong kuota`, `kirim broadcast`).
   - Mode Aman: Melewati mutasi data, ambil screenshot kondisi awal, tandai `PARTIAL TEST WITH REASON`.
   - Izin Mutasi: Menjalankan aksi nyata tanpa guard.
2. **Aksi Navigasi (`Akses menu X > Y` / `Buka halaman /path`) - 100% Agnostik**:
   - Jika teks navigasi memuat relative URL (`/path`) atau absolute URL (`https://...`), lakukan navigasi URL langsung.
   - Jika teks navigasi memuat hierarki menu bahasa alami (misal: `DATA > Pelanggan > Daftar pelanggan`), mesin memecah hierarki dan mengeklik elemen menu bertingkat secara dinamis tanpa mengasumsikan nama modul tertentu.
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
   python3 .agents/skills/browser-qa-execution/scripts/generate_docx_report.py <data.json> ./browser-execution/automate-result/Report_<FeatureName>_<Timestamp>.docx
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
- **Auditable Evidence Index**: Semua screenshot disimpan terorganisir di subfolder `./browser-execution/automate-result/run_<FeatureName>_<Timestamp>/` dan diindeks dalam tabel referensi pada laporan Word.
- **Strong Technical Metrics**: Menampilkan metrik kelulusan, rincian per role, catatan teknis, dan alasan conditional go/no-go secara lugas.

---

## 5. Pedoman Komunikasi Senior QA

1. **Jujur dan Objektif**:
   Jangan pernah melaporkan status `PASSED` jika baru memvalidasi tampilan UI sementara backend belum terverifikasi; gunakan `PARTIAL TEST WITH REASON`.
2. **Proaktif Menjaga Keamanan Data**:
   Selalu ingatkan user jika ada tombol yang berpotensi menghapus atau mengubah data penting di staging.
3. **Penyajian Ringkas & Terarah**:
   Setelah pengujian selesai, sampaikan ringkasan eksekutif (Pass Rate, Verdict, Path Laporan Word, dan Path Folder Screenshot) kepada user dengan format GitHub markdown yang rapi.
