#!/usr/bin/env python3
"""Descarga real desde React/Capacitor: cancelar, reanudar y comprobar SHA-256.

La primera descarga se acelera sembrando un archivo .part con bytes
AUTÉNTICOS del GGUF verificado, y se exige que Android descargue el resto
por HTTPS para reconstruir el fichero correcto. No se falsea la respuesta
del plugin ni se sustituye el servidor de Hugging Face.
"""
import hashlib
import json
import re
import subprocess
import time
import urllib.request
from pathlib import Path
from websocket import create_connection
from probar_emulador import APK, adb, eval_js

ROOT = Path(__file__).resolve().parents[1]
GGUF = ROOT / "cache" / "qwen3-0.6b-q4_k_m.gguf"
OUT = ROOT / "evidencias"
PKG = "pe.myteacheria.alumno"
NAME = "qwen3-0.6b-q4_k_m.gguf"
HASH = "28b1c721c1e476d3e41c629d5993c0aaeca0f3b747afdbab667f5a4bc8e37665"
PART_BYTES = 460 * 1048576

def find_android_webview():
    """Explorar sockets reales: el último no siempre pertenece a la app."""
    for attempt in range(38):
        socket_list = adb("shell", "cat", "/proc/net/unix", timeout=35, check=False)
        sockets = list(dict.fromkeys(re.findall(
            r"webview_devtools_remote_\\d+", socket_list)))
        for socket in reversed(sockets):
            try:
                adb("forward", "tcp:9222", "localabstract:" + socket,
                    timeout=12)
                with urllib.request.urlopen(
                        "http://127.0.0.1:9222/json", timeout=3) as resp:
                    pages = json.load(resp)
                for page in pages:
                    if page.get("type") != "page":
                        continue
                    if page.get("webSocketDebuggerUrl") and (
                            page.get("url", "").startswith("http://localhost")
                            or "My Teacher IA" in page.get("title", "")):
                        return page
            except (OSError, ValueError, KeyError):
                continue
        if attempt in (0, 8, 20, 30):
            print("Buscando WebView de My Teacher IA:", attempt,
                  "sockets:", sockets, flush=True)
            current = adb("shell", "dumpsys", "activity", "activities",
                          check=False, timeout=25)
            print("Actividad Android:", current[-650:], flush=True)
            # Si el sistema perdió la actividad tras copiar 484 MB, reabrir.
            adb("shell", "am", "start", "-n", PKG + "/.MainActivity",
                check=False, timeout=20)
        time.sleep(3)
    OUT.mkdir(exist_ok=True)
    errors = subprocess.run(
        ["adb", "logcat", "-d", "-t", "6000"],
        capture_output=True, text=True, timeout=35)
    (OUT / "fallo-webview-android.txt").write_text(
        errors.stdout[-20000:], encoding="utf-8")
    raise RuntimeError("WebView Android no accesible; consultar fallo-webview-android.txt")

def main():
    assert APK.exists(), "APK no compilado"
    assert GGUF.is_file() and GGUF.stat().st_size > PART_BYTES + 1024 * 1024
    with GGUF.open("rb") as src:
        assert hashlib.file_digest(src, "sha256").hexdigest() == HASH
    print("Preparando prueba de reanudación con GGUF completo y verificado", flush=True)
    adb("install", "-r", str(APK), timeout=160)
    adb("shell", "am", "force-stop", PKG, check=False)
    # En API35 inicializar WebView antes de copiar cientos de megabytes.
    # Es el mismo orden que la prueba GGUF real previamente aprobada.
    first_start = adb("shell", "am", "start", "-W", "-n",
                      PKG + "/.MainActivity", timeout=90)
    print("Arranque inicial Android:", first_start, flush=True)
    time.sleep(9)
    pid = adb("shell", "pidof", PKG, check=False)
    print("Proceso Android inicial:", pid, flush=True)
    assert pid.strip(), "Android no arrancó My Teacher IA antes del fichero parcial"
    adb("shell", "run-as", PKG, "mkdir", "-p", "no_backup/modelos")
    staging = "/data/local/tmp/myteacher-full-download-verify.gguf"
    print("Transfiriendo fichero real temporalmente al emulador…", flush=True)
    print(adb("push", str(GGUF), staging, timeout=250), flush=True)
    try:
        # El archivo final NO se instala: solo se escriben los primeros
        # ~482 MB en .part. Los bytes finales se descargan de verdad.
        adb("shell", "run-as", PKG, "dd", "if=" + staging,
            "of=no_backup/modelos/" + NAME + ".part",
            "bs=1048576", "count=460", timeout=180)
        adb("shell", "run-as", PKG, "rm", "-f", "no_backup/modelos/" + NAME)
    finally:
        adb("shell", "rm", "-f", staging, check=False, timeout=95)
    size = adb("shell", "run-as", PKG, "stat", "-c", "%s",
               "no_backup/modelos/" + NAME + ".part", timeout=40)
    assert int(size) == PART_BYTES, f"El fichero parcial no coincide: {size}"

    pid_after = adb("shell", "pidof", PKG, check=False)
    print("Proceso Android tras copiar GGUF:", pid_after, flush=True)
    if not pid_after.strip():
        activity = adb("shell", "am", "start", "-W", "-n",
                       PKG + "/.MainActivity", timeout=90)
        print("Reinicio tras copiar modelo parcial:", activity, flush=True)
    target = find_android_webview()
    ws = create_connection(target["webSocketDebuggerUrl"], timeout=40, suppress_origin=True)
    ws.settimeout(35)
    try:
        initial = eval_js(ws, """(async () => {
          const btn = [...document.querySelectorAll('button')].find(
            b => b.textContent?.includes('Estudiar sin conexión'));
          if (btn) btn.click();
          await new Promise(r => setTimeout(r,1700));
          const m = window.Capacitor.Plugins.ModeloEducativo;
          const state = await m.estado();
          return {state, setup:!!document.querySelector('.mtc-offline-setup'),
                  installButton:!![...document.querySelectorAll('button')]
                    .find(b=>b.textContent?.trim()==='Descargar modelo')};
        })()""", 501)
        print("Instalador Android desde React:", initial, flush=True)
        assert initial.get("setup") and initial.get("installButton"), initial
        assert initial["state"]["downloadBytes"] == PART_BYTES, initial
        assert initial["state"]["installed"] is False, initial

        canceled = eval_js(ws, """(async () => {
          window.confirm = () => true; // El alumno autorizó esta prueba CI.
          const b = [...document.querySelectorAll('button')].find(
            b=>b.textContent?.trim()==='Descargar modelo');
          b.click();
          await new Promise(r=>setTimeout(r,180));
          const c = [...document.querySelectorAll('button')].find(
            b=>b.textContent?.trim()==='Cancelar descarga');
          if(!c) return {error:'No apareció el control de cancelación'};
          c.click();
          return {cancelButtonWasVisible:true};
        })()""", 502)
        assert canceled == {"cancelButtonWasVisible": True}, canceled
        status = None
        for i in range(35):
            time.sleep(2)
            status = eval_js(ws, """(async()=>{
              const state=await window.Capacitor.Plugins.ModeloEducativo.estado();
              return {state, button:!![...document.querySelectorAll('button')]
                .find(b=>b.textContent?.trim()==='Descargar modelo'),
                error:document.querySelector('.mtc-model-error')?.textContent||null}
            })()""", 510+i)
            if not status["state"]["downloading"] and status["button"]:
                break
        print("Tras cancelar descarga:", status, flush=True)
        assert status and not status["state"]["installed"] and status["button"], status
        assert status["state"]["downloadBytes"] >= PART_BYTES, status
        assert "cancelad" in (status.get("error") or "").lower(), status

        # Reanudar CON EL BOTÓN DE LA INTERFAZ, conservando la parte previa.
        started = eval_js(ws, """(async()=>{
          const b=[...document.querySelectorAll('button')].find(
            x=>x.textContent?.trim()==='Descargar modelo');
          if(!b)return false;
          b.click();
          await new Promise(r=>setTimeout(r,350));
          return !![...document.querySelectorAll('button')].find(
            x=>x.textContent?.trim()==='Cancelar descarga');
        })()""", 601)
        assert started, "El botón React no inició la reanudación"

        outcome = None
        for i in range(120):
            time.sleep(3)
            outcome = eval_js(ws, """(async()=>{
              const m=window.Capacitor.Plugins.ModeloEducativo;
              const state=await m.estado();
              return {state, chat:!!document.querySelector('.mtc-offline-chat'),
                error:document.querySelector('.mtc-model-error')?.textContent||null};
            })()""", 610+i)
            if outcome and (outcome["state"]["installed"] or outcome.get("error")):
                break
            if i % 10 == 0:
                print("Reanudación GGUF:", outcome, flush=True)
        print("Resultado final descarga GUI:", outcome, flush=True)
        assert outcome and outcome["state"]["installed"], outcome
        assert not outcome.get("error"), outcome
        assert outcome["state"]["bytes"] == GGUF.stat().st_size, outcome
        # La llamada de instalación debe abrir el chat local sin reiniciar.
        if not outcome.get("chat"):
            time.sleep(2)
            check = eval_js(ws, "!!document.querySelector('.mtc-offline-chat')", 770)
            assert check, "La interfaz no abrió el tutor después de instalar"

        android_sha = adb("shell", "run-as", PKG, "sha256sum",
            "no_backup/modelos/" + NAME, timeout=180)
        assert android_sha.split()[0] == HASH, android_sha
        leftover = adb("shell", "run-as", PKG, "ls", "-l",
            "no_backup/modelos/" + NAME + ".part", timeout=15, check=False)
        assert "No such file" in leftover or not leftover.strip(), leftover
        report = {
            "model_real_sha256_verified": True, "bytes": GGUF.stat().st_size,
            "resumed_from_bytes": PART_BYTES, "cancel_ui_verified": True,
            "partial_preserved_after_cancel": True, "resume_ui_verified": True,
            "chat_available_after_install": True, "source": "Hugging Face HTTPS"
        }
        OUT.mkdir(exist_ok=True)
        (OUT / "modelo-descarga-real.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print("DESCARGA, CANCELACIÓN Y REANUDACIÓN GGUF REAL VERIFICADAS EN ANDROID.", flush=True)
    finally:
        ws.close()

if __name__ == "__main__":
    main()
