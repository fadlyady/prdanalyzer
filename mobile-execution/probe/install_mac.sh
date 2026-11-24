#!/usr/bin/env bash
# One-shot installer (macOS) untuk mobile-qa-execution: Android SDK + Appium + uiautomator2.
# Aman dijalankan berulang (idempotent). Jalankan: bash install_mac.sh
set -e
step() { printf "\n\033[36m==> %s\033[0m\n" "$1"; }
[ "$(uname)" = "Darwin" ] || { echo "Script ini khusus macOS."; exit 1; }
command -v brew >/dev/null || { echo "Homebrew belum ada. Install dulu: https://brew.sh"; exit 1; }
command -v npm  >/dev/null || { echo "npm/Node belum ada: brew install node"; exit 1; }

step "1/5 Android command-line tools"
if brew list --cask android-commandlinetools >/dev/null 2>&1; then echo "Sudah terpasang."
else brew install --cask android-commandlinetools; fi

BREW_PREFIX=$(brew --prefix)
export JAVA_HOME=$(/usr/libexec/java_home)
export ANDROID_HOME="$BREW_PREFIX/share/android-commandlinetools"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

step "2/5 Environment variable di ~/.zshrc"
MARK="# >>> mobile-qa-execution env >>>"
if grep -qF "$MARK" ~/.zshrc 2>/dev/null; then echo "Sudah ada di ~/.zshrc."
else
  cat >> ~/.zshrc <<ZRC

$MARK
export JAVA_HOME=\$(/usr/libexec/java_home)
export ANDROID_HOME="$ANDROID_HOME"
export ANDROID_SDK_ROOT="\$ANDROID_HOME"
export PATH="\$ANDROID_HOME/platform-tools:\$PATH"
# <<< mobile-qa-execution env <<<
ZRC
  echo "Ditambahkan ke ~/.zshrc."
fi

step "3/5 SDK packages (platform-tools, build-tools 35)"
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses >/dev/null || true
sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "build-tools;35.0.0"

step "4/5 Appium + driver uiautomator2"
# Hindari EACCES: jika folder global npm (mis. /usr/local) tidak bisa ditulis user, pindahkan prefix ke ~/.npm-global (tanpa sudo).
NPM_BIN="$(npm prefix -g)/bin"
if [ ! -w "$NPM_BIN" ] || [ ! -w "$(npm prefix -g)/lib/node_modules" ]; then
  echo "Folder global npm ($NPM_BIN) butuh izin root -> pindah ke ~/.npm-global"
  mkdir -p "$HOME/.npm-global"
  npm config set prefix "$HOME/.npm-global"
  NMARK="# >>> npm-global path >>>"
  grep -qF "$NMARK" ~/.zshrc 2>/dev/null || printf '\n%s\nexport PATH="$HOME/.npm-global/bin:$PATH"\n# <<< npm-global path <<<\n' "$NMARK" >> ~/.zshrc
fi
export PATH="$HOME/.npm-global/bin:$PATH"
if command -v appium >/dev/null; then echo "Appium $(appium -v) sudah ada."
else npm install -g appium; fi
if appium driver list --installed 2>&1 | grep -qi uiautomator2; then echo "Driver uiautomator2 sudah ada."
else appium driver install uiautomator2; fi

step "5/5 Cek adb ganda"
adb kill-server >/dev/null 2>&1 || true
echo "adb aktif: $(command -v adb)"
if brew list --cask android-platform-tools >/dev/null 2>&1; then
  echo "PERHATIAN: cask 'android-platform-tools' juga terpasang (adb kedua)."
  echo "Jika muncul 'adb server version doesn't match', jalankan: brew uninstall --cask android-platform-tools"
fi
adb devices -l

step "Dependency MCP mobile-qa-guard"
(cd "$(dirname "$0")/../../mcp-server-mobile-qa" && npm install --no-audit --no-fund)

step "Menjalankan setup_check.sh"
cd "$(dirname "$0")"
[ -d node_modules/webdriverio ] || npm install --no-audit --no-fund
bash setup_check.sh || true
printf "\nSelesai. Buka terminal baru (atau 'source ~/.zshrc') sebelum menjalankan probe:\n  node probe.mjs --udid <SERIAL_HP> --login\n"
