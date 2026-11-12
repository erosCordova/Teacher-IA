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

echo "Motor de IA local preparado: llama.cpp b12248, Android ABI ARM64 + x86_64."
