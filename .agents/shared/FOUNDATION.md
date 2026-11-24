# Pondasi Workflow QA SDLC (Acuan Tertinggi)

Berlaku untuk semua skill di `.agents/skills/`, skrip, MCP, dan artefak. Bila aturan skill bertentangan dengan
dokumen ini atau standar di `.agents/shared/standards/`, dokumen ini yang berlaku dan skill wajib disesuaikan.

## 1. Prinsip (P1–P12)

| # | Prinsip | Pemeriksaan kepatuhan |
| --- | --- | --- |
| P1 | **Agnostik** — workflow inti tidak menyebut nama aplikasi, domain, host, package, tabel, atau selector; semua itu ada di profil aplikasi. | Guard scan bersih; ganti profil tanpa edit skill. |
| P2 | **Inti alur wajib, sisanya modular** — Intake → Analisa → Test case selalu ada; eksekusi (web, mobile, API, DB) dipilih sesuai kebutuhan. | Modul yang tidak dipilih tercatat "tidak dijalankan". |
| P3 | **Analisa bersumber** — setiap klaim berlabel sumber atau ditandai asumsi/pending. | Tidak ada aturan/angka/menu tanpa label. |
| P4 | **Lengkap = semua dimensi disentuh** — 14 dimensi diisi atau N/A + alasan; kedalaman mengikuti risiko. | Checklist dimensi 100%. |
| P5 | **Analisa dapat dipakai ulang** — cukup untuk diturunkan ke TC jenis apa pun tanpa membuka dokumen awal. | Setiap AC punya expected teramati per layer + sumber + risiko. |
| P6 | **TC = niat uji + binding terpisah** — TC menyatakan apa & expected per layer; cara teknis ada di knowledge profil. | Satu TC dapat dijalankan eksekutor UI/API/DB tanpa ditulis ulang. |
| P7 | **Data uji sebagai variabel** — `{{data.x}}`, `{{role:x}}`, di-resolve per environment. | Tidak ada email/nomor/ID asli di TC. |
| P8 | **Rahasia tidak pernah keluar** — nilai asli hanya di `.secrets/<ALIAS>.env`; output memakai alias; evidence diredaksi. | Guard scan & pre-commit lolos. |
| P9 | **Evidence jujur** — tidak ada nilai default yang menyerupai hasil; yang tidak dijalankan ditulis "tidak dijalankan". | Setiap status tertelusur ke file evidence. |
| P10 | **Verdict sesuai scope** — verdict hanya untuk layer/modul yang diuji dan selalu menyebut scope. | Laporan memuat pernyataan scope. |
| P11 | **Versi & perubahan tercatat** — versi sumber, artefak induk, build; perubahan sumber memicu analisa dampak. | Header versi di artefak; TC terdampak ditandai. |
| P12 | **Review manusia & learning terukur** — hasil menjadi evidence setelah direview; koreksi & defect lolos masuk learning. | Laporan final mencatat reviewer & koreksi. |

## 2. Modul

| Modul | Status | Output di `work/<ALIAS>/<fitur>/` |
| --- | --- | --- |
| M0 Intake | Wajib | `00-scope.md` (via `python3 scripts/qa_feature.py init <fitur>`) |
| M1 Analisa | Wajib | `01-analysis.md`, `01-questions.md` — skill `prd-analyzer-business` |
| M2 Test case | Wajib | `02-testcases.md` (+ `02-testcases.xlsx`) — skill `generate-testcase` |
| M3 Plan & data | Wajib bila ada eksekusi | `03-plan.md` (scope run, exit criteria, data set, binding) |
| M4a UI Web | Opsional | `runs/` — skill `browser-qa-execution` |
| M4b UI Mobile | Opsional | `runs/`, `plans/` — skill `mobile-qa-execution` |
| M4c API | Opsional (rancangan) | `runs/` — lihat `.agents/shared/standards/api-module-design.md` |
| M4d Database | Opsional | `runs/` — skill `database-qa-validation` |
| M5 Review & triage | Wajib bila ada eksekusi | koreksi status, `failure_category`, defect |
| M6 Laporan & verdict | Wajib bila ada eksekusi | `reports/` |
| M7 Dokumen formal | Opsional | `.docx`/`.pdf` — `convert-document` / `convert-with-calculation` |
| M8 Learning | Opsional, dipicu review/defect | `qa-review-learning` |

## 3. Profil aplikasi & rahasia

- `.env` root hanya berisi `QA_ACTIVE_PROFILE=<ALIAS>`. Semua runner membaca lewat `scripts/lib/qa-env.cjs`.
- `.secrets/<ALIAS>.env` — URL, package, akun (`USER_<ROLE>_<n>`/`PASS_<ROLE>_<n>`), DSN (`DB_<FUNGSI>_*`), batas host.
- `profiles/<ALIAS>/` — `profile.yaml`, `glossary.md`, `rbac/`, `knowledge/{web,mobile,api,db}/`, `data/`.
- Alias: aplikasi `APP_<HURUF>`, akun `<ROLE>_<n>`, DB `db:<fungsi>` (`db:main` → MCP target `primary`).
- Yang di-commit hanya workflow agnostik + `profiles/_template/`. Profil, work, evidence, rahasia selalu lokal.
- `scripts/qa_guard_scan.py` (pre-commit) menolak rahasia, istilah di `.secrets/denylist.txt`, dan path artefak.

## 4. Peran (D7)

User yang menjalankan workflow adalah reviewer dan pemutus verdict (penghubung QA Lead dan PM). Namanya diambil dari
`git config user.name` dan dicatat di `review.json` serta laporan. Tanpa review, laporan berlabel `DRAFT`.

## 5. Standar rinci

- Analisa: `.agents/shared/standards/analysis.md`
- Test case: `.agents/shared/standards/testcase.md`
- Status, verdict & evidence: `.agents/shared/standards/status-verdict-evidence.md`
- Modul API (rancangan): `.agents/shared/standards/api-module-design.md`
