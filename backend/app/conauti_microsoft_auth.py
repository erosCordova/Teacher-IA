"""Inicio de sesión Microsoft mediante OAuth 2.0 Web + PKCE.

Configuración requerida: client_id, client_secret y URI de retorno del backend.
Solo se crea una cuenta si Microsoft acredita un correo verificado.
El acceso permanece desactivado mientras no se configure en Entra.
"""
import base64
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from uuid import UUID

import httpx
from fastapi import APIRouter, Cookie, HTTPException, Query
from fastapi.responses import RedirectResponse
from psycopg.errors import UniqueViolation

from app.conauti_auth import connect, hash_password
from app.conauti_google_auth import create_session, google_username
from app.conauti_email_auth import prepare_schema, lock_email, identity_for

router = APIRouter(prefix="/api/conauti/auth/microsoft", tags=["Acceso Microsoft"])

MICROSOFT_SCHEMA = """
CREATE TABLE IF NOT EXISTS conauti_microsoft_accounts (
    subject VARCHAR(255) PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    user_id UUID NOT NULL UNIQUE REFERENCES conauti_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS conauti_microsoft_states (
    state_hash CHAR(64) PRIMARY KEY,
    mode VARCHAR(12) NOT NULL CHECK (mode IN ('register','login')),
    nonce VARCHAR(96) NOT NULL,
    verifier VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS conauti_microsoft_tickets (
    ticket_hash CHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES conauti_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_microsoft_tickets_expires
  ON conauti_microsoft_tickets(expires_at);
"""

def microsoft_config() -> dict:
    required = (
        "MICROSOFT_OAUTH_CLIENT_ID", "MICROSOFT_OAUTH_CLIENT_SECRET",
        "MICROSOFT_OAUTH_REDIRECT_URI",
    )
    enabled = all(os.getenv(k, "").strip() for k in required)
    uri = os.getenv("MICROSOFT_OAUTH_REDIRECT_URI", "")
    return {
        "enabled": bool(enabled and uri.startswith("https://")
                        and uri.endswith("/api/conauti/auth/microsoft/callback")),
    }


def require_config() -> tuple[str, str, str]:
    if not microsoft_config()["enabled"]:
        raise HTTPException(503, "El acceso con Microsoft no está configurado.")
    return (
        os.environ["MICROSOFT_OAUTH_CLIENT_ID"],
        os.environ["MICROSOFT_OAUTH_CLIENT_SECRET"],
        os.environ["MICROSOFT_OAUTH_REDIRECT_URI"],
    )


def frontend_base() -> str:
    # Destino controlado por servidor; nunca aceptar "next" del solicitante.
    return "https://myteacheria.vercel.app"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def validate_microsoft_claims(identity_token: str, audience: str, nonce: str) -> tuple[str,str]:
    import jwt
    try:
        key = jwt.PyJWKClient(
            "https://login.microsoftonline.com/common/discovery/v2.0/keys",
            cache_jwk_set=True, lifespan=300, timeout=8,
        ).get_signing_key_from_jwt(identity_token)
        decoded = jwt.decode(
            identity_token, key.key, algorithms=["RS256"],
            audience=audience,
            options={"verify_iss": False, "require": ["iss", "aud", "exp", "iat", "tid", "nonce", "sub"]},
            leeway=60,
        )
    except (jwt.PyJWTError, ValueError, OSError) as exc:
        raise HTTPException(401, "No se pudo verificar la identidad Microsoft.") from exc

    tid = decoded.get("tid")
    if not isinstance(tid, str):
        raise HTTPException(401, "La identidad Microsoft es inválida.")
    try:
        tid = str(UUID(tid))
    except ValueError as exc:
        raise HTTPException(401, "El identificador de Microsoft es inválido.") from exc
    if decoded.get("iss") != f"https://login.microsoftonline.com/{tid}/v2.0":
        raise HTTPException(401, "El emisor de Microsoft es incorrecto.")
    if not hmac.compare_digest(str(decoded.get("nonce", "")), nonce):
        raise HTTPException(401, "La verificación Microsoft ha caducado o no coincide.")

    # email y preferred_username no son prueba de control del buzón.
    # Solo las afirmaciones verificadas se aceptan para crear una cuenta.
    verified = decoded.get("verified_primary_email")
    if isinstance(verified, list):
        verified = verified[0] if len(verified) == 1 else None
    if not isinstance(verified, str) or not verified:
        if decoded.get("xms_edov") is True or decoded.get("email_verified") is True:
            verified = decoded.get("email")
    if not isinstance(verified, str):
        raise HTTPException(
            403,
            "Microsoft no confirmó el correo. Utiliza otro método o configura el atributo de correo verificado.",
        )
    email = verified.strip().lower()
    if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(401, "Microsoft no proporcionó un correo válido.")

    oid = decoded.get("oid") or decoded.get("sub")
    if not isinstance(oid, str) or not oid or len(oid) > 180:
        raise HTTPException(401, "Identificador Microsoft inválido.")
    return f"{tid}:{oid}", email


@router.get("/config")
def config():
    return microsoft_config()


@router.get("/start")
def start(mode: str = Query(pattern=r"^(register|login)$")):
    client_id, _, redirect = require_config()
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    with connect() as conn:
        prepare_schema(conn)
        conn.execute(MICROSOFT_SCHEMA)
        conn.execute(
            """INSERT INTO conauti_microsoft_states(state_hash,mode,nonce,verifier,expires_at)
               VALUES(%s,%s,%s,%s,%s)""",
            (digest(state), mode, nonce, verifier, datetime.now(timezone.utc)+timedelta(minutes=5)),
        )
    query = urlencode({
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect,
        "scope": "openid profile email",
        "response_mode": "query",
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    })
    response = RedirectResponse(
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + query,
        status_code=302,
    )
    response.set_cookie("mtc_ms_state", state, max_age=300, httponly=True,
                        secure=True, samesite="lax", path="/api/conauti/auth/microsoft")
    response.headers["Cache-Control"] = "no-store"
    return response


def error_redirect():
    response = RedirectResponse(frontend_base()+"/?login_error=microsoft", status_code=302)
    response.delete_cookie("mtc_ms_state",path="/api/conauti/auth/microsoft")
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/callback")
def callback(
    state: str = Query(default="", max_length=128),
    code: str = Query(default="", max_length=6000),
    error: str = Query(default="", max_length=256),
    cookie_state: str | None = Cookie(default=None, alias="mtc_ms_state"),
):
    try:
        client_id, client_secret, redirect = require_config()
        if error or not state or not code or not cookie_state or not hmac.compare_digest(state, cookie_state):
            return error_redirect()

        with connect() as conn:
            record = conn.execute(
                """DELETE FROM conauti_microsoft_states
                   WHERE state_hash = %s AND expires_at > NOW()
                   RETURNING nonce,mode,verifier""",
                (digest(state),),
            ).fetchone()
        if not record:
            return error_redirect()

        try:
            with httpx.Client(timeout=12) as client:
                r = client.post(
                    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                    data={
                        "client_id": client_id, "client_secret": client_secret,
                        "grant_type": "authorization_code", "code": code,
                        "redirect_uri": redirect, "code_verifier": record["verifier"],
                        "scope": "openid profile email",
                    },
                )
                r.raise_for_status()
                id_token = r.json().get("id_token")
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(401, "Microsoft no pudo completar la autenticación.") from exc
        if not isinstance(id_token, str):
            return error_redirect()

        subject, email = validate_microsoft_claims(id_token, client_id, record["nonce"])

        with connect() as conn:
            prepare_schema(conn)
            conn.execute(MICROSOFT_SCHEMA)
            lock_email(conn, email)
            account = conn.execute(
                "SELECT user_id,email FROM conauti_microsoft_accounts WHERE subject=%s",
                (subject,),
            ).fetchone()
            if record["mode"] == "login":
                if not account or account["email"] != email:
                    return error_redirect()
                uid = account["user_id"]
            else:
                if account or identity_for(conn, email):
                    return error_redirect()
                user = conn.execute(
                    """INSERT INTO conauti_users(username,password_hash)
                       VALUES(%s,%s) RETURNING id""",
                    (google_username(email),hash_password(secrets.token_urlsafe(64))),
                ).fetchone()
                uid = user["id"]
                conn.execute(
                    "INSERT INTO conauti_microsoft_accounts(subject,email,user_id) VALUES(%s,%s,%s)",
                    (subject,email,uid),
                )
                conn.execute(
                    """INSERT INTO conauti_verified_email_identities(email,user_id,provider)
                       VALUES(%s,%s,'microsoft')""",
                    (email,uid),
                )
            ticket = secrets.token_urlsafe(32)
            conn.execute(
                """INSERT INTO conauti_microsoft_tickets(ticket_hash,user_id,expires_at)
                   VALUES(%s,%s,%s)""",
                (digest(ticket),uid,datetime.now(timezone.utc)+timedelta(seconds=60)),
            )
        response = RedirectResponse(frontend_base()+"/?ms_ticket="+ticket,status_code=302)
        response.delete_cookie("mtc_ms_state",path="/api/conauti/auth/microsoft")
        response.headers["Cache-Control"] = "no-store"
        return response
    except (HTTPException, UniqueViolation):
        return error_redirect()


@router.post("/complete")
def complete(ticket: str = Query(min_length=30,max_length=128)):
    with connect() as conn:
        conn.execute(MICROSOFT_SCHEMA)
        row = conn.execute(
            """DELETE FROM conauti_microsoft_tickets
               WHERE ticket_hash=%s AND expires_at > NOW() RETURNING user_id""",
            (digest(ticket),),
        ).fetchone()
        if not row:
            raise HTTPException(401, "El acceso Microsoft ha caducado o ya se utilizó.")
        return create_session(conn, row["user_id"])
