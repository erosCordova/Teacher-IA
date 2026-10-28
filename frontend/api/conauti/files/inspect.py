"""Endpoint independiente para adjuntos del tutor en Vercel.

Se utiliza porque la API de Render puede no tener sincronizada
la ruta nueva. Autentica cada solicitud contra Render y procesa
el archivo exclusivamente en memoria, sin almacenar el original.
"""
import io
import json
import re
import zipfile
from pathlib import PurePath
from xml.etree import ElementTree as ET
from http.server import BaseHTTPRequestHandler
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request as URLRequest, urlopen

AUTH_VERIFY_URL = "https://my-teacher-ia-api.onrender.com/api/conauti/auth/me"

MAX_FILE_BYTES = 4_000_000
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



class handler(BaseHTTPRequestHandler):
    """Vercel Python Function: GET comprueba ruta; POST extrae archivo."""

    def _json(self, status: int, payload: dict):
        serialized = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(serialized)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(serialized)

    def do_GET(self):
        self._json(200, {
            "status": "ok",
            "message": "Servicio de lectura de documentos disponible.",
            "max_bytes": MAX_FILE_BYTES,
            "stored": False,
        })

    def do_POST(self):
        token = self.headers.get("Authorization", "")
        if not token.startswith("Bearer ") or len(token) > 4096:
            return self._json(401, {"detail": "Inicia sesión para enviar archivos."})
        # Se confirma que la sesión existe sin acceder a contraseñas ni JWT secretos.
        auth_request = URLRequest(
            AUTH_VERIFY_URL,
            headers={"Authorization": token, "Accept": "application/json"},
            method="GET",
        )
        try:
            with urlopen(auth_request, timeout=12) as auth_result:
                if auth_result.status != 200:
                    return self._json(401, {"detail": "Sesión no válida."})
        except HTTPError as error:
            if error.code in (401, 403):
                return self._json(401, {"detail": "Tu sesión expiró. Inicia sesión nuevamente."})
            return self._json(503, {"detail": "No se pudo verificar la sesión con el servidor."})
        except (URLError, TimeoutError, OSError):
            return self._json(503, {"detail": "El servidor de autenticación no está disponible."})

        query = parse_qs(urlsplit(self.path).query)
        original = (query.get("filename") or [""])[0]
        if not original or len(original) > 150:
            return self._json(400, {"detail": "Nombre de archivo no válido."})
        filename = original.replace("\\", "/").split("/")[-1].strip()
        if not filename or filename in (".", ".."):
            return self._json(400, {"detail": "Nombre de archivo no válido."})
        length_header = self.headers.get("Content-Length")
        try:
            length = int(length_header or "")
        except ValueError:
            return self._json(411, {"detail": "No se indicó el tamaño del archivo."})
        if length <= 0:
            return self._json(400, {"detail": "El archivo está vacío."})
        if length > MAX_FILE_BYTES:
            return self._json(413, {"detail": "El archivo supera el límite de 4 MB."})
        content = self.rfile.read(length)
        if len(content) != length:
            return self._json(400, {"detail": "No se recibió el archivo completo."})
        try:
            excerpt = extract_document_text(filename, content)
        except (ValueError, RuntimeError, OSError, zipfile.BadZipFile) as error:
            return self._json(422, {"detail": str(error)})
        except Exception:
            return self._json(422, {
                "detail": "No se pudo interpretar este documento."
            })
        if not excerpt:
            return self._json(422, {
                "detail": "El archivo se recibió, pero no contiene texto que pueda analizarse. "
                "Para una fotografía utiliza «Subir imagen». Si el PDF está escaneado, "
                "utiliza una imagen de la página."
            })
        return self._json(200, {
            "filename": filename,
            "excerpt": excerpt,
            "truncated": len(excerpt) >= MAX_EXCERPT_CHARS,
            "stored": False,
        })
