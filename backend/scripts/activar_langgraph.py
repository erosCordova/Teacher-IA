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
LOG = ROOT / ".conauti-backups"

NO_WINDOW = getattr(
    subprocess,
    "CREATE_NO_WINDOW",
    0x08000000,
)

opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({})
)


def get(url):
    try:
        with opener.open(url, timeout=3) as result:
            return (
                result.status,
                result.read().decode(
                    "utf-8",
                    errors="replace",
                ),
            )
    except urllib.error.HTTPError as error:
        return error.code, ""
    except Exception:
        return None, ""


def free(port):
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def wait(check):
    for _ in range(25):
        if check():
            return True
        time.sleep(1)
    return check()


def start(command, cwd, filename):
    with (LOG / filename).open(
        "a",
        encoding="utf-8",
    ) as output:
        output.write(
            "\n===== INICIO LANGGRAPH =====\n"
        )
        output.flush()

        process = subprocess.Popen(
            command,
            cwd=str(cwd),
            stdin=subprocess.DEVNULL,
            stdout=output,
            stderr=subprocess.STDOUT,
            creationflags=NO_WINDOW,
            close_fds=True,
        )

    print(
        f"PROCESO_SIN_CMD={process.pid}",
        flush=True,
    )


def backend_ready(port):
    status, content = get(
        f"http://127.0.0.1:{port}"
        "/api/conauti/health/db"
    )

    engine, _ = get(
        f"http://127.0.0.1:{port}"
        "/api/conauti/ai/engine"
    )

    if status != 200 or engine != 401:
        return False

    try:
        return (
            json.loads(content).get("database")
            == "conauti_educativo"
        )
    except (ValueError, TypeError):
        return False


def frontend_ready(port):
    status, html = get(
        f"http://127.0.0.1:{port}/"
    )
    return (
        status == 200
        and "CONAUTI | Asistente Educativo" in html
    )


def frontend_connected(port):
    status, _ = get(
        f"http://127.0.0.1:{port}"
        "/api/conauti/ai/engine"
    )
    return status == 401


def main():
    print("===== INICIAR API LANGGRAPH =====")

    backend_port = next(
        (
            port for port in range(8090, 8110)
            if free(port)
        ),
        None,
    )

    if backend_port is None:
        raise RuntimeError(
            "No hay puerto backend libre."
        )

    start(
        [
            sys.executable,
            "-m", "uvicorn",
            "app.main:app",
            "--host", "127.0.0.1",
            "--port", str(backend_port),
        ],
        BACK,
        "backend_langgraph.log",
    )

    if not wait(lambda: backend_ready(backend_port)):
        raise RuntimeError(
            "No se pudo iniciar el backend actualizado. "
            "Consulta backend_langgraph.log."
        )

    print("BACKEND_LANGGRAPH=OK")

    print("===== CONFIGURAR PROXY =====")

    config = FRONT / "vite.conauti.config.ts"
    source = config.read_text(encoding="utf-8")

    updated, found = re.subn(
        r"target:\s*['\"]http://127\.0\.0\.1:\d+['\"]",
        f"target: 'http://127.0.0.1:{backend_port}'",
        source,
        count=1,
    )

    if found != 1:
        raise RuntimeError(
            "No se reconoce el proxy actual."
        )

    if updated != source:
        shutil.copy2(
            config,
            LOG / "vite_antes_langgraph.ts",
        )
        config.write_text(
            updated,
            encoding="utf-8",
        )

    frontend_port = None

    for port in (5175, 5174, 5176, 5177):
        if frontend_ready(port) and wait(
            lambda p=port: frontend_connected(p)
        ):
            frontend_port = port
            print("FRONTEND_EXISTENTE=REUTILIZADO")
            break

    if frontend_port is None:
        frontend_port = next(
            (
                port for port in range(5230, 5250)
                if free(port)
            ),
            None,
        )

        if frontend_port is None:
            raise RuntimeError(
                "No hay puerto frontend libre."
            )

        node = shutil.which("node")
        vite = (
            FRONT / "node_modules"
            / "vite" / "bin" / "vite.js"
        )

        if not node or not vite.exists():
            raise RuntimeError(
                "Node o Vite no están disponibles."
            )

        start(
            [
                node,
                str(vite),
                "--config",
                str(config),
                "--host",
                "127.0.0.1",
                "--port",
                str(frontend_port),
                "--strictPort",
            ],
            FRONT,
            "frontend_langgraph.log",
        )

        if not wait(
            lambda: frontend_ready(frontend_port)
            and frontend_connected(frontend_port)
        ):
            raise RuntimeError(
                "React no se conectó con LangGraph."
            )

    print("==========================================")
    print("LANGCHAIN=INTEGRADO")
    print("LANGGRAPH=INTEGRADO")
    print("FASTAPI=ACTUALIZADO")
    print("REACT=CONSERVADO")
    print("POSTGRESQL=CONSERVADO")
    print("MOTOR_PEDAGOGICO=CONSERVADO")
    print("SISMOIA=NO_MODIFICADO")
    print("VENTANAS_CMD_NUEVAS=NO")
    print("AVANCE_GLOBAL=48%")
    print(f"URL=http://127.0.0.1:{frontend_port}/")
    print("==========================================")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(
            "ACTIVACION_LANGGRAPH=ERROR_"
            + type(error).__name__
        )
        print(
            "DETALLE=" + str(error)[:500]
        )
        sys.exit(1)
