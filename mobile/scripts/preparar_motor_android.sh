#!/usr/bin/env bash
# Se usa exclusivamente en GitHub Actions. No altera el backend ni Render.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT/mobile/android/app"
CPP="$APP/src/main/cpp"

test -f "$APP/build.gradle" || { echo "Falta el proyecto generado por Capacitor"; exit 1; }
mkdir -p "$CPP"
cp "$ROOT/mobile/native/cpp/CMakeLists.txt" "$CPP/CMakeLists.txt"
cp "$ROOT/mobile/native/cpp/teacher_llama.cpp" "$CPP/teacher_llama.cpp"

# Release exacta: evitar cambios inesperados y roturas por usar main.
git clone --quiet --depth 1 --branch b12248 \
  https://github.com/ggml-org/llama.cpp.git "$CPP/llama.cpp"
test -f "$CPP/llama.cpp/include/llama.h"

# Capacitor genera build.gradle en cada CI; la configuración se inyecta
# después para no versionar la plataforma Android generada.
cat >> "$APP/build.gradle" <<'GRADLE'

// Inicio de sesión nativo: no cargar cuentas Google en WebView.
// Versiones estables fijadas para reproducibilidad en Android y CI.
dependencies {
    implementation 'androidx.credentials:credentials:1.6.0'
    implementation 'androidx.credentials:credentials-play-services-auth:1.6.0'
    implementation 'com.google.android.libraries.identity.googleid:googleid:1.2.1'
}

// Motor offline por JNI. Se incluyen ambas ABI para prueba en emulador
// x86_64 y para teléfonos arm64-v8a.
android {
    defaultConfig {
        ndk {
            abiFilters 'arm64-v8a', 'x86_64'
        }
    }
    externalNativeBuild {
        cmake {
            path file('src/main/cpp/CMakeLists.txt')
        }
    }
}
GRADLE

MANIFEST="$APP/src/main/AndroidManifest.xml"
test -f "$MANIFEST"
if ! grep -q 'android.permission.RECORD_AUDIO' "$MANIFEST"; then
  sed -i '/<application/i\    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-feature android:name="android.hardware.microphone" android:required="false" />\n    <queries>\n      <intent><action android:name="android.speech.RecognitionService" /></intent>\n      <intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>\n    </queries>' "$MANIFEST"
fi

# Reglas específicas para Android 12+: algunos fabricantes permiten
# transferencia de datos entre teléfonos pese a allowBackup="false".
XML_DIR="$APP/src/main/res/xml"
mkdir -p "$XML_DIR"
cp "$ROOT/mobile/native/android/res/xml/data_extraction_rules.xml" \
  "$XML_DIR/data_extraction_rules.xml"

# Los datos educativos, los tokens y las preferencias de la WebView
# no deben salir por Android Auto Backup ni por una extracción adb.
# El manifest pertenece al proyecto Android generado por Capacitor.
python3 - "$MANIFEST" <<'PY'
from pathlib import Path
import re
import sys
path = Path(sys.argv[1])
s = path.read_text(encoding="utf-8")
assert "<application" in s, "Falta aplicación Android"
s, n = re.subn(r"<application\b([^>]*)>", lambda m: "<application" + (
    re.sub(r'\s+android:(allowBackup|fullBackupContent|dataExtractionRules)="[^"]*"', "", m.group(1))
    ) + ' android:allowBackup="false" android:fullBackupContent="false" android:dataExtractionRules="@xml/data_extraction_rules">',
    s, count=1)
assert n == 1, "No se pudieron deshabilitar copias de seguridad"
path.write_text(s, encoding="utf-8")
PY

echo "Motor de IA local preparado: llama.cpp b12248, Android ABI ARM64 + x86_64."
