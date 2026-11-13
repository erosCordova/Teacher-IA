#!/usr/bin/env python3
"""Diagnóstico seguro para un teléfono Android físico con My Teacher IA.

No cambia la red, no accede a chats ni credenciales y no ejecuta pruebas
artificiales. Solo --medir abre la aplicación y toma dos muestras de memoria.
No significa por sí solo que se hayan probado inferencia, voz o consumo real.
Uso en Git Bash con Android Platform Tools instalado:
    python mobile/scripts/auditar_telefono_arm64.py
    python mobile/scripts/auditar_telefono_arm64.py --medir --segundos 25
"""
import argparse
import json
import re
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = "pe.myteacheria.alumno"

def ejecutar(*args, serial=None, timeout=30, permitir_error=False):
    cmd = ["adb"]
    if serial:
        cmd += ["-s", serial]
    cmd += list(args)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode and not permitir_error:
        raise RuntimeError(f"ADB no pudo ejecutar {args[0]}: {result.stderr.strip()[:350]}")
    return result.stdout.strip()

def dispositivos():
    salida = ejecutar("devices", "-l")
    dispositivos = []
    for linea in salida.splitlines()[1:]:
        partes = linea.split()
        if len(partes) >= 2 and partes[1] == "device":
            dispositivos.append(partes[0])
    return dispositivos

def propiedad(serial, nombre):
    return ejecutar("shell", "getprop", nombre, serial=serial)

def nivel_bateria(salida):
    m = re.search(r"(?m)^\s*level:\s*(\d+)\s*$", salida)
    return int(m.group(1)) if m else None

def total_memoria_mib(salida):
    m = re.search(r"(?m)^MemTotal:\s*(\d+)\s+kB", salida)
    return round(int(m.group(1)) / 1024) if m else None

def pss_mib(salida):
    m = re.search(r"(?m)TOTAL PSS:\s*([\d,]+)", salida)
    return round(int(m.group(1).replace(",", "")) / 1024, 1) if m else None

def self_test():
    assert nivel_bateria("level: 71\nscale: 100") == 71
    assert nivel_bateria("status: 2") is None
    assert total_memoria_mib("MemTotal:       4096000 kB") == 4000
    assert pss_mib("TOTAL PSS: 123,456") == 120.6
    assert pss_mib("sin datos") is None
    print("Pruebas de análisis del diagnóstico ARM64: correctas")

def main():
    parser = argparse.ArgumentParser(description="Auditoría local, segura y sin datos privados de My Teacher IA.")
    parser.add_argument("--serial", help="Identificador ADB, si hay varios teléfonos conectados")
    parser.add_argument("--medir", action="store_true", help="Abrir la app y registrar dos muestras de memoria")
    parser.add_argument("--segundos", type=int, default=25, help="Tiempo entre muestras: 5 a 180 segundos")
    parser.add_argument("--self-test", action="store_true", help="Verificar el analizador sin un teléfono")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not shutil.which("adb"):
        raise SystemExit("Instala Android Platform Tools y agrega adb al PATH de Git Bash.")
    conectados = dispositivos()
    if args.serial and args.serial not in conectados:
        raise SystemExit("El teléfono seleccionado no está autorizado o no está conectado.")
    if not args.serial and len(conectados) != 1:
        raise SystemExit("Conecta y autoriza exactamente un teléfono, o especifica --serial.")
    serial = args.serial or conectados[0]
    # Un emulador no sustituye una prueba física.
    if serial.startswith("emulator-") or propiedad(serial, "ro.kernel.qemu") == "1":
        raise SystemExit("La prueba ARM64 debe ejecutarse en un teléfono físico, no en un emulador.")
    abi = propiedad(serial, "ro.product.cpu.abi")
    if abi != "arm64-v8a":
        raise SystemExit("El dispositivo no es ARM64; se detectó " + abi)
    sdk_raw = propiedad(serial, "ro.build.version.sdk")
    if not sdk_raw.isdigit():
        raise SystemExit("No se pudo verificar la versión de Android.")
    sdk = int(sdk_raw)
    instalado = ejecutar("shell", "pm", "path", PACKAGE, serial=serial, permitir_error=True)
    if "package:" not in instalado:
        raise SystemExit("Instala primero My Teacher IA y vuelve a ejecutar el diagnóstico.")
    memoria = ejecutar("shell", "cat", "/proc/meminfo", serial=serial)
    bateria = ejecutar("shell", "dumpsys", "battery", serial=serial)
    reporte = {
        "momento_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "modelo_dispositivo": propiedad(serial, "ro.product.model"),
        "fabricante": propiedad(serial, "ro.product.manufacturer"),
        "abi": abi,
        "android_sdk": sdk,
        "memoria_total_mib": total_memoria_mib(memoria),
        "bateria_inicial_porcentaje": nivel_bateria(bateria),
        "app_instalada": True,
        "memoria_pss_antes_mib": pss_mib(ejecutar(
            "shell", "dumpsys", "meminfo", PACKAGE, serial=serial, permitir_error=True
        )),
        "prueba_inferencia_offline": "pendiente",
        "prueba_dictado_espanol": "pendiente",
        "prueba_audio_audible": "pendiente",
        "consumo_energetico_medido": False,
        "prueba_release_firmada": False,
        "nota": "Diagnóstico físico parcial. No certifica autonomía, voz ni versión Play Store."
    }
    if args.medir:
        if not 5 <= args.segundos <= 180:
            raise SystemExit("--segundos debe estar entre 5 y 180.")
        ejecutar("shell", "am", "start", "-W", "-n", PACKAGE + "/.MainActivity",
                serial=serial, timeout=45)
        time.sleep(args.segundos)
        reporte["memoria_pss_despues_mib"] = pss_mib(ejecutar(
            "shell", "dumpsys", "meminfo", PACKAGE, serial=serial, permitir_error=True
        ))
        reporte["bateria_final_porcentaje"] = nivel_bateria(
            ejecutar("shell", "dumpsys", "battery", serial=serial)
        )
        reporte["intervalo_segundos"] = args.segundos
        reporte["consumo_energetico_medido"] = False  # El nivel % no mide energía.
    ruta = ROOT / "evidencias" / "telefono-arm64.json"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(reporte, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
    print(json.dumps(reporte, ensure_ascii=False, indent=2))
    print("Evidencia local:", ruta)
    print("No contiene número de serie, cuenta, tokens ni historial del alumno.")

if __name__ == "__main__":
    main()
