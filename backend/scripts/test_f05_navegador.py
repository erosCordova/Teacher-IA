import secrets
import sys
import traceback

from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright, expect

from app.main import app
from app.conauti_auth import connect


URL = "http://127.0.0.1:5175/"
SUFIJO = secrets.token_hex(5)
USUARIO_A = "hist_a_" + SUFIJO
USUARIO_B = "hist_b_" + SUFIJO
CLAVE = "ClaveSeguraConauti2026!"
TEXTO_UNICO = "busquedaunica" + SUFIJO

contador = 0


def comprobar(nombre, condicion=True):
    global contador

    if not condicion:
        raise AssertionError(nombre)

    contador += 1
    print(f"{nombre}=OK", flush=True)


def preparar_datos():
    with TestClient(app) as cliente:
        tokens = {}

        for usuario in (USUARIO_A, USUARIO_B):
            registro = cliente.post(
                "/api/conauti/auth/register",
                json={
                    "username": usuario,
                    "password": CLAVE,
                },
            )
            comprobar(
                "REGISTRO_" + usuario[:6],
                registro.status_code == 201,
            )

            acceso = cliente.post(
                "/api/conauti/auth/login",
                json={
                    "username": usuario,
                    "password": CLAVE,
                },
            )
            comprobar(
                "ACCESO_" + usuario[:6],
                acceso.status_code == 200,
            )

            tokens[usuario] = {
                "Authorization": (
                    "Bearer "
                    + acceso.json()["access_token"]
                )
            }

        cabecera_a = tokens[USUARIO_A]
        cabecera_b = tokens[USUARIO_B]
        conversacion_principal = None

        for numero in range(21):
            respuesta = cliente.post(
                "/api/conauti/conversations",
                headers=cabecera_a,
                json={
                    "title": f"Unidad CONAUTI {numero:02d}"
                },
            )
            comprobar(
                "CREACION_" + str(numero),
                respuesta.status_code == 201,
            )

            if numero == 0:
                conversacion_principal = respuesta.json()["id"]

        for numero in range(61):
            cuerpo = f"Mensaje educativo {numero:02d}"

            if numero == 4:
                cuerpo += " " + TEXTO_UNICO

            respuesta = cliente.post(
                "/api/conauti/conversations/"
                + conversacion_principal + "/messages",
                headers=cabecera_a,
                json={"body": cuerpo},
            )

            if respuesta.status_code != 201:
                raise AssertionError(
                    f"No se guardo mensaje {numero}"
                )

        comprobar("SESENTA_Y_UN_MENSAJES_CREADOS")

        busqueda = cliente.get(
            "/api/conauti/history/conversations",
            params={"search": TEXTO_UNICO},
            headers=cabecera_a,
        )

        comprobar(
            "BUSQUEDA_API_POR_CONTENIDO",
            busqueda.status_code == 200
            and busqueda.json()["total"] == 1,
        )

        aislamiento = cliente.get(
            "/api/conauti/history/conversations",
            headers=cabecera_b,
        )

        comprobar(
            "AISLAMIENTO_ENTRE_CUENTAS",
            aislamiento.status_code == 200
            and aislamiento.json()["total"] == 0,
        )


def entrar(pagina, usuario):
    pagina.goto(URL, wait_until="domcontentloaded")

    pagina.get_by_label(
        "Usuario", exact=True
    ).fill(usuario)

    pagina.get_by_label(
        "Contraseña", exact=True
    ).fill(CLAVE)

    pagina.get_by_role(
        "button",
        name="Iniciar sesión",
        exact=True,
    ).click()

    expect(
        pagina.locator(".historial-fila")
    ).to_have_count(
        15 if usuario == USUARIO_A else 0,
        timeout=20000,
    )


def comprobar_navegador():
    with sync_playwright() as playwright:
        navegador = None

        for canal in ("msedge", "chrome"):
            try:
                navegador = playwright.chromium.launch(
                    channel=canal,
                    headless=True,
                )
                print("NAVEGADOR=" + canal.upper())
                break
            except Exception:
                continue

        if navegador is None:
            raise RuntimeError(
                "No se pudo abrir Edge ni Chrome."
            )

        try:
            contexto_a = navegador.new_context(
                viewport={
                    "width": 1366,
                    "height": 768,
                }
            )
            pagina = contexto_a.new_page()
            pagina.set_default_timeout(15000)

            print("===== INICIAR SESION A =====")
            entrar(pagina, USUARIO_A)
            comprobar("HISTORIAL_PRIMERA_PAGINA")

            print("===== PAGINACION =====")
            pagina.get_by_role(
                "button",
                name="Siguiente",
                exact=True,
            ).click()

            expect(
                pagina.locator(".historial-fila")
            ).to_have_count(6)

            comprobar("HISTORIAL_SEGUNDA_PAGINA")

            pagina.get_by_role(
                "button",
                name="Anterior",
                exact=True,
            ).click()

            expect(
                pagina.locator(".historial-fila")
            ).to_have_count(15)

            comprobar("REGRESO_PRIMERA_PAGINA")

            print("===== BUSQUEDA EN MENSAJES =====")

            buscador = pagina.get_by_role(
                "searchbox",
                name="Buscar en títulos y mensajes",
            )

            buscador.fill(TEXTO_UNICO)

            expect(
                pagina.locator(".historial-fila")
            ).to_have_count(1)

            comprobar("BUSQUEDA_FRONTEND_REAL")

            pagina.locator(
                ".historial-titulo"
            ).click()

            print("===== RECUPERAR MENSAJES =====")

            expect(
                pagina.locator(".message-list .message")
            ).to_have_count(30)

            comprobar("ULTIMOS_TREINTA_MENSAJES")

            boton = pagina.locator(
                ".mensajes-anteriores"
            )

            expect(boton).to_be_visible()

            boton.click()

            expect(
                pagina.locator(".message-list .message")
            ).to_have_count(60)

            comprobar("CARGA_MENSAJES_ANTERIORES")

            boton.click()

            expect(
                pagina.locator(".message-list .message")
            ).to_have_count(61)

            expect(boton).to_have_count(0)

            comprobar("HISTORIAL_COMPLETO_SIN_DUPLICADOS")

            print("===== SEGUNDA SESION =====")

            contexto_b = navegador.new_context()
            segunda = contexto_b.new_page()
            segunda.set_default_timeout(15000)

            entrar(segunda, USUARIO_B)

            comprobar("SEGUNDA_CUENTA_SIN_DATOS_AJENOS")

            contexto_b.close()

            print("===== RECARGA Y RECUPERACION =====")

            pagina.reload(
                wait_until="domcontentloaded"
            )

            expect(
                pagina.locator(".historial-fila")
            ).to_have_count(15)

            comprobar("HISTORIAL_PERSISTE_TRAS_RECARGA")

            print("===== NAVEGACION MOVIL =====")

            pagina.set_viewport_size({
                "width": 390,
                "height": 844,
            })

            dimensiones = pagina.evaluate(
                """() => ({
                    ventana: window.innerWidth,
                    documento:
                        document.documentElement.scrollWidth
                })"""
            )

            comprobar(
                "SIN_DESBORDAMIENTO_MOVIL",
                dimensiones["documento"]
                <= dimensiones["ventana"] + 2,
            )

            contexto_a.close()

        finally:
            navegador.close()


def limpiar():
    try:
        with connect() as conn:
            conn.execute(
                """
                DELETE FROM conauti_users
                WHERE username = ANY(%s)
                """,
                ([USUARIO_A, USUARIO_B],),
            )

        print("CUENTAS_TEMPORALES=ELIMINADAS")

    except Exception as error:
        print(
            "LIMPIEZA=ERROR_"
            + type(error).__name__
        )


resultado = 1

try:
    preparar_datos()
    comprobar_navegador()

    print("==========================================")
    print("VALIDACION_F05=EXITOSA")
    print(f"COMPROBACIONES_SUPERADAS={contador}")
    print("AVANCE_GLOBAL_ACREDITADO=30%")
    resultado = 0

except Exception as error:
    print("==========================================")
    print("VALIDACION_F05=ERROR")
    print(
        "ERROR="
        + type(error).__name__
        + ": "
        + str(error)[:900]
    )
    print(f"COMPROBACIONES_SUPERADAS={contador}")
    print("AVANCE_GLOBAL_ACREDITADO=23%")
    traceback.print_exc()

finally:
    limpiar()

sys.exit(resultado)
