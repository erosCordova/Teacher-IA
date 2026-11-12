#!/usr/bin/env python3
"""Validación de un GGUF real en Android x86_64, sin enviar texto a una API.

Solo ejecutarla en CI de integración profunda. Descarga el modelo fuera del
APK, lo instala en el almacenamiento privado, comprueba huella SHA-256
y utiliza el motor JNI con fetch bloqueado. Nunca usa cuentas de alumnos.
"""
import hashlib
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from websocket import create_connection
from probar_emulador import APK, adb, eval_js, get_target, wait_for_debug_socket

ROOT = Path(__file__).resolve().parents[1]
GGUF = ROOT / "cache" / "qwen3-0.6b-q4_k_m.gguf"
PKG = "pe.myteacheria.alumno"
SHA256 = "28b1c721c1e476d3e41c629d5993c0aaeca0f3b747afdbab667f5a4bc8e37665"
MODEL_SIZE_MIN = 350_000_000

def main():
    assert GGUF.is_file() and GGUF.stat().st_size > MODEL_SIZE_MIN, "Falta GGUF completo"
    with GGUF.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    assert digest == SHA256, "SHA-256 no coincide con el fichero de Hugging Face"
    print("Modelo real verificado:", GGUF.stat().st_size, "bytes", digest)
    assert APK.is_file(), "No hay APK de prueba para instalar"
    print("Instalando APK Android:", adb("install", "-r", str(APK), timeout=160))
    adb("shell", "am", "force-stop", PKG, check=False)
    print("Abriendo My Teacher IA:", adb("shell", "am", "start", "-W",
          "-n", PKG + "/.MainActivity", timeout=90)[:500])
    time.sleep(6)
    print("Espacio Android:", adb("shell", "df", "-h", "/data", check=False)[:500])
    adb("shell", "run-as", PKG, "mkdir", "-p", "no_backup/modelos")
    target = "/data/local/tmp/myteacher-model-check.gguf"
    print(adb("push", str(GGUF), target, timeout=240))
    try:
        print(adb("shell", "run-as", PKG, "cp", target,
                  "no_backup/modelos/qwen3-0.6b-q4_k_m.gguf", timeout=150))
        print("Modelos privados:", adb("shell", "run-as", PKG, "ls",
               "-lh", "no_backup/modelos", timeout=40))
    finally:
        adb("shell", "rm", "-f", target, check=False, timeout=90)

    # Verificar también sobre Android, no solo el hash en el ordenador CI.
    # El modelo GGUF real debe estar en el directorio privado de la app.
    android_sha = adb("shell", "run-as", PKG, "sha256sum",
        "no_backup/modelos/qwen3-0.6b-q4_k_m.gguf", timeout=240)
    print("SHA-256 del GGUF en almacenamiento privado Android:", android_sha)
    assert android_sha.split()[0] == SHA256, "El GGUF instalado en Android no es íntegro"
    (ROOT / "evidencias").mkdir(exist_ok=True)
    (ROOT / "evidencias" / "modelo-real-almacenado.json").write_text(
        json.dumps({"android_sha256": android_sha.split()[0],
                    "source_sha256": SHA256, "bytes": GGUF.stat().st_size,
                    "private_storage_verified": True,
                    "inference_tested": False}, indent=2),
        encoding="utf-8")
    print("VALIDACIÓN DEL MODELO REAL ALMACENADO EN ANDROID COMPLETADA.")

    # Comprobar JNI con transporte HTTP deliberadamente bloqueado en la WebView.
    socket = wait_for_debug_socket()
    adb("forward", "tcp:9222", "localabstract:" + socket)
    target_page = get_target()
    ws = create_connection(target_page["webSocketDebuggerUrl"],
                           timeout=480, suppress_origin=True)
    try:
        ws.settimeout(30)
        # No bloquear el WebView con awaitPromise=true durante minutos.
        # La inferencia se vigila desde JavaScript y deja evidencias aunque se
        # agote el tiempo. Ningún contenido se envía a servidores.
        task = eval_js(ws, """(async () => {
          const c = window.Capacitor;
          const motor = c?.Plugins?.MotorLocal ?? c?.registerPlugin?.('MotorLocal');
          const model = c?.Plugins?.ModeloEducativo ?? c?.registerPlugin?.('ModeloEducativo');
          if (!motor || !model) return {error:'Plugins ausentes'};
          const state = await model.estado();
          if (!state.installed || !state.engineAvailable) return {error:'Falta motor o modelo',state};
          const originalFetch = window.fetch;
          window.fetch = () => Promise.reject(new Error('RED BLOQUEADA EN LA PRUEBA'));
          window.__teacherInference = {
            status:'running', started:Date.now(), state, response:null, error:null
          };
          void motor.responder({
            texto:'Dame una pista muy breve para entender las fracciones.',
            maxTokens:12
          }).then(response => {
            window.__teacherInference = {
              ...window.__teacherInference, status:'success', response,
              elapsedMs:Date.now()-window.__teacherInference.started
            };
          }).catch(e => {
            window.__teacherInference = {
              ...window.__teacherInference, status:'failed',error:String(e),
              elapsedMs:Date.now()-window.__teacherInference.started
            };
          }).finally(() => { window.fetch = originalFetch; });
          return {started:true,state};
        })()""", 200)
        print("Inicio de inferencia real JNI:", task, flush=True)
        assert task and task.get("started") is True, task

        outcome = None
        start = time.monotonic()
        for attempt in range(30):
            time.sleep(10)
            try:
                outcome = eval_js(ws, """window.__teacherInference || null""", 201 + attempt)
            except Exception as error:
                print("WebView ocupado generando tokens:", str(error)[:250], flush=True)
                outcome = None
            if outcome and outcome.get("status") in ("success", "failed"):
                break
            if attempt % 3 == 0:
                print("Inferencia pendiente (segundos):", int(time.monotonic()-start),
                      "estado:", outcome, flush=True)
                print("Memoria app:", adb("shell", "dumpsys", "meminfo", PKG,
                      timeout=25, check=False)[:1000], flush=True)
        print("Resultado final inferencia JNI:", outcome, flush=True)
        if not outcome or outcome.get("status") != "success":
            raise AssertionError("El modelo GGUF real no generó una respuesta verificada: "
                                 + str(outcome))
        answer = outcome.get("response") or {}
        assert answer.get("origen") == "dispositivo", outcome
        assert isinstance(answer.get("texto"), str) and len(answer["texto"].strip()) >= 2, outcome
        assert len(answer["texto"]) < 1000, outcome
        (ROOT / "evidencias" / "modelo-real.json").write_text(
          json.dumps({"hash_verified": True, "bytes": GGUF.stat().st_size,
            "native_inference": True, "http_fetch_blocked": True,
            "elapsed_ms": outcome.get("elapsedMs"),
            "answer_excerpt": answer["texto"][:180]}, ensure_ascii=False, indent=2),
          encoding="utf-8")
        print("INFERENCIA REAL DEL MODELO EN ANDROID VERIFICADA SIN RED.", flush=True)
    finally:
        ws.close()

if __name__ == "__main__":
    main()
