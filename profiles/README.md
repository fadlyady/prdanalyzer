# profiles/ — Profil Aplikasi (Pondasi P1, P8)

Satu folder per aplikasi, dinamai **alias** (`APP_A`, `APP_B`, ...). Workflow inti (skill, skrip, MCP) tidak pernah
menyebut nama aplikasi; semua yang spesifik aplikasi ada di sini.

- `profiles/_template/` — satu-satunya isi folder ini yang di-commit. Salin untuk aplikasi baru.
- `profiles/<ALIAS>/` — lokal (di-gitignore): knowledge UI/API/DB, data uji, RBAC, glosarium.
- Rahasia (URL, package, akun, DSN) **tidak** di sini, melainkan di `.secrets/<ALIAS>.env` (lokal, di-gitignore).

## Menambah aplikasi baru

1. `cp -R profiles/_template profiles/APP_B`
2. `cp profiles/_template/secrets.env.example .secrets/APP_B.env` lalu isi nilai asli.
3. Lengkapi `profiles/APP_B/profile.yaml` (platform, role, DB, path knowledge).
4. Aktifkan: set `QA_ACTIVE_PROFILE=APP_B` di `.env` root (atau `QA_ACTIVE_PROFILE=APP_B <perintah>` untuk sekali jalan).
5. Tambahkan istilah identitas aplikasi baru ke `.secrets/denylist.txt` agar penjaga commit menolaknya.

## Bagaimana profil aktif dipakai

- Semua runner & MCP membaca konfigurasi lewat `scripts/lib/qa-env.cjs`: `.env` (penunjuk) + `.secrets/<ALIAS>.env`.
- Skill membaca knowledge dari `profiles/<ALIAS>/knowledge/<layer>/` dan menulis artefak ke `work/<ALIAS>/<fitur>/`.
- Setiap `work/<ALIAS>/<fitur>/00-scope.md` mencatat alias, sehingga fitur lama tetap terikat ke profilnya.
