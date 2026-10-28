import ast
from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / "backend/app/conauti_ai.py"

source = path.read_text(encoding="utf-8")

marker = "CONAUTI_ORCHESTRATOR"

integration = '''
    # CONAUTI_ORCHESTRATOR: LangGraph activo.
    if config(
        "CONAUTI_ORCHESTRATOR",
        "langgraph",
    ).strip().lower() == "langgraph":

        from app.conauti_orchestrator import run_graph

        api_key = config("GEMINI_API_KEY")

        if not api_key:
            raise HTTPException(
                503,
                "La inteligencia artificial no está configurada.",
            )

        try:
            return run_graph(
                history,
                pedagogical_instruction,
                SYSTEM_PROMPT,
                api_key,
                current_model(),
            )

        except HTTPException:
            raise

        except Exception as error:
            code = getattr(error, "code", None)

            if code is None:
                code = getattr(
                    error,
                    "status_code",
                    None,
                )

            try:
                code = int(code)
            except (TypeError, ValueError):
                code = None

            if code == 429:
                raise HTTPException(
                    429,
                    "Gemini alcanzó su límite temporal.",
                )

            if code in (401, 403):
                raise HTTPException(
                    503,
                    "La credencial de Gemini fue rechazada.",
                )

            if isinstance(error, TimeoutError) or (
                code == 408
            ):
                raise HTTPException(
                    504,
                    "Gemini tardó demasiado en responder.",
                )

            if code is not None and code >= 500:
                raise HTTPException(
                    503,
                    "El proveedor de inteligencia artificial "
                    "no está disponible.",
                )

            raise HTTPException(
                502,
                "No fue posible generar la respuesta "
                "mediante LangGraph y Gemini.",
            )
'''

if marker not in source:
    tree = ast.parse(source)

    functions = [
        node for node in tree.body
        if isinstance(node, ast.FunctionDef)
        and node.name == "generate_reply"
    ]

    if len(functions) != 1:
        raise RuntimeError(
            "No se identificó generate_reply."
        )

    function = functions[0]

    parameters = [
        item.arg
        for item in function.args.args
    ]

    if parameters[:2] != [
        "history",
        "pedagogical_instruction",
    ]:
        raise RuntimeError(
            "La firma actual no es compatible."
        )

    lines = source.splitlines(keepends=True)

    position = (
        function.body[0].lineno - 1
    )

    lines.insert(
        position,
        integration.strip("\n") + "\n",
    )

    source = "".join(lines)

if '@router.get("/engine")' not in source:
    source += '''

@router.get("/engine")
def orchestration_engine(
    user=Depends(current_user),
):
    return {
        "engine": config(
            "CONAUTI_ORCHESTRATOR",
            "langgraph",
        ),
        "framework": "LangChain",
        "workflow": "LangGraph",
        "model": current_model(),
    }
'''

ast.parse(source)

path.write_text(
    source,
    encoding="utf-8",
)

print("FASTAPI=INTEGRADO_CON_LANGGRAPH")
print("ADAPTADOR_LANGCHAIN=ACTIVO")
print("GEMINI=CONSERVADO")
print("HISTORIAL_POSTGRESQL=CONSERVADO")
print("MOTOR_PEDAGOGICO=CONSERVADO")
print("RUTA_DIAGNOSTICO=AGREGADA")
