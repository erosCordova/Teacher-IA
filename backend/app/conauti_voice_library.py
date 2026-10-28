"""Catálogo público de voces compartidas para CONAUTI.

No genera audio de pago y no expone las claves del proveedor.
"""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(
    prefix="/api/conauti/voice-library",
    tags=["CONAUTI - Biblioteca de voces"],
)

API = "https://api.elevenlabs.io/v1/shared-voices"


@router.get("/status")
def estado():
    return {
        "provider": "elevenlabs",
        "catalog_available": True,
        "api_key_configured": bool(
            os.getenv("ELEVENLABS_API_KEY", "").strip()
        ),
        "tts_connected": False,
        "selection_storage": "browser",
    }


@router.get("/catalog")
def catalogo(
    search: str = Query(default="", max_length=80),
    language: str = Query(default="es", pattern="^(es|all)$"),
    page: int = Query(default=0, ge=0, le=100),
):
    params = {
        "page_size": 24,
        "page": page,
        "sort": "trending",
    }

    term = search.strip()

    if term:
        params["search"] = term

    if language != "all":
        params["language"] = language

    url = API + "?" + urlencode(params)

    headers = {
        "Accept": "application/json",
        "User-Agent": "CONAUTI-VoiceLibrary/1.0",
    }

    key = os.getenv("ELEVENLABS_API_KEY", "").strip()

    if key:
        headers["xi-api-key"] = key

    request = Request(
        url,
        headers=headers,
        method="GET",
    )

    try:
        with urlopen(request, timeout=12) as response:
            raw = response.read(2_000_001)

            if len(raw) > 2_000_000:
                raise HTTPException(
                    status_code=502,
                    detail="La respuesta del proveedor es demasiado grande.",
                )

            payload = json.loads(raw)

    except HTTPError as exc:
        if exc.code in (401, 403):
            message = (
                "ElevenLabs rechazó el acceso al catálogo. "
                "Comprueba los permisos de la API."
            )
        elif exc.code == 429:
            message = (
                "El proveedor alcanzó su límite de solicitudes. "
                "Inténtalo más tarde."
            )
        else:
            message = (
                f"El proveedor devolvió un error HTTP {exc.code}."
            )

        raise HTTPException(
            status_code=502,
            detail=message,
        ) from exc

    except (URLError, TimeoutError, OSError) as exc:
        raise HTTPException(
            status_code=503,
            detail="No se pudo conectar con la biblioteca de voces.",
        ) from exc

    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="El proveedor devolvió una respuesta inválida.",
        ) from exc

    items = payload.get("voices", [])

    if not isinstance(items, list):
        raise HTTPException(
            status_code=502,
            detail="Formato del catálogo no reconocido.",
        )

    voices = []

    for item in items:
        if not isinstance(item, dict):
            continue

        voice_id = str(item.get("voice_id") or "")
        owner_id = str(item.get("public_owner_id") or "")

        if not voice_id or len(voice_id) > 128:
            continue

        preview = item.get("preview_url")

        if not isinstance(preview, str) or not preview.startswith(
            "https://"
        ):
            preview = None

        voices.append({
            "voice_id": voice_id,
            "public_owner_id": owner_id,
            "name": str(item.get("name") or "Voz sin nombre")[:120],
            "description": str(item.get("description") or "")[:250],
            "language": str(item.get("language") or ""),
            "accent": str(item.get("accent") or ""),
            "gender": str(item.get("gender") or ""),
            "category": str(item.get("category") or ""),
            "preview_url": preview,
        })

    return {
        "provider": "elevenlabs",
        "voices": voices,
        "has_more": bool(payload.get("has_more", False)),
        "page": page,
        "language": language,
    }
