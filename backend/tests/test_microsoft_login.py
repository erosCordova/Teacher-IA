"""El proveedor Microsoft es opcional y solo acepta identidad acreditada."""
from unittest.mock import patch
import jwt
import pytest
from fastapi import HTTPException

from app import conauti_microsoft_auth as ms


def test_not_configured_is_disabled(monkeypatch):
    for key in ("MICROSOFT_OAUTH_CLIENT_ID", "MICROSOFT_OAUTH_CLIENT_SECRET", "MICROSOFT_OAUTH_REDIRECT_URI"):
        monkeypatch.delenv(key, raising=False)
    assert ms.config() == {"enabled": False}
    with pytest.raises(HTTPException) as exc:
        ms.start("register")
    assert exc.value.status_code == 503


def get_claims(**changes):
    claims = {
        "iss": "https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0",
        "tid": "11111111-1111-1111-1111-111111111111",
        "oid": "school-student-123",
        "nonce": "one-time-nonce",
        "verified_primary_email": "alumno@institucion.edu.pe",
    }
    claims.update(changes)
    class JwkClient:
        def __init__(self, *args, **kwargs): pass
        def get_signing_key_from_jwt(self, token): return type("Key", (), {"key": "key"})()
    with patch.object(jwt, "PyJWKClient", JwkClient):
        with patch.object(jwt, "decode", return_value=claims):
            return ms.validate_microsoft_claims("mock.token.value", "client-id", "one-time-nonce")


def test_verified_email_accepted():
    subject, email = get_claims()
    assert email == "alumno@institucion.edu.pe"
    assert subject.endswith("school-student-123")


@pytest.mark.parametrize("changes,expected", [
    ({"verified_primary_email": None, "email": "user@example.com"}, 403),
    ({"nonce": "another"}, 401),
    ({"iss": "https://fake.example.com/tenant"}, 401),
    ({"tid": "invalid"}, 401),
    ({"verified_primary_email": "no-email"}, 401),
])
def test_rejects_unverified_or_invalid_claims(changes, expected):
    with pytest.raises(HTTPException) as exc:
        get_claims(**changes)
    assert exc.value.status_code == expected


def test_accepts_explicit_domain_verification():
    assert get_claims(verified_primary_email=None, email="student@school.edu", xms_edov=True)[1] == "student@school.edu"


def test_ticket_digest_is_sha256():
    assert len(ms.digest("unguessable-ticket")) == 64
    assert ms.digest("one-ticket") != ms.digest("another-ticket")


def test_no_open_redirect_to_arbitrary_site():
    assert ms.frontend_base() == "https://myteacheria.vercel.app"
