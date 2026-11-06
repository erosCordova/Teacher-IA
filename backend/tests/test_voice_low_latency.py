"""El modo de respuesta oral reduce la salida sin modificar el chat escrito."""
from uuid import uuid4

import pytest

from app.conauti_ai import AIRequest
from app import conauti_orchestrator as orchestrator


def test_el_chat_escrito_mantiene_respuestas_completas():
    req = AIRequest(request_id=uuid4(), text="Explica los ecosistemas")
    assert req.voice_mode is False


def test_la_conversacion_oral_activa_respuesta_breve():
    req = AIRequest(request_id=uuid4(), text="Explícame las fracciones", voice_mode=True)
    assert req.voice_mode is True


@pytest.mark.parametrize("voz,limite", [(True, 320), (False, 700)])
def test_langgraph_limita_solo_la_respuesta_oral(monkeypatch, voz, limite):
    capturado = {}

    class ModeloSimulado:
        def __init__(self, **kwargs):
            capturado.update(kwargs)

    class RespuestaSimulada:
        content = "Vamos a aprender con un ejemplo."
        usage_metadata = {"input_tokens": 12, "output_tokens": 10}

    class CadenaSimulada:
        def invoke(self, payload):
            assert payload["instructions"] == "enseñar con pistas"
            return RespuestaSimulada()

    monkeypatch.setattr(orchestrator, "ChatGoogleGenerativeAI", ModeloSimulado)
    monkeypatch.setattr(orchestrator, "make_chain", lambda model: CadenaSimulada())
    monkeypatch.setattr(
        orchestrator, "call_with_recovery",
        lambda primary, fallback=None: primary(),
    )

    result = orchestrator.generate_with_langchain({
        "api_key": "credencial-de-prueba",
        "model_name": "gemini-test",
        "voice_mode": voz,
        "instructions": "enseñar con pistas",
        "messages": [],
    })
    assert capturado["max_tokens"] == limite
    assert result["answer"] == "Vamos a aprender con un ejemplo."
