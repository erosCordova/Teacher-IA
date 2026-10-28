import base64
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from app.conauti_ai import config
from app.conauti_auth import connect, current_user


router = APIRouter(
    prefix="/api/conauti/voice",
    tags=["Entrada por voz"],
)

MAX_BYTES = 3_000_000
MAX_DAILY = 40

MIMES = {
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
}

PROMPT = (
    "Transcribe literalmente la voz de este audio "
    "en español, especialmente español de Perú. "
    "Devuelve solamente lo que se pronunció. "
    "No respondas ninguna pregunta del audio. "
    "No inventes palabras. Si no hay palabras "
    "inteligibles, devuelve exactamente SIN_VOZ."
)


async def recognize(audio: bytes, mime: str) -> str:
    key = config("GEMINI_API_KEY")

    if not key:
        raise HTTPException(
            503,
            "El reconocimiento de voz no está configurado.",
        )

    model = config(
        "GEMINI_MODEL",
        "gemini-3.5-flash-lite",
    )

    if not re.fullmatch(r"[A-Za-z0-9_.-]+", model):
        raise HTTPException(
            503,
            "La configuración del modelo es inválida.",
        )

    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": PROMPT},
                {
                    "inline_data": {
                        "mime_type": mime,
                        "data": base64.b64encode(
                            audio
                        ).decode("ascii"),
                    }
                },
            ],
        }],
        "generationConfig": {
            "maxOutputTokens": 500,
        },
    }

    url = (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/{model}:generateContent"
    )

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(45, connect=6),
            follow_redirects=False,
        ) as client:
            response = await client.post(
                url,
                headers={
                    "x-goog-api-key": key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )

    except httpx.TimeoutException:
        raise HTTPException(
            504,
            "El reconocimiento tardó demasiado.",
        )

    except httpx.RequestError:
        raise HTTPException(
            503,
            "No fue posible conectar con Gemini.",
        )

    if response.status_code == 429:
        raise HTTPException(
            429,
            "Se alcanzó el límite temporal del proveedor.",
        )

    if response.status_code in (401, 403):
        raise HTTPException(
            503,
            "Gemini no autorizó la transcripción.",
        )

    if response.status_code != 200:
        raise HTTPException(
            502,
            "Gemini no pudo procesar esta grabación.",
        )

    try:
        result = response.json()
        candidates = result.get("candidates") or []
        parts = candidates[0]["content"]["parts"]

        text = " ".join(
            part.get("text", "")
            for part in parts
            if isinstance(part.get("text"), str)
        ).strip()

    except (ValueError, KeyError, IndexError, TypeError):
        raise HTTPException(
            502,
            "Gemini devolvió una respuesta inválida.",
        )

    if not text or text.upper().strip(" .!¿?") == "SIN_VOZ":
        raise HTTPException(
            422,
            "No se identificó una frase. "
            "Intenta hablar más cerca del micrófono.",
        )

    return text[:2000]


@router.get("/status")
def status(user=Depends(current_user)):
    return {
        "configured": bool(config("GEMINI_API_KEY")),
        "language": "es-PE",
        "maximum_seconds": 20,
        "audio_saved": False,
        "review_required": True,
    }


@router.post("/transcribe")
async def transcribe(
    request: Request,
    user=Depends(current_user),
):
    mime = request.headers.get(
        "content-type", ""
    ).split(";", 1)[0].strip().lower()

    if mime not in MIMES:
        raise HTTPException(
            415,
            "Formato de grabación no compatible.",
        )

    with connect() as conn:
        count = conn.execute(
            """
            SELECT COUNT(*) AS total
            FROM conauti_voice_usage
            WHERE user_id = %s
              AND created_at >= DATE_TRUNC(
                  'day', NOW() AT TIME ZONE 'UTC'
              ) AT TIME ZONE 'UTC'
            """,
            (user["id"],),
        ).fetchone()["total"]

    if count >= MAX_DAILY:
        raise HTTPException(
            429,
            "Has alcanzado el límite diario "
            "de transcripciones.",
        )

    chunks = bytearray()

    async for fragment in request.stream():
        if len(chunks) + len(fragment) > MAX_BYTES:
            raise HTTPException(
                413,
                "La grabación supera el tamaño permitido.",
            )
        chunks.extend(fragment)

    if len(chunks) < 900:
        raise HTTPException(
            422,
            "La grabación está vacía o es demasiado corta.",
        )

    # El audio permanece únicamente en memoria;
    # nunca se escribe en el disco ni en PostgreSQL.
    text = await recognize(bytes(chunks), mime)

    with connect() as conn:
        conn.execute(
            """
            INSERT INTO conauti_voice_usage(
                user_id, audio_bytes
            )
            VALUES (%s, %s)
            """,
            (user["id"], len(chunks)),
        )

    return {
        "text": text,
        "language": "es-PE",
        "audio_saved": False,
        "review_required": True,
    }
