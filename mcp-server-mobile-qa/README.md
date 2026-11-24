# Mobile QA Guard MCP Server (`mobile-qa-guard`)

MCP server untuk skill **`mobile-qa-execution`**: eksekusi test case di HP Android fisik (USB) terhadap app **staging**, lewat Appium UiAutomator2, dengan hard guard di level kode.

| Gate | Penegakan di server |
|---|---|
| 2 Device & Build | Pilih device (tanya jika >1), allowlist package staging (`.stag/.staging/.dev/.qa`), keputusan install/upgrade (tidak pernah downgrade), foreground guard (app keluar → dicatat & dikembalikan) |
| 3 Credential | Password dibaca dari `.env` dan diketik oleh server — tidak pernah dikirim ke AI. Pre-login (izin pelacakan/onboarding) ditangani |
| 4 Mutation | Safe Mode default. Mutasi diblokir → `PARTIAL TEST WITH REASON`. Mutasi via tap koordinat **selalu** diblokir. Logout diblokir kecuali eksplisit |
| 5 Evidence | Screenshot terstandar, logcat otomatis untuk FAILED, rekaman layar, `actions.jsonl`, tier & confidence locator |
| 6 Reset | `pm clear` + grant ulang izin antar role |

Tool: `qa_check_device_state`, `qa_init_app`, `qa_list_available_roles`, `qa_set_mutation_permission`, `qa_login_role`, `qa_inspect_screen`, `qa_execute_action`, `qa_assert_element`, `qa_capture_evidence`, `qa_screen_recording`, `qa_device_control`, `qa_navigate_home`, `qa_reset_session`, `qa_push_support_file`, `qa_close_app`.

## Instalasi

Prasyarat Mac (sekali): `bash mobile-execution/probe/install_mac.sh` (Android SDK, Appium, driver uiautomator2).

```bash
cd mcp-server-mobile-qa
npm install
npm run selftest     # uji protokol MCP + resolver/guard (tanpa device)
```

## Registrasi MCP

Sudah didaftarkan di `.agents/mcp_config.json` dan `.cursor/mcp.json`:

```json
"mobile-qa-guard": { "command": "node", "args": ["mcp-server-mobile-qa/src/index.js"] }
```

Restart IDE/agent setelah `npm install` agar tool muncul.

## Konfigurasi (profil aktif)

Nilai di bawah disimpan di `.secrets/<QA_ACTIVE_PROFILE>.env` (lokal, di-gitignore) dan dibaca lewat `scripts/lib/qa-env.cjs`; `.env` root hanya berisi `QA_ACTIVE_PROFILE`. Lihat `profiles/README.md`.

```
MOBILE_APP_PACKAGE_STAGING=com.example.app.staging
# MOBILE_APP_PACKAGE_ALLOWLIST=com.example.app.staging
# MOBILE_APP_ACTIVITY=com.example.app.MainActivity   (opsional, auto-resolve)
# ANDROID_DEVICE_SERIAL=<SERIAL_HP>                   (opsional)
# APPIUM_URL=http://127.0.0.1:4723   (opsional; KOSONGKAN agar MCP mengelola Appium sendiri di port 4733)
```

## Environment (penting untuk IDE)

IDE di macOS tidak membaca `~/.zshrc`, jadi server mendeteksi sendiri `ANDROID_HOME`, `JAVA_HOME`, dan PATH (`adb`, `appium` di `~/.npm-global/bin`, `/opt/homebrew/bin`). Hasil deteksi terlihat di `qa_check_device_state.environment`. Appium dijalankan MCP di port **4733** dengan environment tersebut, terpisah dari Appium lain di 4723.

## Target elemen (`qa_execute_action` / `qa_assert_element`)

`{ref}` dari `qa_inspect_screen` → `{id}` (resource-id, akhiran `*` = prefix) → `{label}` (label efektif exact) → `{contains}` (fuzzy, LOW) → `{type:"input"|"password"}` → `{xy:[x,y]}` (koordinat, LOW, diblokir untuk mutasi). Tambahkan `index` bila kandidat >1. Target ambigu → server mengembalikan `candidates`, tidak memilih sendiri.

## Output

`mobile-execution/automate-result/run_<Feature>_<timestamp>/` — screenshot, logcat, mp4, `actions.jsonl`, `run_meta.json`, `guard_events.json`.

---

## Mutation Policy v2 (Gate 4) — safe | full | full_external

Satu modul bersama: `mcp-server-browser-qa/src/policy.js` (dipakai browser-qa-guard & mobile-qa-guard). Konfigurasi di `.env` (lihat `.env.example` bagian MUTATION POLICY).

| Mode | Yang dijalankan nyata |
|---|---|
| `safe` | Tidak ada mutasi — langkah mutasi → `PARTIAL TEST WITH REASON` |
| `full` | create / update / delete / ubah status di staging |
| `full_external` | `full` + kirim / balas / broadcast, hanya bila penerima di layar cocok `QA_TEST_RECIPIENT_ALLOWLIST` |

Aturan keras di semua mode:
- **Finansial** (bayar, top up, checkout, potong kuota) diblokir kecuali `QA_FINANCIAL_SANDBOX=true`.
- **Update/delete hanya data ber-TAG**: `qa_set_mutation_permission` mengembalikan `dataTag` (mis. `QAAUTO-2611201530`); pakai `{{TAG}}` di value saat membuat data. Edit/hapus diizinkan bila elemen/baris/dialog memuat TAG atau ≤ `QA_TAG_CONTEXT_WINDOW` langkah setelah membuka data ber-TAG.
- **Logout** hanya bila `isMutation:true` / `mutationType:"session_end"`.
- **Browser**: domain hanya host dari `QA_STAGING_HOSTS` / `*_BASE_URL_STAGING` (target tidak lagi auto-allow); `QA_PROD_HOSTS_DENY` selalu ditolak; halaman berpindah ke luar staging → mode dipaksa `safe`. Klasifikasi memakai selector + teks elemen (bukan nilai `fill`); link `<a href>` = navigasi.
- **Mobile**: koordinat mentah (`xy`) tidak pernah untuk mutasi; koordinat ber-anchor `{relativeTo:{id|label}, side, offset?}` boleh di mode full dengan screenshot `_anchored_before/after.png` otomatis.
- Mode di-reset ke default `.env` (atau `safe`) saat `qa_close_browser` / `qa_close_app`; ganti role (`qa_reset_session`) mempertahankan mode & TAG.

Audit & teardown: setiap mutasi dijalankan/diblokir dicatat di `mutation_ledger.jsonl` folder run; `qa_get_mutation_ledger` memberi ringkasan + daftar data yang dibuat. Plan runner mobile menjalankan `plan.teardown[]` di akhir (lewati dengan `--skip-teardown`).

Validasi DB setelah mutasi **opsional** (opt-in lewat skill `database-qa-validation`, butuh detail tabel/kondisi dari user) — tidak dipanggil otomatis.

Self-test tanpa device/Chrome: `npm run selftest`.
