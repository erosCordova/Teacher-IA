import json
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import sync_playwright, expect

from app.conauti_auth import connect


ROOT = Path(__file__).resolve().parents[2]
BACK = ROOT / "backend"
FRONT = ROOT / "frontend"
LOG = ROOT / ".conauti-backups"

SIN_VENTANA = getattr(
    subprocess,
    "CREATE_NO_WINDOW",
    0x08000000,
)

opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({})
)


def consultar(url):
    try:
        with opener.open(url, timeout=3) as respuesta:
            return (
                respuesta.status,
                respuesta.read().decode(
                    "utf-8",
                    errors="replace",
                ),
            )
    except urllib.error.HTTPError as error:
        return error.code, ""
    except Exception:
        return None, ""


def puerto_libre(numero):
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", numero))
            return True
        except OSError:
            return False


def iniciar(comando, carpeta, archivo):
    with (LOG / archivo).open(
        "a",
        encoding="utf-8",
    ) as salida:
        salida.write("\n===== ARRANQUE FASE 06 =====\n")
        salida.flush()

        proceso = subprocess.Popen(
            comando,
            cwd=str(carpeta),
            stdin=subprocess.DEVNULL,
            stdout=salida,
            stderr=subprocess.STDOUT,
            close_fds=True,
            creationflags=SIN_VENTANA,
        )

    print(
        f"PROCESO_INDEPENDIENTE={proceso.pid}",
        flush=True,
    )


def esperar(funcion, intentos=25):
    for _ in range(intentos):
        if funcion():
            return True
        time.sleep(1)
    return funcion()


def backend_operativo(puerto):
    estado, contenido = consultar(
        f"http://127.0.0.1:{puerto}"
        "/api/conauti/health/db"
    )

    if estado != 200:
        return False

    try:
        return (
            json.loads(contenido).get("database")
            == "conauti_educativo"
        )
    except (ValueError, AttributeError, TypeError):
        return False


def ruta_ia_operativa(puerto):
    estado, _ = consultar(
        f"http://127.0.0.1:{puerto}"
        "/api/conauti/ai/status"
    )
    return estado == 401


def pagina_operativa(puerto):
    estado, contenido = consultar(
        f"http://127.0.0.1:{puerto}/"
    )
    return (
        estado == 200
        and "CONAUTI | Asistente Educativo" in contenido
    )


def mostrar_registro(nombre):
    archivo = LOG / nombre

    if not archivo.exists():
        return

    print(f"REGISTRO={nombre}", flush=True)

    contenido = archivo.read_text(
        encoding="utf-8",
        errors="replace",
    )

    for linea in contenido.splitlines()[-18:]:
        linea = re.sub(
            r"(AIza)[A-Za-z0-9_-]{20,}",
            "[CLAVE_OCULTA]",
            linea,
        )
        print(linea, flush=True)


def preparar_servicios():
    print("===== COMPROBAR BASE DE DATOS =====", flush=True)

    with connect() as conn:
        resultado = conn.execute(
            "SELECT current_database() AS nombre"
        ).fetchone()

    if resultado["nombre"] != "conauti_educativo":
        raise RuntimeError(
            "La conexión apunta a una base incorrecta."
        )

    print("POSTGRESQL=OK", flush=True)

    print("===== LOCALIZAR BACKEND ACTUALIZADO =====", flush=True)

    backend_port = None

    for puerto in range(8010, 8031):
        if (
            backend_operativo(puerto)
            and ruta_ia_operativa(puerto)
        ):
            backend_port = puerto
            print(
                "BACKEND_ACTUALIZADO=REUTILIZADO",
                flush=True,
            )
            break

    if backend_port is None:
        backend_port = next(
            (
                puerto
                for puerto in range(8020, 8040)
                if puerto_libre(puerto)
            ),
            None,
        )

        if backend_port is None:
            raise RuntimeError(
                "No hay un puerto libre para FastAPI."
            )

        iniciar(
            [
                sys.executable,
                "-m", "uvicorn",
                "app.main:app",
                "--host", "127.0.0.1",
                "--port", str(backend_port),
            ],
            BACK,
            "backend_f06_final.log",
        )

        if not esperar(
            lambda: backend_operativo(backend_port)
            and ruta_ia_operativa(backend_port)
        ):
            mostrar_registro("backend_f06_final.log")
            raise RuntimeError(
                "No se pudo iniciar FastAPI actualizado."
            )

    print(
        f"BACKEND_PUERTO={backend_port}",
        flush=True,
    )

    print("===== ACTUALIZAR CONEXION REACT =====", flush=True)

    configuracion = FRONT / "vite.conauti.config.ts"
    original = configuracion.read_text(
        encoding="utf-8"
    )

    nuevo, encontrados = re.subn(
        r"target:\s*['\"]http://127\.0\.0\.1:\d+['\"]",
        f"target: 'http://127.0.0.1:{backend_port}'",
        original,
        count=1,
    )

    if encontrados != 1:
        raise RuntimeError(
            "No se pudo reconocer el proxy de React."
        )

    if nuevo != original:
        shutil.copy2(
            configuracion,
            LOG / "vite_previo_f06_final.ts",
        )
        configuracion.write_text(
            nuevo,
            encoding="utf-8",
        )

    print("PROXY=CONFIGURADO", flush=True)

    print("===== COMPROBAR FRONTEND EXISTENTE =====", flush=True)

    frontend_port = None

    for puerto in [5175, 5174, 5176, 5177]:
        if (
            pagina_operativa(puerto)
            and esperar(
                lambda p=puerto: ruta_ia_operativa(p),
                intentos=5,
            )
        ):
            frontend_port = puerto
            print(
                "FRONTEND=REUTILIZADO",
                flush=True,
            )
            break

    if frontend_port is None:
        frontend_port = next(
            (
                puerto
                for puerto in range(5180, 5200)
                if puerto_libre(puerto)
            ),
            None,
        )

        if frontend_port is None:
            raise RuntimeError(
                "No hay puerto libre para React."
            )

        nodo = shutil.which("node")
        vite = (
            FRONT
            / "node_modules"
            / "vite"
            / "bin"
            / "vite.js"
        )

        if not nodo or not vite.exists():
            raise RuntimeError(
                "Node o Vite no están disponibles."
            )

        iniciar(
            [
                nodo,
                str(vite),
                "--config",
                str(configuracion),
                "--host",
                "127.0.0.1",
                "--port",
                str(frontend_port),
                "--strictPort",
            ],
            FRONT,
            "frontend_f06_final.log",
        )

        if not esperar(
            lambda: pagina_operativa(frontend_port)
            and ruta_ia_operativa(frontend_port)
        ):
            mostrar_registro("frontend_f06_final.log")
            raise RuntimeError(
                "React no se conectó con FastAPI."
            )

    print("FRONTEND_BACKEND=OK", flush=True)

    return frontend_port


def validar_navegador(puerto):
    usuario = "f06real_" + uuid4().hex[:10]
    clave = "ConautiPruebaSegura2026!"

    pregunta_1 = (
        "¿Qué es una fracción? "
        "Explícamelo con un ejemplo sencillo."
    )

    pregunta_2 = (
        "Ahora dame otro ejemplo relacionado "
        "con el concepto anterior."
    )

    try:
        with sync_playwright() as playwright:
            navegador = None

            for canal in ("msedge", "chrome"):
                try:
                    navegador = playwright.chromium.launch(
                        channel=canal,
                        headless=True,
                    )
                    print(
                        "NAVEGADOR=" + canal.upper(),
                        flush=True,
                    )
                    break
                except Exception:
                    continue

            if navegador is None:
                raise RuntimeError(
                    "No se pudo utilizar Edge ni Chrome."
                )

            try:
                contexto = navegador.new_context(
                    viewport={
                        "width": 1366,
                        "height": 768,
                    }
                )

                pagina = contexto.new_page()
                pagina.set_default_timeout(65000)

                errores_js = []
                pagina.on(
                    "pageerror",
                    lambda error: errores_js.append(
                        str(error)
                    ),
                )

                pagina.goto(
                    f"http://127.0.0.1:{puerto}/",
                    wait_until="domcontentloaded",
                )

                pagina.get_by_role(
                    "button",
                    name="Registrarse",
                    exact=True,
                ).click()

                pagina.get_by_label(
                    "Usuario",
                    exact=True,
                ).fill(usuario)

                pagina.get_by_label(
                    "Contraseña",
                    exact=True,
                ).fill(clave)

                pagina.get_by_role(
                    "button",
                    name="Crear cuenta",
                ).click()

                expect(
                    pagina.locator(".historial-avanzado")
                ).to_be_visible()

                print("REGISTRO_ESTUDIANTE=OK", flush=True)

                editor = pagina.get_by_label(
                    "Escribe tu mensaje"
                )

                editor.fill(pregunta_1)

                pagina.get_by_role(
                    "button",
                    name=re.compile("^Enviar"),
                ).click()

                expect(
                    pagina.locator(
                        ".message-list article.message"
                    )
                ).to_have_count(2, timeout=65000)

                respuesta = pagina.locator(
                    ".message-list article.message"
                ).nth(1)

                contenido = respuesta.inner_text().strip()

                if (
                    len(contenido) < 40
                    or not any(
                        palabra in contenido.lower()
                        for palabra in (
                            "fracci",
                            "numerador",
                            "denominador",
                            "partes",
                        )
                    )
                ):
                    raise AssertionError(
                        "La respuesta real no superó "
                        "la comprobación básica de pertinencia."
                    )

                print("PRIMERA_RESPUESTA_GEMINI=OK", flush=True)

                editor.fill(pregunta_2)

                pagina.get_by_role(
                    "button",
                    name=re.compile("^Enviar"),
                ).click()

                expect(
                    pagina.locator(
                        ".message-list article.message"
                    )
                ).to_have_count(4, timeout=65000)

                print("CONTEXTO_CONVERSACIONAL=OK", flush=True)
                print("MENSAJES_ANTERIORES=CONSERVADOS", flush=True)

                pagina.reload(
                    wait_until="domcontentloaded"
                )

                elemento = pagina.locator(
                    ".historial-titulo"
                ).filter(has_text=pregunta_1)

                expect(elemento.first).to_be_visible()
                elemento.first.click()

                expect(
                    pagina.locator(
                        ".message-list article.message"
                    )
                ).to_have_count(4)

                print("HISTORIAL_IA_PERSISTENTE=OK", flush=True)

                with connect() as conn:
                    registro = conn.execute(
                        """
                        SELECT COUNT(*) AS total
                        FROM conauti_messages m
                        JOIN conauti_conversations c
                          ON c.id = m.conversation_id
                        JOIN conauti_users u
                          ON u.id = c.user_id
                        WHERE u.username = %s
                        """,
                        (usuario,),
                    ).fetchone()

                if registro["total"] != 4:
                    raise AssertionError(
                        "Los mensajes no coinciden "
                        "con los datos persistidos."
                    )

                print("POSTGRESQL_MENSAJES_IA=OK", flush=True)

                if errores_js:
                    raise AssertionError(
                        "Se detectaron errores de JavaScript."
                    )

                print("SIN_ERRORES_JAVASCRIPT=OK", flush=True)

                contexto.close()

            finally:
                navegador.close()

    finally:
        with connect() as conn:
            conn.execute(
                """
                DELETE FROM conauti_users
                WHERE username = %s
                """,
                (usuario,),
            )

        print("CUENTA_DE_PRUEBA=ELIMINADA", flush=True)


def principal():
    puerto = preparar_servicios()

    print("===== PROBAR CHAT CON IA REAL =====", flush=True)

    validar_navegador(puerto)

    print("==========================================")
    print("GEMINI_REAL=VALIDADO")
    print("CHAT_IA=FUNCIONAL")
    print("CONTEXTO=VALIDADO")
    print("PERSISTENCIA=VALIDADA")
    print("FASE_06=COMPLETADA")
    print("AVANCE_GLOBAL=38%")
    print(f"URL=http://127.0.0.1:{puerto}/")
    print("==========================================")


if __name__ == "__main__":
    try:
        principal()
    except Exception as error:
        print(
            "VALIDACION=ERROR_"
            + type(error).__name__,
            flush=True,
        )
        print(
            "DETALLE=" + str(error)[:600],
            flush=True,
        )
        print("FASE_06=EN_VALIDACION", flush=True)
        print("AVANCE_GLOBAL=30%", flush=True)
        sys.exit(1)
