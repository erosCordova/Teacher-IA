"""Historial privado de evaluaciones académicas."""

from fastapi import APIRouter, Depends, Query
import psycopg

from app.conauti_auth import current_user, database_url
from app.conauti_voice_preferences import authenticated_user_id
from app.conauti_assessments import KEYS


router = APIRouter(
    prefix="/api/conauti/memory/assessment",
    tags=["My Teacher IA - Historial académico"],
)


@router.get("/history")
def assessment_history(
    limit: int = Query(default=30, ge=1, le=100),
    user=Depends(current_user),
):
    uid = authenticated_user_id(user)

    with psycopg.connect(
        database_url(),
        connect_timeout=10,
    ) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    topic_key,
                    exercise_key,
                    correct,
                    answered_at
                FROM public.conauti_assessment_attempts
                WHERE user_id = %s
                  AND answered_at IS NOT NULL
                ORDER BY answered_at DESC, id DESC
                LIMIT %s
                """,
                (uid, limit),
            )

            rows = cursor.fetchall()

    items = []

    for attempt_id, topic, key, correct, date in rows:
        exercise = KEYS.get(key)

        question = (
            exercise[1]
            if exercise and exercise[0] == topic
            else "Ejercicio anterior"
        )

        items.append(
            {
                "id": str(attempt_id),
                "topic": topic,
                "question": question,
                "correct": bool(correct),
                "answered_at": date.isoformat(),
            }
        )

    return {
        "items": items,
        "count": len(items),
        "limit": limit,
    }
