"""El cliente móvil solo permite los orígenes conocidos de Capacitor."""
from fastapi.testclient import TestClient
from app.main import app, conauti_cors_origins


def test_android_localhost_is_authorized_without_wildcard():
    origins = conauti_cors_origins()
    assert "http://localhost" in origins
    assert "https://localhost" in origins
    assert "*" not in origins


def test_preflight_android_with_bearer_header():
    response = TestClient(app).options(
        "/api/conauti/auth/me",
        headers={
            "Origin": "http://localhost",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_unknown_android_origin_is_not_trusted():
    response = TestClient(app).options(
        "/api/conauti/auth/me",
        headers={
            "Origin": "https://sitio-malicioso.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in response.headers
