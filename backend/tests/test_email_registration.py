"""Reglas básicas del acceso por correo de un solo uso."""
import hashlib
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app import conauti_email_auth as mail


def test_email_config_disabled_without_smtp(monkeypatch):
    for key in ("SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM", "EMAIL_OTP_PEPPER"):
        monkeypatch.delenv(key, raising=False)
    assert mail.email_config()["enabled"] is False
    with pytest.raises(HTTPException) as err:
        mail.email_start(mail.EmailStart(email="alumno@example.com", mode="register"))
    assert err.value.status_code == 503


def test_email_formats_are_validated():
    with pytest.raises(ValidationError):
        mail.EmailStart(email="inventado", mode="register")
    with pytest.raises(ValidationError):
        mail.EmailConfirm(email="a@ejemplo.com", mode="register", code="1234")
    with pytest.raises(ValidationError):
        mail.EmailStart(email="a@ejemplo.com", mode="unknown")


def test_code_hash_is_scoped_by_email_and_mode(monkeypatch):
    monkeypatch.setenv("EMAIL_OTP_PEPPER", "This_is_a_long_random_secret_example_value_12345")
    a = mail.code_hash("a@example.com", "register", "12345678")
    b = mail.code_hash("b@example.com", "register", "12345678")
    c = mail.code_hash("a@example.com", "login", "12345678")
    assert len(a) == 64 and a != b and a != c
    assert a != hashlib.sha256(b"12345678").hexdigest()


def test_mail_message_contains_code_but_not_in_endpoint_result(monkeypatch):
    for key, value in {
        "SMTP_HOST": "smtp.example.com",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "test",
        "SMTP_PASSWORD": "hidden",
        "SMTP_FROM": "no-reply@example.com",
    }.items():
        monkeypatch.setenv(key, value)

    captured = []
    class DummySMTP:
        def __init__(self, host, port, timeout):
            assert host == "smtp.example.com" and port == 587
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def ehlo(self): pass
        def starttls(self, context): pass
        def login(self, username, password):
            assert username == "test"
        def send_message(self, message):
            captured.append(message)

    monkeypatch.setattr(mail.smtplib, "SMTP", DummySMTP)
    mail.send_code("alumno@example.com", "12345678")
    assert captured[0]["To"] == "alumno@example.com"
    assert "12345678" in captured[0].get_content()
    assert "12345678" not in str(mail.email_config())


def test_provider_identity_must_be_global():
    assert "PRIMARY KEY" in mail.GLOBAL_SCHEMA
    assert "provider" in mail.GLOBAL_SCHEMA
    assert "google" in mail.GOOGLE_BACKFILL
    assert "ON CONFLICT (email) DO NOTHING" in mail.GOOGLE_BACKFILL


def test_bad_hmac_key_fails_closed(monkeypatch):
    monkeypatch.setenv("EMAIL_OTP_PEPPER", "short")
    with pytest.raises(HTTPException) as err:
        mail.code_hash("a@example.com", "login", "00000000")
    assert err.value.status_code == 503


def test_code_handler_declares_attempt_limiter():
    assert "attempts INT NOT NULL DEFAULT 0" in mail.GLOBAL_SCHEMA
    assert "last_sent_at" in mail.GLOBAL_SCHEMA
    assert "hourly_count" in mail.GLOBAL_SCHEMA
