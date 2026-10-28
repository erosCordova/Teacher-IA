"""Sintesis neuronal local de CONAUTI.

Gemini produce el texto.
Kokoro genera un MP3 con la voz elegida.
"""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/api/conauti/kokoro",
    tags=["CONAUTI - Voz neuronal local"],
)

BASE_URL = os.getenv("CONAUTI_KOKORO_URL", "http://127.0.0.1:8880").rstrip("/")

VOICES = {
    "ef_dora": {
        "id": "ef_dora",
        "name": "Dora",
        "language": "es",
        "gender": "female",
    },
    "em_alex": {
        "id": "em_alex",
        "name": "Alex",
        "language": "es",
        "gender": "male",
    },
    "em_santa": {
        "id": "em_santa",
        "name": "Santa",
        "language": "es",
        "gender": "male",
    },
}


class SpeechInput(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    voice: str = "ef_dora"
    speed: float = Field(default=1.0, ge=0.75, le=1.25)


@router.get("/voices")
def available_voices():
    return {
        "provider": "kokoro",
        "price": "local_free",
        "voices": list(VOICES.values()),
    }


@router.get("/status")
def status():
    try:
        req = Request(
            BASE_URL + "/health",
            headers={"Accept": "application/json"},
        )
        with urlopen(req, timeout=4) as response:
            return {
                "engine": "kokoro",
                "available": response.status == 200,
                "cloud_key_required": False,
            }
    except (HTTPError, URLError, TimeoutError, OSError):
        return {
            "engine": "kokoro",
            "available": False,
            "cloud_key_required": False,
        }


@router.post("/speech")
def generate_speech(payload: SpeechInput):
    if payload.voice not in VOICES:
        raise HTTPException(
            status_code=422,
            detail="Voz no admitida.",
        )

    text = payload.text.strip()

    if not text:
        raise HTTPException(
            status_code=422,
            detail="No se recibió texto.",
        )

    body = json.dumps(
        {
            "model": "kokoro",
            "input": text,
            "voice": payload.voice,
            "speed": payload.speed,
            "response_format": "mp3",
        },
        ensure_ascii=False,
    ).encode("utf-8")

    request = Request(
        BASE_URL + "/v1/audio/speech",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=120) as response:
            audio = response.read(8_000_001)

            if len(audio) > 8_000_000:
                raise HTTPException(
                    status_code=502,
                    detail="Audio demasiado grande.",
                )

            if not audio:
                raise HTTPException(
                    status_code=502,
                    detail="Kokoro no devolvió audio.",
                )

            return Response(
                content=audio,
                media_type="audio/mpeg",
                headers={
                    "Cache-Control": "no-store",
                    "X-TTS-Engine": "kokoro",
                },
            )

    except HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Error de Kokoro: HTTP {exc.code}.",
        ) from exc

    except (URLError, TimeoutError, OSError) as exc:
        raise HTTPException(
            status_code=503,
            detail="El motor de voz local no está disponible.",
        ) from exc
