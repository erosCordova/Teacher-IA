#!/usr/bin/env python3
"""Auditoría de seguridad del APK *release SIN FIRMAR* generado por CI.

Rechaza copias de seguridad automáticas de alumnos, depuración WebView
en producción, HTTP claro, secretos incrustados y modelos GGUF incluidos.
No firma APK/AAB ni publica aplicaciones en Google Play.
"""
import json
import os
import re
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APK = ROOT / "android/app/build/outputs/apk/release/app-release-unsigned.apk"
AAB = ROOT / "android/app/build/outputs/bundle/release/app-release.aab"
EVIDENCE = ROOT / "evidencias/seguridad-release.json"

def run(*cmd: str) -> str:
    completed = subprocess.run(cmd, text=True, capture_output=True, check=True)
    return completed.stdout

def main() -> None:
    assert APK.is_file() and AAB.is_file(), "Falta APK release o AAB sin firmar"
    home = Path(os.environ["ANDROID_HOME"])
    tools = sorted((home / "build-tools").glob("*/aapt"))
    assert tools, "Android Build Tools no incluye aapt"
    aapt = str(tools[-1])
    manifest = run(aapt, "dump", "xmltree", str(APK), "AndroidManifest.xml")
    badging = run(aapt, "dump", "badging", str(APK))
    assert "package: name='pe.myteacheria.alumno'" in badging, "Paquete Android inesperado"

    application = manifest[manifest.index("E: application"):]
    flags = {
        "allowBackup": r"android:allowBackup[^\\n]*",
        "fullBackupContent": r"android:fullBackupContent[^\\n]*",
        "debuggable": r"android:debuggable[^\\n]*",
        "usesCleartextTraffic": r"android:usesCleartextTraffic[^\\n]*",
    }
    found = {key: (re.search(pattern, application).group(0)
                    if re.search(pattern, application) else "")
             for key, pattern in flags.items()}
    assert found["allowBackup"] and re.search(r"0x0(?:\\s|$)", found["allowBackup"]), found
    assert found["fullBackupContent"] and re.search(r"0x0(?:\\s|$)", found["fullBackupContent"]), found
    for key in ("debuggable", "usesCleartextTraffic"):
        assert not found[key] or re.search(r"0x0(?:\\s|$)", found[key]), found
    assert "android.permission.INTERNET" in badging, "El chat en línea necesita Internet"

    with zipfile.ZipFile(APK) as apk:
        names = apk.namelist()
        assert "lib/arm64-v8a/libteacher_llama.so" in names, "Falta IA nativa ARM64"
        assert "lib/x86_64/libteacher_llama.so" in names, "Falta IA nativa de pruebas"
        assert not any(x.endswith((".gguf", ".safetensors", ".onnx", ".env"))
                       for x in names), "No incluir modelos/secretos en APK"
        asset_names = [x for x in names if x.startswith("assets/public/")]
        assert asset_names, "Falta la interfaz empaquetada"
        assets = b"\\n".join(apk.read(name) for name in asset_names
                            if name.endswith((".html", ".js", ".css")))
        assert b"VITE_ANDROID_CI_TESTS" not in assets, "No publicar variables de CI"
        assert b"ClaveAndroidCI_2026_Alumno" not in assets, "No publicar claves del CI"
        assert b"http://localhost:8010" not in assets, "No empaquetar API efímera del CI"

    source = (ROOT / "native/android/MainActivity.java").read_text(encoding="utf-8")
    assert "ApplicationInfo.FLAG_DEBUGGABLE" in source, "DevTools debe quedar restringido a debug"
    assert "WebView.setWebContentsDebuggingEnabled(true)" in source
    size = APK.stat().st_size
    assert size < 120_000_000, "APK contiene recursos demasiado grandes"
    report = {
        "status": "passed",
        "publication_ready": False,
        "signed": False,
        "release_debuggable": False,
        "release_cleartext_http": False,
        "android_auto_backup": False,
        "android_full_backup": False,
        "arm64_jni_available": True,
        "downloaded_model_embedded": False,
        "apk_size_bytes": size,
        "aab_size_bytes": AAB.stat().st_size,
        "test_credentials_embedded": False,
    }
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\\n",
                        encoding="utf-8")
    print("AUDITORÍA DE PRIVACIDAD APK RELEASE SUPERADA:", json.dumps(report))

if __name__ == "__main__":
    main()
