#!/usr/bin/env python3
"""Prueba Android real sin DevTools: instalar/cancelar/reanudar el GGUF.

Interacciona con la WebView como un usuario real mediante la accesibilidad
nativa y adb input tap. Nunca simula el resultado de una descarga.
El modelo de origen tiene SHA-256 comprobada antes de instalarlo.
"""
import hashlib
import json
import re
import subprocess
import time
from pathlib import Path
from xml.etree import ElementTree
from probar_emulador import APK, adb

ROOT = Path(__file__).resolve().parents[1]
GGUF = ROOT / "cache" / "qwen3-0.6b-q4_k_m.gguf"
OUT = ROOT / "evidencias"
PKG = "pe.myteacheria.alumno"
NAME = "qwen3-0.6b-q4_k_m.gguf"
HASH = "28b1c721c1e476d3e41c629d5993c0aaeca0f3b747afdbab667f5a4bc8e37665"
INITIAL_BYTES = 8 * 1048576
RESUME_BYTES = 460 * 1048576


def capture(name):
    OUT.mkdir(exist_ok=True)
    remote = "/sdcard/teacher-evidence.png"
    adb("shell", "screencap", "-p", remote, timeout=30, check=False)
    adb("pull", remote, str(OUT / name), timeout=40, check=False)


def dump_ui():
    adb("shell", "uiautomator", "dump", "/sdcard/teacher-ui.xml",
        timeout=80, check=False)
    value = adb("shell", "cat", "/sdcard/teacher-ui.xml",
                timeout=30, check=False)
    if "<hierarchy" not in value:
        return []
    try:
        tree = ElementTree.fromstring(value[value.index("<hierarchy"):])
    except ElementTree.ParseError:
        return []
    return [{
        "text": (n.attrib.get("text", "") + " " +
                 n.attrib.get("content-desc", "")).strip(),
        "bounds": n.attrib.get("bounds", ""),
        "enabled": n.attrib.get("enabled"),
        "class": n.attrib.get("class"),
    } for n in tree.iter("node")]


def tap(node):
    match = re.fullmatch(
        r"\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]",
        node["bounds"])
    if not match:
        raise AssertionError("Sin coordenadas para: " + str(node))
    x1, y1, x2, y2 = map(int, match.groups())
    adb("shell", "input", "tap", str((x1 + x2)//2),
        str((y1 + y2)//2), timeout=18)


def scroll(up=True):
    size = adb("shell", "wm", "size", check=False)
    dim = re.search(r"(\\d+)x(\\d+)", size)
    w, h = (int(dim[1]), int(dim[2])) if dim else (1080, 2400)
    start, end = ((0.80, 0.32) if up else (0.32, 0.80))
    adb("shell", "input", "swipe",
        str(w//2), str(int(h*start)),
        str(w//2), str(int(h*end)), "390", timeout=20)
    time.sleep(0.8)


def find_text(needle, *, scroll_page=False, timeout=60):
    begin = time.monotonic()
    scans = 0
    while time.monotonic() - begin < timeout:
        nodes = dump_ui()
        matching = [
            n for n in nodes if needle.lower() in n["text"].lower()
            and n["bounds"] and n["enabled"] != "false"
        ]
        if matching:
            return matching[0]
        if scans == 0 or scans % 5 == 0:
            print("Buscando botón", needle, "nodos visibles:",
                  [n["text"][:40] for n in nodes if n["text"]][:22],
                  flush=True)
        scans += 1
        if scroll_page:
            scroll(up=True)
        else:
            time.sleep(1)
    return None


def click(needle, *, scroll_page=False, timeout=70):
    node = find_text(needle, scroll_page=scroll_page, timeout=timeout)
    if not node:
        capture("error-boton-" + re.sub(r"[^a-z]", "", needle.lower())[:22] + ".png")
        raise AssertionError("No aparece el botón Android: " + needle)
    tap(node)
    print("Botón Android pulsado:", needle, node["bounds"], flush=True)


def file_bytes(name):
    location = "no_backup/modelos/" + name
    out = adb("shell", "run-as", PKG, "stat", "-c", "%s",
              location, timeout=35, check=False)
    if out.isdigit():
        return int(out)
    # Android toybox stat no está disponible de manera uniforme en SDK35.
    listing = adb("shell", "run-as", PKG, "ls", "-ln",
                  location, timeout=35, check=False)
    cols = listing.split()
    if len(cols) >= 5 and cols[4].isdigit():
        return int(cols[4])
    print("Archivo privado no encontrado (stat/ls):",
          repr(out), repr(listing), flush=True)
    return 0


def dd_partial(staging, mib):
    cmd = ["adb", "shell", "run-as", PKG, "dd", "if=" + staging,
           "of=no_backup/modelos/" + NAME + ".part",
           "bs=1048576", "count=" + str(mib)]
    cp = subprocess.run(cmd, capture_output=True, text=True, timeout=190)
    print("DD Android:", cp.returncode, cp.stdout[:550],
          cp.stderr[:900], flush=True)
    assert cp.returncode == 0, "No se pudo sembrar la parte real de GGUF"
    listing = adb("shell", "run-as", PKG, "ls", "-ln",
                  "no_backup/modelos", check=False)
    print("Ficheros privados Android:", listing[:650], flush=True)
    expected = mib * 1048576
    actual = file_bytes(NAME + ".part")
    assert actual == expected, f"Parte GGUF: {actual} en lugar de {expected}"


def approve_download():
    # La solicitud de consentimiento es real (Android WebView), no se puentea.
    for label in ("Aceptar", "OK", "Permitir", "Sí"):
        node = find_text(label, timeout=4)
        if node:
            tap(node)
            print("Descarga autorizada mediante diálogo:", label, flush=True)
            return
    raise AssertionError("No apareció confirmación de descarga")


def main():
    assert APK.exists() and GGUF.exists(), "APK o GGUF de CI ausente"
    assert GGUF.stat().st_size > RESUME_BYTES + 1048576
    with GGUF.open("rb") as source:
        assert hashlib.file_digest(source, "sha256").hexdigest() == HASH

    adb("install", "-r", str(APK), timeout=160)
    adb("shell", "am", "force-stop", PKG, check=False)
    start = adb("shell", "am", "start", "-W", "-n",
                PKG + "/.MainActivity", timeout=90)
    print("Inicio Android:", start, flush=True)
    time.sleep(6)
    assert adb("shell", "pidof", PKG, check=False), "La app no arrancó"
    capture("inicio-descarga.png")

    adb("shell", "run-as", PKG, "mkdir", "-p", "no_backup/modelos")
    staging = "/data/local/tmp/myteacher-real-download.gguf"
    print("Transfiriendo GGUF verificado al emulador temporalmente", flush=True)
    adb("push", str(GGUF), staging, timeout=300)
    try:
        dd_partial(staging, 8)
        adb("shell", "run-as", PKG, "rm", "-f",
            "no_backup/modelos/" + NAME, timeout=20)

        click("Estudiar sin conexión", scroll_page=True, timeout=85)
        time.sleep(3)
        capture("instalador-descarga.png")
        click("Descargar modelo", scroll_page=True, timeout=75)
        approve_download()

        click("Cancelar descarga", timeout=50)
        click("Descargar modelo", timeout=125)
        part_after = file_bytes(NAME + ".part")
        print("Bytes conservados tras cancelar:", part_after, flush=True)
        assert part_after >= INITIAL_BYTES, part_after
        assert file_bytes(NAME) == 0, "La descarga se completó antes de cancelar"

        # Ampliar la parte AUTÉNTICA para que Android descargue solo el
        # tramo final por HTTPS y valide el modelo entero por SHA-256.
        dd_partial(staging, 460)
        click("Descargar modelo", timeout=65)
        approve_download()

        deadline = time.monotonic() + 460
        while time.monotonic() < deadline:
            full = file_bytes(NAME)
            if full == GGUF.stat().st_size:
                break
            if full and full != GGUF.stat().st_size:
                raise AssertionError(f"Modelo final incompleto: {full}")
            time.sleep(5)
        assert file_bytes(NAME) == GGUF.stat().st_size, (
            "Android no finalizó la descarga reanudada")
        check = adb("shell", "run-as", PKG, "sha256sum",
                    "no_backup/modelos/" + NAME, timeout=210)
        assert check.split()[0] == HASH, "SHA-256 Android errónea"
        chat = find_text("Tutor local", timeout=70)
        assert chat, "No se habilitó chat después de instalar el modelo"
        capture("modelo-descargado.png")

        OUT.mkdir(exist_ok=True)
        report = {
            "source": "Hugging Face HTTPS", "source_sha256": HASH,
            "model_bytes": GGUF.stat().st_size, "initial_bytes": INITIAL_BYTES,
            "part_bytes_after_cancel": part_after,
            "resume_bytes": RESUME_BYTES, "cancel_ui_verified": True,
            "resume_ui_verified": True, "android_sha256_verified": True,
            "chat_available_after_install": True
        }
        (OUT / "modelo-descarga-real.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print("INSTALACIÓN, CANCELACIÓN Y REANUDACIÓN GGUF REAL CONFIRMADAS.", flush=True)
    except Exception:
        capture("fallo-descarga.png")
        nodes = dump_ui()
        (OUT / "arbol-accessibilidad.json").write_text(
            json.dumps(nodes, ensure_ascii=False, indent=2), encoding="utf-8")
        raise
    finally:
        adb("shell", "rm", "-f", staging, timeout=90, check=False)


if __name__ == "__main__":
    main()
