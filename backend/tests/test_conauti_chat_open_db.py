"""Prueba del chat con PostgreSQL efímero y modelo simulado, nunca producción."""
import os
from pathlib import Path
from uuid import uuid4

import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("CONAUTI_TEST_DATABASE_URL"),
    reason="Requiere la base efímera de CI.",
)


def test_chat_persists_open_model_metadata_and_isolates_students(monkeypatch):
    import psycopg
    from fastapi.testclient import TestClient
    from app.main import app
    from app.conauti_auth import current_user

    url = os.environ["CONAUTI_TEST_DATABASE_URL"]
    assert "teacher_ci" in url or "teacher_test" in url
    monkeypatch.setenv("CONAUTI_DATABASE_URL", url)
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_ENABLED", "true")
    monkeypatch.setenv("OLLAMA_MODEL", "qwen3:0.6b")
    student, other, conversation, request_id = uuid4(), uuid4(), uuid4(), uuid4()

    migrations = Path(__file__).resolve().parents[1] / "migrations"
    with psycopg.connect(url, autocommit=True) as conn:
        for name in ("conauti_001_up.sql", "conauti_004_up.sql", "conauti_005_up.sql"):
            conn.execute((migrations / name).read_text(encoding="utf-8"))
        conn.execute(
            "INSERT INTO conauti_users(id,username,password_hash) VALUES (%s,%s,%s),(%s,%s,%s)",
            (student, "estudiante_ci", "hash", other, "otro_ci", "hash"),
        )
        conn.execute(
            "INSERT INTO conauti_conversations(id,user_id,title) VALUES (%s,%s,%s)",
            (conversation, student, "Prueba"),
        )

    calls = []
    def model(history, instructions, *, max_tokens):
        calls.append(instructions)
        answers = [
            "Busca una explicación conceptual sencilla.",
            "Una fracción representa partes de una unidad.",
            "Una fracción representa partes de una unidad. ¿Qué observarías?",
        ]
        return answers[len(calls) - 1], {"input_tokens": 3, "output_tokens": 2}

    monkeypatch.setattr("app.conauti_multi_agent.open_reply", model)
    app.dependency_overrides[current_user] = lambda: {"id": student, "username": "estudiante_ci"}
    try:
        with TestClient(app) as client:
            route = f"/api/conauti/ai/conversations/{conversation}/respond"
            payload = {"request_id": str(request_id), "text": "¿Qué es una fracción?"}
            result = client.post(route, json=payload)
            assert result.status_code == 200, result.text
            assert "fracción" in result.json()["assistant_message"]["body"].lower()
            assert len(calls) == 3

            repeated = client.post(route, json=payload)
            assert repeated.status_code == 200
            assert repeated.json()["reused"] is True
            assert len(calls) == 3

            app.dependency_overrides[current_user] = lambda: {"id": other, "username": "otro_ci"}
            denied = client.post(route, json={"request_id": str(uuid4()), "text": "Hola"})
            assert denied.status_code == 404

        with psycopg.connect(url) as conn:
            row = conn.execute(
                "SELECT provider,model,input_tokens,output_tokens FROM conauti_ai_requests WHERE request_id=%s",
                (request_id,),
            ).fetchone()
            assert row == ("Ollama", "qwen3:0.6b", 9, 6)
            count = conn.execute(
                "SELECT COUNT(*) FROM conauti_messages WHERE conversation_id=%s",
                (conversation,),
            ).fetchone()[0]
            assert count == 2
    finally:
        app.dependency_overrides.pop(current_user, None)
