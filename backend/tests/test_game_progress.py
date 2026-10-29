"""Progreso de juegos: aislamiento entre estudiantes y validación del payload."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.conauti_auth import current_user
from app import conauti_games as games


class FakeConnection:
    rows = {}
    last_params = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def execute(self, sql, params=None):
        if "INSERT INTO conauti_game_progress" in sql:
            self.rows[str(params[0])] = {
                "xp": params[1],
                "completados": params[2],
                "aciertos": params[3],
                "intentos": params[4],
                "por_materia": __import__("json").loads(params[5]),
                "dias": __import__("json").loads(params[6]),
                "insignias": __import__("json").loads(params[7]),
            }
        if "SELECT xp, completados" in sql:
            self.last_params = params
        return self

    def fetchone(self):
        return self.rows.get(str(self.last_params[0]))


@pytest.fixture
def client(monkeypatch):
    FakeConnection.rows = {}
    FakeConnection.last_params = None
    monkeypatch.setattr(games, "connect", lambda: FakeConnection())
    monkeypatch.setattr(games, "_prepared", False)
    app.dependency_overrides[current_user] = lambda: {"id": "7e100000-0000-4000-a000-000000000001"}
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(current_user, None)


def test_progress_persists_for_authenticated_student(client):
    assert client.get("/api/conauti/games/progress").json()["progress"]["xp"] == 0
    progress = {"xp": 65, "completados": 1, "aciertos": 1, "intentos": 1,
                "porMateria": {"biologia": 1}, "dias": ["2026-10-28"],
                "insignias": ["¡Primer desafío!"]}
    response = client.put("/api/conauti/games/progress", json={"progress": progress})
    assert response.status_code == 200
    actual = client.get("/api/conauti/games/progress")
    assert actual.status_code == 200
    assert actual.json()["progress"] == progress


def test_invalid_subject_is_rejected(client):
    progress = {"xp": 50, "completados": 1, "aciertos": 1, "intentos": 1,
                "porMateria": {"inventada": 1}, "dias": [], "insignias": []}
    assert client.put("/api/conauti/games/progress", json={"progress": progress}).status_code == 422


def test_bad_counters_are_rejected(client):
    progress = {"xp": 10, "completados": 3, "aciertos": 3, "intentos": 1,
                "porMateria": {}, "dias": [], "insignias": []}
    assert client.put("/api/conauti/games/progress", json={"progress": progress}).status_code == 422
