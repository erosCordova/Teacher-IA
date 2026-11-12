#!/usr/bin/env python3
"""Prueba una WebView Android real contra el backend público, sin cuentas reales.

Conserva evidencia de la pantalla y valida que las llamadas HTTPS desde la
WebView tienen CORS permitido. No simula una sesión autenticada ni IA offline.
"""
import json
import re
import subprocess
import time
import urllib.request
from pathlib import Path

from websocket import create_connection

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evidencias"
OUT.mkdir(exist_ok=True)
APK = ROOT / "android/app/build/outputs/apk/debug/app-debug.apk"
PKG = "pe.myteacheria.alumno"


def adb(*args, timeout=30, check=True):
    return subprocess.run(
        ["adb", *args], capture_output=True, text=True, timeout=timeout, check=check
    ).stdout.strip()


def wait_for_debug_socket(seconds=70):
    for _ in range(seconds // 3):
        sock = adb("shell", "cat", "/proc/net/unix", check=False)
        candidates = re.findall(r"webview_devtools_remote_\d+", sock)
        if candidates:
            return candidates[-1]
        time.sleep(3)
    raise RuntimeError("No se habilitó la depuración de WebView Android.")


def get_target():
    for _ in range(22):
        try:
            with urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=6) as response:
                pages = json.load(response)
            for page in pages:
                if page.get("type") == "page" and page.get("webSocketDebuggerUrl"):
                    return page
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError("No se encontró una página WebView accesible.")


def eval_js(ws, expr, seq):
    message = {
        "id": seq,
        "method": "Runtime.evaluate",
        "params": {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True,
        },
    }
    ws.send(json.dumps(message))
    while True:
        result = json.loads(ws.recv())
        if result.get("id") != seq:
            continue
        if "exceptionDetails" in result.get("result", {}):
            raise RuntimeError(str(result["result"]["exceptionDetails"]))
        return result.get("result", {}).get("result", {}).get("value")


def main():
    assert APK.exists(), f"No existe APK de prueba: {APK}"
    print("Instalando APK:", APK.stat().st_size, "bytes")
    print(adb("install", "-r", str(APK), timeout=120))
    adb("shell", "am", "force-stop", PKG, check=False)
    start = adb("shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity", timeout=75)
    print("Inicio Android:", start.replace("\n", " ")[:350])
    time.sleep(9)
    adb("shell", "screencap", "-p", "/sdcard/teacher.png")
    adb("pull", "/sdcard/teacher.png", str(OUT / "inicio-android.png"), timeout=45)
    socket_name = wait_for_debug_socket()
    adb("forward", "tcp:9222", f"localabstract:{socket_name}")
    target = get_target()
    print("WebView:", target.get("url"), target.get("title"))
    ws = create_connection(target["webSocketDebuggerUrl"], timeout=40, origin="http://localhost")
    try:
        current = eval_js(ws, """({
          origin: location.origin,
          title: document.title,
          authPage: !!document.querySelector('.mtc-auth-shell'),
          appPage: !!document.querySelector('.mtc-app')
        })""", 1)
        print("Página montada:", current)
        assert current["origin"] == "http://localhost", current
        assert "My Teacher IA" in current["title"], current
        assert current["authPage"] or current["appPage"], "No se montó React."

        # La API está en Render y puede necesitar despertarse; esto ejercita
        # EXACTAMENTE el fetch del WebView, no una petición de Python en CI.
        expression = """fetch('https://my-teacher-ia-api.onrender.com/api/health',
          {cache:'no-store'}).then(async r => ({ok:r.ok,status:r.status,
          payload:await r.json()})).catch(e => ({error:String(e)}))"""
        result = None
        for attempt in range(5):
            result = eval_js(ws, expression, 2 + attempt)
            if result and result.get("ok") and result.get("payload", {}).get("status") == "ok":
                break
            print("Reintentando API (Render frío/CORS):", result)
            time.sleep(13)
        print("API en Android:", result)
        assert result and result.get("ok"), f"Error de red real en Android: {result}"

        # Comprueba que el preflight con token no queda bloqueado por CORS.
        expression2 = """fetch('https://my-teacher-ia-api.onrender.com/api/conauti/auth/me',
          {headers:{'Authorization':'Bearer prueba-integracion'}})
          .then(r => ({status:r.status})).catch(e => ({error:String(e)}))"""
        auth = eval_js(ws, expression2, 12)
        print("Ruta de autenticación (token inválido esperado):", auth)
        assert auth and auth.get("status") in (401, 403), auth

        report = {"device": "emulator x86_64 API35", "page": current,
                  "api_health": result, "unauthorized_auth_request": auth,
                  "authenticated_chat_tested": False, "offline_inference_tested": False}
        (OUT / "reporte.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print("Prueba real de WebView + acceso HTTP completada.")
    finally:
        ws.close()


if __name__ == "__main__":
    main()
