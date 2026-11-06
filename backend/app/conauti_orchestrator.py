import os
import re
from contextvars import ContextVar
from typing import Any, TypedDict

from app.conauti_prompting import (TutorPlan, adapt_instructions, lesson_plan, make_chain, safe_model_name, trim_history)
from app.conauti_resilience import call_with_recovery
from app.conauti_tools import verificar_operacion, planificar_refuerzo
from app.conauti_specialists import specialist_instructions
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph

from app.conauti_pedagogy import (
    classify,
    review_output,
)


_RUN_API_KEY: ContextVar[str] = ContextVar("myteacher_api_key", default="")


class TutorState(TypedDict, total=False):
    history: list[dict[str, Any]]
    rules: str
    system_prompt: str
    api_key: str
    model_name: str
    voice_mode: bool
    question: str
    intent: str
    messages: list[Any]
    instructions: str
    plan: dict[str, Any]
    subject: str
    specialist_rules: str
    tool_context: str
    answer: str
    usage: dict[str, int]


def identify_intent(state: TutorState):
    question = ""

    for message in reversed(state["history"]):
        if message["role"] == "user":
            question = str(message["body"])
            break

    if not question.strip():
        raise ValueError(
            "No existe una pregunta válida."
        )

    return {
        "question": question,
        "intent": classify(question),
    }


def plan_learning(state: TutorState):
    """Planificador con herramientas verificadas, sin llamadas adicionales a Gemini."""
    intent = state["intent"]
    result = {"plan": lesson_plan(intent).model_dump(), "tool_context": ""}
    if intent == "review":
        match = re.search(r"(?<!\w)(\d{1,6}\s*[+\-*/]\s*\d{1,6})(?!\w)", state["question"])
        if match:
            try:
                checked = verificar_operacion.invoke({"expresion": match.group(1)})
                result["tool_context"] = (
                    "Comprobación interna de una operación del intento: "
                    + str(checked["resultado_de_comprobacion"])
                    + ". No reveles la respuesta. Pregunta al estudiante "
                      "cómo podría verificar su resultado."
                )
            except (ValueError, KeyError, TypeError):
                pass
    elif intent == "simpler":
        plan = planificar_refuerzo.invoke({"tema": state["question"][:100]})
        result["tool_context"] = (
            "Protocolo de apoyo: " + "; ".join(plan["pasos"])
        )
    return result


def assign_specialist(state: TutorState):
    """Elige estrategia docente sin otra llamada al modelo."""
    subject, instructions = specialist_instructions(state["question"])
    return {"subject": subject, "specialist_rules": instructions}


def select_route(state: TutorState):
    if state["intent"] in (
        "full_solution",
        "mode_on",
        "mode_off",
    ):
        return "proteger"

    return "especialista"


def protect_student(state: TutorState):
    intent = state["intent"]

    if intent == "mode_on":
        answer = (
            "Modo sin pistas activado. "
            "Practica con autonomía y revisa "
            "tu propio razonamiento."
        )
    elif intent == "mode_off":
        answer = (
            "Modo sin pistas desactivado. "
            "Podemos continuar con explicaciones "
            "y pistas progresivas."
        )
    else:
        answer = (
            "Puedo ayudarte a comprender el ejercicio "
            "y resolverlo paso a paso, pero no "
            "hacer toda la tarea por ti. "
            "¿Qué has intentado hasta ahora?"
        )

    return {
        "answer": answer,
        "usage": {
            "input_tokens": 0,
            "output_tokens": 0,
        },
    }


def prepare_context(state: TutorState):
    """Trimming + Prompt Templates + ejemplo Few-Shot del plan pedagógico."""
    instructions = adapt_instructions(
        state["system_prompt"] + "\n\n" + state["rules"],
        state["intent"], plan=TutorPlan.model_validate(state["plan"]),
    ) + ("\n" + state.get("tool_context", "") if state.get("tool_context") else "")
    instructions += "\nESTRATEGIA ESPECIALIZADA: " + state.get("specialist_rules", "")
    return {
        "instructions": instructions,
        "messages": trim_history(state["history"], max_messages=12, max_chars=10500),
    }


def generate_with_langchain(state: TutorState):
    def invoke(model_name: str):
        model = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=state.get("api_key") or _RUN_API_KEY.get(),
            vertexai=False,
            temperature=0.6,
            max_tokens=320 if state.get("voice_mode") else 700,
            timeout=35,
            max_retries=0,
        )
        # LCEL: ChatPromptTemplate | ChatGoogleGenerativeAI
        chain = make_chain(model)
        return chain.invoke({
            "instructions": state["instructions"],
            "conversation": state["messages"],
        })

    backup = os.getenv("GEMINI_FALLBACK_MODEL", "").strip()
    alternative = (lambda: invoke(backup)) if (
        safe_model_name(backup) and backup != state["model_name"]
    ) else None
    response = call_with_recovery(
        lambda: invoke(state["model_name"]),
        fallback=alternative,
    )

    content = response.content

    if isinstance(content, str):
        answer = content.strip()
    elif isinstance(content, list):
        answer = "\n".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict)
            and isinstance(part.get("text"), str)
            and part.get("type", "text") == "text"
        ).strip()
    else:
        answer = ""

    if not answer:
        raise ValueError(
            "Gemini no devolvió una respuesta textual."
        )

    metadata = response.usage_metadata or {}

    return {
        "answer": answer[:6000],
        "usage": {
            "input_tokens": int(
                metadata.get("input_tokens") or 0
            ),
            "output_tokens": int(
                metadata.get("output_tokens") or 0
            ),
        },
    }


def validate_answer(state: TutorState):
    level_match = re.search(
        r"nivel\s+([123])",
        state["rules"].lower(),
    )

    level = (
        int(level_match.group(1))
        if level_match else 0
    )

    decision = {
        "fixed": None,
        "intent": state["intent"],
        "hint_level": level,
    }

    answer = review_output(
        state["answer"],
        decision,
        state["question"],
    )

    return {"answer": answer}


def create_graph(checkpointer=None):
    builder = StateGraph(TutorState)

    builder.add_node(
        "clasificar",
        identify_intent,
    )
    builder.add_node("planificar", plan_learning)
    builder.add_node("especialista", assign_specialist)
    builder.add_node(
        "proteger",
        protect_student,
    )
    builder.add_node(
        "preparar",
        prepare_context,
    )
    builder.add_node(
        "generar",
        generate_with_langchain,
    )
    builder.add_node(
        "validar",
        validate_answer,
    )

    builder.add_edge(
        START,
        "clasificar",
    )

    builder.add_edge("clasificar", "planificar")
    builder.add_conditional_edges(
        "planificar",
        select_route,
        {
            "proteger": "proteger",
            "especialista": "especialista",
        },
    )

    builder.add_edge(
        "proteger",
        END,
    )
    builder.add_edge("especialista", "preparar")

    builder.add_edge(
        "preparar",
        "generar",
    )

    builder.add_edge(
        "generar",
        "validar",
    )

    builder.add_edge(
        "validar",
        END,
    )

    # La persistencia continúa en PostgreSQL.
    # No guardamos secretos ni mensajes en
    # puntos de control adicionales.
    return builder.compile(checkpointer=checkpointer)


GRAPH = create_graph()


def run_graph(
    history,
    pedagogical_instruction,
    system_prompt,
    api_key,
    model_name,
    *,
    student_id=None,
    conversation_id=None,
    voice_mode=False,
):
    if not api_key:
        raise ValueError("Gemini no está configurado.")
    if not safe_model_name(model_name):
        raise ValueError("Identificador de modelo inválido.")

    state = {
        "history": history,
        "rules": pedagogical_instruction,
        "system_prompt": system_prompt,
        "model_name": model_name,
        "voice_mode": bool(voice_mode),
    }

    # Las credenciales NO se guardan en State, ni en los checkpoints.
    secret_context = _RUN_API_KEY.set(api_key)
    try:
        if (
            os.getenv("LANGGRAPH_CHECKPOINTS_ENABLED", "false").lower() == "true"
            and student_id is not None
            and conversation_id is not None
        ):
            # Checkpoints reales, con persistencia PostgreSQL. Durability='exit'
            # limita el almacenamiento en la base gratuita.
            os.environ.setdefault("LANGGRAPH_STRICT_MSGPACK", "true")
            from langgraph.checkpoint.postgres import PostgresSaver
            from app.conauti_auth import database_url

            thread_id = f"teacher:{student_id}:{conversation_id}"
            with PostgresSaver.from_conn_string(database_url()) as saver:
                saver.setup()
                graph = create_graph(checkpointer=saver)
                result = graph.invoke(
                    state,
                    config={"configurable": {"thread_id": thread_id}},
                    durability="exit",
                )
        else:
            result = GRAPH.invoke(state)
    finally:
        _RUN_API_KEY.reset(secret_context)

    return result["answer"], result["usage"]
