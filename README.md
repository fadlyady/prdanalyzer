# PRD Analyzer & QA Workflow (Agnostik)

Workflow QA berbasis AI agent untuk siklus SDLC: dari dokumen kebutuhan sampai test case, eksekusi (web, mobile, API, DB),
review, verdict, dan pembelajaran — **satu repo untuk banyak aplikasi**. Acuan tertinggi: [`.agents/shared/FOUNDATION.md`](.agents/shared/FOUNDATION.md).

## Prinsip singkat

- **Agnostik:** skill & skrip tidak menyebut aplikasi apa pun; yang spesifik aplikasi ada di profil lokal `profiles/<ALIAS>/`.
- **Inti wajib, sisanya modular:** Intake → Analisa → Test case selalu ada; eksekusi dipilih sesuai kebutuhan
  (mis. PRD → TC → UI saja, atau PRD → TC → DB saja). Verdict selalu menyebut scope.
- **Rahasia tidak keluar:** nilai asli hanya di `.secrets/<ALIAS>.env` dan dibaca runner/MCP; artefak memakai alias.
- **Evidence jujur:** tidak ada hasil default; status & verdict mengikuti standar bersama; review oleh user yang menjalankan workflow.

## Struktur

```text
.agents/
  shared/FOUNDATION.md            Pondasi (prinsip, modul, profil, peran)
  shared/standards/               analysis.md · testcase.md · status-verdict-evidence.md · api-module-design.md
  skills/                         prd-analyzer-business · generate-testcase · convert-document · convert-with-calculation
                                  browser-qa-execution · mobile-qa-execution · database-qa-validation · qa-review-learning
profiles/_template/               template profil aplikasi (satu-satunya isi profiles/ yang di-commit)
profiles/<ALIAS>/                 LOKAL: profile.yaml, glossary, rbac, knowledge/{web,mobile,api,db}, data
.secrets/<ALIAS>.env              LOKAL: URL, package, akun USER_<ROLE>_<n>, DSN DB_<FUNGSI>_*
work/<ALIAS>/<fitur>/             LOKAL: 00-scope, 01-analysis, 01-questions, 02-testcases(.md/.xlsx), 03-plan, plans/, runs/, reports/
scripts/lib/qa-env.cjs            pembaca konfigurasi tunggal (.env -> QA_ACTIVE_PROFILE -> .secrets/<ALIAS>.env)
scripts/qa_feature.py             where | list | init <fitur>  (M0 Intake)
scripts/tc_export_xlsx.py         02-testcases.md -> .xlsx (15 kolom lama + 6 kolom baru), --verify
scripts/qa_guard_scan.py          penjaga commit (dipanggil .githooks/pre-commit)
mcp-server-browser-qa/            MCP guard browser (Chrome CDP)
mcp-server-mobile-qa/             MCP guard Android (Appium) + plan runner
mcp-server-database-qa/           MCP PostgreSQL read-only (Go)
templates/work-feature/           template 00-scope.md
Testcase-support/qa-learnings.md  pembelajaran generik (tanpa data aplikasi)
knowledge-review/                 template input review/walkthrough
```

## Mulai

1. Instal dependensi: `pip3 install -r requirements.txt` dan `npm install` (root, `mcp-server-mobile-qa/` bila memakai mobile).
2. Aktifkan penjaga commit: `git config core.hooksPath .githooks`.
3. Buat profil aplikasi:
   ```bash
   cp -R profiles/_template profiles/APP_A
   mkdir -p .secrets && cp profiles/_template/secrets.env.example .secrets/APP_A.env   # isi nilai asli
   echo "QA_ACTIVE_PROFILE=APP_A" > .env
   python3 scripts/qa_feature.py where
   ```
   Tambahkan istilah identitas aplikasi ke `.secrets/denylist.txt` (satu per baris).
4. Mulai fitur: `python3 scripts/qa_feature.py init <nama-fitur>` lalu jalankan skill sesuai modul:

| Modul | Skill | Output utama |
| --- | --- | --- |
| M1 Analisa | `prd-analyzer-business` | `01-analysis.md`, `01-questions.md` |
| M2 Test case | `generate-testcase` | `02-testcases.md` + `02-testcases.xlsx` |
| M4a UI Web | `browser-qa-execution` | `runs/`, `reports/` |
| M4b UI Mobile | `mobile-qa-execution` | `plans/`, `runs/`, `reports/` |
| M4d Database | `database-qa-validation` | bukti DB di folder run |
| M7 Dokumen formal | `convert-document` / `convert-with-calculation` | `.docx` / `.pdf` |
| M8 Learning | `qa-review-learning` | `qa-learnings.md` / `profiles/<ALIAS>/learnings.md` |

Panduan langkah demi langkah: `PANDUAN_PENGGUNAAN_QA_SKILLS.md`.

## Yang tidak pernah di-commit

`.env`, `.secrets/`, `profiles/<ALIAS>/`, `work/`, evidence run (`*/automate-result/`, `probe-result/`), APK, video, log,
dan `.backup/`. Pre-commit menolak file tersebut, nilai rahasia, istilah di denylist, serta pola token/password.
