#!/usr/bin/env bash
# Prueba local de que el paquete Android acepta una firma de subida.
# La clave se crea de cero, se destruye al terminar y NO se distribuye.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UNSIGNED="$ROOT/mobile/android/app/build/outputs/bundle/release/app-release.aab"
test -s "$UNSIGNED"
test -n "${JAVA_HOME:-}"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT
PASSWORD="only_for_disposable_CI_signing_2026"
keytool -genkeypair -noprompt -keystore "$TEMP/ci.jks" \
  -storetype PKCS12 \
  -alias "myteacher-disposable-ci" \
  -storepass "$PASSWORD" -keypass "$PASSWORD" \
  -keyalg RSA -keysize 2048 -validity 2 \
  -dname "CN=My Teacher IA,OU=CI,O=Testing,C=PE" >/dev/null 2>&1
jarsigner -keystore "$TEMP/ci.jks" \
  -storepass "$PASSWORD" -keypass "$PASSWORD" \
  -signedjar "$TEMP/myteacher-ci-signed.aab" "$UNSIGNED" \
  myteacher-disposable-ci >/dev/null
jarsigner -verify "$TEMP/myteacher-ci-signed.aab" > "$TEMP/verification.txt" 2>&1
grep -q 'jar verified' "$TEMP/verification.txt"
unzip -tqq "$TEMP/myteacher-ci-signed.aab"
test "$(stat -c%s "$TEMP/myteacher-ci-signed.aab")" -gt 100000
# Asegurar que el canal de descarga directa también se pueda firmar.
UNSIGNED_APK="$ROOT/mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk"
test -s "$UNSIGNED_APK"
test -n "${ANDROID_HOME:-}"
APKSIGNER="$(find "$ANDROID_HOME/build-tools" -type f -name apksigner | sort -V | tail -n 1)"
test -x "$APKSIGNER"
BUILD_TOOLS="$(dirname "$APKSIGNER")"
"$BUILD_TOOLS/zipalign" -P 16 -f 4 "$UNSIGNED_APK" "$TEMP/aligned.apk"
"$APKSIGNER" sign --ks "$TEMP/ci.jks" --ks-key-alias myteacher-disposable-ci \\
  --ks-pass "pass:$PASSWORD" --key-pass "pass:$PASSWORD" \\
  --out "$TEMP/signed.apk" "$TEMP/aligned.apk"
"$APKSIGNER" verify --verbose "$TEMP/signed.apk"
"$BUILD_TOOLS/zipalign" -c -P 16 4 "$TEMP/signed.apk"
test -s "$TEMP/signed.apk"
echo 'Firma temporal APK comprobada; la clave de CI se destruye.'
echo 'Firma temporal AAB comprobada correctamente; no se guardó la clave de CI.'
echo 'El AAB de CI NO está firmado con clave de publicación ni listo para Google Play.'
