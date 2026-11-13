#!/usr/bin/env python3
"""Auditoría de seguridad del APK *release SIN FIRMAR* generado por CI.

Rechaza copias de seguridad automáticas de alumnos, depuración WebView
en producción, HTTP claro, secretos incrustados y modelos GGUF incluidos.
No firma APK/AAB ni publica aplicaciones en Google Play.
"""
import json
import os
import re
import struct
import subprocess
import zipfile
from pathlib import Path
from xml.etree import ElementTree

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
        "allowBackup": r"android:allowBackup[^\n]*",
        "dataExtractionRules": r"android:dataExtractionRules[^\n]*",
        "fullBackupContent": r"android:fullBackupContent[^\n]*",
        "debuggable": r"android:debuggable[^\n]*",
        "usesCleartextTraffic": r"android:usesCleartextTraffic[^\n]*",
    }
    found = {key: (re.search(pattern, application).group(0)
                    if re.search(pattern, application) else "")
             for key, pattern in flags.items()}
    assert found["allowBackup"] and re.search(r"0x0(?:\s|$)", found["allowBackup"]), found
    assert found["fullBackupContent"] and re.search(r"0x0(?:\s|$)", found["fullBackupContent"]), found
    assert found["dataExtractionRules"], "Faltan reglas de migración Android 12+"
    for key in ("debuggable", "usesCleartextTraffic"):
        assert not found[key] or re.search(r"0x0(?:\s|$)", found[key]), found
    assert "android.permission.INTERNET" in badging, "El chat en línea necesita Internet"
    permissions_prohibited = (
        "READ_CONTACTS", "WRITE_CONTACTS", "READ_SMS", "SEND_SMS",
        "READ_CALL_LOG", "ACCESS_FINE_LOCATION", "ACCESS_BACKGROUND_LOCATION",
        "MANAGE_EXTERNAL_STORAGE", "QUERY_ALL_PACKAGES", "READ_PHONE_STATE",
    )
    for permission in permissions_prohibited:
        assert not re.search(r"uses-permission: name='android\\.permission\\." +
                             permission + "'", badging), (
            "El APK no debe solicitar el permiso " + permission)


    with zipfile.ZipFile(APK) as apk:
        names = apk.namelist()
        assert "lib/arm64-v8a/libteacher_llama.so" in names, "Falta IA nativa ARM64"
        assert "lib/x86_64/libteacher_llama.so" in names, "Falta IA nativa de pruebas"
        # Máquina ELF: ARM64=183, x86_64=62; evitar una biblioteca
        # con nombre de arquitectura correcto pero bytes incompatibles.
        for abi, machine in (("arm64-v8a", 183), ("x86_64", 62)):
            native = apk.read("lib/" + abi + "/libteacher_llama.so")
            assert native[:4] == b"\\x7fELF" and native[4] == 2 and native[5] == 1, (
                "La biblioteca no es ELF64 de tipo little-endian: " + abi)
            assert struct.unpack_from("<H", native, 18)[0] == machine, (
                "Arquitectura ELF incorrecta para " + abi)

        assert not any(x.endswith((".gguf", ".safetensors", ".onnx", ".env"))
                       for x in names), "No incluir modelos/secretos en APK"
        assert "res/xml/data_extraction_rules.xml" in names, (
            "Las reglas de transferencia privada no se incorporaron al APK")
        # Evaluar el manifiesto binario y el XML declarado en el proyecto.
        # Para Android 12+ los dos modos requieren exclusiones explícitas.
        source_rules = (ROOT / "native/android/res/xml/data_extraction_rules.xml")
        xml_rules = ElementTree.parse(source_rules).getroot()
        assert xml_rules.tag == "data-extraction-rules", "XML no válido"
        required = {"root", "file", "database", "sharedpref", "external"}
        for mode in ("cloud-backup", "device-transfer"):
            branch = xml_rules.find(mode)
            assert branch is not None, "Falta protección " + mode
            excluded = {x.attrib.get("domain") for x in branch.findall("exclude")
                        if x.attrib.get("path") in (".", "./")}
            assert required <= excluded, (
                "Las reglas " + mode + " permiten transferir datos sensibles")
        asset_names = [x for x in names if x.startswith("assets/public/")]
        assert asset_names, "Falta la interfaz empaquetada"
        assets = b"\n".join(apk.read(name) for name in asset_names
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
        "android_12_cloud_backup_excluded": True,
        "android_12_device_to_device_excluded": True,
        "arm64_jni_available": True,
        "arm64_elf_verified": True,
        "emulator_x86_64_elf_verified": True,
        "unnecessary_sensitive_permissions_absent": True,
        "downloaded_model_embedded": False,
        "apk_size_bytes": size,
        "aab_size_bytes": AAB.stat().st_size,
        "test_credentials_embedded": False,
    }
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    print("AUDITORÍA DE PRIVACIDAD APK RELEASE SUPERADA:", json.dumps(report))

if __name__ == "__main__":
    main()
