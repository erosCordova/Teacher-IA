from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.conauti_auth import (
    connect,
    current_user,
    verify_password,
)


router = APIRouter(
    prefix="/api/conauti",
    tags=["Privacidad y permisos"],
)


class RenameConversation(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class ConfirmDeletion(BaseModel):
    password: str = Field(min_length=12, max_length=128)


@router.get("/auth/roles")
def my_roles(user=Depends(current_user)):
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT role_code
            FROM conauti_user_roles
            WHERE user_id = %s
            ORDER BY role_code
            """,
            (user["id"],),
        ).fetchall()

    return {
        "username": user["username"],
        "roles": [r["role_code"] for r in rows],
    }


@router.patch("/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: UUID,
    data: RenameConversation,
    user=Depends(current_user),
):
    with connect() as conn:
        row = conn.execute(
            """
            UPDATE conauti_conversations
            SET title = %s
            WHERE id = %s AND user_id = %s
            RETURNING id, title
            """,
            (data.title, conversation_id, user["id"]),
        ).fetchone()

    if not row:
        raise HTTPException(404, "Conversacion no encontrada")

    return row


@router.get("/privacy/export")
def export_personal_data(user=Depends(current_user)):
    uid = user["id"]

    with connect() as conn:

        conversations = conn.execute(
            """
            SELECT id, title, created_at
            FROM conauti_conversations
            WHERE user_id = %s
            ORDER BY created_at, id
            """,
            (uid,),
        ).fetchall()

        messages = conn.execute(
            """
            SELECT m.conversation_id, m.role,
                   m.body, m.created_at
            FROM conauti_messages m
            JOIN conauti_conversations c
              ON c.id = m.conversation_id
            WHERE c.user_id = %s
            ORDER BY m.id
            """,
            (uid,),
        ).fetchall()

        memories = conn.execute(
            """
            SELECT id, content, source_message_id,
                   consent_granted_at, expires_at, created_at
            FROM conauti_memories
            WHERE user_id = %s
            """,
            (uid,),
        ).fetchall()

        progress = conn.execute(
            """
            SELECT id, subject, topic, attempts,
                   score, recorded_at
            FROM conauti_progress
            WHERE user_id = %s
            """,
            (uid,),
        ).fetchall()

        roles = conn.execute(
            """
            SELECT role_code
            FROM conauti_user_roles
            WHERE user_id = %s
            """,
            (uid,),
        ).fetchall()

        # Exportar tarjetas de estudio y repeticiones cuando existan.
        study_cards = []
        stored_study = conn.execute(
            "SELECT to_regclass('public.conauti_study_cards') AS exists"
        ).fetchone()
        if stored_study["exists"] is not None:
            study_cards = conn.execute(
                "SELECT topic,question,answer,source_name,source_page,due_at,"
                "repetitions,reviews,created_at "
                "FROM public.conauti_study_cards "
                "WHERE user_id=%s ORDER BY created_at DESC",
                (uid,),
            ).fetchall()

        # Exportar también los textos guardados voluntariamente en RAG.
        materials = []
        exists = conn.execute(
            "SELECT to_regclass('public.conauti_rag_documents') AS exists"
        ).fetchone()
        if exists["exists"] is not None:
            materials = conn.execute(
                """
                SELECT d.id, d.filename, d.created_at,
                       c.page_number, c.ordinal, c.body
                FROM public.conauti_rag_documents d
                JOIN public.conauti_rag_chunks c ON c.document_id=d.id
                WHERE d.user_id=%s
                ORDER BY d.created_at, c.ordinal
                """, (uid,),
            ).fetchall()

    data = {
        "account": {
            "username": user["username"],
            "roles": [r["role_code"] for r in roles],
        },
        "conversations": conversations,
        "messages": messages,
        "memories": memories,
        "materials": materials,
        "study_cards": study_cards,
        "progress": progress,
    }

    return JSONResponse(
        content=jsonable_encoder(data),
        headers={
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Content-Disposition":
                'attachment; filename="conauti_datos.json"',
        },
    )


@router.delete("/privacy/account")
def delete_my_account(
    confirmation: ConfirmDeletion,
    user=Depends(current_user),
):
    with connect() as conn:

        account = conn.execute(
            """
            SELECT password_hash
            FROM conauti_users
            WHERE id = %s
            FOR UPDATE
            """,
            (user["id"],),
        ).fetchone()

        if not account or not verify_password(
            confirmation.password,
            account["password_hash"],
        ):
            raise HTTPException(
                403,
                "Confirmacion de contraseña incorrecta",
            )

        conn.execute(
            """
            DELETE FROM conauti_users
            WHERE id = %s
            """,
            (user["id"],),
        )

    return {"deleted": True}
