"""Pruebas de lectura de adjuntos sin servicios externos ni base de datos."""
import io
import zipfile

from fastapi.testclient import TestClient

from app.conauti_files import extract_document_text, current_user
from app.main import app


def test_texto_generico_y_codigo():
    assert "fracciones" in extract_document_text("nota.txt", b"Practiquemos fracciones")
    assert "clave" in extract_document_text("datos.json", b'{"clave": "valor"}')
    assert "def suma" in extract_document_text("codigo.py", b"def suma(a,b): return a+b")


def test_binario_no_interpretable():
    assert extract_document_text("programa.exe", b"\x00\x01\x02") == ""


def test_documento_docx():
    document = (
        b'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        b'<w:body><w:p><w:r><w:t>Leccion de ciencias</w:t></w:r></w:p></w:body></w:document>'
    )
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("word/document.xml", document)
    assert "Leccion de ciencias" in extract_document_text("clase.docx", stream.getvalue())


def test_hoja_de_calculo_xlsx():
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as archive:
        archive.writestr("xl/sharedStrings.xml", (
            '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<si><t>Nota</t></si></sst>'
        ))
        archive.writestr("xl/worksheets/sheet1.xml", (
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<sheetData><row><c t="s"><v>0</v></c><c><v>19</v></c>'
            '</row></sheetData></worksheet>'
        ))
    result = extract_document_text("notas.xlsx", data.getvalue())
    assert "Nota" in result and "19" in result


def test_ruta_autenticada_y_archivo_en_memoria():
    app.dependency_overrides[current_user] = lambda: {"id": "usuario-de-prueba"}
    try:
        with TestClient(app) as client:
            result = client.post(
                "/api/conauti/files/inspect?filename=notas.txt",
                content=b"Aprender matematica mediante ejemplos.",
                headers={"Content-Type": "application/octet-stream"},
            )
            assert result.status_code == 200, result.text
            assert result.json()["stored"] is False
            assert "matematica" in result.json()["excerpt"]
            rejected = client.post(
                "/api/conauti/files/inspect?filename=programa.exe",
                content=b"\x00\x01\x02",
            )
            assert rejected.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_limite_tamano():
    app.dependency_overrides[current_user] = lambda: {"id": "usuario-de-prueba"}
    try:
        with TestClient(app) as client:
            result = client.post(
                "/api/conauti/files/inspect?filename=grande.txt",
                content=b"a" * 8_000_001,
            )
            assert result.status_code == 413
    finally:
        app.dependency_overrides.clear()
