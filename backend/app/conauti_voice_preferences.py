"""Preferencias de voz autenticadas de My Teacher IA."""

from collections.abc import Mapping
from typing import Any, Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.conauti_auth import current_user, database_url


router = APIRouter(
    prefix="/api/conauti/preferences",
    tags=["My Teacher IA - Preferencias de voz"],
)


class VoicePreferences(BaseModel):
    voice: Literal[
        "ef_dora",
        "em_alex",
        "em_santa",
    ] = "ef_dora"

    speed: float = Field(
        default=1.0,
        ge=0.75,
        le=1.25,
    )

    volume: float = Field(
        default=1.0,
        ge=0,
        le=1,
    )


def authenticated_user_id(user: Any) -> UUID:
    """Usar exclusivamente la identidad autenticada."""

    if isinstance(user, Mapping):
        candidate = user.get("id") or user.get("user_id")
    elif isinstance(user, UUID):
        candidate = user
    elif isinstance(user, str):
        candidate = user
    else:
        candidate = (
            getattr(user, "id", None)
            or getattr(user, "user_id", None)
        )

    try:
        return UUID(str(candidate))
    except (TypeError, ValueError, AttributeError):
        raise HTTPException(
            status_code=401,
            detail="No se pudo verificar la identidad.",
        )


@router.get("/voice", response_model=VoicePreferences)
def read_voice_preferences(
    user: Any = Depends(current_user),
):
    user_id = authenticated_user_id(user)

    try:
        with psycopg.connect(
            database_url(),
            connect_timeout=10,
        ) as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT voice_id, speed, volume
                    FROM public.conauti_voice_preferences
                    WHERE user_id = %s
                    """,
                    (user_id,),
                )

                row = cursor.fetchone()

    except psycopg.Error as exc:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron leer las preferencias.",
        ) from exc

    if row is None:
        return VoicePreferences()

    return VoicePreferences(
        voice=row[0],
        speed=float(row[1]),
        volume=float(row[2]),
    )


@router.put("/voice", response_model=VoicePreferences)
def save_voice_preferences(
    payload: VoicePreferences,
    user: Any = Depends(current_user),
):
    user_id = authenticated_user_id(user)

    try:
        with psycopg.connect(
            database_url(),
            connect_timeout=10,
        ) as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO public.conauti_voice_preferences
                        (user_id, voice_id, speed, volume)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id)
                    DO UPDATE SET
                        voice_id = EXCLUDED.voice_id,
                        speed = EXCLUDED.speed,
                        volume = EXCLUDED.volume,
                        updated_at = NOW()
                    """,
                    (
                        user_id,
                        payload.voice,
                        payload.speed,
                        payload.volume,
                    ),
                )

    except psycopg.Error as exc:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron guardar las preferencias.",
        ) from exc

    return payload
