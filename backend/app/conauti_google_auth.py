"""Registro y acceso con identidad comprobada por Google.

No se acepta un email escrito libremente: el token de identidad debe haber
sido emitido por Google para este cliente OAuth y acreditar email_verified.
Las cuentas anteriores mantienen su acceso por contraseña.
"""
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from psycopg.errors import UniqueViolation

from app.conauti_auth import connect, hash_password
import hashlib

router = APIRouter(prefix="/api/conauti/auth/google", tags=["Acceso Google"])

# Esta migración es aditiva: no renombra ni elimina usuarios existentes.
# El índice único hace que dos solicitudes simultáneas no puedan duplicar correos.
SCHEMA = """
CREATE TABLE IF NOT EXISTS conauti_google_accounts (
    google_sub VARCHAR(255) PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    user_id UUID NOT NULL UNIQUE REFERENCES conauti_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_conauti_google_email_normalized CHECK (email = LOWER(email))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conauti_google_email_ci
ON conauti_google_accounts (LOWER(email));
"""


class GoogleIdentityInput(BaseModel):
    credential: str = Field(min_length=40, max_length=12000)
    mode: str = Field(pattern=r"^(register|login)$")


def client_id() -> str:
    return os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip()


def validate_google_identity(credential: str, audience: str) -> tuple[str, str]:
    """Verifica criptográficamente firma, emisor, audiencia y caducidad."""
    if not audience:
        raise HTTPException(503, "El registro con Google todavía no está configurado.")
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
        claims = id_token.verify_oauth2_token(
            credential, google_requests.Request(), audience
        )
    except Exception as exc:
        raise HTTPException(401, "La identidad de Google no pudo verificarse.") from exc

    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(401, "El proveedor de identidad no es válido.")
    if claims.get("email_verified") is not True:
        raise HTTPException(403, "Google no ha verificado este correo electrónico.")

    subject = claims.get("sub")
    email = claims.get("email")
    if not isinstance(subject, str) or not subject or len(subject) > 255:
        raise HTTPException(401, "La identidad de Google es inválida.")
    if not isinstance(email, str) or len(email) > 254:
        raise HTTPException(401, "Google no proporcionó un correo electrónico válido.")
    email = email.strip().lower()

    # Google solo es autoridad sobre la titularidad del buzón en Gmail
    # o en un dominio administrado por Google Workspace (claim hd).
    # Para correos de terceros se necesitaría un enlace de verificación propio.
    domain = email.rsplit("@", 1)[-1]
    hosted_domain = claims.get("hd")
    if domain != "gmail.com" and not (
        isinstance(hosted_domain, str) and hosted_domain.lower() == domain
    ):
        raise HTTPException(
            403,
            "Por seguridad, utiliza Gmail o un correo verificado de Google Workspace."
        )

    # Validación estructural adicional; no basta con tener sintaxis de email.
    if not re.fullmatch(r"[^\s@]{1,64}@[^\s@]+\.[a-z]{2,63}", email):
        raise HTTPException(401, "El correo verificado no tiene un formato válido.")
    return subject, email


def google_username(email: str) -> str:
    local = re.sub(r"[^a-z0-9_]", "_", email.split("@", 1)[0])[:19].strip("_")
    return (local or "alumno") + "_" + secrets.token_hex(4)


def create_session(conn, user_id) -> dict:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO conauti_sessions(token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
        (
            hashlib.sha256(token.encode()).hexdigest(),
            user_id,
            datetime.now(timezone.utc) + timedelta(days=7),
        ),
    )
    return {"access_token": token, "token_type": "bearer"}


@router.get("/config")
def google_config():
    identifier = client_id()
    return {"enabled": bool(identifier), "client_id": identifier if identifier else None}


@router.post("")
def google_authentication(data: GoogleIdentityInput):
    # Fail closed sin configuración: jamás se acepta un Gmail no verificado.
    subject, email = validate_google_identity(data.credential, client_id())

    try:
        with connect() as conn:
            # Migración incremental e idempotente, sin modificar cuentas anteriores.
            conn.execute(SCHEMA)
            match = conn.execute(
                "SELECT user_id, email FROM conauti_google_accounts WHERE google_sub = %s",
                (subject,),
            ).fetchone()

            if data.mode == "login":
                if not match or match["email"] != email:
                    raise HTTPException(401, "No existe una cuenta vinculada a este Google. Regístrate primero.")
                return create_session(conn, match["user_id"])

            if match:
                raise HTTPException(409, "Este correo ya está registrado. Utiliza «Ingresar con Google».")

            # Para evitar secuestro de cuentas no se permite asociar un correo
            # que esté vinculado a un Google subject diferente.
            existing_email = conn.execute(
                "SELECT user_id FROM conauti_google_accounts WHERE LOWER(email) = %s",
                (email,),
            ).fetchone()
            if existing_email:
                raise HTTPException(409, "Este correo ya está registrado.")

            # Los usuarios Google no tienen contraseña local utilizable.
            password_hash = hash_password(secrets.token_urlsafe(64))
            user = conn.execute(
                """
                INSERT INTO conauti_users(username, password_hash)
                VALUES (%s, %s)
                RETURNING id
                """,
                (google_username(email), password_hash),
            ).fetchone()
            conn.execute(
                "INSERT INTO conauti_google_accounts (google_sub, email, user_id) VALUES (%s, %s, %s)",
                (subject, email, user["id"]),
            )
            return create_session(conn, user["id"])
    except UniqueViolation as exc:
        raise HTTPException(409, "Este correo ya está registrado.") from exc
