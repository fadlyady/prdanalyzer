# Standar Test Case (M2) — Kontrak Bersama Semua Eksekutor

TC menyatakan niat uji dan hasil teramati per layer dalam bahasa pengguna. Cara teknis (selector, route, endpoint,
query) diambil dari binding di `profiles/<ALIAS>/knowledge/<layer>/`. Markdown `02-testcases.md` adalah sumber
kebenaran; Excel adalah hasil ekspor.

## 1. Field wajib (header selalu `- **Nama**:` tanpa tambahan dalam kurung)

| Field | Isi |
| --- | --- |
| Heading | `### <ID>: <judul>` dengan ID `<PLATFORM atau ALL>-<MODUL>-<SUB>-<TIPE>-<SEQ>` (immutable). TIPE: POS, NEG, BVA, SEC, CON, EXP |
| Covers | `AC-xx`, `RSK-xxx`, `Q-xx` |
| Priority / Type / Status | `P1`–`P4` / Functional, Negative, Boundary, Security, Concurrency, Exploratory / Draft, Ready |
| Platforms | `web`, `android`, `ios`, `api`, `db` (satu atau lebih) |
| Layers | layer yang punya expected: `UI`, `API`, `DB`, `LOG` |
| Role | `{{role:<alias>}}` (mis. `{{role:owner}}`); jangan tulis akun asli |
| Blocked by | `Q-xx` / `assumption` / `—` |
| Test data | `{{data.<set>}}` dari `profiles/<ALIAS>/data/sets.yaml`; data buatan run memakai `{{TAG}}` |
| Precondition | kondisi awal bernomor |
| Steps | aksi niat pengguna bernomor; langkah mutasi diberi `[MUTATION:<create|update|delete|state_change|external|financial|session_end>]` |
| Expected | baris per layer: `[UI] ...`, `[API] ...`, `[DB] ...`, `[LOG] ...`, masing-masing diakhiri label sumber |
| Capture | nilai runtime untuk layer lain, mis. `order_id ← nomor order pada [UI]` |
| DB check | opsional, terstruktur: `target=db:main; tabel=<t>; kunci=<k>; kondisi=<...>; timeout=60s` |

Navigasi ditulis lewat menu/layar ("Buka menu Pengaturan > Profil"), bukan URL/route, kecuali route terdokumentasi.
Endpoint, tabel, dan menu hanya boleh ditulis bila ada di knowledge profil atau dokumen sumber; selain itu narasi fungsional.

## 2. Contoh (agnostik)

```markdown
### ALL-ORD-CHKO-POS-001: Checkout dengan saldo cukup menghasilkan order lunas
- **Covers**: AC-03, RSK-002
- **Priority**: P1 | **Type**: Functional | **Status**: Ready
- **Platforms**: web, android, db
- **Layers**: UI, API, DB
- **Role**: {{role:buyer}}
- **Blocked by**: —
- **Test data**: {{data.buyer_balance_ok}}, {{data.product_a}}
- **Precondition**:
  1. Saldo akun {{data.buyer_balance_ok}} lebih besar dari harga {{data.product_a}}.
- **Steps**:
  1. Buka detail produk {{data.product_a.name}}.
  2. Pilih Beli.
  3. Konfirmasi pembayaran. [MUTATION:financial]
- **Expected**:
  - [UI] Tampil status pembayaran berhasil beserta nomor order baru. [PRD §4.2]
  - [API] Permintaan pembayaran berhasil (2xx) dan mengembalikan nomor order. [API checkout#create]
  - [DB] Order {{capture.order_id}} berstatus lunas; saldo berkurang sebesar harga. [DB orders]
- **Capture**: order_id ← nomor order pada [UI]
```

## 3. Pemilihan eksekutor & binding

1. Eksekutor mengambil TC bila salah satu `Platforms` miliknya, dan hanya memvalidasi layer yang ia kuasai; layer lain
   dicatat `NOT IN SCOPE` pada run itu.
2. Binding belum ada → TC berstatus `BLOCKED (binding)`; jangan menebak selector/endpoint/tabel.
3. Status akhir per TC = gabungan run per layer (UI dari run web + DB dari run DB).
4. `Capture` meneruskan nilai antar eksekutor (pengganti `execution_context.json`).

## 4. Ekspor Excel (D6)

`python3 scripts/tc_export_xlsx.py work/<ALIAS>/<fitur>/02-testcases.md` → `02-testcases.xlsx`, sheet `Test Cases`.
15 kolom lama **tidak diubah** (urutan, nama — termasuk `decription` — dan isi), lalu 6 kolom baru di kanan:

| # | Kolom | Sumber |
| --- | --- | --- |
| 1–15 | project_id, suite_id, unique_id, title, decription, precondition, priority, type, status, tags, steps, step_desc, expected_desc, is_automated, user_story | format lama |
| 16 | platforms | `Platforms` |
| 17 | layers | `Layers` |
| 18 | role | `Role` |
| 19 | covers | `Covers` |
| 20 | blocked_by | `Blocked by` |
| 21 | test_data | `Test data` |

Untuk tools internal yang hanya menerima 15 kolom, hapus kolom 16–21. `--verify` membandingkan Excel vs Markdown 1-ke-1.
