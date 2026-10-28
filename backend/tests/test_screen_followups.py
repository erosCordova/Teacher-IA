"""Asistente visual: nueva captura por consulta y continuidad pedagógica segura."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.conauti_auth import current_user
from app import conauti_screen as screen


class FakeGemini:
    last_payload = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def post(self, url, headers, json):
        self.last_payload = json
        FakeGemini.last_payload = json
        return type(
            "Response", (), {
                "status_code": 200,
                "json": lambda self: {
                    "candidates": [{"content": {
                        "parts": [{"text": "¿Qué observas al comparar las fracciones?"}],
                    }}],
                },
            },
        )()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(screen, "config", lambda name: "test-key")
    monkeypatch.setattr(screen, "current_model", lambda: "gemini-test")
    monkeypatch.setattr(screen.httpx, "AsyncClient", lambda **kwargs: FakeGemini())
    app.dependency_overrides[current_user] = lambda: {"id": "student"}
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(current_user, None)


def test_visual_followup_sends_question_and_previous_context(client):
    jpeg = b"\xff\xd8\xff" + b"f" * 240 + b"\xff\xd9"
    result = client.post(
        "/api/conauti/screen/analyze?question=Por%20qu%C3%A9",
        headers={
            "Content-Type": "image/jpeg",
            "X-Visual-Context": "Pregunta anterior: fracciones. Orientación anterior: divide en cuatro.",
        },
        content=jpeg,
    )
    assert result.status_code == 200
    assert result.json()["image_stored"] is False
    assert result.json()["automatic_capture"] is False
    parts = FakeGemini.last_payload["contents"][0]["parts"]
    instruction = parts[0]["text"]
    assert "Pregunta actual del estudiante: Por qué" in instruction
    assert "Pregunta anterior: fracciones" in instruction
    assert parts[1]["inline_data"]["mime_type"] == "image/jpeg"


def test_visual_context_is_size_limited(client):
    result = client.post(
        "/api/conauti/screen/analyze?question=ayuda",
        headers={"Content-Type": "image/jpeg", "X-Visual-Context": "x" * 501},
        content=b"\xff\xd8\xff" + b"a" * 240 + b"\xff\xd9",
    )
    assert result.status_code == 422


def test_visual_question_requires_valid_image(client):
    result = client.post(
        "/api/conauti/screen/analyze?question=Ayuda",
        headers={"Content-Type": "image/jpeg"},
        content=b"contenido no válido",
    )
    assert result.status_code == 400
