import re
import secrets
import sys
import traceback

from playwright.sync_api import (
    sync_playwright,
    expect,
)

from app.conauti_auth import connect


URL = "http://127.0.0.1:5174/"
USERNAME = "testf04_" + secrets.token_hex(5)
PASSWORD = "PruebaConauti2026!Segura"
MESSAGE = "Prueba F04: quiero practicar fracciones"
NEW_TITLE = "Historial validado F04"

passed = []
browser = None


def check(name, condition=True):
    if not condition:
        raise AssertionError(name)

    passed.append(name)
    print(f"{name}=OK", flush=True)


def cleanup():
    try:
        with connect() as conn:
            conn.execute(
                """
                DELETE FROM conauti_users
                WHERE username = %s
                """,
                (USERNAME,),
            )

        print("CUENTA_TEMPORAL=LIMPIADA", flush=True)

    except Exception as error:
        print(
            "LIMPIEZA=ERROR_" + type(error).__name__,
            flush=True,
        )


def run():
    global browser

    with sync_playwright() as playwright:

        print("===== INICIAR NAVEGADOR REAL =====", flush=True)

        last_error = None

        for channel in ("msedge", "chrome"):
            try:
                browser = playwright.chromium.launch(
                    channel=channel,
                    headless=True,
                )
                print(
                    "NAVEGADOR=" + channel.upper(),
                    flush=True,
                )
                break

            except Exception as error:
                last_error = error

        if browser is None:
            raise RuntimeError(
                "No fue posible abrir Edge ni Chrome "
                "con Playwright: "
                + str(last_error)[:300]
            )

        context = browser.new_context(
            viewport={"width": 1366, "height": 768},
            accept_downloads=True,
        )

        page = context.new_page()
        page.set_default_timeout(15000)

        js_errors = []

        page.on(
            "pageerror",
            lambda error: js_errors.append(str(error)),
        )

        print("===== VALIDAR PANTALLA DE ACCESO =====", flush=True)

        response = page.goto(
            URL,
            wait_until="domcontentloaded",
            timeout=20000,
        )

        check(
            "PAGINA_HTTP",
            response is not None and response.status == 200,
        )

        expect(
            page.get_by_role(
                "heading",
                name="Aprender es descubrir",
            )
        ).to_be_visible()

        check("PANTALLA_LOGIN")

        print("===== REGISTRO REAL =====", flush=True)

        page.get_by_role(
            "button",
            name="Registrarse",
        ).click()

        page.get_by_label(
            "Usuario",
            exact=True,
        ).fill(USERNAME)

        page.get_by_label(
            "Contraseña",
            exact=True,
        ).fill(PASSWORD)

        page.get_by_role(
            "button",
            name="Crear cuenta",
        ).click()

        expect(
            page.get_by_role(
                "button",
                name="+ Nueva conversación",
            )
        ).to_be_visible(timeout=20000)

        check("REGISTRO_E_INICIO_SESION")

        print("===== VALIDAR NAVEGACION =====", flush=True)

        page.get_by_role(
            "button",
            name=re.compile("Mi progreso"),
        ).click()

        expect(
            page.get_by_role(
                "heading",
                name="Mi progreso", exact=True,
            )
        ).to_be_visible()

        check("NAVEGACION_PROGRESO")

        page.get_by_role(
            "button",
            name=re.compile("Configuración"),
        ).click()

        expect(
            page.locator(".panel").get_by_text(
                re.compile(re.escape(USERNAME)),
            )
        ).to_be_visible()

        check("NAVEGACION_CONFIGURACION")

        page.get_by_role(
            "button",
            name=re.compile("Privacidad"),
        ).click()

        expect(
            page.get_by_role(
                "button",
                name="Exportar mis datos",
            )
        ).to_be_visible()

        check("NAVEGACION_PRIVACIDAD")

        page.get_by_role(
            "button",
            name=re.compile("Conversaciones"),
        ).click()

        check("NAVEGACION_CHAT")

        print("===== VALIDAR ACCIONES DEL CHAT =====", flush=True)

        page.get_by_role(
            "button",
            name="Dame una pista",
        ).click()

        editor = page.get_by_label(
            "Escribe tu mensaje",
        )

        check(
            "ACCION_PISTA",
            editor.input_value().startswith(
                "Dame una pista"
            ),
        )

        editor.fill(MESSAGE)
        editor.press("Control+Enter")

        expect(
            page.locator("article.message p").filter(has_text=MESSAGE)
        ).to_be_visible(timeout=20000)

        check("MENSAJE_GUARDADO_DESDE_NAVEGADOR")
        check("ATAJO_CTRL_ENTER")

        print("===== VALIDAR PERSISTENCIA =====", flush=True)

        page.reload(wait_until="domcontentloaded")

        expect(
            page.get_by_role(
                "button",
                name=MESSAGE, exact=True,
            )
        ).to_be_visible(timeout=20000)

        check("HISTORIAL_TRAS_RECARGA")

        page.get_by_role(
            "button",
            name=MESSAGE, exact=True,
        ).click()

        expect(
            page.locator("article.message p").filter(has_text=MESSAGE)
        ).to_be_visible()

        check("RECUPERACION_DE_MENSAJES")

        print("===== VALIDAR RENOMBRADO Y BUSQUEDA =====", flush=True)

        page.once(
            "dialog",
            lambda dialog: dialog.accept(NEW_TITLE),
        )

        page.get_by_role(
            "button",
            name=re.compile("^Renombrar "),
        ).click()

        expect(
            page.get_by_role(
                "button",
                name=NEW_TITLE,
                exact=True,
            )
        ).to_be_visible()

        check("RENOMBRAR_CONVERSACION")

        search = page.get_by_role(
            "searchbox",
            name="Buscar conversaciones",
        )

        search.fill("texto_inexistente_9999")

        expect(
            page.get_by_role(
                "button",
                name=NEW_TITLE,
                exact=True,
            )
        ).to_have_count(0)

        search.fill("Historial validado")

        expect(
            page.get_by_role(
                "button",
                name=NEW_TITLE,
                exact=True,
            )
        ).to_be_visible()

        check("BUSQUEDA_HISTORIAL")

        search.fill("")

        print("===== VALIDAR SEGUNDA SESION =====", flush=True)

        second_context = browser.new_context(
            viewport={"width": 1280, "height": 800},
        )

        second = second_context.new_page()
        second.goto(URL, wait_until="domcontentloaded")

        second.get_by_label(
            "Usuario",
            exact=True,
        ).fill(USERNAME)

        second.get_by_label(
            "Contraseña",
            exact=True,
        ).fill(PASSWORD)

        second.get_by_role(
            "button",
            name="Iniciar sesión",
        ).click()

        expect(
            second.get_by_role(
                "button",
                name=NEW_TITLE,
                exact=True,
            )
        ).to_be_visible(timeout=20000)

        second.get_by_role(
            "button",
            name=NEW_TITLE,
            exact=True,
        ).click()

        expect(
            second.locator("article.message p").filter(has_text=MESSAGE)
        ).to_be_visible()

        check("HISTORIAL_EN_SEGUNDA_SESION")

        second_context.close()

        print("===== VALIDAR DISENO MOVIL =====", flush=True)

        page.set_viewport_size({
            "width": 390,
            "height": 844,
        })

        expect(
            page.get_by_role(
                "button",
                name=re.compile("Mi progreso"),
            )
        ).to_be_visible()

        dimensions = page.evaluate(
            """() => ({
                width: window.innerWidth,
                document: document.documentElement.scrollWidth
            })"""
        )

        check(
            "SIN_DESBORDAMIENTO_HORIZONTAL_MOVIL",
            dimensions["document"]
            <= dimensions["width"] + 2,
        )

        page.get_by_role(
            "button",
            name=re.compile("Mi progreso"),
        ).click()

        expect(
            page.get_by_role(
                "heading",
                name="Mi progreso", exact=True,
            )
        ).to_be_visible()

        check("NAVEGACION_MOVIL")

        page.set_viewport_size({
            "width": 1366,
            "height": 768,
        })

        print("===== VALIDAR EXPORTACION =====", flush=True)

        page.get_by_role(
            "button",
            name=re.compile("Privacidad"),
        ).click()

        with page.expect_download() as download_info:
            page.get_by_role(
                "button",
                name="Exportar mis datos",
            ).click()

        download = download_info.value

        check(
            "EXPORTACION_JSON",
            download.suggested_filename.endswith(".json"),
        )

        print("===== VALIDAR ELIMINACION =====", flush=True)

        page.get_by_role(
            "button",
            name=re.compile("Conversaciones"),
        ).click()

        page.once(
            "dialog",
            lambda dialog: dialog.accept(),
        )

        page.get_by_role(
            "button",
            name="Eliminar " + NEW_TITLE,
        ).click()

        expect(
            page.get_by_role(
                "button",
                name=NEW_TITLE,
                exact=True,
            )
        ).to_have_count(0)

        check("ELIMINACION_CONVERSACION")

        print("===== VALIDAR CIERRE DE SESION =====", flush=True)

        page.get_by_role(
            "button",
            name="Salir",
        ).click()

        expect(
            page.get_by_role(
                "heading",
                name="Aprender es descubrir",
            )
        ).to_be_visible(timeout=20000)

        check("CIERRE_DE_SESION")

        print("===== VALIDAR ERRORES DE JAVASCRIPT =====", flush=True)

        if js_errors:
            for error in js_errors[:5]:
                print(
                    "ERROR_JS=" + error[:300],
                    flush=True,
                )

        check(
            "SIN_EXCEPCIONES_JAVASCRIPT",
            len(js_errors) == 0,
        )

        context.close()


try:
    run()

    print("==========================================", flush=True)
    print("RESULTADO_PRUEBAS_UI=EXITOSO", flush=True)
    print(f"PRUEBAS_SUPERADAS={len(passed)}", flush=True)
    print("FASE_04=VALIDADA_AUTOMATICAMENTE", flush=True)
    print("AVANCE_GLOBAL_ACREDITADO=23%", flush=True)
    print("SIGUIENTE_FASE=05_HISTORIAL_PERSISTENTE", flush=True)

except Exception as error:
    print("==========================================", flush=True)
    print("RESULTADO_PRUEBAS_UI=ERROR", flush=True)
    print(
        "ERROR=" + type(error).__name__ + ": " + str(error)[:900],
        flush=True,
    )
    print(f"PRUEBAS_SUPERADAS={len(passed)}", flush=True)
    print("FASE_04=REQUIERE_CORRECCION", flush=True)
    print("AVANCE_GLOBAL_ACREDITADO=16%", flush=True)
    traceback.print_exc()
    sys.exit(1)

finally:
    cleanup()
