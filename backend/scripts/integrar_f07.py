from datetime import datetime
from pathlib import Path
from shutil import copy2
import re


root = Path(__file__).resolve().parents[2]

backpath = root / "backend/app/main.py"
aipath = root / "backend/app/conauti_ai.py"
frontpath = root / "frontend/conauti-ui/main.tsx"

files = {
    backpath: backpath.read_text(encoding="utf-8"),
    aipath: aipath.read_text(encoding="utf-8"),
    frontpath: frontpath.read_text(encoding="utf-8"),
}

back = files[backpath]
ai = files[aipath]
front = files[frontpath]

if "conauti_pedagogy_router" not in back:
    back += (
        "\n\nfrom app.conauti_pedagogy import "
        "router as conauti_pedagogy_router\n"
        "app.include_router(conauti_pedagogy_router)\n"
    )

imports = (
    "from app.conauti_pedagogy import "
    "plan, review_output, save_state\n"
)

if imports not in ai:
    ai = imports + ai

old = "def generate_reply(history):"
new = (
    "def generate_reply("
    "history, pedagogical_instruction=''):"
)

if old in ai:
    ai = ai.replace(old, new, 1)
elif new not in ai:
    raise RuntimeError(
        "No se reconoce el adaptador de Gemini."
    )

old = '"parts": [{"text": SYSTEM_PROMPT}]'
new = (
    '"parts": [{"text": '
    'SYSTEM_PROMPT + "\\n\\n" + pedagogical_instruction}]'
)

if old in ai:
    ai = ai.replace(old, new, 1)
elif new not in ai:
    raise RuntimeError(
        "No se pudo configurar el contexto pedagógico."
    )

old = "        answer, usage = generate_reply(history)"
new = """        decision = plan(
            conn, conversation_id, question
        )

        if decision["fixed"] is not None:
            answer = decision["fixed"]
            usage = {
                "input_tokens": 0,
                "output_tokens": 0,
            }
        else:
            answer, usage = generate_reply(
                history,
                decision["instructions"],
            )
            answer = review_output(answer, decision)"""

if old in ai:
    ai = ai.replace(old, new, 1)
elif "decision = plan(" not in ai:
    raise RuntimeError(
        "No se reconoce la ejecución de Gemini."
    )

anchor = """    return {
        "user_message": student_message,"""

addition = """        if decision["fixed"] is not None:
            conn.execute(
                \"""
                UPDATE conauti_ai_requests
                SET provider = 'Motor pedagogico',
                    model = 'reglas-v1'
                WHERE request_id = %s
                \""",
                (data.request_id,),
            )

        save_state(
            conn,
            conversation_id,
            decision,
            student_message["id"],
        )

"""

if addition not in ai:
    if anchor not in ai:
        raise RuntimeError(
            "No se reconoce el cierre de la transacción."
        )

    ai = ai.replace(
        anchor,
        addition + anchor,
        1,
    )

if "GuiaPedagogica" not in front:
    marker = "import './style.css'"

    if marker not in front:
        raise RuntimeError(
            "No se reconoce la entrada de React."
        )

    front = front.replace(
        marker,
        "import GuiaPedagogica "
        "from './GuiaPedagogica'\n"
        + marker,
        1,
    )

    match = re.search(
        r'(?m)^([ \t]*)<div className="messages" '
        r'aria-live="polite">',
        front,
    )

    if not match:
        raise RuntimeError(
            "No se encontró el panel de mensajes."
        )

    indentation = match.group(1)

    component = (
        indentation
        + "<GuiaPedagogica\n"
        + indentation
        + "  token={token ?? ''}\n"
        + indentation
        + "  conversationId={active}\n"
        + indentation
        + "  revision={historyVersion}\n"
        + indentation
        + "  onPrepare={message => {\n"
        + indentation
        + "    setDraft(message)\n"
        + indentation
        + "    editor.current?.focus()\n"
        + indentation
        + "  }}\n"
        + indentation
        + "/>\n"
    )

    front = (
        front[:match.start()]
        + component
        + front[match.start():]
    )

if not all((
    "decision = plan(" in ai,
    "save_state(" in ai,
    "GuiaPedagogica" in front,
    "conauti_pedagogy_router" in back,
)):
    raise RuntimeError(
        "La integración de la fase 07 no está completa."
    )

results = {
    backpath: back,
    aipath: ai,
    frontpath: front,
}

stamp = datetime.now().strftime(
    "%Y%m%d_%H%M%S_%f"
)

backups = root / ".conauti-backups"
backups.mkdir(exist_ok=True)

for path, content in results.items():
    if content != files[path]:
        backup = backups / f"{stamp}_{path.name}"
        copy2(path, backup)

for path, content in results.items():
    if content != files[path]:
        path.write_text(
            content,
            encoding="utf-8",
        )

print("FASTAPI_MOTOR=INTEGRADO")
print("GEMINI_REGLAS=INTEGRADAS")
print("ESTADO_PEDAGOGICO=PERSISTENTE")
print("CONTROLES_REACT=INTEGRADOS")
print("RESPALDOS=CREADOS")
