"""Pruebas de acceso privado a originales y compatibilidad con materiales antiguos."""
from uuid import uuid4
import pytest
from fastapi import HTTPException
from app import conauti_rag as rag


def test_allowed_mimes_are_not_from_upload_header():
    assert rag.media_type("manual.pdf") == "application/pdf"
    assert rag.media_type("clase.docx").endswith("wordprocessingml.document")
    assert rag.media_type("resumen.txt").startswith("text/plain")


def test_file_download_headers_are_private_and_safe():
    result = rag.private_headers("Apuntes matemáticas.pdf", download=True)
    assert result["Content-Disposition"].startswith("attachment;")
    assert "Apuntes%20matem%C3%A1ticas.pdf" in result["Content-Disposition"]
    assert "no-store" in result["Cache-Control"]
    assert result["X-Content-Type-Options"] == "nosniff"


def test_text_backup_is_labeled_as_incomplete_not_original():
    text = rag.extracted_document_text("Anatomía.pdf", [(2, "El cerebro."), (3, "La médula.")])
    assert "no el archivo original" in text
    assert "[Página 2]" in text
    assert "[Página 3]" in text


class FakeConn:
    def __init__(self, answers):
        self.answers = iter(answers)
        self.sql = []

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return None

    def execute(self, sql, params=()):
        self.sql.append((sql, params))
        return self

    def fetchone(self):
        return next(self.answers)

    def fetchall(self):
        return next(self.answers)


def test_private_get_file_checks_owner_and_returns_original(monkeypatch):
    owner = uuid4()
    document = uuid4()
    fake = FakeConn([("libro.pdf", b"%PDF-1.4 original", "application/pdf")])
    monkeypatch.setattr(rag.psycopg, "connect", lambda *a, **kw: fake)
    monkeypatch.setattr(rag, "ensure_schema", lambda conn: None)
    monkeypatch.setattr(rag, "database_url", lambda: "postgresql://fake")
    response = rag.get_saved_file(document, download=True, user={"id": owner})
    assert response.body == b"%PDF-1.4 original"
    assert response.headers["content-disposition"].startswith("attachment;")
    assert fake.sql[0][1] == (document, owner)
    assert "d.user_id=%s" in fake.sql[0][0]


def test_legacy_file_replies_with_clear_reupload_instruction(monkeypatch):
    owner = uuid4()
    fake = FakeConn([("material.pdf", None, None)])
    monkeypatch.setattr(rag.psycopg, "connect", lambda *a, **kw: fake)
    monkeypatch.setattr(rag, "ensure_schema", lambda conn: None)
    monkeypatch.setattr(rag, "database_url", lambda: "postgresql://fake")
    with pytest.raises(HTTPException) as err:
        rag.get_saved_file(uuid4(), download=True, user={"id": owner})
    assert err.value.status_code == 409
    assert "Vuelve a subir" in err.value.detail


def test_file_not_owned_is_not_exposed(monkeypatch):
    fake = FakeConn([None])
    monkeypatch.setattr(rag.psycopg, "connect", lambda *a, **kw: fake)
    monkeypatch.setattr(rag, "ensure_schema", lambda conn: None)
    monkeypatch.setattr(rag, "database_url", lambda: "postgresql://fake")
    with pytest.raises(HTTPException) as err:
        rag.get_saved_file(uuid4(), download=False, user={"id": uuid4()})
    assert err.value.status_code == 404


def test_owner_can_read_legacy_index_without_original(monkeypatch):
    fake = FakeConn([("manual.pdf",), [(1, "Anotaciones de clase.")]])
    monkeypatch.setattr(rag.psycopg, "connect", lambda *a, **kw: fake)
    monkeypatch.setattr(rag, "ensure_schema", lambda conn: None)
    monkeypatch.setattr(rag, "database_url", lambda: "postgresql://fake")
    response = rag.get_indexed_text(uuid4(), download=False, user={"id": uuid4()})
    assert "Anotaciones de clase." in response.body.decode()
    assert "no el archivo original" in response.body.decode()
