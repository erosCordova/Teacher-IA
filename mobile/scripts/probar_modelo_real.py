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
from pathlib import Path
from websocket import create_connection
from probar_emulador import adb, eval_js, get_target, wait_for_debug_socket

ROOT = Path(__file__).resolve().parents[1]
GGUF = ROOT / "cache" / "qwen3-0.6b-q4_k_m.gguf"
PKG = "pe.myteacheria.alumno"
SHA256 = "28b1c721c1e476d3e41c629d5993c0aaeca0f3b747afdbab667f5a4bc8e37665"
MODEL_SIZE_MIN = 350_000_000

def main():
    assert GGUF.is_file() and GGUF.stat().st_size > MODEL_SIZE_MIN, "Falta GGUF completo"
    digest = hashlib.file_digest(GGUF.open("rb"), "sha256").hexdigest()
    assert digest == SHA256, "SHA-256 no coincide con el fichero de Hugging Face"
    print("Modelo real verificado:", GGUF.stat().st_size, "bytes", digest)
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

    # Comprobar JNI con transporte HTTP deliberadamente bloqueado en la WebView.
    wait_for_debug_socket()
    target_page = get_target()
    ws = create_connection(target_page["webSocketDebuggerUrl"],
                           timeout=480, suppress_origin=True)
    try:
        ws.settimeout(480)
        outcome = eval_js(ws, """(async () => {
          const c = window.Capacitor;
          const motor = c?.Plugins?.MotorLocal ?? c?.registerPlugin?.('MotorLocal');
          const model = c?.Plugins?.ModeloEducativo ?? c?.registerPlugin?.('ModeloEducativo');
          if (!motor || !model) return {error:'Plugins ausentes'};
          const state = await model.estado();
          const originalFetch = window.fetch;
          window.fetch = () => Promise.reject(new Error('RED BLOQUEADA EN LA PRUEBA'));
          try {
            const answer = await motor.responder({
              texto:'Explícame con una sola pista cómo entender las fracciones en español.',
              maxTokens:64
            });
            return {state,answer};
          } catch(e) { return {state,error:String(e)}; }
          finally { window.fetch = originalFetch; }
        })()""", 200)
        print("Inferencia GGUF dentro del emulador:", json.dumps(
            outcome, ensure_ascii=False)[:1600])
        assert outcome and outcome.get("state", {}).get("installed"), outcome
        assert outcome.get("state", {}).get("engineAvailable"), outcome
        answer = outcome.get("answer", {})
        assert answer.get("origen") == "dispositivo", outcome
        assert isinstance(answer.get("texto"), str) and len(answer["texto"].strip()) > 8, outcome
        assert len(answer["texto"]) < 5000, outcome
        (ROOT / "evidencias").mkdir(exist_ok=True)
        (ROOT / "evidencias" / "modelo-real.json").write_text(
          json.dumps({"hash_verified":True,"bytes":GGUF.stat().st_size,
            "native_inference":True,"http_fetch_blocked":True,
            "answer_excerpt":answer["texto"][:220]},ensure_ascii=False,indent=2),
          encoding="utf-8")
        print("Inferencia local real con GGUF verificada; sin uso de fetch.")
    finally:
        ws.close()

if __name__ == "__main__":
    main()
