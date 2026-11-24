# work/ — Artefak kerja per fitur (lokal, tidak di-commit)

```
work/<ALIAS>/<fitur>/
  00-scope.md          M0 Intake: alias, kedalaman, modul dipilih, scope
  01-analysis.md       M1 Analisa (+ risk register)
  01-questions.md      pertanyaan terbuka untuk PM/stakeholder
  02-testcases.md      M2 Test case (sumber kebenaran) (+ 02-testcases.xlsx hasil ekspor)
  03-plan.md           M3 Plan & data (bila ada eksekusi)
  plans/               rencana eksekusi mobile (*.plan.json)
  runs/index.json      daftar run (run lama dirujuk ke lokasi asalnya)
  runs/run_<...>/      evidence run baru
  reports/             laporan & dokumen formal
```

- Mulai fitur baru: `python3 scripts/qa_feature.py init <nama-fitur>` (memakai profil aktif dari `.env`).
- Runner browser/mobile otomatis menulis evidence ke `runs/` fitur yang terdaftar; fitur yang belum di-`init`
  tetap memakai folder lama (`browser-execution/automate-result/`, `mobile-execution/automate-result/`).
- Isi folder ini memuat data aplikasi & hasil uji, sehingga di-gitignore; hanya README & .gitkeep yang di-commit.
