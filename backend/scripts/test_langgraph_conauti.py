from unittest.mock import patch

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
)

from app.conauti_orchestrator import (
    GRAPH,
    run_graph,
)


checks = 0


def check(condition, name):
    global checks

    if not condition:
        raise AssertionError(name)

    checks += 1
    print(f"{name}=OK", flush=True)


nodes = set(GRAPH.nodes)

check(
    {
        "clasificar",
        "proteger",
        "preparar",
        "generar",
        "validar",
    }.issubset(nodes),
    "CINCO_NODOS_IMPLEMENTADOS",
)

with patch(
    "app.conauti_orchestrator.ChatGoogleGenerativeAI"
) as factory:

    model = factory.return_value

    model.invoke.return_value = AIMessage(
        content=(
            "Una fracción representa "
            "partes de un todo."
        ),
        usage_metadata={
            "input_tokens": 20,
            "output_tokens": 12,
            "total_tokens": 32,
        },
    )

    reply, usage = run_graph(
        [
            {
                "role": "user",
                "body": "¿Qué es una fracción?",
            },
        ],
        "Explica con claridad.",
        "Eres un tutor educativo.",
        "clave-simulada",
        "gemini-3.5-flash-lite",
    )

    check(
        "fracción" in reply,
        "MODELO_LANGCHAIN_SIMULADO",
    )

    check(
        usage["input_tokens"] == 20
        and usage["output_tokens"] == 12,
        "METRICAS_DE_TOKENS",
    )

    args = model.invoke.call_args.args[0]

    check(
        isinstance(args[0], SystemMessage)
        and isinstance(args[-1], HumanMessage),
        "MENSAJES_ESTRUCTURADOS_LANGCHAIN",
    )

    model.invoke.return_value = AIMessage(
        content="La respuesta es 56.",
        usage_metadata={
            "input_tokens": 10,
            "output_tokens": 8,
            "total_tokens": 18,
        },
    )

    reply, _ = run_graph(
        [
            {
                "role": "user",
                "body": "Calcula 7 x 8.",
            },
        ],
        "Orienta sin revelar el resultado.",
        "Eres un tutor educativo.",
        "clave-simulada",
        "gemini-3.5-flash-lite",
    )

    check(
        "56" not in reply
        and len(reply) > 20,
        "VALIDACION_DE_RESPUESTA_DIRECTA",
    )

    before = model.invoke.call_count

    reply, usage = run_graph(
        [
            {
                "role": "user",
                "body": (
                    "Resuélveme toda la tarea "
                    "y dame la respuesta."
                ),
            },
        ],
        "No resuelvas tareas completas.",
        "Eres un tutor educativo.",
        "clave-simulada",
        "gemini-3.5-flash-lite",
    )

    check(
        model.invoke.call_count == before
        and usage["input_tokens"] == 0,
        "RUTA_SEGURA_SIN_LLAMAR_GEMINI",
    )

    check(
        "tarea" in reply.lower(),
        "RESPUESTA_DE_ORIENTACION",
    )

    model.invoke.return_value = AIMessage(
        content="Vamos a revisar tu razonamiento.",
        usage_metadata={
            "input_tokens": 24,
            "output_tokens": 10,
            "total_tokens": 34,
        },
    )

    answer, _ = run_graph(
        [
            {
                "role": "user",
                "body": "Explícame las fracciones.",
            },
            {
                "role": "assistant",
                "body": (
                    "Son partes de un todo."
                ),
            },
            {
                "role": "user",
                "body": "Dame otro ejemplo.",
            },
        ],
        "Proporciona un ejemplo diferente.",
        "Eres un tutor educativo.",
        "clave-simulada",
        "gemini-3.5-flash-lite",
    )

    messages = model.invoke.call_args.args[0]

    check(
        len(messages) == 4
        and isinstance(messages[2], AIMessage),
        "CONTEXTO_DE_VARIOS_TURNOS",
    )

    check(
        len(answer) > 15,
        "SALIDA_DEL_GRAFO_VALIDADA",
    )

print("====================================")
print("PRUEBAS_LANGGRAPH=EXITOSAS")
print(f"COMPROBACIONES={checks}")
print("====================================")
