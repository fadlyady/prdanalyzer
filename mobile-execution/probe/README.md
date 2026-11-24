# Mobile QA Probe (Phase 0) — Android

Alur: buka app → lewati layar izin pelacakan → isi email & password dari `.env` → Login → analisa home: tab atas, ikon app bar (menu/filter/search), dan tiap menu drawer level 1 (read-only). Hasil struktur juga disalin ke `doc-analyzer/strukturmenu/mobile-apps/live-analyzer/`.

Probe ini dijalankan **sekali** sebelum skill `mobile-qa-execution` dibangun, untuk mengukur seberapa "terbaca" aplikasi profil aktif (Flutter) oleh Appium.
Semua aksi bersifat **read-only** (login + navigasi). Tombol berlabel mutasi (hapus/buat/simpan/kirim/logout, dst.) otomatis dilewati.

## 1. Persiapan Mac (sekali saja)

```bash
# Java 17
brew install --cask temurin@17
# Android command-line tools + platform-tools (adb) + build-tools (aapt2/apksigner)
brew install --cask android-commandlinetools
sdkmanager "platform-tools" "build-tools;35.0.0"
# Appium 2/3 + driver Android
npm install -g appium
appium driver install uiautomator2
```

Tambahkan ke `~/.zshrc` lalu buka terminal baru:

```bash
export JAVA_HOME=$(/usr/libexec/java_home)
export ANDROID_HOME=$(brew --prefix)/share/android-commandlinetools
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

## 2. Persiapan HP (real device)

1. Settings > About phone > ketuk **Build number** 7x untuk membuka Developer options.
2. Developer options: aktifkan **USB debugging** dan **Stay awake**.
3. Xiaomi/Redmi/POCO: aktifkan juga **USB debugging (Security settings)** dan **Install via USB** (butuh SIM + login Mi Account).
4. Colok USB, setujui dialog **Allow USB debugging** (centang *Always allow*).
5. Matikan screen lock selama pengujian; gunakan HP khusus QA.

## 3. Jalankan

```bash
cd mobile-execution/probe
npm install                 # sekali saja
bash setup_check.sh         # semua item harus OK (WARN boleh)
node probe.mjs --login      # tambah --install jika app belum terpasang / versi berbeda
```

Opsi:

| Flag | Default | Fungsi |
|---|---|---|
| `--login` | off | Login memakai `USER_/PASS_<ROLE>` dari `.env` |
| `--role` | `OWNER_1` | Suffix kredensial di `.env` |
| `--install` | off | Izinkan install/upgrade APK dari `build-apk/` (`adb install -r -g`) |
| `--deeplinks` | (kosong) | Opsional, hanya jika route app sudah dikonfirmasi dev, contoh `"/room/12345"` |
| `--fresh` | off | `pm clear` app staging sebelum mulai (sesi & data app di-reset, mulai dari layar awal) |
| `--att` | `decline` | Pilihan layar izin pelacakan sebelum login: `decline` (Jangan izinkan) / `grant` (Izinkan) |
| `--use-installed` | off | Pakai build yang sudah terpasang walau versinya berbeda dari APK |
| `--udid` | auto | Serial device jika lebih dari 1 HP terhubung |
| `--no-explore-tabs` | off | Jangan eksplorasi app setelah login |
| `--open-chat` | off | Buka chatroom ke-N di daftar (0 = teratas). Efek samping: pesan ditandai sudah dibaca |
| `--manual-wait` | `90` | Detik menunggu jika butuh OTP/aksi manual saat login |

Konfigurasi opsional di `.env`: `MOBILE_APP_PACKAGE_STAGING`, `MOBILE_APP_ACTIVITY`, `MOBILE_DEEPLINK_HOST`, `ANDROID_DEVICE_SERIAL`, `APPIUM_URL`.

## 4. Hasil

`mobile-execution/probe-result/probe_<timestamp>/`
- `probe_report.md` — ringkasan: device, Build Guard, status login, Testability Score per layar, hasil deep link, elemen tanpa label.
- `NN_<layar>.xml` + `.png` — page source (password di-mask `***`) dan screenshot per layar.

Kirim folder hasil ini (atau minta Claude membacanya) untuk menentukan locator profile Flutter pada skill.

## Keamanan

- Password tidak pernah dicetak ke terminal, laporan, maupun XML.
- Build Guard: hanya package di allowlist yang berakhiran `.stag` yang boleh dijalankan; jika app keluar ke app lain (browser, WhatsApp), probe mencatat dan kembali ke app staging.
