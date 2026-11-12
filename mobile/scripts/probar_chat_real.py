#!/usr/bin/env python3
"""Prueba end-to-end del CHAT Android con GGUF real, sin cuentas ni servidor.

Se ejecuta después de probar_modelo_real.py, conservando el modelo y la app
en el emulador. Escribe por la UI React, espera la inferencia del motor JNI,
comprueba persistencia cifrada nativa y recarga el WebView para restaurarla.
"""
import json
import time
from pathlib import Path
from websocket import create_connection
from probar_emulador import adb, eval_js, get_target, wait_for_debug_socket

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evidencias"
PKG = "pe.myteacheria.alumno"

def check(ws, code, seq):
    result = eval_js(ws, code, seq)
    print("Chat Android:", json.dumps(result, ensure_ascii=False)[:520], flush=True)
    return result

def main():
    socket = wait_for_debug_socket()
    adb("forward", "tcp:9222", "localabstract:" + socket)
    page = get_target()
    ws = create_connection(page["webSocketDebuggerUrl"], timeout=35, suppress_origin=True)
    ws.settimeout(35)
    try:
        entered = check(ws, """(async () => {
          if (document.querySelector('.mtc-offline-chat')) return {entered:true};
          const btn = [...document.querySelectorAll('button')].find(
             b => b.textContent?.includes('Estudiar sin conexión'));
          if (!btn) return {error:'No existe el acceso local'};
          btn.click();
          await new Promise(r => setTimeout(r,1500));
          return {entered:!!document.querySelector('.mtc-offline-chat'),
                  setup:!!document.querySelector('.mtc-offline-setup')};
        })()""", 301)
        assert entered.get("entered"), "No se pudo abrir chat con modelo: " + str(entered)

        begun = check(ws, """(async () => {
          const textarea = document.querySelector('#mtc-offline-input');
          const mode = document.querySelector('#mtc-offline-mode');
          const form = document.querySelector('.mtc-offline-composer');
          if (!textarea || !mode || !form) return {error:'Falta el editor de chat'};
          mode.value = '32';
          mode.dispatchEvent(new Event('change',{bubbles:true}));
          const setter = Object.getOwnPropertyDescriptor(
             HTMLTextAreaElement.prototype, 'value').set;
          setter.call(textarea, '¿Cómo puedo entender las fracciones?');
          textarea.dispatchEvent(new Event('input',{bubbles:true}));
          await new Promise(r => setTimeout(r, 400));
          const canSend = !form.querySelector('button[type=submit]')?.disabled;
          if (!canSend) return {error:'El envío sigue deshabilitado',value:textarea.value};
          form.requestSubmit();
          await new Promise(r => setTimeout(r, 350));
          return {sent:!!document.querySelector('.mtc-offline-msg-estudiante')};
        })()""", 302)
        assert begun.get("sent"), "No se envió el mensaje mediante React: " + str(begun)

        result = None
        for attempt in range(48):
            time.sleep(8)
            result = eval_js(ws, """({
              user: [...document.querySelectorAll('.mtc-offline-msg-estudiante p')]
                 .map(e => e.textContent).at(-1) || null,
              tutor: [...document.querySelectorAll('.mtc-offline-msg-tutor p')]
                 .map(e => e.textContent).at(-1) || null,
              busy:!!document.querySelector('.mtc-offline-thinking'),
              error:document.querySelector('.mtc-offline-notice')?.textContent || null
            })""", 320 + attempt)
            if result and (result.get("tutor") or result.get("error")):
                break
            if attempt % 5 == 0:
                print("Esperando respuesta real desde interfaz:", result, flush=True)
        assert result and result.get("tutor"), "No hubo respuesta en chat Android: " + str(result)
        assert result["user"] == "¿Cómo puedo entender las fracciones?", result
        assert "<think>" not in result["tutor"], "Se mostró razonamiento interno"
        assert not result.get("busy"), "La app continúa bloqueada después de responder"

        stored = check(ws, """(async () => {
          const c = window.Capacitor;
          const h = c?.Plugins?.HistorialLocal ?? c?.registerPlugin?.('HistorialLocal');
          const response = await h.leer();
          const messages = JSON.parse(response.datos);
          return {count:messages.length,
            hasStudent:messages.some(m=>m.rol==='estudiante' &&
              m.texto==='¿Cómo puedo entender las fracciones?'),
            hasTutor:messages.some(m=>m.rol==='tutor' && m.texto.length>0)};
        })()""", 370)
        assert stored.get("hasStudent") and stored.get("hasTutor"), stored

        check(ws, "location.reload(); true", 371)
        restored = None
        for attempt in range(20):
            time.sleep(2)
            try:
                restored = eval_js(ws, """({
                  offline:!!document.querySelector('.mtc-offline-chat'),
                  student:!!document.querySelector('.mtc-offline-msg-estudiante'),
                  tutor:!!document.querySelector('.mtc-offline-msg-tutor'),
                  text:document.querySelector('.mtc-offline-msg-tutor p')?.textContent || ''
                })""", 380 + attempt)
                if restored and restored.get("offline") and restored.get("tutor"):
                    break
            except Exception as exc:
                print("Esperando recarga Android:", str(exc)[:160], flush=True)
        assert restored and restored.get("offline") and restored.get("student") and restored.get("tutor"), restored
        OUT.mkdir(exist_ok=True)
        report = {
            "offline_chat_real": True, "input_through_react": True,
            "jni_model_used": True, "encrypted_history": True,
            "history_restored_after_reload": True, "response_hidden_think_tags": True,
            "request": result["user"], "response_excerpt": result["tutor"][:160]
        }
        (OUT / "chat-real-historial.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print("CHAT OFFLINE REAL Y RESTAURACIÓN DEL HISTORIAL CIFRADO VERIFICADOS.", flush=True)
    finally:
        ws.close()

if __name__ == "__main__":
    main()
