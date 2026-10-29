"""Perfil editable: autenticación, aislamiento y validación sin tocar el correo OAuth."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.conauti_auth import current_user
from app import conauti_profile as profile


class FakeConnection:
    records = {}
    result = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def execute(self, sql, params=None):
        if "INSERT INTO conauti_user_profiles" in sql:
            user_id, display_name = params
            self.records[user_id] = display_name
            self.result = {"display_name": display_name}
        elif "SELECT display_name FROM conauti_user_profiles" in sql:
            self.result = ({"display_name": self.records[params[0]]}
                           if params[0] in self.records else None)
        else:
            self.result = None
        return self

    def fetchone(self):
        return self.result


@pytest.fixture
def client(monkeypatch):
    FakeConnection.records = {}
    profile._schema_ready = False
    monkeypatch.setattr(profile, "connect", lambda: FakeConnection())
    app.dependency_overrides[current_user] = lambda: {"id": "b26e1000-0000-4000-a000-000000000001"}
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(current_user, None)


def test_name_can_be_saved_and_retrieved(client):
    response = client.patch("/api/conauti/profile", json={"display_name": "  Ana María Córdova  "})
    assert response.status_code == 200
    assert response.json() == {"display_name": "Ana María Córdova", "saved": True}
    retrieved = client.get("/api/conauti/profile")
    assert retrieved.status_code == 200
    assert retrieved.json()["display_name"] == "Ana María Córdova"


def test_profile_is_isolated_per_student(client):
    client.patch("/api/conauti/profile", json={"display_name": "Ana María"})
    app.dependency_overrides[current_user] = lambda: {"id": "b26e1000-0000-4000-a000-000000000002"}
    assert client.get("/api/conauti/profile").json()["display_name"] is None
    client.patch("/api/conauti/profile", json={"display_name": "Luis Pérez"})
    assert client.get("/api/conauti/profile").json()["display_name"] == "Luis Pérez"
    app.dependency_overrides[current_user] = lambda: {"id": "b26e1000-0000-4000-a000-000000000001"}
    assert client.get("/api/conauti/profile").json()["display_name"] == "Ana María"


@pytest.mark.parametrize("bad", ["", "A", "<script>alert(1)</script>", "Juan\nPérez", "😊😊"])
def test_invalid_name_rejected(client, bad):
    assert client.patch("/api/conauti/profile", json={"display_name": bad}).status_code == 422


def test_cannot_modify_verified_identity_through_profile(client):
    response = client.patch("/api/conauti/profile", json={
        "display_name": "Ana María", "email": "intruso@example.com",
    })
    assert response.status_code == 200
    assert FakeConnection.records["b26e1000-0000-4000-a000-000000000001"] == "Ana María"
