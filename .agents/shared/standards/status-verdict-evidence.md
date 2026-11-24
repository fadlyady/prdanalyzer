# Standar Status, Verdict & Evidence (M4–M6)

## 1. Status (sama untuk semua eksekutor, dicatat per TC per layer)

| Status | Kapan | Pengaruh verdict |
| --- | --- | --- |
| `PASSED` | Semua layer dalam scope tervalidasi, confidence tinggi | positif |
| `PASSED (LOW CONFIDENCE)` | Lolos via fuzzy/koordinat/penilaian visual | P1/P2 → maks. Conditional |
| `PARTIAL TEST WITH REASON` | Layer dalam scope dicoba tetapi tidak tuntas (mutasi diblokir, locator ambigu); sebut layernya | P1/P2 → maks. Conditional |
| `FAILED` | Expected tidak terpenuhi; wajib `failure_category`: product / script / environment / data | hanya `product` = defect |
| `BLOCKED` | Q-PM terbuka, asumsi, data/akun belum siap, binding belum ada, environment down | P1/P2 → maks. Conditional |
| `NOT IN SCOPE` | Layer/TC sengaja tidak dipilih untuk run ini | tidak; tercatat di scope |
| `SKIP WITH REASON` | Dikeluarkan atas keputusan user (mis. platform belum didukung) | tidak; tercatat |

FAILED kategori script/environment/data diperbaiki lalu dijalankan ulang; selama belum, diperlakukan sebagai BLOCKED.

## 2. Pernyataan scope (wajib di setiap laporan)

"Scope run: layer <...> untuk <n> dari <N> TC (<prioritas>), environment <...>, build <...>. Layer <...>: NOT IN SCOPE."

## 3. Verdict

1. **NO-GO**: ada `FAILED (product)` pada P1/P2, atau risiko Critical/High tanpa satu pun TC `PASSED` dalam scope.
2. **CONDITIONAL GO**: tanpa kondisi NO-GO, tetapi ada `FAILED (product)` P3/P4, atau `LOW CONFIDENCE`/`PARTIAL`/`BLOCKED`
   pada P1/P2 — masing-masing dengan mitigasi tertulis dan pemilik.
3. **GO**: tanpa kondisi di atas dan exit criteria `03-plan.md` terpenuhi.
4. Persentase (mis. weighted risk coverage, bobot 4/3/2/1) hanya dari TC yang dijalankan & lulus dalam scope; data kurang
   → `INSUFFICIENT DATA`, bukan angka default.
5. Verdict rilis keseluruhan hanya bila gabungan scope semua run menutup semua layer AC P1/P2 yang dideklarasikan analisa.
6. Exploratory/charter yang tidak dijalankan ditulis "tidak dijalankan" — tidak pernah PASS default.
7. **INSUFFICIENT DATA** juga dipakai bila tidak ada TC yang benar-benar dieksekusi (semua BLOCKED/SKIP/NOT IN SCOPE).
8. Aturan konservatif selama belum direview: FAILED tanpa `failure_category` dianggap `product`; TC tanpa prioritas dianggap P1.

**Implementasi tunggal:** `scripts/lib/verdict.cjs` (runner JS) dan `scripts/lib/verdict.py` (laporan, review, kalkulasi) —
diuji dengan vektor bersama `scripts/lib/verdict_cases.json` (`node scripts/lib/verdict_selftest.mjs`). Skill tidak boleh
menulis aturan verdict sendiri.

**Review (M5/D7):** `python3 scripts/qa_review.py <folder-run> --init` → isi `review.json` (reviewer, koreksi status &
`failure_category`, opsional `decision` + `decision_reason`) → `python3 scripts/qa_review.py <folder-run>` menghitung ulang
verdict, menulis `report_data.json`, laporan `reports/Report_<run>_REVIEWED.docx`, dan `runs/index.json`.

**Audit laporan lama:** `python3 scripts/qa_audit_reports.py` menandai run/laporan yang dibuat sebelum perbaikan P0
(charter bawaan, verdict tidak sesuai hitung ulang) di `runs/index.json` (`audit.tainted`) dan menulis ringkasan ke
`work/<ALIAS>/_audit/` (lokal). Laporan bertanda tidak dipakai untuk keputusan sebelum di-review ulang.

## 4. Evidence minimum per run (`runs/<run-id>/`)

| File | Isi |
| --- | --- |
| `run_meta.json` | alias, environment, build/versi, versi `02-testcases.md` & `03-plan.md`, eksekutor, mode mutasi, waktu |
| `run_results.json` | per TC per layer: status, confidence, failure_category, alasan, capture, daftar evidence |
| `actions.jsonl` | jejak aksi & assertion |
| evidence per layer | UI: screenshot sebelum mutasi, sesudah assertion, saat gagal (+ video P1); API: ringkasan request/response termasking; DB: query read-only, parameter, waktu, hasil termasking, expected vs actual; log saat gagal |
| `mutation_ledger.jsonl` | mutasi dijalankan/diblokir + teardown data ber-TAG |
| `manifest.json` | sha256 setiap file evidence |
| `review.json` | reviewer (runner), waktu, koreksi status (sebelum → sesudah + alasan), keputusan |

Laporan & verdict dibangkitkan hanya dari file di atas. Laporan tanpa `review.json` berlabel `DRAFT`.

## 5. Redaksi & klasifikasi

- Screenshot, log, HAR, dan hasil query diredaksi (email, nomor telepon, nama orang, nama aplikasi) sebelum masuk
  laporan yang dibagikan; versi mentah tetap di folder run lokal (`internal`).
- Dokumen formal (M7) hanya dibuat dari artefak `shareable`.
