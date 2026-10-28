from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.conauti_auth import connect, current_user


router = APIRouter(
    prefix="/api/conauti/history",
    tags=["Historial educativo"],
)


@router.get("/conversations")
def search_conversations(
    search: str = Query(default="", max_length=100),
    limit: int = Query(default=15, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=1000000),
    user=Depends(current_user),
):
    term = search.strip()
    uid = user["id"]

    where = """
        c.user_id = %s
        AND (
            %s = ''
            OR POSITION(LOWER(%s) IN LOWER(c.title)) > 0
            OR EXISTS (
                SELECT 1
                FROM conauti_messages m
                WHERE m.conversation_id = c.id
                  AND POSITION(LOWER(%s) IN LOWER(m.body)) > 0
            )
        )
    """

    params = (uid, term, term, term)

    with connect() as conn:
        total = conn.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM conauti_conversations c
            WHERE {where}
            """,
            params,
        ).fetchone()["total"]

        items = conn.execute(
            f"""
            SELECT
                c.id,
                c.title,
                c.created_at,
                (
                    SELECT COUNT(*)
                    FROM conauti_messages m
                    WHERE m.conversation_id = c.id
                ) AS message_count
            FROM conauti_conversations c
            WHERE {where}
            ORDER BY c.created_at DESC, c.id DESC
            LIMIT %s OFFSET %s
            """,
            (*params, limit, offset),
        ).fetchall()

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + len(items) < total,
    }


@router.get("/conversations/{conversation_id}/messages")
def paginated_messages(
    conversation_id: UUID,
    before_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=30, ge=1, le=100),
    user=Depends(current_user),
):
    with connect() as conn:
        owned = conn.execute(
            """
            SELECT 1
            FROM conauti_conversations
            WHERE id = %s
              AND user_id = %s
            """,
            (conversation_id, user["id"]),
        ).fetchone()

        if not owned:
            raise HTTPException(
                status_code=404,
                detail="Conversación no encontrada",
            )

        rows = conn.execute(
            """
            SELECT id, role, body, created_at
            FROM conauti_messages
            WHERE conversation_id = %s
              AND (%s::BIGINT IS NULL OR id < %s::BIGINT)
            ORDER BY id DESC
            LIMIT %s
            """,
            (
                conversation_id,
                before_id,
                before_id,
                limit + 1,
            ),
        ).fetchall()

    has_more = len(rows) > limit
    selected = rows[:limit]

    next_before = (
        selected[-1]["id"] if has_more and selected else None
    )

    return {
        "items": list(reversed(selected)),
        "has_more": has_more,
        "next_before": next_before,
    }
