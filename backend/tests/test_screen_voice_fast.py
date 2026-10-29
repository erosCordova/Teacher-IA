"""Pruebas del camino rápido voz + captura, sin llamar al Gemini real."""
import base64
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.conauti_auth import current_user
from app import conauti_screen_voice as voice


class MockGemini:
    calls = 0
    payload = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def post(self, url, json, headers):
        MockGemini.calls += 1
        MockGemini.payload = json

        class Response:
            status_code = 200

            def json(self):
                return {"candidates": [{"content": {"parts": [{
                    "text": '{"question":"¿Qué es una fracción?","analysis":"Observa en cuántas partes se divide la unidad."}',
                }]}}]}

        return Response()


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
    monkeypatch.setattr(voice, "config", lambda name: "test-key")
    monkeypatch.setattr(voice, "current_model", lambda: "gemini-test")
    monkeypatch.setattr(voice, "connect", lambda: FakeDB())
    FakeDB.records = []
    monkeypatch.setattr(voice.httpx, "AsyncClient", lambda **kwargs: MockGemini())
    app.dependency_overrides[current_user] = lambda: {"id": "estudiante"}
    MockGemini.calls = 0
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(current_user, None)


def audio_e_imagen():
    return {
        "image_base64": base64.b64encode(
            b"\xff\xd8\xff" + b"f" * 245 + b"\xff\xd9"
        ).decode("ascii"),
        "audio_base64": base64.b64encode(
            b"\x1a\x45\xdf\xa3" + b"audio" * 210
        ).decode("ascii"),
        "audio_type": "audio/webm",
        "context": "Orientación anterior: analizar la figura",
    }


def test_pregunta_con_voz_y_vista_usa_una_sola_llamada_gemini(client):
    result = client.post("/api/conauti/screen/ask-voice", json=audio_e_imagen())
    assert result.status_code == 200
    assert MockGemini.calls == 1
    assert len(FakeDB.records) == 1
    assert result.json()["question"] == "¿Qué es una fracción?"
    assert result.json()["image_stored"] is False
    assert result.json()["audio_stored"] is False
    parts = MockGemini.payload["contents"][0]["parts"]
    assert parts[1]["inline_data"]["mime_type"] == "audio/webm"
    assert parts[2]["inline_data"]["mime_type"] == "image/jpeg"


def test_audio_invalido_se_rechaza_antes_de_gemini(client):
    data = audio_e_imagen()
    data["audio_type"] = "application/octet-stream"
    result = client.post("/api/conauti/screen/ask-voice", json=data)
    assert result.status_code == 415
    assert MockGemini.calls == 0


def test_imagen_truncada_se_rechaza_antes_de_gemini(client):
    data = audio_e_imagen()
    data["image_base64"] = base64.b64encode(b"archivo incorrecto").decode("ascii")
    result = client.post("/api/conauti/screen/ask-voice", json=data)
    assert result.status_code == 400
    assert MockGemini.calls == 0
