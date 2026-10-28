from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]

backend = root / "backend/app/main.py"
frontend = root / "frontend/conauti-ui/main.tsx"
styles = root / "frontend/conauti-ui/style.css"

back = backend.read_text(encoding="utf-8")
front = frontend.read_text(encoding="utf-8")
css = styles.read_text(encoding="utf-8")

if "conauti_voice_router" not in back:
    back += (
        "\n\nfrom app.conauti_voice import "
        "router as conauti_voice_router\n"
        "app.include_router(conauti_voice_router)\n"
    )

if "EntradaVoz" not in front:
    marker = "import './style.css'"

    if marker not in front:
        raise RuntimeError(
            "No se encontró la entrada de estilos de React."
        )

    front = front.replace(
        marker,
        "import EntradaVoz from './EntradaVoz'\n" + marker,
        1,
    )

    match = re.search(
        r'(?m)^([ \t]*)<GuiaPedagogica\b',
        front,
    )

    if not match:
        raise RuntimeError(
            "No se encontró el panel pedagógico existente."
        )

    indent = match.group(1)

    component = (
        indent + "<EntradaVoz\n"
        + indent + "  token={token ?? ''}\n"
        + indent + "  disabled={busy}\n"
        + indent + "  onText={text => {\n"
        + indent + "    retryId.current = null\n"
        + indent + "    setDraft(previous =>\n"
        + indent + "      previous.trim()\n"
        + indent + "        ? previous.trimEnd() + ' ' + text\n"
        + indent + "        : text\n"
        + indent + "    )\n"
        + indent + "    editor.current?.focus()\n"
        + indent + "  }}\n"
        + indent + "/>\n"
    )

    front = (
        front[:match.start()]
        + component
        + front[match.start():]
    )

if "/* VOZ CONAUTI F08 */" not in css:
    css += """
/* VOZ CONAUTI F08 */
.conauti-voz {
  background: #edfaff;
  border: 1px solid #b3dbeb;
  padding: 14px;
  border-radius: 14px;
  margin: 10px 0;
}
.conauti-voz-superior {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  color: #155a78;
  font-size: 12px;
}
.conauti-voz-superior span {
  font-size: 11px;
  color: #568094;
}
.conauti-voz-botones {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.conauti-voz-botones button {
  padding: 9px 13px;
  background: white;
  color: #16638c;
  border: 1px solid #99cce3;
  border-radius: 9px;
  cursor: pointer;
}
.conauti-voz-botones button:hover {
  background: #def2ff;
}
.conauti-voz-botones button:disabled {
  opacity: .5;
}
.conauti-voz-nivel {
  background: #d0eaf7;
  height: 9px;
  border-radius: 999px;
  overflow: hidden;
  margin-top: 12px;
}
.conauti-voz-nivel > div {
  background: #1491c6;
  height: 100%;
  border-radius: inherit;
  transition: width 100ms;
}
.conauti-voz p {
  margin: 9px 0 5px;
  font-size: 11px;
}
.conauti-voz small {
  color: #52758a;
  font-size: 10px;
}
"""

if not (
    "conauti_voice_router" in back
    and "<EntradaVoz" in front
    and "VOZ CONAUTI F08" in css
):
    raise RuntimeError(
        "No fue posible verificar la integración."
    )

backend.write_text(back, encoding="utf-8")
frontend.write_text(front, encoding="utf-8")
styles.write_text(css, encoding="utf-8")

print("API_VOZ=INTEGRADA")
print("REACT_MICROFONO=INTEGRADO")
print("LANGCHAIN=CONSERVADO")
print("LANGGRAPH=CONSERVADO")
print("MOTOR_PEDAGOGICO=CONSERVADO")
