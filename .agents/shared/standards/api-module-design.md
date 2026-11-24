# Rancangan Awal Modul API (M4c) — Acuan (D8)

Status: **rancangan**, belum diimplementasikan. Sampai modul ini ada, layer `[API]` pada run dicatat `NOT IN SCOPE`
(atau divalidasi pasif lewat capture network browser bila tahap A sudah tersedia).

## 1. Tujuan

Memvalidasi layer `[API]` test case (status, kontrak/schema, nilai field, waktu respons, idempotency) secara agnostik,
dengan pengaman yang sama seperti eksekutor UI: host allowlist, policy mutasi, TAG data uji, dan rahasia yang tidak pernah
terlihat oleh AI. Target utama: TC dengan `Platforms: api` atau `Layers` memuat `API`.

## 2. Input & binding

| Input | Lokasi | Keterangan |
| --- | --- | --- |
| Test case | `work/<ALIAS>/<fitur>/02-testcases.md` | Expected `[API]` + `Capture` + `Test data` |
| Kontrak | `profiles/<ALIAS>/knowledge/api/` | OpenAPI/Swagger (utama), Postman collection, catatan kontrak |
| Binding operasi | `profiles/<ALIAS>/knowledge/api/bindings.yaml` | nama operasi fungsional di TC → `operationId`/method+path |
| Rahasia & host | `.secrets/<ALIAS>.env` | `API_BASE_URL_STAGING`, token/akun per role, `QA_STAGING_HOSTS`, `QA_PROD_HOSTS_DENY` |

Tanpa kontrak/binding untuk sebuah operasi → TC `BLOCKED (binding)`; endpoint tidak pernah ditebak.

## 3. Tahapan implementasi

| Tahap | Kemampuan | Risiko mutasi | Prasyarat |
| --- | --- | --- | --- |
| A. Pasif | Rekam network (method, path, status, durasi, ringkasan body termasking) dari `browser-qa-guard` saat run UI; asersi `[API]` dari rekaman | Tidak ada | Tool baru `qa_network_log` di MCP browser |
| B. Aktif read-only | Request GET/HEAD/OPTIONS dari binding; validasi status, schema OpenAPI, JSONPath, waktu respons | Tidak ada | Kontrak OpenAPI + binding |
| C. Aktif mutasi | POST/PUT/PATCH/DELETE mengikuti `policy.js` (safe/full/full_external, TAG, finansial diblokir) + teardown | Terkendali | Data ber-TAG, mode `full`, persetujuan user |

## 4. Rancangan MCP `api-qa-guard`

| Tool | Fungsi |
| --- | --- |
| `qa_api_list_operations` | Daftar operasi dari kontrak profil aktif (tanpa nilai rahasia) |
| `qa_api_login_role` | Ambil token/sesi untuk `{{role:x}}` di sisi server; AI hanya menerima alias |
| `qa_api_request` | Kirim request berdasarkan `operation` + parameter/body (variabel `{{data.x}}`, `{{capture.x}}`, `{{TAG}}`); method mutasi dicek policy |
| `qa_api_assert` | `status_in`, `schema_valid` (OpenAPI), `jsonpath_equals/contains`, `header_present`, `latency_below`, `idempotent_repeat` |
| `qa_api_capture` | Simpan nilai respons ke capture untuk layer DB/UI berikutnya |
| `qa_api_poll` | Ulangi request sampai kondisi terpenuhi / timeout (untuk proses async) |
| `qa_api_close` | Tutup sesi, tulis ringkasan & ledger |

Pengaman: host hanya dari allowlist profil; produksi selalu ditolak; header `Authorization`/cookie/token tidak pernah
dikembalikan ke AI; body request/respons dimasking (email, telepon, nama, token) sebelum disimpan ke evidence.

## 5. Evidence & status

- Per request: `api/<TC>_<n>.json` berisi method, operasi, path template (bukan URL penuh), status, durasi, ringkasan
  header & body termasking, hasil asersi; masuk `manifest.json` folder run.
- Status mengikuti `status-verdict-evidence.md`: kontrak tidak cocok/status salah → `FAILED (product)`; host/env bermasalah →
  `FAILED (environment)`; binding belum ada → `BLOCKED`; mutasi diblokir policy → `PARTIAL TEST WITH REASON`.

## 6. Keputusan yang dibutuhkan sebelum implementasi

1. Sumber kontrak resmi per aplikasi (OpenAPI tersedia? siapa pemiliknya?).
2. Mekanisme autentikasi API staging per role (token statis, login API, atau ambil dari sesi browser).
3. Apakah tahap A (pasif via browser) cukup untuk rilis awal sebelum tahap B/C.
