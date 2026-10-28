import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

import psycopg
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/conauti", tags=["CONAUTI"])
bearer = HTTPBearer(auto_error=False)


def database_url():
    value = os.getenv("CONAUTI_DATABASE_URL")

    if value:
        return value

    env_file = Path(__file__).resolve().parents[1] / ".env"

    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("CONAUTI_DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"')

    raise RuntimeError("CONAUTI_DATABASE_URL no configurada")


def connect():
    return psycopg.connect(
        database_url(),
        row_factory=dict_row,
        connect_timeout=5,
    )


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    result = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=16384,
        r=8,
        p=1,
    )
    return salt.hex() + ":" + result.hex()


def verify_password(password, stored):
    try:
        salt_hex, expected = stored.split(":", 1)
        calculated = hash_password(
            password,
            bytes.fromhex(salt_hex),
        )
        return hmac.compare_digest(calculated, stored)
    except (ValueError, TypeError):
        return False


class Credentials(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=32,
        pattern=r"^[a-zA-Z0-9_]+$",
    )
    password: str = Field(min_length=12, max_length=128)


class ConversationInput(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class MessageInput(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    if credentials is None:
        raise HTTPException(401, "Autenticacion requerida")

    token_hash = hashlib.sha256(
        credentials.credentials.encode()
    ).hexdigest()

    with connect() as conn:
        user = conn.execute(
            """
            SELECT u.id, u.username
            FROM conauti_sessions s
            JOIN conauti_users u ON u.id = s.user_id
            WHERE s.token_hash = %s
              AND s.expires_at > NOW()
            """,
            (token_hash,),
        ).fetchone()

    if not user:
        raise HTTPException(401, "Sesion invalida o vencida")

    return user


@router.get("/health/db")
def database_health():
    with connect() as conn:
        row = conn.execute(
            "SELECT current_database() AS database, 1 AS ready"
        ).fetchone()

    return {"status": "ok", "database": row["database"]}


@router.post("/auth/register", status_code=403)
def register(data: Credentials):
    # Se conserva la ruta para avisar a clientes anteriores, pero se impide
    # crear cuentas sin verificar la propiedad del correo.
    del data
    raise HTTPException(403, "Regístrate con Google para verificar tu correo electrónico.")


@router.post("/auth/login")
def login(data: Credentials):
    username = data.username.lower()

    with connect() as conn:
        user = conn.execute(
            """
            SELECT id, username, password_hash
            FROM conauti_users
            WHERE username = %s
            """,
            (username,),
        ).fetchone()

        if not user or not verify_password(
            data.password, user["password_hash"]
        ):
            raise HTTPException(401, "Credenciales invalidas")

        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        conn.execute(
            """
            INSERT INTO conauti_sessions(
                token_hash, user_id, expires_at
            )
            VALUES (%s, %s, %s)
            """,
            (
                token_hash,
                user["id"],
                datetime.now(timezone.utc) + timedelta(days=7),
            ),
        )

    return {"access_token": token, "token_type": "bearer"}


@router.get("/auth/me")
def me(user=Depends(current_user)):
    # El correo mostrado es el de la identidad verificada, no el nombre técnico.
    with connect() as conn:
        tables = conn.execute(
            """SELECT to_regclass('public.conauti_verified_email_identities') AS shared,
                      to_regclass('public.conauti_google_accounts') AS google"""
        ).fetchone()
        if tables and tables["shared"]:
            identity = conn.execute(
                "SELECT email FROM conauti_verified_email_identities WHERE user_id = %s",
                (user["id"],),
            ).fetchone()
            if identity:
                return {**user, "username": identity["email"], "email": identity["email"]}
        if tables and tables["google"]:
            identity = conn.execute(
                "SELECT email FROM conauti_google_accounts WHERE user_id = %s",
                (user["id"],),
            ).fetchone()
            if identity:
                return {**user, "username": identity["email"], "email": identity["email"]}
    return user


@router.post("/auth/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    user=Depends(current_user),
):
    token_hash = hashlib.sha256(
        credentials.credentials.encode()
    ).hexdigest()

    with connect() as conn:
        conn.execute(
            """
            DELETE FROM conauti_sessions
            WHERE token_hash = %s AND user_id = %s
            """,
            (token_hash, user["id"]),
        )

    return {"status": "logged_out"}


@router.post("/conversations", status_code=201)
def create_conversation(
    data: ConversationInput,
    user=Depends(current_user),
):
    with connect() as conn:
        row = conn.execute(
            """
            INSERT INTO conauti_conversations(user_id, title)
            VALUES (%s, %s)
            RETURNING id, title, created_at
            """,
            (user["id"], data.title),
        ).fetchone()

    return row


@router.get("/conversations")
def list_conversations(user=Depends(current_user)):
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, created_at
            FROM conauti_conversations
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 100
            """,
            (user["id"],),
        ).fetchall()

    return rows


@router.get("/conversations/{conversation_id}/messages")
def list_messages(
    conversation_id: UUID,
    user=Depends(current_user),
):
    with connect() as conn:
        exists = conn.execute(
            """
            SELECT 1 FROM conauti_conversations
            WHERE id = %s AND user_id = %s
            """,
            (conversation_id, user["id"]),
        ).fetchone()

        if not exists:
            raise HTTPException(404, "Conversacion no encontrada")

        return conn.execute(
            """
            SELECT id, role, body, created_at
            FROM conauti_messages
            WHERE conversation_id = %s
            ORDER BY id ASC
            LIMIT 200
            """,
            (conversation_id,),
        ).fetchall()


@router.post(
    "/conversations/{conversation_id}/messages",
    status_code=201,
)
def add_message(
    conversation_id: UUID,
    data: MessageInput,
    user=Depends(current_user),
):
    with connect() as conn:
        row = conn.execute(
            """
            INSERT INTO conauti_messages(
                conversation_id, role, body
            )
            SELECT id, 'user', %s
            FROM conauti_conversations
            WHERE id = %s AND user_id = %s
            RETURNING id, role, body, created_at
            """,
            (data.body, conversation_id, user["id"]),
        ).fetchone()

    if not row:
        raise HTTPException(404, "Conversacion no encontrada")

    return row


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: UUID,
    user=Depends(current_user),
):
    with connect() as conn:
        row = conn.execute(
            """
            DELETE FROM conauti_conversations
            WHERE id = %s AND user_id = %s
            RETURNING id
            """,
            (conversation_id, user["id"]),
        ).fetchone()

    if not row:
        raise HTTPException(404, "Conversacion no encontrada")

    return {"deleted": True}
