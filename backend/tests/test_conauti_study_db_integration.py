"""Pruebas end-to-end sobre PostgreSQL EFÍMERO de GitHub Actions.

No ejecuta tareas contra Supabase ni cuentas de estudiantes.
CONAUTI_TEST_DATABASE_URL debe señalar a una base de pruebas aislada.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("CONAUTI_TEST_DATABASE_URL"),
    reason="Esta prueba requiere PostgreSQL de CI, nunca la base de producción.",
)


@pytest.fixture(scope="module")
def test_db(monkeypatch_module=None):
    import psycopg
    url = os.environ["CONAUTI_TEST_DATABASE_URL"]
    # Fail closed: no permitir pruebas destructivas con configuración normal.
    assert any(name in url for name in ("teacher_ci", "teacher_test")), (
        "La integración solo puede ejecutarse en una base de pruebas."
    )
    os.environ["CONAUTI_DATABASE_URL"] = url
    with psycopg.connect(url) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS public.conauti_users(
                id uuid PRIMARY KEY, username varchar(120) NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS public.conauti_learning_topics(
                user_id uuid, topic varchar(110), mastery smallint,
                last_difficulty varchar(110), next_goal varchar(160),
                updated_at timestamptz DEFAULT now()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS public.conauti_assessment_attempts(
                id uuid PRIMARY KEY, user_id uuid,
                topic_key varchar(110), correct boolean,
                answered_at timestamptz DEFAULT now()
            )
        """)
        user_id = uuid.uuid4()
        conn.execute(
            "INSERT INTO public.conauti_users(id, username) VALUES (%s, %s)",
            (user_id, "teacher_ci_student"),
        )
        conn.execute(
            "INSERT INTO public.conauti_learning_topics "
            "(user_id,topic,mastery,last_difficulty,next_goal) "
            "VALUES (%s,%s,%s,%s,%s)",
            (user_id, "química", 1, "intermedio", "Repasar enlaces"),
        )
        for index in range(3):
            conn.execute(
                "INSERT INTO public.conauti_assessment_attempts "
                "(id,user_id,topic_key,correct) VALUES (%s,%s,%s,%s)",
                (uuid.uuid4(), user_id, "fracciones", index == 0),
            )
    yield user_id
    # GitHub elimina el contenedor de pruebas al terminar. No toca producción.


def test_full_study_flow_with_real_database_and_isolated_student(test_db, monkeypatch):
    import psycopg
    from fastapi.testclient import TestClient
    from app.main import app
    from app.conauti_auth import current_user

    user_id = test_db
    other_id = uuid.uuid4()
    original = app.dependency_overrides.get(current_user)
    app.dependency_overrides[current_user] = lambda: {
        "id": user_id, "username": "teacher_ci_student"
    }

    try:
        with TestClient(app) as client:
            initial = client.get("/api/conauti/study/overview")
            assert initial.status_code == 200, initial.text
            overview = initial.json()
            chemistry = next(x for x in overview["recommendations"] if x["topic"] == "química")
            assert chemistry["priority"] == 3
            assert overview["cards"]["total"] == 0
            assert next(x for x in overview["recommendations"]
                        if x["topic"] == "fracciones")["priority"] == 3

            created = client.post("/api/conauti/study/cards/starter")
            assert created.status_code == 200, created.text
            assert created.json()["created"] == 6

            again = client.post("/api/conauti/study/cards/starter")
            assert again.status_code == 200, again.text
            assert again.json()["created"] == 0

            card_response = client.get("/api/conauti/study/cards?limit=80")
            assert card_response.status_code == 200, card_response.text
            cards = card_response.json()["cards"]
            assert len(cards) == 6
            card_id = cards[0]["id"]

            reviewed = client.post(
                f"/api/conauti/study/cards/{card_id}/review",
                json={"rating": "bien"},
            )
            assert reviewed.status_code == 200, reviewed.text
            assert reviewed.json()["interval_days"] >= 1
            updated_cards = client.get("/api/conauti/study/cards").json()["cards"]
            assert next(x for x in updated_cards if x["id"] == card_id)["reviews"] == 1

            created_manual = client.post(
                "/api/conauti/study/cards",
                json={
                    "topic": "biología",
                    "question": "¿Para qué sirven los ribosomas?",
                    "answer": "Sintetizan proteínas a partir de ARN mensajero.",
                },
            )
            assert created_manual.status_code == 201, created_manual.text
            manual_id = created_manual.json()["id"]

            start = client.post(
                "/api/conauti/study/exams/start",
                json={"topic": "", "count": 5},
            )
            assert start.status_code == 201, start.text
            exam = start.json()
            assert len(exam["questions"]) == 5
            assert all(
                set(item) == {"id", "topic", "question", "options"}
                for item in exam["questions"]
            )
            selections = {q["id"]: "A" for q in exam["questions"]}
            finished = client.post(
                f"/api/conauti/study/exams/{exam['id']}/submit",
                json={"answers": selections},
            )
            assert finished.status_code == 200, finished.text
            assert 0 <= finished.json()["score"] <= 5
            assert len(finished.json()["feedback"]) == 5
            assert client.post(
                f"/api/conauti/study/exams/{exam['id']}/submit",
                json={"answers": selections},
            ).status_code == 409

            # Integración real: resultados por materia se convierten en
            # evidencia para la ruta adaptativa (no solo nota global).
            with psycopg.connect(os.environ["CONAUTI_TEST_DATABASE_URL"]) as conn:
                row = conn.execute(
                    "SELECT answers,score FROM public.conauti_study_exams "
                    "WHERE id=%s AND user_id=%s",
                    (uuid.UUID(exam["id"]), user_id),
                ).fetchone()
            assert row is not None and row[0] == selections
            learning = client.get("/api/conauti/study/overview")
            assert learning.status_code == 200, learning.text
            topics = {entry["topic"] for entry in learning.json()["recommendations"]}
            assert any(q["topic"] in topics for q in exam["questions"])

            history = client.get("/api/conauti/study/exams/history")
            assert history.status_code == 200, history.text
            assert history.json()["exams"][0]["id"] == exam["id"]

            # Ningún estudiante puede revisar ni recuperar recursos ajenos.
            app.dependency_overrides[current_user] = lambda: {
                "id": other_id, "username": "other"
            }
            assert client.get("/api/conauti/study/cards").json()["cards"] == []
            assert client.post(
                f"/api/conauti/study/cards/{card_id}/review",
                json={"rating": "bien"}
            ).status_code == 404
            assert client.post(
                f"/api/conauti/study/exams/{exam['id']}/submit",
                json={"answers": selections},
            ).status_code == 404

            # El creador sí puede borrar sus propias tarjetas.
            app.dependency_overrides[current_user] = lambda: {
                "id": user_id, "username": "teacher_ci_student"
            }
            assert client.delete(
                f"/api/conauti/study/cards/{manual_id}"
            ).status_code == 200

        # Sin sesión las rutas permanecen protegidas.
        app.dependency_overrides.pop(current_user, None)
        with TestClient(app) as client:
            assert client.get("/api/conauti/study/overview").status_code == 401
            assert client.get("/api/conauti/study/cards").status_code == 401
            assert client.get("/api/conauti/study/exams/history").status_code == 401
    finally:
        if original is not None:
            app.dependency_overrides[current_user] = original
        else:
            app.dependency_overrides.pop(current_user, None)


def test_document_generation_and_removal_with_real_db(test_db, monkeypatch):
    import psycopg
    from fastapi.testclient import TestClient
    from app.main import app
    from app.conauti_auth import current_user
    from app.conauti_rag import ensure_schema

    uid = test_db
    doc_id = uuid.uuid4()
    # El índice temporal solo existe en el contenedor PostgreSQL de CI.
    with psycopg.connect(os.environ["CONAUTI_TEST_DATABASE_URL"]) as conn:
        ensure_schema(conn)
        conn.execute(
            "INSERT INTO public.conauti_rag_documents "
            "(id,user_id,filename,checksum,pages) VALUES (%s,%s,%s,%s,%s)",
            (doc_id,uid,"ciencias-ci.pdf","f"*64,2),
        )
        conn.execute(
            "INSERT INTO public.conauti_rag_chunks "
            "(document_id,ordinal,page_number,body) VALUES "
            "(%s,0,1,%s),(%s,1,2,%s)",
            (
                doc_id, "Los seres vivos están compuestos de células.",
                doc_id, "Las células tienen membrana y citoplasma.",
            ),
        )

    generated = {
        "cards": [
            {"question": "¿Qué forma a los seres vivos?",
             "answer": "Los seres vivos están compuestos de células.", "page": 1},
            {"question": "¿Qué protege a las células?",
             "answer": "La membrana celular delimita y protege.", "page": 2},
            {"question": "¿Qué es el citoplasma?",
             "answer": "Es la zona celular donde ocurren muchos procesos.", "page": 2},
            {"question": "¿Cuál es una unidad de la vida?",
             "answer": "La célula es la unidad básica de la vida.", "page": 1},
        ]
    }

    class FakeReply:
        content = __import__("json").dumps(generated)

    class FakeModel:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def invoke(self, messages):
            assert "PÁGINA" in messages[-1].content
            return FakeReply()

    monkeypatch.setattr(
        "langchain_google_genai.ChatGoogleGenerativeAI", FakeModel
    )
    monkeypatch.setattr("app.conauti_ai.config", lambda name: "fake-ci-api-key")
    monkeypatch.setattr("app.conauti_ai.current_model", lambda: "gemini-ci-fake")

    old = app.dependency_overrides.get(current_user)
    app.dependency_overrides[current_user] = lambda: {
        "id": uid, "username": "teacher_ci_student"
    }
    try:
        with TestClient(app) as client:
            made = client.post(
                "/api/conauti/study/cards/from-document",
                json={"document_id": str(doc_id), "topic": "biología documental"},
            )
            assert made.status_code == 200, made.text
            assert made.json()["created"] == 4

            result = client.get("/api/conauti/study/cards?limit=80")
            assert result.status_code == 200, result.text
            derived = [
                row for row in result.json()["cards"]
                if row["source_name"] == "ciencias-ci.pdf"
            ]
            assert len(derived) == 4
            assert all(row["source_page"] in (1, 2) for row in derived)

            exam = client.post(
                "/api/conauti/study/exams/start",
                json={"topic": "biología documental", "count": 4},
            )
            assert exam.status_code == 201, exam.text
            exam_id = exam.json()["id"]

            deleted = client.delete(f"/api/conauti/rag/documents/{doc_id}")
            assert deleted.status_code == 200, deleted.text
            assert deleted.json()["deleted"] is True

            listed = client.get("/api/conauti/study/cards?limit=80").json()
            assert not any(
                c["source_name"] == "ciencias-ci.pdf"
                for c in listed["cards"]
            )
            assert exam_id not in {
                e["id"] for e in
                client.get("/api/conauti/study/exams/history").json()["exams"]
            }
    finally:
        if old is not None:
            app.dependency_overrides[current_user] = old
        else:
            app.dependency_overrides.pop(current_user, None)
