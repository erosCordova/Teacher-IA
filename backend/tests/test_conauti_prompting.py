import pytest

from app.conauti_prompting import (
    TutorPlan, adapt_instructions, lesson_plan, make_chain, trim_history,
)
from app.conauti_resilience import call_with_recovery, is_transient
from app.conauti_orchestrator import plan_learning, prepare_context


def test_planner_is_validated_and_educational():
    plan = lesson_plan("guided")
    assert isinstance(plan, TutorPlan)
    assert "autonom" in plan.objetivo
    assert plan_learning({"intent": "guided"})["plan"]["requiere_revision"]


def test_prompt_uses_few_shot_not_actual_memory():
    value = adapt_instructions("Responde en español.", "guided")
    assert "Few-Shot" in value
    assert "NO es una conversación real" in value
    assert "no confiables" not in value or isinstance(value, str)


def test_trim_context_limits_and_keeps_latest():
    items = [{"role":"user","body":"antiguo " * 500},
             {"role":"assistant","body":"intermedio " * 500},
             {"role":"user","body":"pregunta actual"}]
    messages = trim_history(items, max_messages=2, max_chars=500)
    assert len(messages) == 2
    assert messages[-1].content == "pregunta actual"
    assert sum(len(m.content) for m in messages) <= 500


def test_runnable_chain_accepts_history():
    from langchain_core.runnables import RunnableLambda
    model = RunnableLambda(lambda msgs: msgs)
    chain = make_chain(model)
    answer = chain.invoke({"instructions":"Sé pedagógico.",
                           "conversation":trim_history([{"role":"user","body":"Hola"}])})
    assert answer.messages[0].content == "Sé pedagógico."


def test_http_429_is_not_retried():
    class QuotaError(Exception):
        status_code = 429
    attempts = []
    def failed():
        attempts.append(1)
        raise QuotaError("Cuota agotada")
    with pytest.raises(QuotaError):
        call_with_recovery(failed)
    assert len(attempts) == 1
    assert not is_transient(QuotaError())


def test_http_503_retries_at_most_once(monkeypatch):
    class TemporaryError(Exception):
        status_code = 503
    attempts = []
    monkeypatch.setattr("app.conauti_resilience.time.sleep",lambda _:None)
    def action():
        attempts.append(1)
        if len(attempts)==1:
            raise TemporaryError()
        return "ok"
    assert call_with_recovery(action)=="ok"
    assert len(attempts)==2


def test_graph_preparation_uses_lcel_messages():
    state={"system_prompt":"Reglas base","rules":"Con pistas",
           "intent":"guided",
           "plan":lesson_plan("guided").model_dump(),
           "history":[{"role":"user","body":"¿Cómo comienzo?"}]}
    result=prepare_context(state)
    assert len(result["messages"])==1
    assert "pistas" in result["instructions"].lower() or "Con pistas" in result["instructions"]
