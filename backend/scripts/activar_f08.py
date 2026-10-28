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


def check_url(url):
    try:
        with opener.open(url, timeout=3) as result:
            return result.status, result.read().decode(
                "utf-8",
                errors="replace",
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


def start(command, folder, filename):
    with (LOG / filename).open(
        "a",
        encoding="utf-8",
    ) as stream:
        stream.write("\n===== FASE 08 =====\n")
        stream.flush()

        process = subprocess.Popen(
            command,
            cwd=str(folder),
            stdin=subprocess.DEVNULL,
            stdout=stream,
            stderr=subprocess.STDOUT,
            close_fds=True,
            creationflags=NO_WINDOW,
        )

    print(
        f"PROCESO_SIN_CMD={process.pid}",
        flush=True,
    )


def api_ready(port):
    status, content = check_url(
        f"http://127.0.0.1:{port}"
        "/api/conauti/health/db"
    )

    voice_status, _ = check_url(
        f"http://127.0.0.1:{port}"
        "/api/conauti/voice/status"
    )

    if status != 200 or voice_status != 401:
        return False

    try:
        return (
            json.loads(content).get("database")
            == "conauti_educativo"
        )
    except (TypeError, ValueError):
        return False


def frontend_ready(port):
    status, html = check_url(
        f"http://127.0.0.1:{port}/"
    )

    return (
        status == 200
        and "CONAUTI | Asistente Educativo" in html
    )


def main():
    backend_port = next(
        (
            port for port in range(8060, 8090)
            if free(port)
        ),
        None,
    )

    if backend_port is None:
        raise RuntimeError(
            "No hay puerto libre para FastAPI."
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
        "backend_f08.log",
    )

    if not wait(lambda: api_ready(backend_port)):
        raise RuntimeError(
            "FastAPI no pudo iniciar la API de voz."
        )

    print("BACKEND_VOZ=OK", flush=True)

    config = FRONT / "vite.conauti.config.ts"
    source = config.read_text(encoding="utf-8")

    changed, matches = re.subn(
        r"target:\s*['\"]http://127\.0\.0\.1:\d+['\"]",
        f"target: 'http://127.0.0.1:{backend_port}'",
        source,
        count=1,
    )

    if matches != 1:
        raise RuntimeError(
            "No se reconoció la configuración de Vite."
        )

    if changed != source:
        shutil.copy2(
            config,
            LOG / "vite_anterior_f08.ts",
        )

        config.write_text(
            changed,
            encoding="utf-8",
        )

    frontend_port = None

    for port in (5175, 5174, 5176, 5177):
        if frontend_ready(port) and wait(
            lambda p=port: (
                check_url(
                    f"http://127.0.0.1:{p}"
                    "/api/conauti/voice/status"
                )[0] == 401
            )
        ):
            frontend_port = port
            print("FRONTEND=REUTILIZADO", flush=True)
            break

    if frontend_port is None:
        frontend_port = next(
            (
                port for port in range(5210, 5230)
                if free(port)
            ),
            None,
        )

        if frontend_port is None:
            raise RuntimeError(
                "No hay puerto libre para React."
            )

        node = shutil.which("node")
        vite = (
            FRONT / "node_modules"
            / "vite" / "bin" / "vite.js"
        )

        if not node or not vite.exists():
            raise RuntimeError(
                "No se encontró Node o Vite."
            )

        start(
            [
                node,
                str(vite),
                "--config", str(config),
                "--host", "127.0.0.1",
                "--port", str(frontend_port),
                "--strictPort",
            ],
            FRONT,
            "frontend_f08.log",
        )

        if not wait(
            lambda: frontend_ready(frontend_port)
            and check_url(
                f"http://127.0.0.1:{frontend_port}"
                "/api/conauti/voice/status"
            )[0] == 401
        ):
            raise RuntimeError(
                "No se pudo conectar React y la API de voz."
            )

    print("FRONTEND_VOZ=OK", flush=True)
    print("MICROFONO_REQUIERE_PERMISO=SI")
    print("GRABACION_AUTOMATICA=NO")
    print("PERSISTENCIA_AUDIO=NO")
    print("==========================================")
    print("SERVICIOS_F08=ACTIVOS")
    print("FASE_08=EN_VALIDACION")
    print("AVANCE_GLOBAL=48%")
    print(f"URL=http://127.0.0.1:{frontend_port}/")
    print("==========================================")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(
            "ACTIVACION_F08=ERROR_"
            + type(error).__name__,
            flush=True,
        )
        print(
            "DETALLE=" + str(error)[:500],
            flush=True,
        )
        sys.exit(1)
