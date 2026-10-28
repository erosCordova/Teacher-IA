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

ROOT = Path(__file__).resolve().parents[2]
BACK = ROOT / "backend"
FRONT = ROOT / "frontend"
LOGS = ROOT / ".conauti-backups"
LOGS.mkdir(exist_ok=True)

NO_WINDOW = getattr(
    subprocess, "CREATE_NO_WINDOW", 0x08000000
)

opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({})
)


def consultar(url):
    try:
        with opener.open(url, timeout=3) as respuesta:
            return respuesta.status, respuesta.read().decode(
                "utf-8", errors="replace"
            )
    except urllib.error.HTTPError as error:
        return error.code, ""
    except Exception:
        return None, ""


def disponible(port):
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def puerto_libre(opciones):
    return next(
        (port for port in opciones if disponible(port)),
        None,
    )


def iniciar(comando, carpeta, archivo):
    ruta = LOGS / archivo

    with ruta.open("a", encoding="utf-8") as salida:
        salida.write("\n===== NUEVO INICIO =====\n")
        salida.flush()

        proceso = subprocess.Popen(
            comando,
            cwd=str(carpeta),
            stdin=subprocess.DEVNULL,
            stdout=salida,
            stderr=subprocess.STDOUT,
            creationflags=NO_WINDOW,
            close_fds=True,
        )

    print(
        f"PROCESO_OCULTO_INICIADO={proceso.pid}",
        flush=True,
    )


def esperar(comprobacion):
    for intento in range(20):
        if comprobacion():
            return True
        time.sleep(1)

    return comprobacion()


def mostrar_error(archivo):
    ruta = LOGS / archivo

    if ruta.exists():
        print("===== REGISTRO DE ERROR =====")

        for linea in ruta.read_text(
            encoding="utf-8",
            errors="replace",
        ).splitlines()[-15:]:
            linea = re.sub(
                r"(postgres(?:ql)?://[^:\s@]+:)[^@\s]+(@)",
                r"\1***\2",
                linea,
                flags=re.IGNORECASE,
            )
            print(linea, flush=True)


def backend_correcto(port):
    status, cuerpo = consultar(
        f"http://127.0.0.1:{port}"
        "/api/conauti/health/db"
    )

    if status != 200:
        return False

    try:
        return (
            json.loads(cuerpo).get("database")
            == "conauti_educativo"
        )
    except (ValueError, TypeError):
        return False


def main():
    print("===== COMPROBAR POSTGRESQL =====", flush=True)

    from app.conauti_auth import connect

    try:
        with connect() as conn:
            resultado = conn.execute(
                "SELECT current_database() AS nombre"
            ).fetchone()

        if resultado["nombre"] != "conauti_educativo":
            print("POSTGRESQL=BASE_INCORRECTA")
            return

    except Exception as error:
        print(
            "POSTGRESQL=ERROR_"
            + type(error).__name__,
            flush=True,
        )
        return

    print("POSTGRESQL=OK", flush=True)

    print("===== PREPARAR BACKEND OCULTO =====", flush=True)

    # Usamos puertos alternativos para no terminar
    # procesos que pudieran estar funcionando.
    backend_port = puerto_libre(
        [8011, 8012, 8013, 8014, 8015]
    )

    if backend_port is None:
        print("ERROR=SIN_PUERTO_BACKEND")
        return

    iniciar(
        [
            sys.executable,
            "-m", "uvicorn",
            "app.main:app",
            "--host", "127.0.0.1",
            "--port", str(backend_port),
        ],
        BACK,
        "backend_sin_ventana.log",
    )

    if not esperar(
        lambda: backend_correcto(backend_port)
    ):
        print("BACKEND=ERROR", flush=True)
        mostrar_error("backend_sin_ventana.log")
        return

    print("BACKEND=ACTIVO_SIN_CONSOLA", flush=True)

    print("===== CONFIGURAR FRONTEND =====", flush=True)

    config = FRONT / "vite.conauti.config.ts"
    original = config.read_text(encoding="utf-8")

    actualizado, cantidad = re.subn(
        r"target:\s*['\"]http://127\.0\.0\.1:\d+['\"]",
        f"target: 'http://127.0.0.1:{backend_port}'",
        original,
        count=1,
    )

    if cantidad != 1:
        print("ERROR=CONFIGURACION_PROXY_NO_RECONOCIDA")
        return

    if actualizado != original:
        respaldo = LOGS / "vite_antes_sin_ventana.ts"
        if not respaldo.exists():
            shutil.copy2(config, respaldo)

        config.write_text(
            actualizado,
            encoding="utf-8",
        )

    frontend_port = puerto_libre(
        [5175, 5176, 5177, 5178, 5179]
    )

    if frontend_port is None:
        print("ERROR=SIN_PUERTO_FRONTEND")
        return

    node = shutil.which("node")

    vite = (
        FRONT / "node_modules"
        / "vite" / "bin" / "vite.js"
    )

    if not node or not vite.exists():
        print("ERROR=NODE_O_VITE_NO_ENCONTRADO")
        return

    print("===== INICIAR REACT SIN CMD =====", flush=True)

    iniciar(
        [
            node,
            str(vite),
            "--config", str(config),
            "--host", "127.0.0.1",
            "--port", str(frontend_port),
            "--strictPort",
        ],
        FRONT,
        "frontend_sin_ventana.log",
    )

    def frontend_correcto():
        status, html = consultar(
            f"http://127.0.0.1:{frontend_port}/"
        )

        return (
            status == 200
            and "CONAUTI | Asistente Educativo" in html
        )

    if not esperar(frontend_correcto):
        print("FRONTEND=ERROR", flush=True)
        mostrar_error("frontend_sin_ventana.log")
        return

    print("FRONTEND=ACTIVO_SIN_CONSOLA", flush=True)

    print("===== VALIDAR INTEGRACION =====", flush=True)

    if not esperar(
        lambda: backend_correcto(frontend_port)
    ):
        print("INTEGRACION=ERROR", flush=True)
        mostrar_error("frontend_sin_ventana.log")
        return

    print("==========================================")
    print("RESULTADO=SERVICIOS_INDEPENDIENTES_OK")
    print("BACKEND=OK")
    print("FRONTEND=OK")
    print("POSTGRESQL=OK")
    print("VENTANAS_CMD_NUEVAS=NO")
    print("AVANCE_GLOBAL=23%")
    print(
        f"URL=http://127.0.0.1:{frontend_port}/"
    )
    print("==========================================")


if __name__ == "__main__":
    sys.path.insert(0, str(BACK))
    main()
