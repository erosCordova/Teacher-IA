import os
import re
from typing import Any, TypedDict

from app.conauti_prompting import (TutorPlan, adapt_instructions, lesson_plan, make_chain, safe_model_name, trim_history)
from app.conauti_resilience import call_with_recovery
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph

from app.conauti_pedagogy import (
    classify,
    review_output,
)


class TutorState(TypedDict, total=False):
    history: list[dict[str, Any]]
    rules: str
    system_prompt: str
    api_key: str
    model_name: str
    question: str
    intent: str
    messages: list[Any]
    instructions: str
    plan: dict[str, Any]
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
    """Planificador determinista; no requiere llamadas adicionales a Gemini."""
    return {"plan": lesson_plan(state["intent"]).model_dump()}


def select_route(state: TutorState):
    if state["intent"] in (
        "full_solution",
        "mode_on",
        "mode_off",
    ):
        return "proteger"

    return "preparar"


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
    )
    return {
        "instructions": instructions,
        "messages": trim_history(state["history"], max_messages=12, max_chars=10500),
    }


def generate_with_langchain(state: TutorState):
    def invoke(model_name: str):
        model = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=state["api_key"],
            vertexai=False,
            temperature=0.6,
            max_tokens=700,
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


def create_graph():
    builder = StateGraph(TutorState)

    builder.add_node(
        "clasificar",
        identify_intent,
    )
    builder.add_node("planificar", plan_learning)
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
            "preparar": "preparar",
        },
    )

    builder.add_edge(
        "proteger",
        END,
    )

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
    return builder.compile()


GRAPH = create_graph()


def run_graph(
    history,
    pedagogical_instruction,
    system_prompt,
    api_key,
    model_name,
):
    if not api_key:
        raise ValueError(
            "Gemini no está configurado."
        )

    if not re.fullmatch(
        r"[a-zA-Z0-9_.-]+",
        model_name,
    ):
        raise ValueError(
            "Identificador de modelo inválido."
        )

    result = GRAPH.invoke({
        "history": history,
        "rules": pedagogical_instruction,
        "system_prompt": system_prompt,
        "api_key": api_key,
        "model_name": model_name,
    })

    return result["answer"], result["usage"]
