"""Pruebas de importación de historial offline con PostgreSQL CI efímero.

Nunca apuntan a base de producción ni utilizan cuentas reales.
"""
import os
from uuid import uuid4

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("CONAUTI_TEST_DATABASE_URL"),
    reason="Solo se ejecuta con la base temporal de PostgreSQL del CI.",
)


def test_offline_import_is_idempotent_private_and_incremental():
    import psycopg
    from fastapi.testclient import TestClient
    from app.main import app
    from app.conauti_auth import current_user

    url = os.environ["CONAUTI_TEST_DATABASE_URL"]
    assert any(marker in url for marker in ("teacher_ci", "teacher_test"))
    os.environ["CONAUTI_DATABASE_URL"] = url
    alice, bob, local = uuid4(), uuid4(), uuid4()
    with psycopg.connect(url) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS public.conauti_users(
                id UUID PRIMARY KEY, username VARCHAR(120) NOT NULL)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS public.conauti_conversations(
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES conauti_users(id) ON DELETE CASCADE,
                title VARCHAR(120) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS public.conauti_messages(
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                conversation_id UUID NOT NULL
                    REFERENCES conauti_conversations(id) ON DELETE CASCADE,
                role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
                body TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())
        """)
        conn.execute("INSERT INTO conauti_users(id,username) VALUES (%s,%s),(%s,%s)",
                     (alice, "offline_ci_a", bob, "offline_ci_b"))

    original = app.dependency_overrides.get(current_user)
    payload = {
        "local_conversation_id": str(local),
        "messages": [
            {"id": 1, "rol": "estudiante", "texto": "¿Qué es una fracción?"},
            {"id": 2, "rol": "tutor", "texto": "¿En cuántas partes se divide la unidad?"},
        ],
    }
    try:
        with TestClient(app) as client:
            # Nunca transferir datos offline sin una sesión autenticada.
            app.dependency_overrides.pop(current_user, None)
            assert client.post("/api/conauti/offline/import", json=payload).status_code == 401

            app.dependency_overrides[current_user] = lambda: {
                "id": alice, "username": "offline_ci_a"}
            first = client.post("/api/conauti/offline/import", json=payload)
            assert first.status_code == 200, first.text
            first_data = first.json()
            assert first_data["added"] == 2
            assert first_data["total"] == 2
            cid = first_data["conversation_id"]

            duplicate = client.post("/api/conauti/offline/import", json=payload)
            assert duplicate.status_code == 200
            assert duplicate.json()["added"] == 0
            assert duplicate.json()["conversation_id"] == cid

            # La ventana móvil de mensajes crece tras el siguiente estudio.
            expanded = {**payload, "messages": [
                *payload["messages"],
                {"id": 3, "rol": "estudiante", "texto": "¿Y si tengo cuatro partes?"},
                {"id": 4, "rol": "tutor", "texto": "¿Cuántas partes serían la mitad?"},
            ]}
            synced = client.post("/api/conauti/offline/import", json=expanded)
            assert synced.status_code == 200, synced.text
            assert synced.json()["added"] == 2
            assert synced.json()["total"] == 4
            assert client.post("/api/conauti/offline/import", json=expanded).json()["added"] == 0

            # El cliente solo retiene la ventana final; la unión usa solapamiento.
            tail = {**expanded, "messages": [
                expanded["messages"][2],
                expanded["messages"][3],
                {"id": 5, "rol": "estudiante", "texto": "¿Puedes darme otra pista?"},
            ]}
            last = client.post("/api/conauti/offline/import", json=tail)
            assert last.status_code == 200, last.text
            assert last.json()["added"] == 1
            assert last.json()["total"] == 5

            divergent = {**payload, "messages": [
                {"id": 1, "rol": "estudiante", "texto": "Un texto distinto"},
            ]}
            bad = client.post("/api/conauti/offline/import", json=divergent)
            assert bad.status_code == 409
            invalid = {**payload, "messages": [
                {"id": 9, "rol": "estudiante", "texto": "Pregunta"},
                {"id": 9, "rol": "tutor", "texto": "Pista"},
            ]}
            assert client.post("/api/conauti/offline/import", json=invalid).status_code == 422

            app.dependency_overrides[current_user] = lambda: {
                "id": bob, "username": "offline_ci_b"}
            assert client.get(f"/api/conauti/conversations/{cid}/messages").status_code == 404
            # Mismo ID local, pero un usuario distinto produce conversación distinta.
            other = client.post("/api/conauti/offline/import", json=payload)
            assert other.status_code == 200, other.text
            assert other.json()["conversation_id"] != cid

            app.dependency_overrides[current_user] = lambda: {
                "id": alice, "username": "offline_ci_a"}
            history = client.get(f"/api/conauti/conversations/{cid}/messages")
            assert history.status_code == 200
            assert [x["role"] for x in history.json()] == [
                "user", "assistant", "user", "assistant", "user"]
    finally:
        if original is not None:
            app.dependency_overrides[current_user] = original
        else:
            app.dependency_overrides.pop(current_user, None)
