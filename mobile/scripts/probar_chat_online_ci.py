#!/usr/bin/env python3
"""Prueba login y aislamiento de datos desde una WebView Android real.

Usa un PostgreSQL efímero y un FastAPI que escucha solo en el runner CI;
no crea cuentas en Render ni toca datos de estudiantes.
"""
import json
import time

from websocket import create_connection
from probar_emulador import APK, PKG, adb, eval_js, get_target, wait_for_debug_socket

TEST_USERNAME_A = "android_ci_alumno_a"
TEST_PASSWORD_A = "ClaveAndroidCI_2026_AlumnoA"
TEST_USERNAME_B = "android_ci_alumno_b"
TEST_PASSWORD_B = "ClaveAndroidCI_2026_AlumnoB"

def main():
    assert APK.exists(), "La compilación Android no generó un APK"
    print("Instalación APK:", adb("install", "-r", str(APK), timeout=150))
    print("Enlace seguro a API de prueba del mismo runner:",
          adb("reverse", "tcp:8010", "tcp:8010", timeout=30))
    adb("shell", "am", "force-stop", PKG, check=False)
    print(adb("shell", "am", "start", "-W", "-n", PKG + "/.MainActivity", timeout=75)[:400])
    time.sleep(8)
    socket = wait_for_debug_socket()
    adb("forward", "tcp:9222", "localabstract:" + socket)
    target = get_target()
    ws = create_connection(target["webSocketDebuggerUrl"], timeout=90, suppress_origin=True)
    try:
        result = eval_js(ws, """(async () => {
          const root = 'http://localhost:8010/api/conauti';
          const a = async (path, method='GET', body, token) => {
            const response = await fetch(root+path, {
              method, headers: {
                ...(body ? {'Content-Type':'application/json'} : {}),
                ...(token ? {'Authorization':'Bearer '+token} : {})
              },
              ...(body ? {body:JSON.stringify(body)} : {})
            });
            const data = await response.json().catch(()=>({}));
            return {status:response.status,data};
          };
          const one = await a('/auth/login','POST',{
            username:'android_ci_alumno_a',password:'ClaveAndroidCI_2026_AlumnoA'
          });
          if (one.status!==200) return {step:'login_a',status:one.status};
          const tokenA = one.data.access_token;
          const me = await a('/auth/me','GET',undefined,tokenA);
          const created = await a('/conversations','POST',{
            title:'Conversación Android aislada de prueba'
          },tokenA);
          if (created.status!==201) return {step:'create',status:created.status};
          const id = created.data.id;
          const posted = await a('/conversations/'+id+'/messages','POST',{
            body:'¿Cómo comprendo las fracciones en secundaria?'
          },tokenA);
          const listed = await a('/conversations/'+id+'/messages','GET',undefined,tokenA);
          const another = await a('/auth/login','POST',{
            username:'android_ci_alumno_b',password:'ClaveAndroidCI_2026_AlumnoB'
          });
          if (another.status!==200) return {step:'login_b',status:another.status};
          const forbidden = await a('/conversations/'+id+'/messages','GET',undefined,
            another.data.access_token);
          const logout = await a('/auth/logout','POST',undefined,tokenA);
          const expired = await a('/auth/me','GET',undefined,tokenA);
          return {
            origin: location.origin,
            login_a:one.status,me:me.status,
            same_user:me.data.username === 'android_ci_alumno_a',
            create:created.status,post:posted.status,
            messages:listed.status,count:Array.isArray(listed.data)?listed.data.length:-1,
            body_ok:listed.data?.[0]?.body ===
              '¿Cómo comprendo las fracciones en secundaria?',
            login_b:another.status,cross_user:forbidden.status,
            logout:logout.status,revoked:expired.status
          };
        })().catch(e=>({error:String(e)}))""", 300)
        print("Login y conversaciones desde Android con usuarios efímeros:", result)
        assert result and result.get("origin") == "http://localhost", result
        assert all(result.get(k) == 200 for k in ("login_a", "me", "messages", "login_b", "logout")), result
        assert all(result.get(k) == 201 for k in ("create","post")), result
        assert result.get("same_user") and result.get("body_ok"), result
        assert result.get("count") == 1, result
        assert result.get("cross_user") == 404, "Falla aislamiento de cuentas Android"
        assert result.get("revoked") == 401, "La revocación de sesión no funciona"
        print("ÉXITO: autenticación, persistencia, revocación y aislamiento entre usuarios comprobados.")
    finally:
        ws.close()

if __name__ == "__main__":
    main()
