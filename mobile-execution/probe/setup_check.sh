#!/usr/bin/env bash
# Setup checker for mobile-qa-execution (Android, Phase 0).
# Read-only: only checks and prints guidance. Installs nothing.
set -u
PASS=0; FAIL=0; WARN=0
ok()   { printf "  \033[32m[OK]\033[0m   %s\n" "$1"; PASS=$((PASS+1)); }
bad()  { printf "  \033[31m[FAIL]\033[0m %s\n" "$1"; [ -n "${2:-}" ] && printf "         -> %s\n" "$2"; FAIL=$((FAIL+1)); }
warn() { printf "  \033[33m[WARN]\033[0m %s\n" "$1"; [ -n "${2:-}" ] && printf "         -> %s\n" "$2"; WARN=$((WARN+1)); }

echo "== 1. Runtime"
if command -v node >/dev/null; then
  NV=$(node -v | sed 's/v//; s/\..*//'); [ "$NV" -ge 18 ] && ok "Node $(node -v)" || bad "Node $(node -v) terlalu lama" "Butuh Node >= 18"
else bad "Node tidak ditemukan" "brew install node"; fi

if command -v java >/dev/null && java -version >/dev/null 2>&1; then
  ok "Java: $(java -version 2>&1 | head -1)"
  [ -n "${JAVA_HOME:-}" ] && ok "JAVA_HOME=$JAVA_HOME" || warn "JAVA_HOME belum di-set" 'export JAVA_HOME=$(/usr/libexec/java_home)  (tambahkan ke ~/.zshrc)'
else bad "Java JDK tidak ditemukan" "brew install --cask temurin@17  lalu  export JAVA_HOME=\$(/usr/libexec/java_home)"; fi

echo "== 2. Android SDK"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -n "$SDK" ] && [ -d "$SDK" ]; then ok "ANDROID_HOME=$SDK"
else bad "ANDROID_HOME / ANDROID_SDK_ROOT belum di-set" "brew install --cask android-commandlinetools ; export ANDROID_HOME=\$(brew --prefix)/share/android-commandlinetools ; sdkmanager \"platform-tools\" \"build-tools;35.0.0\""; fi
if command -v adb >/dev/null; then ok "adb: $(adb version | head -1)"
else bad "adb tidak ada di PATH" 'export PATH="$ANDROID_HOME/platform-tools:$PATH"'; fi
if [ -n "$SDK" ] && ls "$SDK"/build-tools/*/apksigner >/dev/null 2>&1; then ok "build-tools (apksigner) tersedia"
else warn "build-tools belum terpasang (dibutuhkan UiAutomator2 untuk verifikasi APK server)" "sdkmanager \"build-tools;35.0.0\""; fi

echo "== 3. Appium"
if command -v appium >/dev/null; then
  ok "Appium $(appium -v 2>/dev/null)"
  if appium driver list --installed 2>&1 | grep -qi uiautomator2; then ok "Driver uiautomator2 terpasang"
  else bad "Driver uiautomator2 belum terpasang" "appium driver install uiautomator2"; fi
else bad "Appium belum terpasang" "npm install -g appium && appium driver install uiautomator2"; fi
if [ -d "$(dirname "$0")/node_modules/webdriverio" ]; then ok "webdriverio terpasang (probe)"
else warn "Dependency probe belum terpasang" "cd mobile-execution/probe && npm install"; fi

echo "== 4. Device (USB)"
if command -v adb >/dev/null; then
  LIST=$(adb devices | tail -n +2 | grep -v '^\s*$')
  N_OK=$(echo "$LIST" | grep -c -w device || true)
  N_UNAUTH=$(echo "$LIST" | grep -c unauthorized || true)
  [ "$N_UNAUTH" -gt 0 ] && bad "$N_UNAUTH device 'unauthorized'" "Buka kunci HP dan setujui dialog 'Allow USB debugging' (centang Always allow)"
  if [ "$N_OK" -eq 0 ]; then bad "Tidak ada device terhubung" "Colok HP via USB, aktifkan Developer options > USB debugging"
  else
    [ "$N_OK" -gt 1 ] && warn "$N_OK device terhubung" "Probe akan meminta --udid <serial>"
    for S in $(echo "$LIST" | awk '$2=="device"{print $1}'); do
      BRAND=$(adb -s "$S" shell getprop ro.product.brand | tr -d '\r')
      MODEL=$(adb -s "$S" shell getprop ro.product.model | tr -d '\r')
      REL=$(adb -s "$S" shell getprop ro.build.version.release | tr -d '\r')
      SDKV=$(adb -s "$S" shell getprop ro.build.version.sdk | tr -d '\r')
      [ "$SDKV" -ge 28 ] && ok "$S : $BRAND $MODEL, Android $REL (API $SDKV)" || bad "$S : Android $REL (API $SDKV) < minSdk 28 app"
      case "$(echo "$BRAND" | tr 'A-Z' 'a-z')" in
        xiaomi|redmi|poco) warn "$S Xiaomi/Redmi/POCO" "Aktifkan juga 'USB debugging (Security settings)' & 'Install via USB' di Developer options";;
        oppo|realme|vivo|iqoo|oneplus) warn "$S $BRAND" "Cek opsi 'Disable permission monitoring' / 'Install via USB' di Developer options";;
      esac
      STAY=$(adb -s "$S" shell settings get global stay_on_while_plugged_in | tr -d '\r')
      [ "$STAY" != "0" ] && ok "$S Stay awake aktif" || warn "$S Stay awake nonaktif" "Developer options > Stay awake (layar tidak mati saat charging)"
      APP_PKG=$(cd "$(dirname "$0")/../.." && node -e "try{process.stdout.write(require('./scripts/lib/qa-env.cjs').readQaEnv(process.cwd()).MOBILE_APP_PACKAGE_STAGING||'')}catch(e){}" 2>/dev/null)
      APP_BASE=${APP_PKG%.*}
      PKG=$( [ -n "$APP_BASE" ] && adb -s "$S" shell pm list packages "$APP_BASE" | tr -d '\r' | sed 's/package://' | tr '\n' ' ')
      [ -n "$PKG" ] && ok "$S package aplikasi profil aktif terpasang: $PKG" || warn "$S app profil aktif belum terpasang (atau MOBILE_APP_PACKAGE_STAGING kosong)" "Probe bisa menginstal dengan flag --install"
    done
  fi
fi

echo
echo "Ringkasan: $PASS OK, $WARN WARN, $FAIL FAIL"
[ "$FAIL" -eq 0 ] && echo "Siap menjalankan probe: node probe.mjs --login" || echo "Perbaiki item FAIL terlebih dahulu."
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
