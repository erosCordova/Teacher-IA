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


def capture_diagnostics():
    try:
        logs = subprocess.run(
            ["adb", "logcat", "-d", "-t", "1600", "*:E"],
            capture_output=True, text=True, timeout=30
        )
        (OUT / "errores-android.txt").write_text(logs.stdout, encoding="utf-8")
        print("Últimos errores de Android:", logs.stdout[-9500:])
        activity = adb("shell", "dumpsys", "activity", "activities", check=False)
        (OUT / "actividad-android.txt").write_text(activity, encoding="utf-8")
    except Exception as error:
        print("No se pudieron recopilar registros:", error)


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
    ws = create_connection(target["webSocketDebuggerUrl"], timeout=40, suppress_origin=True)
    try:
        current = None
        for attempt in range(30):
            current = eval_js(ws, """({
              origin: location.origin,
              title: document.title,
              authPage: !!document.querySelector('.mtc-auth-shell'),
              appPage: !!document.querySelector('.mtc-app'),
              localPage: !!document.querySelector('.mtc-offline-app'),
              readyState: document.readyState,
              body: document.body?.innerText?.slice(0, 320) || '',
              root: document.getElementById('root')?.innerHTML?.slice(0, 280) || ''
            })""", 50 + attempt)
            if current["authPage"] or current["appPage"] or current["localPage"]:
                break
            if attempt in (0, 5, 15):
                print("Esperando interfaz React:", current)
            time.sleep(2)
        print("Página montada:", current)
        assert current["origin"] == "http://localhost", current
        assert "My Teacher IA" in current["title"], current
        assert current["authPage"] or current["appPage"] or current["localPage"], (
            "No se montó React. Último diagnóstico: " + str(current)
        )

        # Prueba puente Java <-> JS: token ficticio, almacenamiento cifrado.
        native = eval_js(ws, """(async () => {
          const c = window.Capacitor;
          const v = c?.Plugins?.SesionSegura ?? c?.registerPlugin?.('SesionSegura');
          if (!v) return { error:'Plugin nativo no disponible' };
          await v.guardar({token:'token_dummy_no_real_2026'});
          const read = await v.leer();
          await v.borrar();
          const removed = await v.leer();
          return {stored:read?.token,removed:removed?.token ?? null};
        })().catch(e => ({error:String(e)}))""", 15)
        print("Android Keystore puente nativo:", native)
        assert native == {"stored": "token_dummy_no_real_2026", "removed": None}, native

        # El instalador se consulta sin descargar 484 MB en cada ejecución CI.
        model = eval_js(ws, """(async () => {
          const c = window.Capacitor;
          const v = c?.Plugins?.ModeloEducativo ?? c?.registerPlugin?.('ModeloEducativo');
          if (!v) return {error:'Instalador no disponible'};
          return v.estado();
        })().catch(e => ({error:String(e)}))""", 16)
        print("Modelo local:", model)
        assert model and model.get("modelId") == "qwen3-0.6b-q4_k_m", model
        assert model.get("engineAvailable") is True, model

        engine = eval_js(ws, """(async () => {
          const c = window.Capacitor;
          const v = c?.Plugins?.MotorLocal ?? c?.registerPlugin?.('MotorLocal');
          if (!v) return {error:'Puente IA no disponible'};
          return v.estado();
        })().catch(e => ({error:String(e)}))""", 17)
        print("Motor local JNI:", engine)
        assert engine and engine.get("engineAvailable") is True, engine
        assert engine.get("modelInstalled") is False, engine

        # El historial no se guarda en localStorage: Android Keystore lo cifra.
        history = eval_js(ws, """(async () => {
          const c = window.Capacitor;
          const v = c?.Plugins?.HistorialLocal ?? c?.registerPlugin?.('HistorialLocal');
          if (!v) return {error:'No hay historial privado'};
          const original = JSON.stringify([{id:1,rol:'estudiante',texto:'¿Qué es una fracción?'}]);
          await v.guardar({datos:original});
          const stored = await v.leer();
          await v.borrar();
          const cleared = await v.leer();
          return {same:stored.datos===original,empty:cleared.datos==='[]'};
        })().catch(e => ({error:String(e)}))""", 18)
        print("Historial cifrado Android:", history)
        assert history == {"same": True, "empty": True}, history

        # Comprobar el módulo de voz: jamás debe usar reconocimiento en nube.
        voice = eval_js(ws, """(async () => {
          const c = window.Capacitor;
          const v = c?.Plugins?.VozLocal ?? c?.registerPlugin?.('VozLocal');
          if (!v) return {error:'VozLocal no registrado'};
          const state = await v.estado();
          let rejectedEmpty = false;
          try { await v.hablar({texto:''}); }
          catch (e) { rejectedEmpty = true; }
          return {...state,rejectedEmpty};
        })().catch(e => ({error:String(e)}))""", 21)
        print("Voz del dispositivo:", voice)
        assert voice.get("soloDispositivo") is True, voice
        assert isinstance(voice.get("sintesisDisponible"), bool), voice
        assert isinstance(voice.get("reconocimientoDisponible"), bool), voice
        assert voice.get("rejectedEmpty") is True, voice

        # Sintetizar una frase de prueba con una voz que Android declara local.
        # Esto verifica aceptación de la síntesis, no la audición humana.
        if voice.get("sintesisDisponible"):
            spoken = eval_js(ws, """(async () => {
              const c = window.Capacitor;
              const v = c?.Plugins?.VozLocal ?? c?.registerPlugin?.('VozLocal');
              await v.hablar({texto:'Hola, soy tu tutor educativo sin conexión.'});
              await new Promise(resolve => setTimeout(resolve, 650));
              await v.detener();
              return {sintesisLocalAceptada:true};
            })().catch(e => ({error:String(e)}))""", 22)
            print("Síntesis de voz sin red aceptada:", spoken)
            assert spoken == {"sintesisLocalAceptada": True}, spoken

        # Crear una pregunta local de prueba sin cuenta, para asegurar
        # que la sincronización no transmite datos de forma automática.
        seeded = eval_js(ws, """(async () => {
          const c = window.Capacitor;
          const h = c?.Plugins?.HistorialLocal ?? c?.registerPlugin?.('HistorialLocal');
          await h.guardar({datos:JSON.stringify([
            {id:1024,rol:'estudiante',texto:'Prueba local de privacidad'}
          ])});
          return true;
        })()""", 29)
        assert seeded is True

        # Desde la pantalla de acceso debe poder abrirse el tutor local
        # sin enviar contraseñas ni pedir autorización al backend.
        offline = eval_js(ws, """(async () => {
          const button = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent?.includes('Estudiar sin conexión'));
          if (!button) return {error:'No existe el acceso local'};
          button.click();
          await new Promise(resolve => setTimeout(resolve, 1200));
          return {offline:!!document.querySelector('.mtc-offline-app'),
                  title:document.querySelector('.mtc-offline-lead h1')?.textContent};
        })().catch(e => ({error:String(e)}))""", 19)
        print("Acceso sin cuenta a modo offline:", offline)
        assert offline and offline.get("offline") is True, offline

        sync = eval_js(ws, """({
          sectionVisible:!!document.querySelector('.mtc-offline-sync'),
          syncDisabled:!!document.querySelector('.mtc-offline-sync button')?.disabled,
          localQuestion:!!document.querySelector('.mtc-offline-sync p')
        })""", 32)
        print("Protección de sincronización sin cuenta:", sync)
        assert sync == {"sectionVisible": True, "syncDisabled": True,
                        "localQuestion": True}, sync

        # Comprobar que es posible regresar a la cuenta web sin reiniciar Android.
        back = eval_js(ws, """(async () => {
          const button = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent?.includes('Usar mi cuenta en línea'));
          if (!button) return false;
          button.click();
          await new Promise(resolve => setTimeout(resolve, 1200));
          return !!document.querySelector('.mtc-auth-shell');
        })()""", 20)
        assert back is True, "No se pudo regresar del tutor local al inicio de sesión"

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
                  "secure_session_tested": True, "offline_history_encrypted": True, "offline_entry_tested": True, "sync_without_login_blocked": True, "voice_native_bridge_tested": True, "voice_capabilities": voice, "voice_synthesis_accepted": bool(voice.get("sintesisDisponible")), "model_installer_detected": True, "jni_library_loaded": True,
                  "api_health": result, "unauthorized_auth_request": auth,
                  "authenticated_chat_tested": False, "offline_inference_tested": False}
        (OUT / "reporte.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print("Prueba real de WebView + acceso HTTP completada.")
    finally:
        ws.close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        capture_diagnostics()
        raise
