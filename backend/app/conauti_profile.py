"""Nombre visible del estudiante, independiente de la identidad verificada.

Nunca modifica el correo de Google, Microsoft o la credencial técnica.
La configuración se almacena en PostgreSQL por UUID de usuario.
"""
import threading
import unicodedata

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.conauti_auth import connect, current_user


router = APIRouter(
    prefix="/api/conauti/profile",
    tags=["My Teacher IA - Perfil del estudiante"],
)
_schema_lock = threading.Lock()
_schema_ready = False


def ensure_profile_schema() -> None:
    """Inicialización idempotente: compatible con bases de datos ya desplegadas."""
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if _schema_ready:
            return
        with connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS conauti_user_profiles (
                    user_id UUID PRIMARY KEY
                        REFERENCES conauti_users(id) ON DELETE CASCADE,
                    display_name VARCHAR(60) NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        _schema_ready = True


class DisplayNameInput(BaseModel):
    display_name: str = Field(min_length=2, max_length=60)

    @field_validator("display_name")
    @classmethod
    def check_name(cls, value: str) -> str:
        if any(char in "\\n\\r\\t" or unicodedata.category(char) in ("Cc", "Cf") for char in value):
            raise ValueError("El nombre no puede incluir saltos de línea ni caracteres invisibles.")
        name = unicodedata.normalize("NFC", value).strip()
        name = " ".join(name.split())
        if not 2 <= len(name) <= 60:
            raise ValueError("El nombre debe tener entre 2 y 60 caracteres.")
        # Permite tildes, ñ, letras internacionales y nombres con guion o apóstrofo;
        # rechaza controles, HTML, enlaces e imitaciones con caracteres invisibles.
        valid_punctuation = " -.'’"
        if not any(unicodedata.category(char).startswith("L") for char in name):
            raise ValueError("El nombre debe incluir letras.")
        if any(
            not (
                unicodedata.category(char).startswith(("L", "M", "N"))
                or char in valid_punctuation
            )
            for char in name
        ):
            raise ValueError("Utiliza letras, espacios, números, puntos o guiones.")
        return name


@router.get("")
def my_profile(user=Depends(current_user)):
    ensure_profile_schema()
    with connect() as conn:
        row = conn.execute(
            "SELECT display_name FROM conauti_user_profiles WHERE user_id = %s",
            (user["id"],),
        ).fetchone()
    return {
        "display_name": row["display_name"] if row else None,
        "editable": True,
    }


@router.patch("")
def save_my_profile(body: DisplayNameInput, user=Depends(current_user)):
    ensure_profile_schema()
    with connect() as conn:
        row = conn.execute(
            """
            INSERT INTO conauti_user_profiles(user_id, display_name)
            VALUES (%s, %s)
            ON CONFLICT (user_id)
            DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()
            RETURNING display_name
            """,
            (user["id"], body.display_name),
        ).fetchone()
    return {
        "display_name": row["display_name"],
        "saved": True,
    }
