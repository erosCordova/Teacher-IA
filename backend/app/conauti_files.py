"""Lectura acotada de archivos académicos enviados voluntariamente.

El archivo solo se mantiene en memoria durante esta solicitud.
La respuesta contiene un extracto breve que el frontend puede añadir
a una consulta del tutor educativo; no se guardan archivos en disco.
"""
import io
import re
import zipfile
from pathlib import PurePath
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.conauti_auth import current_user

router = APIRouter(prefix="/api/conauti/files", tags=["Archivos educativos"])

MAX_FILE_BYTES = 8_000_000
MAX_EXCERPT_CHARS = 2900
MAX_UNCOMPRESSED_BYTES = 30_000_000


def _read_zip_member(archive: zipfile.ZipFile, name: str) -> bytes:
    try:
        info = archive.getinfo(name)
    except KeyError:
        return b""
    if info.file_size > 2_000_000:
        raise ValueError("El documento tiene una sección demasiado grande.")
    return archive.read(info)


def _office_text(name: str, data: bytes) -> str:
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise ValueError("El archivo Office no tiene una estructura válida.")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members = archive.infolist()
        if len(members) > 1500 or sum(item.file_size for item in members) > MAX_UNCOMPRESSED_BYTES:
            raise ValueError("El documento contiene demasiados datos comprimidos.")
        names = [entry.filename for entry in members]
        extension = PurePath(name.lower()).suffix
        if extension == ".docx":
            selected = ["word/document.xml"]
        elif extension == ".pptx":
            selected = sorted(
                (item for item in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", item)),
                key=lambda value: int(re.search(r"slide(\d+)", value).group(1)),
            )[:20]
        elif extension == ".xlsx":
            selected = ["xl/sharedStrings.xml"]
            selected += sorted(
                item for item in names if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", item)
            )[:8]
        elif extension in (".odt", ".ods", ".odp"):
            selected = ["content.xml"]
        else:
            return ""
        output = []
        strings = []
        for member in selected:
            payload = _read_zip_member(archive, member)
            if not payload:
                continue
            try:
                root = ET.fromstring(payload)
            except ET.ParseError as exc:
                raise ValueError("No se pudo leer el contenido del documento.") from exc
            if member.endswith("sharedStrings.xml"):
                strings = [
                    "".join(node.text or "" for node in item.iter() if node.tag.endswith("}t"))
                    for item in root.iter()
                    if item.tag.endswith("}si")
                ][:10000]
                continue
            if extension == ".xlsx":
                for row in root.iter():
                    if not row.tag.endswith("}row"):
                        continue
                    cells = []
                    for cell in row:
                        if not cell.tag.endswith("}c"):
                            continue
                        value = next((node.text or "" for node in cell if node.tag.endswith("}v")), "")
                        if cell.attrib.get("t") == "s" and value.isdigit():
                            index = int(value)
                            value = strings[index] if index < len(strings) else ""
                        if cell.attrib.get("t") == "inlineStr":
                            value = "".join(node.text or "" for node in cell.iter() if node.tag.endswith("}t"))
                        if value:
                            cells.append(value)
                    if cells:
                        output.append(" | ".join(cells))
                    if sum(map(len, output)) > MAX_EXCERPT_CHARS:
                        break
            else:
                elements = [node.text.strip() for node in root.iter()
                            if node.text and node.text.strip() and (
                                node.tag.endswith("}t") or node.tag.endswith("}p")
                                or node.tag.endswith("}h")
                            )]
                output.extend(elements)
            if sum(map(len, output)) > MAX_EXCERPT_CHARS:
                break
        return "\n".join(output)[:MAX_EXCERPT_CHARS]


def extract_document_text(filename: str, data: bytes) -> str:
    """Extrae texto sin ejecutar macros, código ni abrir archivos fuera del ZIP."""
    suffix = PurePath(filename.lower()).suffix
    if suffix == ".pdf":
        if not data.startswith(b"%PDF-"):
            raise ValueError("El PDF no es válido.")
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            raise ValueError("No se pueden leer PDF protegidos con contraseña.")
        parts = []
        for page in reader.pages[:20]:
            parts.append(page.extract_text() or "")
            if sum(map(len, parts)) >= MAX_EXCERPT_CHARS:
                break
        return "\n".join(parts)[:MAX_EXCERPT_CHARS].strip()
    if suffix in (".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp"):
        return _office_text(filename, data).strip()
    if suffix == ".rtf":
        decoded = data.decode("latin-1", errors="replace")
        decoded = re.sub(r"\\'[0-9a-fA-F]{2}", " ", decoded)
        decoded = re.sub(r"\\[a-zA-Z]+-?\d* ?", " ", decoded)
        return re.sub(r"[{}]", "", decoded)[:MAX_EXCERPT_CHARS].strip()
    if b"\x00" in data[:8192]:
        return ""
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return ""
    sample = text[:8192]
    controls = sum(ord(c) < 32 and c not in "\n\r\t" for c in sample)
    if controls > max(3, len(sample) // 100):
        return ""
    return text[:MAX_EXCERPT_CHARS].strip()


@router.post("/inspect")
async def inspect_file(
    request: Request,
    filename: str = Query(..., min_length=1, max_length=150),
    user=Depends(current_user),
):
    # Se exige autenticación antes de consumir el cuerpo.
    del user
    clean_name = filename.replace("\\", "/").split("/")[-1].strip()
    if not clean_name or clean_name in (".", ".."):
        raise HTTPException(400, "Nombre de archivo no válido.")

    payload = bytearray()
    async for chunk in request.stream():
        if len(payload) + len(chunk) > MAX_FILE_BYTES:
            raise HTTPException(413, "El archivo supera el límite de 8 MB.")
        payload.extend(chunk)
    if not payload:
        raise HTTPException(400, "El archivo está vacío.")

    try:
        excerpt = extract_document_text(clean_name, bytes(payload))
    except (ValueError, RuntimeError, OSError, zipfile.BadZipFile) as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(422, "No se pudo interpretar este documento.") from exc

    if not excerpt:
        raise HTTPException(
            422,
            "El archivo se recibió, pero no contiene texto legible para el tutor. "
            "Puedes seleccionar cualquier formato; el análisis de archivos binarios "
            "requiere un lector compatible. Para fotos usa «Subir imagen». "
            "Un PDF escaneado puede necesitar reconocimiento visual.",
        )

    return {
        "filename": clean_name,
        "excerpt": excerpt,
        "truncated": len(excerpt) >= MAX_EXCERPT_CHARS,
        "stored": False,
    }
