#!/usr/bin/env python3
"""Autenticación + chat + sincronización en Android y PostgreSQL temporales.

Ejercita la interfaz React real y el Keystore nativo. La APK de esta prueba
apunta solo a localhost:8010 del runner mediante adb reverse; ningún dato
se envía al despliegue público. Nunca imprime credenciales ni tokens.
"""
import json
import time
from pathlib import Path
from websocket import create_connection
from probar_emulador import APK, PKG, OUT, adb, eval_js, get_target, wait_for_debug_socket

API = "http://localhost:8010/api/conauti"
QUESTION = "¿Cómo comprendo las fracciones en secundaria?"
HINT = "Si divides una unidad en cuatro partes, ¿cuántas forman la mitad?"


def run(ws, expression, number):
    return eval_js(ws, expression, number)


def until(ws, expression, start, attempts=35, delay=1.5):
    response = None
    for i in range(attempts):
        response = run(ws, expression, start+i)
        if response and response.get("ready"):
            return response
        if i % 7 == 0:
            print("Comprobación Android:", str(response)[:240], flush=True)
        time.sleep(delay)
    raise AssertionError("La interfaz no completó la operación: " + str(response))


def main():
    assert APK.exists(), "La compilación Android no generó el APK"
    print("Instalación APK:", adb("install", "-r", str(APK), timeout=150))
    print("Backend de prueba por adb reverse:", adb("reverse", "tcp:8010", "tcp:8010"))
    adb("shell", "am", "force-stop", PKG, check=False)
    print(adb("shell", "am", "start", "-W", "-n", PKG + "/.MainActivity",
              timeout=75)[:400])
    time.sleep(9)
    socket = wait_for_debug_socket()
    adb("forward", "tcp:9222", "localabstract:" + socket)
    target = get_target()
    ws = create_connection(target["webSocketDebuggerUrl"], timeout=50,
                           suppress_origin=True)
    ws.settimeout(50)
    try:
        start = until(ws, """(async () => {
          const response = await fetch('http://localhost:8010/api/health');
          return {ready:!!document.querySelector('.mtc-auth-shell'),
                  localApi:response.ok, origin:location.origin};
        })().catch(e => ({error:String(e)}))""", 100)
        assert start["localApi"] and start["origin"] == "http://localhost", start

        # Probar la autenticación desde el formulario React, no solo fetch.
        logged = run(ws, """(async () => {
          const toggle=document.querySelector('.mtc-auth-legacy-toggle');
          if (!toggle) return {error:'Falta formulario anterior'};
          toggle.click();
          await new Promise(r=>setTimeout(r,250));
          const u=document.querySelector('#username');
          const p=document.querySelector('#password');
          const form=document.querySelector('.mtc-auth-legacy-form');
          if (!u||!p||!form) return {error:'No se montó formulario'};
          const set=(el,value)=>{
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')
              .set.call(el,value);
            el.dispatchEvent(new Event('input',{bubbles:true}));
          };
          set(u,'android_ci_alumno_a');
          set(p,'ClaveAndroidCI_2026_AlumnoA');
          await new Promise(r=>setTimeout(r,250));
          form.requestSubmit();
          return {submitted:true};
        })()""", 200)
        assert logged.get("submitted"), logged
        online = until(ws, """({
          ready:!!document.querySelector('.mtc-app'),
          loginForm:!!document.querySelector('.mtc-auth-legacy-form'),
          title:document.title,
          error:document.querySelector('.mtc-auth-notice')?.textContent||null
        })""", 220, attempts=55)
        assert not online["loginForm"], online

        # Sesión real almacenada cifrada: usarla únicamente en RAM de WebView.
        vault = until(ws, """(async () => {
          const p=window.Capacitor?.Plugins?.SesionSegura ??
            window.Capacitor?.registerPlugin?.('SesionSegura');
          const saved=await p.leer();
          const token=saved.token;
          if (!token) return {ready:false};
          const me=await fetch('http://localhost:8010/api/conauti/auth/me',{
             headers:{Authorization:'Bearer '+token}});
          const body=await me.json();
          return {ready:me.ok, username:body.username, isKeystore:true};
        })().catch(e=>({error:String(e)}))""", 290, attempts=20)
        assert vault["username"] == "android_ci_alumno_a", vault

        # Una conversación y mensaje auténticos de la cuenta A; abrirla desde UI.
        prepared = run(ws, """(async () => {
          const token=(await (window.Capacitor?.Plugins?.SesionSegura ??
            window.Capacitor?.registerPlugin?.('SesionSegura')).leer()).token;
          const request=async (path,method='GET',data)=>{
            const response=await fetch('http://localhost:8010/api/conauti'+path,{
              method,
              headers:{Authorization:'Bearer '+token,
                ...(data?{'Content-Type':'application/json'}:{})},
              ...(data?{body:JSON.stringify(data)}:{})
            });
            return {status:response.status,body:await response.json()};
          };
          const created=await request('/conversations','POST',{
             title:'Conversación de prueba Android'});
          if (created.status!==201) return {error:'create',status:created.status};
          const id=created.body.id;
          const msg=await request('/conversations/'+id+'/messages','POST',{
            body:'¿Cómo comprendo las fracciones en secundaria?'});
          return {id,created:created.status,posted:msg.status};
        })()""", 320)
        assert prepared.get("created")==201 and prepared.get("posted")==201, prepared

        # Se accede al mismo chat desde la UI React después de recargar.
        refreshed = run(ws, "location.reload(); true", 340)
        assert refreshed is True
        until(ws, """({ready:!!document.querySelector('.mtc-app')})""", 360)
        loaded = until(ws, """({
          ready:[...document.querySelectorAll('button')].some(b=>
            b.textContent?.includes('Conversación de prueba Android')),
          account:!!document.querySelector('.mtc-app')
        })""", 410)
        shown = run(ws, """(async () => {
          const b=[...document.querySelectorAll('button')].find(x=>
            x.textContent?.includes('Conversación de prueba Android'));
          b.click();
          await new Promise(r=>setTimeout(r,600));
          return {clicked:true};
        })()""", 455)
        assert shown.get("clicked"), shown
        message_on_screen=until(ws, """({
          ready:[...document.querySelectorAll('.mtc-message-user p')]
             .some(p=>p.textContent==='¿Cómo comprendo las fracciones en secundaria?')
        })""", 470, attempts=25)
        assert message_on_screen.get("ready"), message_on_screen

        # Conversación de ejemplo en historial privado del teléfono.
        stored=run(ws, """(async () => {
          const v=window.Capacitor?.Plugins?.HistorialLocal ??
            window.Capacitor?.registerPlugin?.('HistorialLocal');
          await v.guardar({datos:JSON.stringify([
            {id:1001,rol:'estudiante',texto:'¿Qué significa 1/2?'},
            {id:1002,rol:'tutor',texto:'¿En cuántas partes iguales divides una unidad?'}
          ])});
          return {stored:true};
        })()""", 530)
        assert stored.get("stored"), stored

        # Ir al tutor local desde la navegación REAL de la app.
        activated=run(ws, """(async () => {
          const config=[...document.querySelectorAll('button')].find(b=>
            b.textContent?.includes('Configuración'));
          if (!config) return {error:'Falta acceso a configuración'};
          config.click();
          await new Promise(r=>setTimeout(r,280));
          const open=[...document.querySelectorAll('button')].find(b=>
            b.textContent?.includes('Abrir tutor local'));
          if (!open) return {error:'Falta botón tutor local'};
          open.click();
          return {opened:true};
        })()""", 550)
        assert activated.get("opened"), activated
        # No se requiere el GGUF para sincronizar mensajes cifrados:
        # este APK de prueba tiene el instalador, pero no 484 MB precargados.
        local=until(ws, """(async () => {
          const history=window.Capacitor?.Plugins?.HistorialLocal ??
            window.Capacitor?.registerPlugin?.('HistorialLocal');
          const data=await history.leer();
          const stored=JSON.parse(data.datos);
          return {
            ready:!!document.querySelector('.mtc-offline-app') &&
              !!document.querySelector('.mtc-offline-sync'),
            privateStudent:stored.some(m=>m.rol==='estudiante' &&
              m.texto==='¿Qué significa 1/2?'),
            privateTutor:stored.some(m=>m.rol==='tutor' &&
              m.texto==='¿En cuántas partes iguales divides una unidad?'),
            syncDisabled:document.querySelector('.mtc-offline-sync button')?.disabled
          };
        })()""", 560, attempts=35)
        assert local["privateStudent"] and local["privateTutor"], local
        assert local["syncDisabled"] is False, local

        # Probar primero que NO se envía nada automáticamente al cambiar de modo.
        before=run(ws, """(async () => {
          const token=(await (window.Capacitor?.Plugins?.SesionSegura ??
              window.Capacitor?.registerPlugin?.('SesionSegura')).leer()).token;
          const r=await fetch('http://localhost:8010/api/conauti/conversations',{
            headers:{Authorization:'Bearer '+token}});
          return {count:(await r.json()).length};
        })()""", 640)
        assert before.get("count")==1, before

        # Aceptar la confirmación explícita de la app en este CI aislado.
        clicked=run(ws, """(async () => {
          window.__teacherConfirmCount=0;
          window.confirm=()=>{window.__teacherConfirmCount++;return true};
          const btn=document.querySelector('.mtc-offline-sync button');
          if(!btn||btn.disabled) return {error:'El botón no está disponible'};
          btn.click();
          return {clicked:true};
        })()""", 650)
        assert clicked.get("clicked"), clicked
        imported=until(ws, """(async () => {
          const token=(await (window.Capacitor?.Plugins?.SesionSegura ??
             window.Capacitor?.registerPlugin?.('SesionSegura')).leer()).token;
          const r=await fetch('http://localhost:8010/api/conauti/conversations',{
            headers:{Authorization:'Bearer '+token}});
          const items=await r.json();
          const imported=items.find(c=>c.title?.startsWith('Estudio sin conexión'));
          return {ready:!!imported, id:imported?.id||null,
             count:items.length, confirmations:window.__teacherConfirmCount||0,
             message:document.querySelector('.mtc-offline-sync [role=status]')?.textContent||null};
        })()""", 660, attempts=30)
        assert imported["count"]==2 and imported["confirmations"]==1, imported

        checked=run(ws, """(async () => {
          const token=(await (window.Capacitor?.Plugins?.SesionSegura ??
            window.Capacitor?.registerPlugin?.('SesionSegura')).leer()).token;
          const id=%s;
          const req=async (path,token)=>{
             const r=await fetch('http://localhost:8010/api/conauti'+path,{
                headers:{Authorization:'Bearer '+token}});
             return {status:r.status,body:await r.json().catch(()=>null)};
          };
          const own=await req('/conversations/'+id+'/messages',token);
          const b=await fetch('http://localhost:8010/api/conauti/auth/login',{
             method:'POST',headers:{'Content-Type':'application/json'},
             body:JSON.stringify({username:'android_ci_alumno_b',
              password:'ClaveAndroidCI_2026_AlumnoB'})});
          const bdata=await b.json();
          const denied=await req('/conversations/'+id+'/messages',
              bdata.access_token);
          return {own:own.status,rows:own.body?.length,
            student:own.body?.[0]?.body, forbidden:denied.status};
        })()""".replace("%s", json.dumps(imported["id"])), 730)
        assert checked.get("own")==200 and checked.get("rows")==2, checked
        assert checked.get("student")=="¿Qué significa 1/2?",checked
        assert checked.get("forbidden")==404,checked

        # Reintentar desde botón: el endpoint debe evitar mensajes duplicados.
        run(ws,"document.querySelector('.mtc-offline-sync button').click(); true",750)
        repeat=until(ws, """(async () => {
          const token=(await (window.Capacitor?.Plugins?.SesionSegura ??
             window.Capacitor?.registerPlugin?.('SesionSegura')).leer()).token;
          const r=await fetch('http://localhost:8010/api/conauti/conversations/'+%s+
                '/messages',{headers:{Authorization:'Bearer '+token}});
          const rows=await r.json();
          return {ready:window.__teacherConfirmCount===2,
             count:rows.length,confirmations:window.__teacherConfirmCount,
             response:document.querySelector('.mtc-offline-sync [role=status]')?.textContent||null};
        })()""".replace("%s",json.dumps(imported["id"])), 760)
        assert repeat["count"]==2 and repeat["confirmations"]==2,repeat

        OUT.mkdir(exist_ok=True)
        report={"api":"runner localhost only","login_from_react":True,
            "session_android_keystore":True,"conversation_in_app":True,
            "private_history_readable_in_app":True,
            "sync_requires_confirmation":True,
            "no_automatic_sync":True,"offline_messages_imported":2,
            "retry_idempotent":True,"different_student_denied":True,
            "server_user_count":2,"tokens_stored_in_report":False}
        (OUT/"android-online-sync-ci.json").write_text(
           json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
        print("ANDROID: LOGIN REAL EN REACT, CHAT ONLINE, KEYSTORE Y SINCRONIZACIÓN PROBADOS.",flush=True)
    finally:
        ws.close()


if __name__=="__main__":
    main()
