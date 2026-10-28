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



# El contenido seleccionado es solo contexto para Gemini, no texto visible del chat.
# Los PDF se inspeccionan por páginas, evitando depender de la portada.
_STOP_WORDS = {
    "analiza", "analizame", "analízame", "este", "esta", "documento",
    "archivo", "explica", "explícame", "quiero", "necesito", "sobre",
    "cual", "cuáles", "para", "como", "cómo", "puedes", "dame", "desde",
    "qué", "que", "una", "uno", "los", "las", "del", "por", "con", "sus",
    "todo", "todos", "resumen", "general", "favor",
}

def _keywords(question: str) -> list[str]:
    words = re.findall(r"[a-záéíóúñü0-9]{3,}", question.lower())
    return list(dict.fromkeys(word for word in words if word not in _STOP_WORDS))[:12]


def _select_pages(pages: list[tuple[int, str]], question: str, budget: int = 2950) -> str:
    """Escoge páginas distribuidas o relevantes para la pregunta."""
    if not pages:
        return ""
    terms = _keywords(question)
    # Preguntas generales: una muestra distribuida de todo el documento.
    if not terms:
        count = min(len(pages), 8)
        indexes = (
            sorted(set(round(i * (len(pages) - 1) / (count - 1)) for i in range(count)))
            if count > 1 else [0]
        )
    else:
        ranked = sorted(
            range(len(pages)),
            key=lambda index: (
                sum(min(pages[index][1].lower().count(term), 5) for term in terms),
                -(index),
            ),
            reverse=True,
        )
        indexes = sorted(set([0] + ranked[:7]))
    selected = []
    remaining = budget
    for pos in indexes:
        page_num, text = pages[pos]
        header = f"[Página {page_num}]\n"
        # Reparte los caracteres entre las páginas seleccionadas.
        per_page = max(200, (remaining - len(header)) // max(1, len(indexes) - len(selected)))
        fragment = " ".join(text.split())[:per_page]
        if not fragment:
            continue
        chunk = header + fragment
        if len(chunk) > remaining:
            break
        selected.append(chunk)
        remaining -= len(chunk) + 2
        if remaining <= 100:
            break
    return "\n\n".join(selected)


def extract_document_context(filename: str, data: bytes, question: str = "") -> dict:
    """Prepara una muestra contextual con metadatos de cobertura reales."""
    suffix = PurePath(filename.lower()).suffix
    if suffix != ".pdf":
        excerpt = extract_document_text(filename, data)
        return {
            "excerpt": excerpt,
            "pages_total": None,
            "pages_selected": None,
            "scope": "extracto inicial",
            "truncated": len(excerpt) >= MAX_EXCERPT_CHARS,
        }

    if not data.startswith(b"%PDF-"):
        raise ValueError("El PDF no es válido.")
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data), strict=False)
    if reader.is_encrypted:
        raise ValueError("No se pueden leer PDF protegidos con contraseña.")
    total = len(reader.pages)
    # Acotación de trabajo: documentos extensos no pueden tratarse íntegramente
    # como contexto de un único mensaje de 4000 caracteres.
    maximum_pages = 160
    scan_indexes = (
        list(range(total)) if total <= maximum_pages
        else sorted(set(round(i * (total - 1) / (maximum_pages - 1))
                        for i in range(maximum_pages)))
    )
    pages = []
    for index in scan_indexes:
        text = (reader.pages[index].extract_text() or "").strip()
        if text:
            pages.append((index + 1, text[:3500]))
    excerpt = _select_pages(pages, question)
    cited = [int(value) for value in re.findall(r"\[Página (\d+)\]", excerpt)]
    return {
        "excerpt": excerpt,
        "pages_total": total,
        "pages_selected": cited,
        "scope": "muestra representativa" if not _keywords(question) else "páginas relevantes para la pregunta",
        "truncated": len(cited) < total,
    }


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
        question = (query.get("question") or [""])[0][:240]
        try:
            result = extract_document_context(filename, content, question)
            excerpt = result["excerpt"]
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
            **result,
            "stored": False,
        })
