---
name: mobile-qa-execution
description: >-
  Standard operating procedure for a Senior QA Engineer to execute feature test cases on a real Android device (USB) against the STAGING mobile app,
  using the mobile-qa-guard MCP server (Appium UiAutomator2). Mirrors browser-qa-execution for mobile: strict Markdown test case contract with a mobile parser
  (Expected Results split into [UI]/[Network]/[DB] layers, platform filter Android/iOS), Device & Build Gate (device selection, staging package allowlist,
  install/upgrade decision, never downgrade), zero-leak credential login from .env with pre-login consent handling, active session mismatch gate,
  tiered Mutation Policy (QA_MUTATION_MODE safe | full | full_external; TAG-only update/delete, financial blocked, external sends only to allowlisted recipients, Safe Mode -> PARTIAL TEST WITH REASON) with a hard rule that mutations never use raw coordinate/vision taps (anchored coordinates relative to an ID/label element are allowed in full mode with before/after evidence), a mutation ledger with TAG teardown, optional opt-in DB validation,
  precondition readiness gate for manually prepared data, layered locators (resource-id > label > fuzzy > coordinate) with PASSED (LOW CONFIDENCE) flagging,
  RBAC role batching with clean pm-clear reset, 5 mandatory mobile exploratory charters (double tap, background/kill-relaunch, rotation/font/dark mode,
  offline, interruption/back), evidence (screenshots, logcat, screen recording) in timestamped run folders, and a Word (.docx) audit report.
  Activate when the user asks to run mobile/Android/iOS app testing, execute test cases on a phone or emulator, or perform QA on the mobile app.
---

# Senior QA Mobile Execution Skill (`mobile-qa-execution`)

> [!IMPORTANT]
> **Kepatuhan Pondasi (wajib dibaca sebelum menjalankan skill ini):** `.agents/shared/FOUNDATION.md` adalah acuan tertinggi; bila ada aturan di bawah yang bertentangan, Pondasi yang berlaku.
> - **Profil aktif:** jalankan `python3 scripts/qa_feature.py where` untuk mengetahui alias `<ALIAS>`; artefak fitur ada di `work/<ALIAS>/<fitur>/` (buat dengan `python3 scripts/qa_feature.py init <fitur>` bila belum ada). Bila fitur sudah punya `00-scope.md`, alias di file itu yang dipakai.
> - **Kerahasiaan:** nilai asli (URL, package, akun, DSN) hanya dibaca server/runner dari `.secrets/<ALIAS>.env`; AI tidak membuka file itu dan tidak menulis nama aplikasi, host, package, atau akun asli di artefak — pakai alias (`<ALIAS>`, `{{role:owner}}`, `db:main`).
> - **Status, scope & verdict:** `.agents/shared/standards/status-verdict-evidence.md` — tambahan `BLOCKED` dan `NOT IN SCOPE`, `failure_category` (product/script/environment/data) wajib untuk FAILED, pernyataan scope wajib.
> - **Evidence & plan:** plan disimpan di `work/<ALIAS>/<fitur>/plans/`; run & laporan otomatis ke `runs/` dan `reports/` fitur itu. Knowledge UI di `profiles/<ALIAS>/knowledge/mobile/`.
> - **Reviewer & verdict (D7):** user yang menjalankan workflow; laporan tanpa review berlabel `DRAFT` Verdict dihitung modul tunggal `scripts/lib/verdict.cjs`; review lewat `python3 scripts/qa_review.py <folder-run> --init` lalu tanpa `--init`.


SOP **Senior QA Engineer** untuk mengeksekusi test case pada **aplikasi mobile staging di HP Android fisik (USB)** melalui MCP server **`mobile-qa-guard`** (Appium UiAutomator2). Pasangan dari skill `browser-qa-execution`.

- **Fase 1: Android** (real device USB). **Fase 2: iOS** (gate & kontrak sudah siap; TC khusus iOS → `SKIP WITH REASON` di fase 1).
- **Agnostik framework** (Native / Compose / React Native / Flutter): framework dideteksi dari APK; locator berlapis + label efektif (label node anak, pola Flutter).
- Aplikasi mobile **bukan web**: tidak ada URL/tab. Navigasi = tap elemen, tombol back, home anchor. Deep link hanya dipakai jika route **sudah dikonfirmasi dev** dan ditulis eksplisit di TC.

---

## 1. Lokasi Berkas & Arsitektur

| Komponen | Lokasi |
|---|---|
| Test case (wajib `.md`) | `work/<ALIAS>/<fitur>/` (atau path dari user). `.xlsx` → konversi dulu: `python3 .agents/skills/browser-qa-execution/scripts/convert_to_md_testcase.py <file.xlsx>` |
| Parser TC mobile (Gate 1) | `python3 .agents/skills/mobile-qa-execution/scripts/parse_mobile_testcase.py <file.md> --platform android` |
| Build APK staging | `./mobile-execution/build-apk/*.apk` |
| Data uji pendukung | `./mobile-execution/automate-support/` (dikirim ke HP via `qa_push_support_file`) |
| **UI Knowledge per app (SSOT selector)** | `profiles/<ALIAS>/knowledge/mobile/<package>/ui-knowledge.md` (+ `.json`, `seed.json` kurasi). Komponen OS (Files picker, Kamera) di `knowledge/_system/<package>/`. |
| Hasil probe mentah | `profiles/<ALIAS>/knowledge/mobile/live-analyzer/<package>/<timestamp>/` (`app_structure.md`, `locator_map.json`) |
| Pembaru knowledge | `python3 .agents/skills/mobile-qa-execution/scripts/update_ui_knowledge.py --run <folder run> --package <package>` (otomatis dipanggil runner & probe) |
| Setup & probe | `./mobile-execution/probe/` (`install_mac.sh`, `setup_check.sh`, `probe.mjs`, README) |
| Konfigurasi | `.secrets/<ALIAS>.env` (profil aktif dari `.secrets/<ALIAS>.env` → `QA_ACTIVE_PROFILE`): `MOBILE_APP_PACKAGE_STAGING`, `MOBILE_APP_PACKAGE_ALLOWLIST` (opsional), `MOBILE_APP_ACTIVITY` (opsional), `ANDROID_DEVICE_SERIAL` (opsional), `APPIUM_URL` (opsional), kredensial `USER_<ROLE>_<n>` / `PASS_<ROLE>_<n>` |
| Engine (hard guard) | MCP `mobile-qa-guard` → `mcp-server-mobile-qa/src/index.js` |
| Evidence per run | `work/<ALIAS>/<fitur>/runs/run_<fitur>_<YYYYMMDD_HHMMSS>/` (PNG, `*_logcat.txt`, `*_recording.mp4`, `actions.jsonl`, `run_meta.json`, `guard_events.json`) |
| Laporan Word | `./`work/<ALIAS>/<fitur>/reports/Report_<fitur>_<YYYYMMDD_HHMMSS>.docx` via `python3 .agents/skills/browser-qa-execution/scripts/generate_docx_report.py <data.json> <out.docx>` |

### Tool MCP `mobile-qa-guard`
| Tool | Gate | Fungsi |
|---|---|---|
| `qa_check_device_state` | 2 | Device adb, Appium, APK, versi terpasang, varian production di HP |
| `qa_init_app` | 2 | Build Guard + keputusan install + grant izin + Appium + launch + folder run. Bisa mengembalikan `NEEDS_DECISION` |
| `qa_list_available_roles` | 3 | Role di `.secrets/<ALIAS>.env` (username ter-masking, tanpa password) |
| `qa_login_role` | 3 | Lewati layar izin pelacakan/onboarding, login. Password diketik server, tidak pernah ke AI |
| `qa_set_mutation_permission` | 4 | Mode mutasi `safe` / `full` / `full_external` + `dataTag` (tanpa argumen = baca policy aktif) |
| `qa_get_mutation_ledger` | 5 | Ringkasan mutasi dijalankan/diblokir per kategori, data dibuat, `mutation_ledger.jsonl`, petunjuk teardown |
| `qa_inspect_screen` | – | Elemen interaktif (`ref`, `id`, `label`, `position`), teks, toast, Testability Score |
| `qa_execute_action` | 4/5 | tap, long_press, double_tap, type, clear, scroll, swipe, back, hide_keyboard, wait. Mengembalikan `tier` & `confidence` |
| `qa_assert_element` | 5 | visible, not_visible, contains_text, screen_title, enabled, disabled, count_at_least, toast_contains |
| `qa_capture_evidence` | 5 | Screenshot `<TC>_<step>_<status>.png`; logcat otomatis untuk FAILED |
| `qa_screen_recording` | 5 | Rekam layar per TC (mp4) |
| `qa_device_control` | Charter | rotate, background, kill_relaunch, network_off/on, font_scale, dark_mode, restore |
| `qa_navigate_home` | – | Kembali ke home anchor (back → relaunch) |
| `qa_reset_session` | 6 | `pm clear` + grant izin + relaunch (reset antar role) |
| `qa_push_support_file` | 1 | Kirim file `automate-support/` ke `/sdcard/Download/` |
| `qa_close_app` | Post | Stop rekaman, restore setting device, terminate app, tutup sesi |

### Fallback Engine: Plan Runner
Jika agent tidak bisa memanggil tool MCP secara langsung (mis. sesi agent di cloud, atau IDE belum memuat MCP), agent **tetap menjalankan seluruh gate dengan user**, lalu menerjemahkan TC menjadi rencana eksekusi `work/<ALIAS>/<fitur>/plans/<feature>.plan.json` dan meminta user menjalankan di Mac:
```bash
cd mcp-server-mobile-qa && node runner/run_plan.mjs .`work/<ALIAS>/<fitur>/plans/<feature>.plan.json`
```
Runner memanggil tool `mobile-qa-guard` lewat protokol MCP, menghitung status per TC (aturan bagian 4), menjalankan charter di slot `{"charterSlot": true}`, lalu menulis `run_results.json`, `report_data.json`, dan laporan DOCX. Agent wajib meninjau hasil (termasuk screenshot charter visual) sebelum menyampaikan verdict. Format step: lihat header `runner/run_plan.mjs`; contoh plan tersimpan di `work/<ALIAS>/<fitur>/plans/*.plan.json` (lokal).

Field plan tambahan: `targets` (coba beberapa target berurutan — wajib untuk UI picker sistem yang berbeda antar device), `inspect` (simpan peta elemen layar ke folder run), `supportFiles` (push file `automate-support/` ke HP di awal run), `requireNewerThan` (tolak run bila build terpasang belum berisi fix), CLI `--apk <file>` dan `--install-policy <install|use_installed>`.

**Data uji dibuat saat run (`setup`)** — mis. video yang direkam langsung di device lalu dikirim ke room uji:
- `plan.setup[]`: kasus persiapan (tidak dihitung di ringkasan). `provides` di setup + `requires` di TC → TC otomatis `SKIP WITH REASON` bila datanya gagal dibuat.
- `qa_device_control camera_video` (buka kamera sistem mode video), `save_latest_video` (value = nama; salin rekaman terbaru DCIM ke `/sdcard/Download/qa_<nama>.mp4` + salinan di folder run untuk cek metadata `ffprobe`), `activate_app`.
- Orientasi file rekaman mengikuti posisi **fisik** HP (sensor), bukan rotasi layar Appium → pakai step `{"manual": "instruksi"}`: runner berhenti, QA memiringkan HP, lalu tekan Enter.
- `manualFallback` (+ `manualCompletes`) pada step `targets`: bila elemen tidak berlabel/ID (mis. tombol kirim) atau mutasi via koordinat diblokir, QA diminta melakukan aksi itu secara manual. **Aturan keras tetap berlaku**: runner tidak pernah mengirim lewat koordinat.
- Caption ber-`${TAG}` menandai bubble milik run ini; target `{"near": "<caption>", "pick": "above"}` menekan media tepat di atas caption (scroll bila perlu). Jalankan ulang TC tanpa membuat data lagi: `--skip-setup --tag <TAG>`.
- TC orientasi/visual memakai `visualReview` → status maksimal `PASSED (LOW CONFIDENCE)` sampai agent meninjau screenshot/rekaman.

### Picker sistem, toast & izin
- **Picker sistem** (Photo Picker/Galeri, Files/DocumentsUI, Kamera, chooser) dianggap bagian sah alur: tidak memicu Build Guard dan elemennya bisa di-tap. Tambah package lain via `.secrets/<ALIAS>.env` `MOBILE_EXTERNAL_ALLOWLIST`. Batal picker = aksi `back`.
- **Toast** tampil ±2–3 detik: server mencatat semua teks/toast yang terlihat sejak aksi terakhir. Gunakan `toast_contains` segera setelah aksi, `seen_text` / `not_seen_text` (mis. memastikan pesan "hubungi CS" tidak pernah muncul).
- **Izin**: `qa_device_control revoke_permission|grant_permission` (value mis. `CAMERA`; mencabut izin akan me-restart proses app — lakukan sebelum membuka layar uji) dan `permission_dialog allow|deny|leave` untuk menguji dialog izin. Semua dikembalikan saat `restore`/`qa_close_app`.

> Jika MCP `mobile-qa-guard` belum aktif di IDE: minta user mendaftarkannya (lihat `mcp-server-mobile-qa/README.md`) dan menjalankan `npm install` di folder tersebut. Jangan mengotomasi device dengan cara lain.

---

## 2. Gerbang Kualitas Mandatori (STRICT)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ GATE 1  TEST CASE CONTRACT (MOBILE)                                       │
│  - Parser mobile: id, judul, Test Steps >= 1, Expected Results >= 1.      │
│  - Expected dipecah per layer: [UI] dieksekusi; [Network]/[DB] -> PARTIAL.│
│  - Filter platform: TC khusus iOS -> SKIP WITH REASON (fase 1 Android).   │
│  - Lint ditampilkan ke user: TC tanpa role, langkah dicurigai mutasi tanpa│
│    penanda [MUTATION], TC dengan precondition data, TC dengan deeplink.   │
│  - Data pendukung (upload) dipetakan dari mobile-execution/automate-support│
├──────────────────────────────────────────────────────────────────────────┤
│ GATE 2  DEVICE & BUILD GATE (pengganti Target URL/Tab Gate)               │
│  - 0 device -> berhenti + panduan USB debugging; >1 device -> TANYA user. │
│  - Build Guard: hanya package di allowlist & berakhiran .stag/.staging/   │
│    .dev/.qa. App production di HP boleh ada, tapi tidak pernah diuji.     │
│  - Versi: belum terpasang -> tanya install; APK lebih baru -> tanya       │
│    upgrade/pakai terpasang; HP lebih baru -> TIDAK downgrade, tanya pakai  │
│    terpasang atau minta APK terbaru. >1 APK -> tanya APK mana.            │
│  - Foreground guard: app keluar ke launcher/app lain -> dicatat & kembali.│
├──────────────────────────────────────────────────────────────────────────┤
│ GATE 3  CREDENTIAL, PRE-LOGIN & ACTIVE SESSION                            │
│  - Resolver role .env sama dengan browser (sinonim bilingual, 3 kasus:    │
│    cocok tunggal/ganda->tanya, tidak ada->minta update .env, role kosong  │
│    ->WAJIB tanya, dilarang asumsi).                                       │
│  - Pre-login: layar izin pelacakan/onboarding ditangani qa_login_role     │
│    (default "Jangan izinkan"; ikuti TC jika TC menguji layar ini).        │
│  - ACTIVE SESSION MISMATCH: status ALREADY_LOGGED_IN_OR_UNKNOWN -> TANYA: │
│    (A) qa_reset_session lalu login role skenario, (B) lanjut sesi aktif.  │
├──────────────────────────────────────────────────────────────────────────┤
│ GATE 4  MUTATION POLICY (safe | full | full_external)                    │
│  - .env QA_MUTATION_MODE diset -> JANGAN tanya ulang; tampilkan banner   │
│    mutationPolicy (qa_init_app). Belum diset -> tanya sekali (Fase 3).   │
│  - safe: mutasi diblokir server -> PARTIAL TEST WITH REASON + screenshot.│
│  - full: create/update/delete/ubah status nyata di staging.              │
│  - full_external: full + kirim/balas/broadcast HANYA bila penerima di    │
│    layar cocok QA_TEST_RECIPIENT_ALLOWLIST.                              │
│  - ATURAN KERAS: finansial diblokir (kecuali QA_FINANCIAL_SANDBOX);      │
│    update/delete hanya data ber-TAG run; logout hanya bila eksplisit;    │
│    koordinat mentah (xy) TIDAK PERNAH untuk mutasi; koordinat ber-anchor │
│    (relativeTo id/label + side) boleh di full + evidence sebelum/sesudah.│
│  - Langkah mutasi: isMutation=true / mutationType; data baru: {{TAG}}.   │
├──────────────────────────────────────────────────────────────────────────┤
│ GATE 5  PRECONDITION READINESS (data disiapkan manual)                    │
│  - Tampilkan daftar precondition per TC (dan "Data Setup (API/DB)" sebagai│
│    informasi). WAJIB minta user konfirmasi data sudah siap per TC/batch.  │
│  - Belum siap -> SKIP WITH REASON. Langkah yang dilakukan di luar app     │
│    (sistem/API/pelanggan via kanal eksternal) TIDAK dieksekusi agent: anggap     │
│    precondition; jika hasilnya tidak terlihat di app -> FAILED/PARTIAL.   │
├──────────────────────────────────────────────────────────────────────────┤
│ GATE 6  TRANSPARENT STATUS FLAGGING                                       │
│  PASSED | PASSED (LOW CONFIDENCE) | FAILED | PARTIAL TEST WITH REASON |   │
│  SKIP WITH REASON  (aturan detail di bagian 4)                            │
├──────────────────────────────────────────────────────────────────────────┤
│ GATE 7  RBAC ROLE BATCHING & CLEAN RESET                                  │
│  - Kelompokkan TC per role; login 1x per batch.                           │
│  - Ganti role -> qa_reset_session (pm clear) lalu qa_login_role.          │
│  - Laporan dikelompokkan per role.                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Alur Kerja Eksekusi

### Fase 0 — Pre-flight lingkungan
1. `qa_check_device_state`. Jika `adb:false` / Appium tidak ada → minta user menjalankan `bash mobile-execution/probe/install_mac.sh` lalu `bash mobile-execution/probe/setup_check.sh` di Mac.
2. Device `unauthorized` → minta user membuka kunci HP dan menyetujui *Allow USB debugging*. Samsung: Auto Blocker OFF. Xiaomi: *USB debugging (Security settings)* ON.
3. HP harus **tidak terkunci & layar menyala**. MCP otomatis mematikan pop-up notifikasi melayang (heads-up) + mengaktifkan DND selama sesi (di-restore saat `qa_close_app`; nonaktifkan dengan `MOBILE_QUIET_NOTIFICATIONS=false`), dan membaca UI dengan multi-window (node dari jendela lain dibuang). `qa_init_app` berstatus `READY_WITH_WARNING` = UI tree app kosong → minta user membuka kunci/menutup overlay sebelum lanjut; **jangan** mengeksekusi TC (hasilnya akan FAILED palsu).
4. Jika `profiles/<ALIAS>/knowledge/mobile/live-analyzer/<package>/` belum ada atau build berubah signifikan → sarankan user menjalankan probe (`node probe.mjs --udid <serial> [--login]`) untuk memperbarui peta struktur & locator.

### Fase 1 — Test case (Gate 1)
1. Cari `.md` di `work/<ALIAS>/<fitur>/`. Lebih dari 1 → tanya file mana. Hanya `.xlsx` → tawarkan konversi.
2. Jalankan parser mobile dengan `--platform android`. Tampilkan rekap: valid / invalid (alasan) / skip platform / lint.
   `contract_status: NO_TESTCASE` = tidak ada heading TC yang terbaca (mis. format tabel lama) → minta TC dikonversi ke format heading (standar testcase) sebelum lanjut; jangan dianggap lulus.
3. Tanyakan pemetaan file `automate-support/` jika ada langkah upload.

### Fase 1b — Grounding UI
Setelah package diketahui (Fase 2 `qa_init_app`), baca UI knowledge package tersebut (bagian 5) sebelum menerjemahkan langkah TC.

### Fase 2 — Device & Build (Gate 2)
1. `qa_init_app {featureName, installPolicy:"ask"}`.
2. `NEEDS_DECISION` → sampaikan pertanyaan + opsi apa adanya ke user, lalu panggil ulang dengan `udid` / `apkFile` / `installPolicy` sesuai jawaban.
3. Sampaikan `notes` (mis. varian production terpasang, izin di-grant, framework).

### Fase 3 — Kredensial, izin mutasi, precondition (Gate 3, 4, 5)
1. `qa_list_available_roles` → resolusi role per TC (Gate 3). Role kosong → tanya user.
2. Mode mutasi (Gate 4):
   - `.secrets/<ALIAS>.env` berisi `QA_MUTATION_MODE` → **jangan bertanya**; tampilkan `mutationPolicy` dari `qa_init_app` (mode, `dataTag`, aturan aktif) sebagai banner.
   - Belum diset → tanyakan sekali:
     > *"Mode mutasi untuk run ini? (A) **full** — create/update/delete nyata di staging (update/delete hanya data ber-TAG); (B) **full_external** — full + kirim/balas/broadcast hanya ke penerima di `QA_TEST_RECIPIENT_ALLOWLIST`; (C) **safe** — read-only."*
     lalu `qa_set_mutation_permission {mode}` (plan runner: `"mutationMode"`).
   - Simpan `dataTag` dari respons: semua data yang dibuat WAJIB memuat TAG (`{{TAG}}` pada value `type`, `${TAG}` di plan). Edit/hapus hanya pada data ber-TAG (elemen/baris memuat TAG, atau ≤6 langkah setelah membuka data ber-TAG).
3. Tampilkan precondition per TC dan minta konfirmasi kesiapan data (Gate 5).

### Fase 4 — Eksekusi per role batch → per TC
Untuk setiap batch role: `qa_login_role {role, suffix}` (tangani `ALREADY_LOGGED_IN_OR_UNKNOWN` lewat Active Session Mismatch Gate). Untuk setiap TC:

1. `qa_navigate_home` (atau buka `Deeplink` TC bila ada & sudah dikonfirmasi dev — hanya menggantikan navigasi precondition).
2. Opsional `qa_screen_recording start` untuk TC Critical/High.
3. Terjemahkan setiap langkah bahasa alami:

| Pola langkah TC | Aksi |
|---|---|
| "Buka aplikasi … dan login sebagai X" | Sudah ditangani batch login. Verifikasi role cocok. |
| "Buka menu A > B" / "akses menu A" | `qa_inspect_screen` → menu ☰ (`position: app-bar-kiri` / id `*_drawer_*` di locator_map) → tap item A → tap B |
| "Pilih tab X" / "pilih chip X" | `tap {label:"X"}`; jika ambigu (tab vs chip sama nama) gunakan `ref` hasil inspect sesuai konteks |
| "Pilih percakapan/pelanggan Y" | `tap {contains:"Y"}` pada list (`id: …item_*`); tidak tampil → `scroll` lalu ulangi (otomatis scroll-until-visible) |
| "Pada field X, masukkan Y" | `type {label:"X"} value:"Y"` (label/hint field) |
| "Klik tombol X" | `tap {label:"X"}`; tambah `isMutation:true` / `mutationType` bila mutasi |
| Tombol mutasi tanpa ID/label (mis. Kirim, tambah media) | `tap {relativeTo:{id:"<anchor ber-ID>"}, side:"right"}` + `isMutation:true` + `mutationType` WAJIB (mis. `external` untuk kirim) → tier `anchored` (LOW), screenshot `_anchored_before/after.png` otomatis. Jangan pakai `xy`. |
| "Scroll / geser ke …" | `scroll {direction}` atau target dengan scroll otomatis |
| "Tekan back / kembali" | `back` |
| Airplane mode / offline | `qa_device_control network_off` … `network_on` |
| Dark mode / font besar / rotasi / background / kill app | `qa_device_control` sesuai aksi |
| Langkah di luar app (sistem/API/pelanggan via kanal eksternal/web dashboard) | **Tidak dieksekusi**: precondition manual (Gate 5); catat di notes |

Prinsip:
- **Inspect sebelum bertindak** bila layar belum dikenal; utamakan `id` (dari `locator_map.json` / inspect) → `label` exact → `contains`. `xy` hanya untuk navigasi non-mutasi tanpa alternatif.
- **Target ambigu** (server mengembalikan `candidates`) → pilih `ref` hanya jika konteks TC jelas; jika tidak, hentikan langkah dan beri status `PARTIAL TEST WITH REASON: locator ambigu`.
- Respons `PARTIAL TEST WITH REASON` dari server (Safe Mode / kategori di luar mode / data tanpa TAG / finansial / penerima tidak di allowlist / koordinat mentah / logout) → hentikan langkah mutasi itu, salin `reason` ke notes, lanjutkan assertion yang masih bisa, status TC = PARTIAL.
- Catat `tier`/`confidence` setiap langkah & assertion. Ada `confidence: LOW` → TC maksimal `PASSED (LOW CONFIDENCE)`.
- `guard` berisi catatan Build Guard (app keluar ke launcher/app lain) → cantumkan di notes; jika terjadi saat langkah yang diuji → investigasi (potensi defek: back keluar app).

4. **Assertion layer [UI]** → `qa_assert_element` (visible / contains_text / screen_title / enabled / disabled / count_at_least / toast_contains). Assertion visual murni (warna, posisi kiri/kanan, ikon, layout) yang tidak terbaca dari accessibility tree → ambil screenshot, nilai secara visual, dan tandai `PASSED (LOW CONFIDENCE)` bila hanya diverifikasi visual.
5. **Layer [Network]/[DB/Persistence]** → tidak divalidasi otomatis → `PARTIAL TEST WITH REASON` (sebutkan layer). Validasi DB **OPSIONAL (opt-in)**: jalankan skill `database-qa-validation` hanya bila user meminta dan menyediakan detail (target DB, tabel, kolom kunci, kondisi — mis. `WHERE name LIKE '%<TAG>%'`) atau TC memuat blok `[DB-CHECK]`. Detail tidak lengkap → jangan menebak skema; status tetap PARTIAL dengan alasan "detail DB tidak tersedia".
6a. **Teardown data**: akhir suite (mode bukan safe) → `qa_get_mutation_ledger`; bila `created` tidak kosong jalankan TC cleanup yang menghapus data ber-TAG (plan runner: `plan.teardown[]`, otomatis di akhir/saat error; lewati dengan `--skip-teardown`). Cantumkan ringkasan ledger di laporan.
6. `qa_capture_evidence {tcId, step:"final", status}` (FAILED otomatis menyertakan logcat). Stop rekaman bila aktif.

### Fase 5 — 5 Charter Exploratory Mobile (WAJIB di akhir suite)
| # | Charter | Eksekusi | Verifikasi |
|---|---|---|---|
| 1 | ⚡ Impatient User | `double_tap` pada CTA utama layar fitur (non-mutasi di Safe Mode; mutasi hanya bila diizinkan) | Tidak ada aksi ganda / layar ganda / crash |
| 2 | 🔄 Background & Kill-Relaunch | `qa_device_control background 5` lalu `kill_relaunch` | State aman, sesi tetap, tidak ada crash / layar putih |
| 3 | 📱 Rotasi, Font & Dark Mode | `rotate_landscape` → `rotate_portrait`; `font_scale 1.3`; `dark_mode_on` | Tidak ada teks terpotong/overflow, kontras terbaca; lalu `restore` |
| 4 | 📴 Offline Resilience | `network_off` saat di layar fitur → aksi baca/refresh → `network_on` | Pesan offline jelas, data cache tampil, pulih setelah online |
| 5 | 🔙 Interruption & Back | `back` berulang dari sub-layar; buka/tutup drawer/bottom sheet | Kembali ke layar sebelumnya (bukan keluar app), sheet tertutup tanpa submit |

Setiap charter: `qa_capture_evidence` + verdict (PASS / FAIL / OBSERVATION). Selalu akhiri dengan `qa_device_control restore`.

### Fase 6 — Laporan Word
1. Susun JSON untuk `generate_docx_report.py`:
   - `feature_name`, `environment`: `"Staging Android"`, `base_url`: `"<package> v<versionName> (<versionCode>) • <brand model> Android <release>"`, `timestamp`, `testcase_file`, `evidence_dir` (folder run), `qa_lead`: `"Senior QA Engineer (Mobile QA Guard / Appium)"`.
   - `summary`: total, passed (termasuk LOW CONFIDENCE), failed, partial, skipped, exploratory: 5.
   - `roles`: `{ "<role>": [ {id, title, action (ringkas langkah), status, notes (tier/confidence, alasan partial/skip, guard event)} ] }`.
   - `exploratory_scenarios`: charter, action, observed, verdict.
   - `evidence_files`: filename, scenario, timestamp.
   - `release_recommendation`: GO / CONDITIONAL GO / NO-GO sesuai standar verdict bersama + `recommendation_reason` (pernyataan scope, jumlah LOW CONFIDENCE, PARTIAL, BLOCKED, dan FAILED per `failure_category`).
   - Charter yang tidak dijalankan pada run ini (mis. rerun) ditulis "tidak dijalankan" — jangan biarkan generator mengisi default.
   - Review (M5) oleh user yang menjalankan workflow (D7): koreksi status dicatat di `review.json`; laporan final diberi akhiran `_REVIEWED`.
2. Simpan JSON di folder run, jalankan generator ke `work/<ALIAS>/<fitur>/reports/Report_<fitur>_<YYYYMMDD_HHMMSS>.docx`.

### Fase 7 — Post-flight (WAJIB, juga saat run dihentikan)
`qa_close_app` → restore setting device (network, font, dark mode, orientasi), stop rekaman, terminate app, tutup sesi & Appium. Sampaikan ringkasan: pass rate, verdict, path laporan, path folder evidence.

---

## 4. Aturan Status

| Status | Kapan |
|---|---|
| `PASSED` | Semua langkah & assertion [UI] lolos dengan confidence HIGH (resource-id / label exact) dan TC tidak punya layer Network/DB |
| `PASSED (LOW CONFIDENCE)` | Lolos, tetapi ada langkah/assertion **yang diuji** via fuzzy, text-node, koordinat, atau verifikasi visual screenshot |

> **Langkah persiapan/navigasi** (ditandai `setup: true` di plan, mis. tap ikon search untuk membuka room) yang LOW **tidak menurunkan status** bila hasilnya dibuktikan assertion HIGH sesudahnya (mis. header room ber-ID tampil). Tetap dicatat di notes. Tanpa bukti HIGH → tetap `PASSED (LOW CONFIDENCE)` (disetujui user, 19 Nov 2026).
> Langkah ber-`expectNoGuard: true` dinyatakan gagal bila memicu guard event (app keluar ke launcher).
| `FAILED` | Assertion [UI] gagal, elemen wajib tidak ada, crash/ANR, app keluar sendiri, perilaku tidak sesuai expected |
| `PARTIAL TEST WITH REASON` | Layer dalam scope dicoba tetapi tidak tuntas: mutasi diblokir Safe Mode/aturan koordinat; locator ambigu; langkah di luar app tidak terverifikasi |
| `BLOCKED` | Data precondition belum siap; kredensial role tidak ada; Q-PM terbuka/asumsi (`Blocked by`); binding/knowledge layar belum ada; device/environment bermasalah |
| `NOT IN SCOPE` | Layer TC yang tidak dipilih di run ini (mis. [API]/[DB] saat run hanya UI mobile) |
| `SKIP WITH REASON` | Platform bukan Android (fase 1); user memilih skip |

Setiap `FAILED` wajib `failure_category`: `product` (perilaku app salah), `script` (plan/locator salah), `environment` (device, jaringan, staging down), `data` (data uji tidak sesuai). Hanya `product` yang dihitung defect.

UI lolos + layer [API]/[DB] tidak termasuk scope run → status run: `PASSED` (scope UI) dengan layer lain `NOT IN SCOPE`; status akhir TC digabung dengan run DB/API bila ada. Runner lama masih menulis PARTIAL untuk kasus ini — koreksi saat review (M5).

---

## 5. UI Knowledge per Aplikasi (WAJIB sebelum menyusun langkah/plan)

**Prinsip: satu folder = satu package. Knowledge app lain TIDAK BOLEH dipakai.**

1. **Tentukan package** dari hasil `qa_init_app` (`app.package`, mis. `com.example.app.staging`) — bukan dari nama app atau tebakan. Varian production (`variants.production`) punya knowledge sendiri bila pernah diuji, tidak dicampur.
2. **Baca** `profiles/<ALIAS>/knowledge/mobile/<package>/ui-knowledge.md`:
   - bagian **Jebakan yang Diketahui** dan **Known Issues** wajib dipertimbangkan saat menulis langkah & ekspektasi;
   - pakai `resource-id` dari tabel layar (confidence HIGH) sebelum label/posisi; ikuti **Cara mencapai** untuk navigasi;
   - untuk picker/komponen OS, baca `knowledge/_system/<package-picker>/ui-knowledge.md` (contoh: `_system/com.google.android.documentsui`).
3. **Folder knowledge belum ada** (app baru) → jalankan probe untuk app tersebut, lalu lanjutkan dengan `qa_inspect_screen`. Jangan menyalin selector dari app lain.
4. **Selector di knowledge berstatus `stale`** atau tidak ditemukan saat eksekusi → anggap UI berubah: verifikasi dengan `qa_inspect_screen`, jangan memaksa selector lama.
5. **Setelah setiap run/probe** knowledge diperbarui otomatis (runner & probe memanggil `update_ui_knowledge.py --package <package>`; sumber dengan package lain ditolak). Elemen tidak pernah dihapus; yang tidak terlihat 2x → `stale`.
6. **Kurasi** (judul layar, cara mencapai, jebakan baru, known issue baru) ditulis di `knowledge/<package>/seed.json`, lalu `update_ui_knowledge.py --seed <seed.json>`. Layar hasil ingest otomatis berlabel *(auto, perlu kurasi)* → gabungkan dengan `absorb` di seed.

Pola generik lintas app (bukan khusus satu app):
- Flutter: tombol muncul 2 node (wrapper + node aktif) dengan id & bounds sama; label di node anak `*_label` — sudah ditangani resolver.
- Container/sheet berisi banyak item berlabel dibaca sebagai gabungan label; target item dengan ID-nya.
- Kill app saat picker terbuka → Android memulihkan picker di atas app (perilaku OS).
- Mencabut izin (`revoke_permission`) me-restart proses app.

---

## 6. Pedoman Komunikasi Senior QA
1. **Jujur**: jangan pernah `PASSED` bila hanya sebagian layer tervalidasi atau locator LOW CONFIDENCE.
2. **Lindungi data staging**: ingatkan risiko sebelum aksi mutasi; jangan pernah logout/hapus tanpa TC eksplisit.
3. **Jangan memperlakukan app seperti web**: tidak menebak URL/route; navigasi lewat UI.
4. **Ringkas**: setelah selesai sampaikan pass rate, verdict, jumlah LOW CONFIDENCE & PARTIAL, path laporan & evidence.
