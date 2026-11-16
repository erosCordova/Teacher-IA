import httpx
import pytest

from app.conauti_ai import generate_reply
from app.conauti_multi_agent import coordinate, run_open_graph
from app.conauti_open_model import FREE_MODEL, active_details, open_reply


def test_agents_cooperate_and_the_final_guard_hides_the_answer(monkeypatch):
    calls = []

    def fake_model(history, instructions, *, max_tokens):
        calls.append((history, instructions, max_tokens))
        if len(calls) == 1:
            return "Necesita identificar los datos y practicar.", {"input_tokens": 2, "output_tokens": 3}
        if len(calls) == 2:
            assert "DIAGNÓSTICO NO CONFIABLE" in instructions
            assert "Necesita identificar" in instructions
            assert "manipulables" in instructions
            return "Empieza identificando las cantidades.", {"input_tokens": 4, "output_tokens": 5}
        assert "Borrador que debes revisar" in history[-1]["body"]
        return "La respuesta es 7", {"input_tokens": 6, "output_tokens": 7}

    monkeypatch.setattr("app.conauti_multi_agent.open_reply", fake_model)
    answer, usage = run_open_graph(
        [{"role": "user", "body": "¿Cuánto es 3 + 4?"}],
        "Guía con pistas de nivel 1",
        "Tutor respetuoso y en español.",
    )
    assert len(calls) == 3
    assert "7" not in answer
    assert "pista" in answer.lower()
    assert usage == {"input_tokens": 12, "output_tokens": 15}


def test_direct_request_protects_student_without_model_calls(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("No se debe invocar el modelo para una respuesta fija.")

    monkeypatch.setattr("app.conauti_multi_agent.open_reply", forbidden)
    answer, usage = run_open_graph(
        [{"role": "user", "body": "Hazme la tarea"}], "", "Tutor"
    )
    assert "intentado" in answer
    assert usage == {"input_tokens": 0, "output_tokens": 0}


def test_calculator_checks_only_an_explicit_student_attempt():
    state = coordinate({"history": [{"role": "user", "body": "Mi intento: 2+3=6"}]})
    assert "no coincide" in state["evidence"]
    assert "5" not in state["evidence"]
    state = coordinate({"history": [{"role": "user", "body": "¿Cuánto es 2+3?"}]})
    assert "Sin comprobación" in state["evidence"]


def test_openrouter_is_pinned_to_the_free_model_and_private_routing(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "clave-de-prueba")
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        request = httpx.Request("POST", url)
        return httpx.Response(200, request=request, json={
            "choices": [{"message": {"content": "¿Qué datos tienes?"}}],
            "usage": {"prompt_tokens": 8, "completion_tokens": 4},
        })

    monkeypatch.setattr("app.conauti_open_model.httpx.post", fake_post)
    result, usage = open_reply([{"role": "user", "body": "Hola"}], "Enseña", max_tokens=100)
    assert result == "¿Qué datos tienes?"
    assert usage == {"input_tokens": 8, "output_tokens": 4}
    url, options = calls[0]
    assert url == "https://openrouter.ai/api/v1/chat/completions"
    assert options["json"]["model"] == FREE_MODEL
    assert options["json"]["provider"]["data_collection"] == "deny"
    assert active_details() == ("OpenRouter", FREE_MODEL, True)


def test_paid_or_unapproved_model_cannot_be_used(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "clave-de-prueba")
    monkeypatch.setenv("OPENROUTER_MODEL", "qwen/qwen3-4b")
    with pytest.raises(ValueError):
        open_reply([{"role": "user", "body": "Hola"}], "Tutor")
    assert active_details()[2] is False


def test_open_provider_failure_never_falls_back_to_gemini(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openrouter")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "no-debe-usarse")
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as err:
        generate_reply([{"role": "user", "body": "Explícame fracciones"}])
    assert err.value.status_code == 503


def test_ollama_mode_runs_all_three_agents(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_ENABLED", "true")
    monkeypatch.setenv("OLLAMA_MODEL", "qwen3:0.6b")
    calls = []

    def fake_local(history, instructions, *, max_tokens):
        calls.append(instructions)
        return "Identifica los datos. ¿Qué observarías?", {"input_tokens": 1, "output_tokens": 1}

    monkeypatch.setattr("app.conauti_local_model.local_reply", fake_local)
    answer, usage = generate_reply([{"role": "user", "body": "Explícame las fracciones"}])
    assert len(calls) == 3
    assert "Identifica" in answer
    assert usage == {"input_tokens": 3, "output_tokens": 3}
