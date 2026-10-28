"""Catálogo gratuito de voces Kokoro para My Teacher IA.

El audio Kokoro se sintetiza en el navegador y su selección
coincide con la utilizada por el chat y la conversación por voz.
No se conecta a ElevenLabs ni solicita claves de otro proveedor.
"""

from fastapi import APIRouter, Query

from app.conauti_kokoro import VOICES

router = APIRouter(
    prefix="/api/conauti/voice-library",
    tags=["CONAUTI - Biblioteca de voces"],
)

_DESCRIPTIONS = {
    "ef_dora": "Voz femenina natural para aprender en español.",
    "em_alex": "Voz masculina para explicaciones y conversaciones.",
    "em_santa": "Voz masculina para acompañar las actividades.",
}


def _catalog():
    return [
        {
            "voice_id": voice_id,
            "public_owner_id": "kokoro",
            "name": voice["name"],
            "description": _DESCRIPTIONS.get(voice_id, ""),
            "language": voice["language"],
            "accent": "Español",
            "gender": voice["gender"],
            "category": "Kokoro",
            "preview_url": None,
        }
        for voice_id, voice in VOICES.items()
    ]


@router.get("/status")
def estado():
    return {
        "provider": "kokoro",
        "catalog_available": True,
        "api_key_configured": False,
        "tts_connected": False,
        "tts_engine": "browser",
        "selection_storage": "browser_and_account",
        "voices_count": len(VOICES),
    }


@router.get("/catalog")
def catalogo(
    search: str = Query(default="", max_length=80),
    language: str = Query(default="es", pattern="^(es|all)$"),
    page: int = Query(default=0, ge=0, le=100),
):
    term = search.casefold().strip()
    available = [
        item for item in _catalog()
        if (language == "all" or item["language"] == language)
        and (
            not term
            or any(
                term in str(item[field]).casefold()
                for field in ("name", "description", "accent", "category", "gender")
            )
        )
    ]
    page_size = 24
    offset = page * page_size
    return {
        "provider": "kokoro",
        "voices": available[offset:offset + page_size],
        "has_more": len(available) > offset + page_size,
        "page": page,
        "language": language,
    }
