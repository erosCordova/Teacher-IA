from datetime import datetime
from pathlib import Path
from shutil import copy2
import re

root = Path(__file__).resolve().parents[2]

backpath = root / "backend/app/main.py"
frontpath = root / "frontend/conauti-ui/main.tsx"
csspath = root / "frontend/conauti-ui/style.css"

originals = {
    path: path.read_text(encoding="utf-8")
    for path in (backpath, frontpath, csspath)
}

back = originals[backpath]
front = originals[frontpath]
css = originals[csspath]

if "conauti_voice_router" not in back:
    back += (
        "\n\nfrom app.conauti_voice import "
        "router as conauti_voice_router\n"
        "app.include_router(conauti_voice_router)\n"
    )

if "EntradaVoz" not in front:
    anchor = "import './style.css'"

    if anchor not in front:
        raise RuntimeError(
            "No se encontró la entrada principal de React."
        )

    front = front.replace(
        anchor,
        "import EntradaVoz from './EntradaVoz'\n"
        + anchor,
        1,
    )

    marker = re.search(
        r'(?m)^([ \t]*)<GuiaPedagogica\b',
        front,
    )

    if not marker:
        raise RuntimeError(
            "No se encontró el panel pedagógico del chat."
        )

    space = marker.group(1)

    component = (
        space + "<EntradaVoz\n"
        + space + "  token={token ?? ''}\n"
        + space + "  disabled={busy}\n"
        + space + "  onTranscription={text => {\n"
        + space + "    retryId.current = null\n"
        + space + "    setDraft(previous =>\n"
        + space + "      previous.trim()\n"
        + space + "        ? previous.trimEnd() + ' ' + text\n"
        + space + "        : text\n"
        + space + "    )\n"
        + space + "    editor.current?.focus()\n"
        + space + "  }}\n"
        + space + "/>\n"
    )

    front = (
        front[:marker.start()]
        + component
        + front[marker.start():]
    )

if "/* CONAUTI FASE 08 */" not in css:
    css += """
/* CONAUTI FASE 08 */

.conauti-voz {
  padding: 13px 15px;
  border: 1px solid #a9d4e8;
  background: #f0fbff;
  border-radius: 14px;
  margin: 8px 0;
  color: #22506b;
}

.conauti-voz-cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
}

.conauti-voz-cabecera span {
  color: #446c85;
  font-size: 11px;
}

.conauti-voz-acciones {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.conauti-voz-acciones button {
  border: 1px solid #8cbfe0;
  border-radius: 9px;
  padding: 9px 13px;
  background: white;
  color: #16608c;
  cursor: pointer;
  font-size: 12px;
}

.conauti-voz-acciones button:hover {
  background: #dff3ff;
}

.conauti-voz-acciones button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.conauti-voz-medidor {
  width: 100%;
  height: 9px;
  border-radius: 999px;
  overflow: hidden;
  background: #d1e9f5;
  margin-top: 12px;
}

.conauti-voz-medidor > div {
  height: 100%;
  border-radius: inherit;
  background: #1b91bd;
  transition: width 100ms;
}

.conauti-voz p {
  font-size: 11px;
  margin: 10px 0 5px;
}

.conauti-voz small {
  font-size: 10px;
  color: #55758a;
}
"""

if not all((
    "conauti_voice_router" in back,
    "import EntradaVoz" in front,
    "<EntradaVoz" in front,
    "CONAUTI FASE 08" in css,
)):
    raise RuntimeError(
        "La integración de voz no se completó."
    )

changes = {
    backpath: back,
    frontpath: front,
    csspath: css,
}

backups = root / ".conauti-backups"
backups.mkdir(exist_ok=True)

stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

for path, content in changes.items():
    if content != originals[path]:
        copy2(
            path,
            backups / f"{stamp}_{path.name}",
        )

for path, content in changes.items():
    if content != originals[path]:
        path.write_text(
            content,
            encoding="utf-8",
        )

print("API_VOZ=REGISTRADA")
print("COMPONENTE_MICROFONO=INTEGRADO")
print("ESTILOS=INTEGRADOS")
print("RESPALDOS=OK")
