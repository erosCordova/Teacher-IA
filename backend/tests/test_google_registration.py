"""Seguridad de registro: Google verificado, correo único y acceso heredado."""
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app import conauti_google_auth as google
from app.conauti_auth import Credentials, register as legacy_register


def verify(claims):
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=claims):
        return google.validate_google_identity("id-token-ficticio", "cliente-esperado")


def test_google_config_fails_closed(monkeypatch):
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT_ID", raising=False)
    assert google.google_config() == {"enabled": False, "client_id": None}
    with pytest.raises(HTTPException) as err:
        google.validate_google_identity("token", "")
    assert err.value.status_code == 503


def test_verifies_real_gmail_identity_claims():
    sub, email = verify({
        "iss": "https://accounts.google.com",
        "sub": "google-user-123",
        "email": "Estudiante@Gmail.Com",
        "email_verified": True,
    })
    assert sub == "google-user-123"
    assert email == "estudiante@gmail.com"


def test_google_workspace_confirmed():
    assert verify({
        "iss": "accounts.google.com",
        "sub": "google-school-user",
        "email": "alumno@escuela.edu.pe",
        "hd": "escuela.edu.pe",
        "email_verified": True,
    })[1] == "alumno@escuela.edu.pe"


@pytest.mark.parametrize("claims,status", [
    ({"iss": "https://accounts.google.com", "sub": "x", "email": "falso@gmail.com", "email_verified": False}, 403),
    ({"iss": "otro-proveedor", "sub": "x", "email": "alumno@gmail.com", "email_verified": True}, 401),
    ({"iss": "https://accounts.google.com", "sub": "x", "email": "alumno@correo.org", "email_verified": True}, 403),
    ({"iss": "https://accounts.google.com", "sub": "x", "email": "alumno@escuela.edu.pe", "hd": "otra.com", "email_verified": True}, 403),
    ({"iss": "https://accounts.google.com", "sub": "", "email": "alumno@gmail.com", "email_verified": True}, 401),
])
def test_rejects_unverified_and_untrusted_mailboxes(claims, status):
    with pytest.raises(HTTPException) as exc:
        verify(claims)
    assert exc.value.status_code == status


def test_rejects_invalid_token():
    with patch("google.oauth2.id_token.verify_oauth2_token", side_effect=ValueError("invalid signature")):
        with pytest.raises(HTTPException) as exc:
            google.validate_google_identity("token", "audience")
    assert exc.value.status_code == 401


def test_old_password_based_registration_blocked():
    with pytest.raises(HTTPException) as exc:
        legacy_register(Credentials(username="alumno_test", password="Segura_123456789"))
    assert exc.value.status_code == 403


class DummyConnection:
    def __init__(self, subject=None, email=None, by_email=False):
        self.subject = subject
        self.email = email
        self.by_email = by_email
        self.calls = []
        self.conn = self

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, query, args=None):
        self.calls.append((str(query), args))
        self.query = str(query)
        return self

    def fetchone(self):
        if "WHERE google_sub" in self.query:
            if self.subject:
                return {"user_id": "registered-id", "email": self.email}
            return None
        if "FROM conauti_verified_email_identities WHERE email =" in self.query:
            return {"user_id": "another-id", "provider": "email"} if self.by_email else None
        if "RETURNING id" in self.query:
            return {"id": "new-student-id"}
        return None


def test_duplicate_registration_is_not_allowed(monkeypatch):
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "client-id")
    monkeypatch.setattr(google, "validate_google_identity", lambda *args: ("stable-sub", "student@gmail.com"))
    database = DummyConnection(subject="stable-sub", email="student@gmail.com")
    monkeypatch.setattr(google, "connect", lambda: database)
    with pytest.raises(HTTPException) as exc:
        google.google_authentication(google.GoogleIdentityInput(credential="x" * 80, mode="register"))
    assert exc.value.status_code == 409
    assert not any("INSERT INTO conauti_users" in query for query, _ in database.calls)


def test_prevents_same_email_under_another_google_account(monkeypatch):
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "client-id")
    monkeypatch.setattr(google, "validate_google_identity", lambda *args: ("new-sub", "student@gmail.com"))
    database = DummyConnection(by_email=True)
    monkeypatch.setattr(google, "connect", lambda: database)
    with pytest.raises(HTTPException) as exc:
        google.google_authentication(google.GoogleIdentityInput(credential="x" * 80, mode="register"))
    assert exc.value.status_code == 409


def test_google_login_requires_existing_account(monkeypatch):
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "client-id")
    monkeypatch.setattr(google, "validate_google_identity", lambda *args: ("new-sub", "student@gmail.com"))
    database = DummyConnection()
    monkeypatch.setattr(google, "connect", lambda: database)
    with pytest.raises(HTTPException) as exc:
        google.google_authentication(google.GoogleIdentityInput(credential="x" * 80, mode="login"))
    assert exc.value.status_code == 401


def test_verified_google_registration_creates_single_user_and_session(monkeypatch):
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "client-id")
    monkeypatch.setattr(google, "validate_google_identity", lambda *args: ("first-sub", "student@gmail.com"))
    monkeypatch.setattr(google, "hash_password", lambda _pwd: "hash-for-google-account")
    database = DummyConnection()
    monkeypatch.setattr(google, "connect", lambda: database)
    result = google.google_authentication(google.GoogleIdentityInput(credential="x" * 80, mode="register"))
    assert result["token_type"] == "bearer"
    assert len(result["access_token"]) > 20
    queries = [query for query, _ in database.calls]
    assert sum("INSERT INTO conauti_users" in query for query in queries) == 1
    assert sum("INSERT INTO conauti_google_accounts" in query for query in queries) == 1
    assert sum("INSERT INTO conauti_sessions" in query for query in queries) == 1
