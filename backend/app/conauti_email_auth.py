"""Acceso sin contraseña por código enviado al buzón.

El email solo se considera verificado después de introducir un código recibido.
SMTP y el secreto HMAC son obligatorios: falla cerrado si no se configuraron.
"""
import hashlib
import hmac
import os
import re
import secrets
import httpx
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from psycopg.errors import UniqueViolation

from app.conauti_auth import connect, hash_password
from app.conauti_google_auth import SCHEMA as GOOGLE_SCHEMA, create_session, google_username

router = APIRouter(prefix="/api/conauti/auth/email", tags=["Acceso con correo"])

# Registro central: la unicidad abarca Google y el acceso con correo.
GLOBAL_SCHEMA = """
CREATE TABLE IF NOT EXISTS conauti_verified_email_identities (
    email VARCHAR(254) PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES conauti_users(id) ON DELETE CASCADE,
    provider VARCHAR(24) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_verified_provider CHECK (provider IN ('google','email','microsoft'))
);
CREATE TABLE IF NOT EXISTS conauti_email_challenges (
    email VARCHAR(254) PRIMARY KEY,
    mode VARCHAR(12) NOT NULL CHECK (mode IN ('register','login')),
    code_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    hourly_window TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hourly_count INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_email_challenge_expiry
    ON conauti_email_challenges(expires_at);
"""
# Base anterior: migración idempotente de correos Google ya autenticados.
GOOGLE_BACKFILL = """
INSERT INTO conauti_verified_email_identities(email, user_id, provider)
SELECT LOWER(email), user_id, 'google'
FROM conauti_google_accounts
ON CONFLICT (email) DO NOTHING
"""

class EmailStart(BaseModel):
    email: EmailStr
    mode: str = Field(pattern=r"^(register|login)$")

class EmailConfirm(EmailStart):
    code: str = Field(pattern=r"^[0-9]{8}$")


def smtp_ready() -> bool:
    # Render Free bloquea SMTP. Solo habilitar el transporte tras confirmar
    # que el entorno permite conectarse a 587 (por ejemplo, desarrollo local).
    return os.getenv("EMAIL_OTP_SMTP_ENABLED", "").lower() == "true" and all(
        os.getenv(key, "").strip() for key in (
            "SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM",
        )
    )


def mailjet_ready() -> bool:
    return all(os.getenv(key, "").strip() for key in (
        "MAILJET_API_KEY", "MAILJET_SECRET_KEY", "MAILJET_SENDER_EMAIL",
    ))


def delivery_ready() -> bool:
    return mailjet_ready() or smtp_ready()


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(422, "Correo electrónico inválido.")
    return email


def require_email_config() -> None:
    if not email_config()["enabled"]:
        raise HTTPException(503, "El acceso por correo aún no está configurado.")


def code_hash(email: str, mode: str, code: str) -> str:
    pepper = os.environ.get("EMAIL_OTP_PEPPER", "")
    if len(pepper) < 32:
        raise HTTPException(503, "El verificador de correo necesita configuración segura.")
    return hmac.new(
        pepper.encode(), f"{email}|{mode}|{code}".encode(), hashlib.sha256
    ).hexdigest()


def prepare_schema(conn) -> None:
    conn.execute(GOOGLE_SCHEMA)
    conn.execute(GLOBAL_SCHEMA)
    conn.execute(GOOGLE_BACKFILL)


def lock_email(conn, email: str) -> None:
    # Serializa todos los registros de un mismo correo, incluso con dos proveedores.
    conn.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (email,))


def identity_for(conn, email: str):
    return conn.execute(
        "SELECT user_id, provider FROM conauti_verified_email_identities WHERE email = %s",
        (email,),
    ).fetchone()


def send_code(email: str, code: str) -> None:
    if mailjet_ready():
        # API HTTPS: funciona en Render Free sin usar puertos SMTP bloqueados.
        data = {"Messages": [{
            "From": {
                "Email": os.environ["MAILJET_SENDER_EMAIL"],
                "Name": "My Teacher IA",
            },
            "To": [{"Email": email}],
            "Subject": "Tu código de acceso a My Teacher IA",
            "TextPart": (
                f"Tu código de My Teacher IA es: {code}\n\n"
                "Caduca en 10 minutos. Si no solicitaste este acceso, "
                "ignora el mensaje. Nunca compartas este código."
            ),
        }]}
        try:
            response = httpx.post(
                "https://api.mailjet.com/v3.1/send",
                auth=(os.environ["MAILJET_API_KEY"], os.environ["MAILJET_SECRET_KEY"]),
                json=data, timeout=12,
            )
            response.raise_for_status()
            result = response.json()
            if not isinstance(result, dict) or not result.get("Messages") or any(
                item.get("Status") != "success" for item in result["Messages"]
            ):
                raise ValueError("El proveedor no aceptó el correo.")
            return
        except (httpx.HTTPError, ValueError, TypeError, AttributeError) as exc:
            raise HTTPException(503, "No fue posible enviar el código. Inténtalo más tarde.") from exc

    if not smtp_ready():
        raise HTTPException(503, "El envío de correos no está configurado.")

    msg = EmailMessage()
    msg["Subject"] = "Tu código de acceso a My Teacher IA"
    msg["From"] = os.environ["SMTP_FROM"]
    msg["To"] = email
    msg.set_content(
        f"Tu código de My Teacher IA es: {code}\n\n"
        "Caduca en 10 minutos. Si no solicitaste este acceso, ignora el mensaje.\n"
        "Nunca compartas este código con otras personas.\n"
    )
    host = os.environ["SMTP_HOST"]
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
        if port < 1 or port > 65535:
            raise ValueError("bad port")
        with smtplib.SMTP(host, port, timeout=12) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
            smtp.send_message(msg)
    except (OSError, smtplib.SMTPException, ValueError) as exc:
        raise HTTPException(503, "No fue posible enviar el código. Inténtalo más tarde.") from exc


@router.get("/config")
def email_config():
    return {"enabled": delivery_ready() and len(os.getenv("EMAIL_OTP_PEPPER", "")) >= 32}


@router.post("/start")
def email_start(data: EmailStart):
    require_email_config()
    email = normalize_email(str(data.email))
    code = f"{secrets.randbelow(100_000_000):08d}"
    now = datetime.now(timezone.utc)

    with connect() as conn:
        prepare_schema(conn)
        lock_email(conn, email)
        known = identity_for(conn, email)
        if data.mode == "register" and known:
            raise HTTPException(409, "Este correo ya está registrado. Inicia sesión.")
        if data.mode == "login" and not known:
            raise HTTPException(401, "No existe esa cuenta. Selecciona Crear cuenta.")
        if data.mode == "login" and known["provider"] != "email":
            raise HTTPException(401, "Esta cuenta utiliza otro proveedor. Inicia sesión con Google o Microsoft.")

        previous = conn.execute(
            """SELECT last_sent_at, hourly_window, hourly_count
               FROM conauti_email_challenges WHERE email = %s FOR UPDATE""",
            (email,),
        ).fetchone()
        if previous and (now - previous["last_sent_at"]).total_seconds() < 60:
            raise HTTPException(429, "Espera al menos 60 segundos antes de solicitar otro código.")
        hour_reset = not previous or (now - previous["hourly_window"]).total_seconds() >= 3600
        attempts = 1 if hour_reset else previous["hourly_count"] + 1
        if attempts > 5:
            raise HTTPException(429, "Límite de códigos alcanzado. Vuelve a intentarlo más tarde.")

        conn.execute(
            """INSERT INTO conauti_email_challenges(
                   email, mode, code_hash, expires_at, last_sent_at,
                   attempts, hourly_window, hourly_count
               )
               VALUES(%s,%s,%s,%s,%s,0,%s,%s)
               ON CONFLICT (email) DO UPDATE SET
                   mode=EXCLUDED.mode, code_hash=EXCLUDED.code_hash,
                   expires_at=EXCLUDED.expires_at, last_sent_at=EXCLUDED.last_sent_at,
                   attempts=0, hourly_window=EXCLUDED.hourly_window,
                   hourly_count=EXCLUDED.hourly_count""",
            (
                email, data.mode, code_hash(email, data.mode, code),
                now + timedelta(minutes=10), now,
                now if hour_reset else previous["hourly_window"], attempts,
            ),
        )
        # Ante un error SMTP se revierte también el desafío no entregado.
        send_code(email, code)
    return {"sent": True, "message": "Revisa tu bandeja de entrada y correo no deseado."}


@router.post("/verify")
def email_verify(data: EmailConfirm):
    require_email_config()
    email = normalize_email(str(data.email))
    now = datetime.now(timezone.utc)
    failure = None
    answer = None

    try:
        with connect() as conn:
            prepare_schema(conn)
            lock_email(conn, email)
            challenge = conn.execute(
                """SELECT mode, code_hash, attempts, expires_at
                   FROM conauti_email_challenges WHERE email = %s FOR UPDATE""",
                (email,),
            ).fetchone()
            if not challenge or challenge["expires_at"] <= now or challenge["mode"] != data.mode:
                failure = (400, "El código expiró o ya no está disponible. Solicita otro.")
            elif challenge["attempts"] >= 5:
                failure = (429, "Demasiados intentos. Solicita un código nuevo.")
            elif not hmac.compare_digest(
                challenge["code_hash"], code_hash(email, data.mode, data.code)
            ):
                conn.execute(
                    """UPDATE conauti_email_challenges SET attempts = attempts + 1
                       WHERE email = %s""",
                    (email,),
                )
                failure = (400, "Código incorrecto. Compruébalo e inténtalo de nuevo.")
            else:
                identity = identity_for(conn, email)
                if data.mode == "register":
                    if identity:
                        failure = (409, "Este correo ya está registrado. Inicia sesión.")
                    else:
                        user = conn.execute(
                            """INSERT INTO conauti_users(username, password_hash)
                               VALUES(%s,%s) RETURNING id""",
                            (google_username(email), hash_password(secrets.token_urlsafe(64))),
                        ).fetchone()
                        conn.execute(
                            """INSERT INTO conauti_verified_email_identities(email,user_id,provider)
                               VALUES(%s,%s,'email')""",
                            (email, user["id"]),
                        )
                        answer = create_session(conn, user["id"])
                elif not identity or identity["provider"] != "email":
                    failure = (401, "Esta cuenta no utiliza acceso por correo. Usa su proveedor original.")
                else:
                    answer = create_session(conn, identity["user_id"])
                if answer:
                    conn.execute("DELETE FROM conauti_email_challenges WHERE email = %s", (email,))
    except UniqueViolation as exc:
        raise HTTPException(409, "Este correo ya está registrado.") from exc

    if failure:
        raise HTTPException(*failure)
    if not answer:
        raise HTTPException(400, "No se pudo verificar el código.")
    return answer
