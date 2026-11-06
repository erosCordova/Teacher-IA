import pytest

from app.conauti_tools import (
    evaluate_arithmetic, verificar_operacion, planificar_refuerzo,
    tool_catalog,
)
from app.conauti_local_model import local_enabled, local_reply


def test_typed_tools_execute_without_model():
    value = verificar_operacion.invoke({"expresion": "(3+7)/2"})
    assert value["resultado_de_comprobacion"] == 5
    plan = planificar_refuerzo.invoke({"tema": "Ecuaciones"})
    assert len(plan["pasos"]) == 4
    assert len(tool_catalog()) == 2


@pytest.mark.parametrize("expression", [
    "__import__('os').system('whoami')",
    "2**500",
    "(1+2+3+4+5+6+7+8+9+10+11)",
])
def test_calculator_rejects_unsafe_or_expensive_expressions(expression):
    with pytest.raises((ValueError, SyntaxError)):
        evaluate_arithmetic(expression)


def test_local_ollama_is_disabled_unless_explicitly_enabled(monkeypatch):
    monkeypatch.delenv("OLLAMA_ENABLED", raising=False)
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    assert not local_enabled()
    with pytest.raises(RuntimeError):
        local_reply([{"role":"user","body":"Hola"}], "Tutor educativo")


def test_local_ollama_never_uses_user_supplied_url(monkeypatch):
    monkeypatch.setenv("OLLAMA_ENABLED", "true")
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_MODEL", "gemma3:1b")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://malicious.example")
    class Response:
        def raise_for_status(self): pass
        def json(self):
            return {"message":{"content":"Una pista, no la respuesta"},"eval_count":8}
    urls = []
    def fake_post(url, **kwargs):
        urls.append(url)
        return Response()
    monkeypatch.setattr("app.conauti_local_model.httpx.post", fake_post)
    answer, usage = local_reply([{"role":"user","body":"Hola"}], "Tutor")
    assert "pista" in answer
    assert urls == ["http://127.0.0.1:11434/api/chat"]
    assert usage["output_tokens"] == 8
