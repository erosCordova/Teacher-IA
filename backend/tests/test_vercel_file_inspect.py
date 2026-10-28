"""Pruebas del parser aislado que se ejecuta en la API de Vercel."""
import importlib.util
import io
import json
import zipfile
from pathlib import Path
from unittest.mock import patch

from pypdf import PdfWriter

API_FILE = Path(__file__).resolve().parents[2] / "frontend" / "api" / "conauti" / "files" / "inspect.py"
spec = importlib.util.spec_from_file_location("vercel_inspect", API_FILE)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_vercel_text_file():
    assert module.extract_document_text("ejercicio.txt", b"Resuelve 3 + 5") == "Resuelve 3 + 5"


def test_vercel_docx_and_pdf():
    zipped = io.BytesIO()
    with zipfile.ZipFile(zipped, "w") as archive:
        archive.writestr(
            "word/document.xml",
            '<w:document xmlns:w="urn:word"><w:body><w:p><w:r>'
            '<w:t>Fracciones equivalentes</w:t></w:r></w:p></w:body></w:document>',
        )
    assert "Fracciones equivalentes" in module.extract_document_text("leccion.docx", zipped.getvalue())

    pdf = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=300, height=300)
    writer.write(pdf)
    assert module.extract_document_text("prueba.pdf", pdf.getvalue()) == ""


def test_vercel_binary_file_requires_supported_reader():
    assert module.extract_document_text("aplicacion.exe", bytes([0, 16, 5])) == ""


def test_vercel_handler_upload_with_authenticated_session():
    class FakeResult:
        status = 200
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False

    endpoint = object.__new__(module.handler)
    endpoint.path = "/api/conauti/files/inspect?filename=actividad.txt"
    endpoint.headers = {
        "Authorization": "Bearer usuario-valido",
        "Content-Length": "19",
    }
    endpoint.rfile = io.BytesIO(b"Explicar un ejemplo")
    endpoint.wfile = io.BytesIO()
    captured = {}
    endpoint.send_response = lambda status: captured.update(status=status)
    endpoint.send_header = lambda *_: None
    endpoint.end_headers = lambda: None
    with patch.object(module, "urlopen", return_value=FakeResult()):
        endpoint.do_POST()
    assert captured["status"] == 200
    assert json.loads(endpoint.wfile.getvalue())["stored"] is False
    assert "Explicar un ejemplo" in endpoint.wfile.getvalue().decode("utf-8")


def test_vercel_authentication_required():
    endpoint = object.__new__(module.handler)
    endpoint.path = "/api/conauti/files/inspect?filename=actividad.txt"
    endpoint.headers = {"Content-Length": "4"}
    endpoint.rfile = io.BytesIO(b"hola")
    endpoint.wfile = io.BytesIO()
    captured = {}
    endpoint.send_response = lambda status: captured.update(status=status)
    endpoint.send_header = lambda *_: None
    endpoint.end_headers = lambda: None
    endpoint.do_POST()
    assert captured["status"] == 401
