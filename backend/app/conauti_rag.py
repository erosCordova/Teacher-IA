"""Biblioteca RAG por estudiante: extracción, fragmentación y recuperación híbrida.

Los archivos no se guardan. La indexación persistente requiere una acción
explícita en /documents. PostgreSQL guarda solo fragmentos de texto.
Embeddings Gemini opcionales: activar RAG_EMBEDDINGS_ENABLED=true, por cuota.
"""
from __future__ import annotations

import hashlib
import io
import math
import os
import re
import threading
import unicodedata
from collections import Counter
from pathlib import PurePath
from uuid import UUID

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pypdf import PdfReader

from app.conauti_auth import current_user, database_url
from app.conauti_files import extract_document_text

router = APIRouter(prefix="/api/conauti/rag", tags=["Biblioteca académica"])
MAX_BYTES = 6_000_000
MAX_TEXT = 48_000
MAX_CHUNKS = 48
MAX_DOCUMENTS = 12
CHUNK_SIZE = 950
CHUNK_OVERLAP = 130
_EMBED_MODEL = "gemini-embedding-001"
_schema_ready = False
_schema_lock = threading.Lock()
_SUPPORTED = {".pdf", ".txt", ".md", ".csv", ".docx", ".pptx", ".xlsx", ".odt", ".ods", ".odp"}
_STOP = frozenset("de del la el las los un una que para con por como sobre donde cual cuáles que como cuales and the of en es al o y a se me mi tu su este esta estos estas".split())

_SCHEMA = """
CREATE TABLE IF NOT EXISTS public.conauti_rag_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.conauti_users(id) ON DELETE CASCADE,
 filename varchar(150) NOT NULL,
 checksum char(64) NOT NULL,
 pages integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, checksum)
);
CREATE INDEX IF NOT EXISTS idx_conauti_rag_documents_owner
 ON public.conauti_rag_documents(user_id);
CREATE TABLE IF NOT EXISTS public.conauti_rag_chunks (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 document_id uuid NOT NULL REFERENCES public.conauti_rag_documents(id) ON DELETE CASCADE,
 ordinal integer NOT NULL,
 page_number integer NOT NULL DEFAULT 1,
 body text NOT NULL,
 embedding double precision[],
 embedding_model varchar(70),
 UNIQUE (document_id, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_conauti_rag_chunks_document
 ON public.conauti_rag_chunks(document_id);
"""


def ensure_schema(conn) -> None:
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if _schema_ready:
            return
        try:
            conn.execute(_SCHEMA)
            conn.commit()
        except psycopg.Error as exc:
            conn.rollback()
            raise HTTPException(503, "La biblioteca de estudio todavía no está disponible.") from exc
        _schema_ready = True


def validate_filename(name: str) -> str:
    clean = name.replace("\\", "/").split("/")[-1].strip()
    if not clean or clean in (".", "..") or PurePath(clean.lower()).suffix not in _SUPPORTED:
        raise ValueError("Selecciona un documento PDF, Word, presentación, hoja de cálculo o texto.")
    return clean[:150]


async def read_file(request: Request) -> bytes:
    buffer = bytearray()
    async for part in request.stream():
        if len(buffer) + len(part) > MAX_BYTES:
            raise HTTPException(413, "El archivo supera el límite de 6 MB.")
        buffer.extend(part)
    if not buffer:
        raise HTTPException(422, "El documento está vacío.")
    return bytes(buffer)


def document_pages(filename: str, raw: bytes) -> list[tuple[int, str]]:
    """Lee solo texto visible y limita el tamaño; no ejecuta contenido del archivo."""
    if filename.lower().endswith(".pdf"):
        if not raw.startswith(b"%PDF-"):
            raise ValueError("El PDF no es válido.")
        pdf = PdfReader(io.BytesIO(raw), strict=False)
        if pdf.is_encrypted:
            raise ValueError("El PDF está protegido con contraseña.")
        pages = []
        remaining = MAX_TEXT
        for number, page in enumerate(pdf.pages[:40], start=1):
            text = re.sub(r"\s+", " ", (page.extract_text() or "")).strip()
            if text:
                pages.append((number, text[:remaining]))
                remaining -= len(text)
            if remaining <= 0:
                break
        return pages
    text = extract_document_text(filename, raw)
    return [(1, re.sub(r"\s+", " ", text).strip()[:MAX_TEXT])] if text.strip() else []


def split_chunks(pages: list[tuple[int, str]]) -> list[dict]:
    """Partición con solapamiento; mantiene el número de página."""
    chunks: list[dict] = []
    for page, text in pages:
        text = re.sub(r"\s+", " ", text).strip()
        start = 0
        while start < len(text) and len(chunks) < MAX_CHUNKS:
            end = min(len(text), start + CHUNK_SIZE)
            if end < len(text):
                split = text.rfind(" ", start + int(CHUNK_SIZE * .64), end)
                if split > start:
                    end = split
            body = text[start:end].strip()
            if body:
                chunks.append({"page": page, "ordinal": len(chunks), "text": body})
            if end >= len(text):
                break
            start = max(start + 1, end - CHUNK_OVERLAP)
        if len(chunks) == MAX_CHUNKS:
            break
    return chunks


def tokens(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    normalized = "".join(c for c in normalized if not unicodedata.combining(c))
    return [word for word in re.findall(r"[a-z0-9]{3,}", normalized) if word not in _STOP]


def lexical_score(query: str, content: str) -> float:
    words = set(tokens(query))
    if not words:
        return 0.0
    counts = Counter(tokens(content))
    return sum(1 + math.log1p(counts[word]) for word in words if counts[word]) / len(words)


def cosine(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    norm = math.sqrt(sum(x*x for x in a)) * math.sqrt(sum(x*x for x in b))
    return max(-1., min(1., sum(x*y for x,y in zip(a,b)) / norm)) if norm else 0.


def search_chunks(question: str, chunks: list[dict], query_vector=None, limit: int = 4) -> list[dict]:
    """Corrective RAG: descarta fragmentos sin respaldo suficiente."""
    generic = bool(re.search(r"\b(resume|resumen|sintetiza|ideas principales)\b", question.casefold()))
    ranked = []
    for chunk in chunks:
        lexical = lexical_score(question, chunk["text"])
        semantic = (cosine(query_vector, chunk.get("embedding"))
                    if chunk.get("model") == _EMBED_MODEL else 0.)
        # No mezclar espacios de embeddings de versiones distintas.
        valid_semantic = semantic >= .36
        if lexical <= 0 and not valid_semantic and not generic:
            continue
        score = lexical + (1.8 * max(0., semantic) if valid_semantic else 0.)
        if generic and score <= 0:
            score = .1 / (1 + chunk["ordinal"])
        ranked.append((score, chunk))
    ranked.sort(key=lambda row: (-row[0], row[1]["ordinal"]))
    return [{**chunk, "score": round(score, 3)} for score, chunk in ranked[:limit]]


def _embedding(text: str, mode: str) -> list[float] | None:
    """Opt-in: evita consumir cuota si no se habilitan embeddings."""
    if os.getenv("RAG_EMBEDDINGS_ENABLED", "false").lower() != "true":
        return None
    from app.conauti_ai import config
    api_key = config("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        result = httpx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            + _EMBED_MODEL + ":embedContent",
            headers={"x-goog-api-key": api_key},
            json={
                "model": "models/" + _EMBED_MODEL,
                "taskType": "RETRIEVAL_DOCUMENT" if mode == "document" else "RETRIEVAL_QUERY",
                "content": {"parts": [{"text": text[:3500]}]},
                "outputDimensionality": 768,
            },
            timeout=9.0,
        )
        result.raise_for_status()
        values = result.json().get("embedding", {}).get("values", [])
        if len(values) == 768 and all(isinstance(x, (int,float)) and math.isfinite(x) for x in values):
            return [float(x) for x in values]
    except (httpx.HTTPError, ValueError, KeyError):
        pass
    return None


def make_excerpt(rows: list[dict], filename: str, limit: int = 3150) -> str:
    if not rows:
        return ""
    parts = []
    for row in rows:
        page = int(row.get("page", 1))
        parts.append(f"[Fuente: {filename}; página {page}]\n{row['text']}")
    return "\n\n".join(parts)[:limit]


@router.post("/inspect")
async def inspect_with_retrieval(
    request: Request,
    filename: str = Query(..., min_length=1, max_length=150),
    question: str = Query("", max_length=240),
    user=Depends(current_user),
):
    """RAG temporal: analiza el archivo actual y no lo almacena."""
    del user
    try:
        name = validate_filename(filename)
        pages = document_pages(name, await read_file(request))
        chunks = split_chunks(pages)
    except (ValueError, OSError) as exc:
        raise HTTPException(422, str(exc)) from exc
    if not chunks:
        raise HTTPException(422, "No se encontró texto legible en el documento.")
    selected = search_chunks(question or "resumen", chunks, limit=4)
    return {
        "filename": name, "excerpt": make_excerpt(selected, name),
        "stored": False, "pages_total": max(page for page, _ in pages),
        "pages_selected": sorted({c["page"] for c in selected}),
        "scope": "fragmentos relacionados con la pregunta",
        "retrieval": "búsqueda por fragmentos con verificación de relevancia",
    }


@router.post("/documents", status_code=201)
async def save_document(
    request: Request,
    filename: str = Query(..., min_length=1, max_length=150),
    user=Depends(current_user),
):
    """La biblioteca solo guarda texto si el estudiante solicita guardarlo."""
    try:
        name = validate_filename(filename)
        raw = await read_file(request)
        pages = document_pages(name, raw)
        chunks = split_chunks(pages)
    except (ValueError, OSError) as exc:
        raise HTTPException(422, str(exc)) from exc
    if not chunks:
        raise HTTPException(422, "El documento no contiene texto legible.")
    checksum = hashlib.sha256(raw).hexdigest()
    uid = user["id"]
    with psycopg.connect(database_url(), connect_timeout=10) as conn:
        ensure_schema(conn)
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM public.conauti_rag_documents WHERE user_id=%s AND checksum=%s",
                (uid, checksum),
            )
            existing = cursor.fetchone()
            if existing:
                return {"id": str(existing[0]), "filename": name, "duplicate": True,
                        "chunks": len(chunks), "stored": True}
            cursor.execute("SELECT count(*) FROM public.conauti_rag_documents WHERE user_id=%s", (uid,))
            if cursor.fetchone()[0] >= MAX_DOCUMENTS:
                raise HTTPException(409, "La biblioteca alcanzó el máximo de 12 documentos. Puedes eliminar alguno.")
            cursor.execute(
                "INSERT INTO public.conauti_rag_documents(user_id,filename,checksum,pages) "
                "VALUES (%s,%s,%s,%s) RETURNING id",
                (uid, name, checksum, max(p for p,_ in pages)),
            )
            doc_id = cursor.fetchone()[0]
            embedded = 0
            for chunk in chunks:
                # Límite preventivo de coste: máximo 12 embeddings por documento.
                vector = _embedding(chunk["text"], "document") if embedded < 12 else None
                if vector:
                    embedded += 1
                cursor.execute(
                    "INSERT INTO public.conauti_rag_chunks"
                    "(document_id,ordinal,page_number,body,embedding,embedding_model)"
                    " VALUES (%s,%s,%s,%s,%s,%s)",
                    (doc_id, chunk["ordinal"], chunk["page"], chunk["text"],
                     vector, _EMBED_MODEL if vector else None),
                )
    return {"id": str(doc_id), "filename": name, "duplicate": False,
            "chunks": len(chunks), "embedded": embedded, "stored": True}


@router.get("/documents")
def documents(user=Depends(current_user)):
    with psycopg.connect(database_url(), connect_timeout=10) as conn:
        ensure_schema(conn)
        rows = conn.execute(
            "SELECT id,filename,pages,created_at FROM public.conauti_rag_documents "
            "WHERE user_id=%s ORDER BY created_at DESC", (user["id"],),
        ).fetchall()
    return {"documents": [
        {"id": str(r[0]), "filename":r[1], "pages":r[2], "created_at":r[3].isoformat()}
        for r in rows
    ]}


@router.delete("/documents/{document_id}")
def delete_document(document_id: UUID, user=Depends(current_user)):
    with psycopg.connect(database_url(), connect_timeout=10) as conn:
        ensure_schema(conn)
        deleted = conn.execute(
            "DELETE FROM public.conauti_rag_documents WHERE id=%s AND user_id=%s",
            (document_id, user["id"]),
        ).rowcount
    if not deleted:
        raise HTTPException(404, "Documento no encontrado.")
    return {"deleted": True}


@router.get("/search")
def search_library(
    question: str = Query(..., min_length=3, max_length=400),
    user=Depends(current_user),
):
    with psycopg.connect(database_url(), connect_timeout=10) as conn:
        ensure_schema(conn)
        rows = conn.execute(
            "SELECT d.filename,c.page_number,c.ordinal,c.body,c.embedding,c.embedding_model "
            "FROM public.conauti_rag_documents d "
            "JOIN public.conauti_rag_chunks c ON c.document_id=d.id "
            "WHERE d.user_id=%s ORDER BY d.created_at DESC,c.ordinal "
            "LIMIT %s", (user["id"], MAX_DOCUMENTS * MAX_CHUNKS),
        ).fetchall()
    query_vector = _embedding(question, "query") if any(r[4] for r in rows) else None
    chunks = [{"filename":r[0],"page":r[1],"ordinal":r[2], "text":r[3],
               "embedding":r[4],"model":r[5]} for r in rows]
    found = search_chunks(question, chunks, query_vector=query_vector, limit=4)
    return {"found": bool(found), "results": [
        {"filename":r["filename"],"page":r["page"],"text":r["text"],"score":r["score"]}
        for r in found
    ], "note": ("Consulta únicamente los fragmentos recuperados; si no hay resultados, "
               "no afirmes que el documento respalda la respuesta.")}
