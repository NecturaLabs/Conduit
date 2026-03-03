#!/usr/bin/env bash
# Build, sign, and install the Conduit Android APK locally.
# Run from the repo root. Requires Java 21+ on PATH or JAVA_HOME set.
#
# Usage:
#   ./scripts/build-android-local.sh          # build + sign + push to connected device
#   ./scripts/build-android-local.sh --no-install  # build + sign only
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Convert MSYS/Git Bash path to Windows path for tools that need it
to_win() { cygpath -w "$1" 2>/dev/null || echo "$1"; }

KEYSTORE="$REPO_ROOT/conduit-release.keystore"
APK_OUT="$REPO_ROOT/apps/mobile/android/app/build/outputs/apk/release"
SIGNED_APK="$APK_OUT/conduit-signed.apk"
UNSIGNED_APK="$APK_OUT/app-release-unsigned.apk"

# ── Java ────────────────────────────────────────────────────────────────────
# Use full Temurin JDK 21 (has jlink) — not JBR which is JRE-only
# Override the default path via JDK21_HOME env var if your install location differs.
JDK21="${JDK21_HOME:-/tmp/jdk21/jdk-21.0.7+6}"
if [[ ! -f "$JDK21/bin/jlink.exe" ]]; then
  echo "ERROR: Full JDK 21 not found at $JDK21" >&2
  echo "Download: https://adoptium.net/temurin/releases/?version=21" >&2
  exit 1
fi
export JAVA_HOME="$JDK21"
export PATH="$JDK21/bin:$PATH"
echo "Using Java: $("$JDK21/bin/java.exe" -version 2>&1 | head -1)"

# ── Android SDK ─────────────────────────────────────────────────────────────
if [[ -z "${ANDROID_HOME:-}" ]]; then
  export ANDROID_HOME="$HOME/Android/Sdk"
fi
echo "Android SDK: $ANDROID_HOME"

# ── Keystore ────────────────────────────────────────────────────────────────
if [[ ! -f "$KEYSTORE" ]]; then
  echo "ERROR: Keystore not found at $KEYSTORE" >&2
  echo "Run: ./scripts/generate-keystore.sh" >&2
  exit 1
fi

# Load passwords from .env.android if present, else prompt
ENV_FILE="$REPO_ROOT/.env.android"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi
STORE_PASS="${ANDROID_STORE_PASSWORD:-}"
KEY_PASS="${ANDROID_KEY_PASSWORD:-}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-conduit}"
if [[ -z "$STORE_PASS" ]]; then
  read -rsp "Keystore password: " STORE_PASS; echo
fi
if [[ -z "$KEY_PASS" ]]; then
  read -rsp "Key password: " KEY_PASS; echo
fi

# ── Build ────────────────────────────────────────────────────────────────────
echo ""
echo "1/4  Building shared package..."
cd "$REPO_ROOT/packages/shared" && bun run build

echo "2/4  Building web app (mobile mode)..."
cd "$REPO_ROOT/apps/web" && VITE_MOBILE=true bun run build

echo "3/4  Syncing Capacitor..."
cd "$REPO_ROOT/apps/mobile" && bunx cap sync android

echo "4/4  Building APK..."
cd "$REPO_ROOT/apps/mobile/android"
chmod +x gradlew
JAVA_HOME="$(to_win "$JDK21")" ./gradlew assembleRelease --no-daemon

# ── Sign ─────────────────────────────────────────────────────────────────────
echo ""
echo "Signing APK..."
APKSIGNER="$(ls "$ANDROID_HOME/build-tools"/*/apksigner.bat 2>/dev/null | sort -V | tail -1)"
if [[ -z "$APKSIGNER" ]]; then
  APKSIGNER="$(ls "$ANDROID_HOME/build-tools"/*/apksigner 2>/dev/null | sort -V | tail -1)"
fi
if [[ -z "$APKSIGNER" ]]; then
  echo "ERROR: apksigner not found in $ANDROID_HOME/build-tools" >&2
  exit 1
fi
"$APKSIGNER" sign \
  --ks "$(to_win "$KEYSTORE")" \
  --ks-key-alias "$KEY_ALIAS" \
  --ks-pass "pass:$STORE_PASS" \
  --key-pass "pass:$KEY_PASS" \
  --out "$(to_win "$SIGNED_APK")" \
  "$(to_win "$UNSIGNED_APK")"

echo "Signed APK: $SIGNED_APK"

# ── Install ──────────────────────────────────────────────────────────────────
if [[ "${1:-}" != "--no-install" ]]; then
  ADB="$ANDROID_HOME/platform-tools/adb.exe"
  if [[ ! -f "$ADB" ]]; then ADB="/tmp/platform-tools/adb.exe"; fi
  echo ""
  echo "Installing to connected device..."
  MSYS_NO_PATHCONV=1 "$ADB" install -r "$(to_win "$SIGNED_APK")"
  echo "Done. Launching app..."
  MSYS_NO_PATHCONV=1 "$ADB" shell monkey -p com.conduit.app -c android.intent.category.LAUNCHER 1
fi
