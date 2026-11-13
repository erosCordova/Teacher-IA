"""Importación voluntaria de conversaciones educativas creadas sin conexión.

No se ejecuta automáticamente al conectar a Internet. Requiere sesión
válida, rechaza identidades ajenas y evita duplicados al reintentar la
misma sincronización desde el dispositivo del estudiante.
"""
from uuid import UUID, uuid5, NAMESPACE_URL

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.conauti_auth import connect, current_user

router = APIRouter(prefix="/api/conauti", tags=["CONAUTI — Historial local"])


class OfflineMessage(BaseModel):
    id: int = Field(ge=1)
    rol: str = Field(pattern="^(estudiante|tutor)$")
    texto: str = Field(min_length=1, max_length=4000)


class OfflineImport(BaseModel):
    local_conversation_id: UUID
    messages: list[OfflineMessage] = Field(min_length=1, max_length=80)


def _remote_id(user_id: UUID, local_id: UUID) -> UUID:
    """UUID remoto estable y distinto para cada cuenta y chat local."""
    return uuid5(NAMESPACE_URL, f"myteacher-offline:{user_id}:{local_id}")


@router.post("/offline/import")
def import_offline(data: OfflineImport, user=Depends(current_user)):
    """Sincroniza la ventana de hasta 80 mensajes con solapamiento seguro.

    La operación es idempotente: repeticiones no duplican mensajes.
    Se usa una transacción y bloqueo por conversación; ninguna sesión
    accede a conversaciones de otros estudiantes.
    """
    uid = UUID(str(user["id"]))
    remote_id = _remote_id(uid, data.local_conversation_id)
    entries = [(("user" if m.rol == "estudiante" else "assistant"), m.texto)
               for m in data.messages]
    ids = [m.id for m in data.messages]
    if len(ids) != len(set(ids)) or ids != sorted(ids):
        raise HTTPException(422, "Los mensajes locales deben ser únicos y estar ordenados.")

    title = "Estudio sin conexión · " + data.messages[0].texto.strip().replace("\n", " ")[:80]
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO conauti_conversations(id, user_id, title)
            VALUES (%s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (remote_id, uid, title[:120]),
        )
        conversation = conn.execute(
            "SELECT user_id FROM conauti_conversations WHERE id = %s FOR UPDATE",
            (remote_id,),
        ).fetchone()
        if not conversation or str(conversation["user_id"]) != str(uid):
            raise HTTPException(403, "La conversación no pertenece a esta cuenta.")

        rows = conn.execute(
            """
            SELECT role, body FROM conauti_messages
            WHERE conversation_id = %s
            ORDER BY id ASC
            """,
            (remote_id,),
        ).fetchall()
        existing = [(r["role"], r["body"]) for r in rows]

        # El teléfono retiene una ventana móvil de 80 entradas. Encontrar
        # el mayor solapamiento con el final de la conversación ya subida.
        overlap = 0
        for length in range(min(len(existing), len(entries)), 0, -1):
            if existing[-length:] == entries[:length]:
                overlap = length
                break
        if existing and overlap == 0:
            raise HTTPException(
                409,
                "El historial local no coincide con el sincronizado. "
                "No se ha sobrescrito ningún mensaje.",
            )
        new_entries = entries[overlap:]
        for role, body in new_entries:
            conn.execute(
                """
                INSERT INTO conauti_messages(conversation_id, role, body)
                VALUES (%s, %s, %s)
                """,
                (remote_id, role, body),
            )
    return {
        "conversation_id": str(remote_id),
        "added": len(new_entries),
        "total": len(existing) + len(new_entries),
        "already_synced": len(new_entries) == 0,
    }
