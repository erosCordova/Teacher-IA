import asyncio
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app import conauti_open_media as media
from app import conauti_rag as rag
from app import conauti_screen_voice as screen_voice
from app.conauti_auth import current_user
from app.main import app


class FakeDB:
    records = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def execute(self, sql, params):
        if "INSERT INTO conauti_voice_usage" in sql:
            self.records.append(params)
        return self

    def fetchone(self):
        return {"total": 0}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_ENABLED", "true")
    monkeypatch.setenv("OLLAMA_MODEL", "qwen3:0.6b")
    app.dependency_overrides[current_user] = lambda: {"id": "estudiante"}
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(current_user, None)


def test_local_vision_receives_image_and_returns_open_provider(client, monkeypatch):
    seen = {}

    class Response:
        status_code = 200
        def json(self):
            return {"message": {"content": "Veo una figura. ¿Qué representa?"}}

    class Client:
        def __init__(self, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return None
        async def post(self, url, headers, json):
            seen.update({"url": url, "payload": json})
            return Response()

    monkeypatch.setattr(media.httpx, "AsyncClient", Client)
    jpeg = b"\xff\xd8\xff" + b"f" * 240 + b"\xff\xd9"
    result = client.post(
        "/api/conauti/screen/analyze?question=Ayuda",
        headers={"Content-Type": "image/jpeg"}, content=jpeg,
    )
    assert result.status_code == 200
    assert result.json()["image_stored"] is False
    assert result.json()["provider"] == media.LOCAL_VISION_MODEL
    assert seen["url"] == "http://127.0.0.1:11434/api/chat"
    assert seen["payload"]["messages"][1]["images"]


def test_vision_cloud_requires_free_open_model(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "clave-de-prueba")
    monkeypatch.setenv("OPENROUTER_VISION_MODEL", "modelo-de-pago")
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as err:
        asyncio.run(media.analyze_open_image(b"img", "image/jpeg", "", "", "Tutor"))
    assert err.value.status_code == 503


def test_open_voice_uses_whisper_without_saving_audio(monkeypatch):
    calls = []

    class Segment:
        text = " Hola, necesito ayuda. "

    class Whisper:
        def transcribe(self, audio, **kwargs):
            calls.append((audio.read(), kwargs))
            return iter([Segment()]), None

    monkeypatch.setattr(media, "_whisper_model", lambda: Whisper())
    monkeypatch.setenv("OPEN_ASR_ENABLED", "true")
    result = asyncio.run(media.transcribe_open(b"audio-de-prueba"))
    assert result == "Hola, necesito ayuda."
    assert calls[0][0] == b"audio-de-prueba"
    assert calls[0][1]["language"] == "es"


def test_screen_and_voice_use_open_engines(client, monkeypatch):
    import base64

    async def fake_voice(audio):
        return "¿Qué representa la figura?"

    async def fake_vision(image, mime, question, context, instructions):
        assert question == "¿Qué representa la figura?"
        assert mime == "image/jpeg"
        return "Observa las partes.", media.LOCAL_VISION_MODEL

    monkeypatch.setattr(media, "transcribe_open", fake_voice)
    monkeypatch.setattr(media, "analyze_open_image", fake_vision)
    monkeypatch.setattr(screen_voice, "connect", lambda: FakeDB())
    FakeDB.records = []
    body = {
        "image_base64": base64.b64encode(b"\xff\xd8\xff" + b"f" * 245 + b"\xff\xd9").decode(),
        "audio_base64": base64.b64encode(b"a" * 1200).decode(),
        "audio_type": "audio/webm", "context": "Fracciones",
    }
    response = client.post("/api/conauti/screen/ask-voice", json=body)
    assert response.status_code == 200
    assert response.json()["provider"] == media.LOCAL_VISION_MODEL
    assert response.json()["audio_stored"] is False
    assert len(FakeDB.records) == 1


def test_open_mode_does_not_request_gemini_embeddings(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    monkeypatch.setenv("RAG_EMBEDDINGS_ENABLED", "true")
    assert rag._embedding("Prueba", "query") is None


def test_cloud_vision_sends_only_the_approved_free_model(monkeypatch):
    seen = {}

    class Response:
        status_code = 200
        def json(self):
            return {"choices": [{"message": {"content": "Veo un cuadrado rojo."}}]}

    class Client:
        def __init__(self, **kwargs):
            assert kwargs["follow_redirects"] is False
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return None
        async def post(self, url, headers, json):
            seen.update({"url": url, "payload": json})
            return Response()

    monkeypatch.setenv("AI_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "clave-de-prueba")
    monkeypatch.delenv("OPENROUTER_VISION_MODEL", raising=False)
    monkeypatch.setattr(media.httpx, "AsyncClient", Client)
    answer, model = asyncio.run(media.analyze_open_image(b"imagen", "image/png", "¿Qué ves?", "", "Tutor"))
    assert answer == "Veo un cuadrado rojo."
    assert model == media.OPEN_VISION_MODEL == "dots-studio/dots-3-note-preview:free"
    assert seen["payload"]["provider"] == {"data_collection": "deny"}
    assert seen["payload"]["reasoning"] == {"enabled": False}
    assert seen["payload"]["messages"][1]["content"][1]["image_url"]["url"].startswith("data:image/png;base64,")
