"""Práctica adaptativa y pistas pedagógicas de My Teacher IA."""

from uuid import UUID, uuid4
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.conauti_auth import current_user, database_url
from app.conauti_voice_preferences import authenticated_user_id
from app import conauti_assessments as core


router = APIRouter(
    prefix="/api/conauti/memory/assessment/adaptive",
    tags=["My Teacher IA - Práctica adaptativa"],
)


# Ejercicios nuevos con soluciones verificadas.
# El formato es compatible con el motor anterior.

EXTRA = {
    "fracciones": [
        (
            "f07", "¿Cuánto es 2/3 + 1/6?",
            ["3/9", "5/6", "1/2", "4/6"], "B",
        ),
        (
            "f08", "¿Cuánto es 3/4 - 1/8?",
            ["2/8", "1/2", "5/8", "1/8"], "C",
        ),
        (
            "f09", "¿Cuánto es 2/5 de 30?",
            ["6", "10", "12", "15"], "C",
        ),
        (
            "f10", "¿Cuánto es 5/6 + 1/3?",
            ["6/9", "1", "7/6", "5/9"], "C",
        ),
        (
            "f11", "¿Cuánto es 3/4 dividido entre 1/2?",
            ["3/8", "3/2", "1/4", "2/3"], "B",
        ),
        (
            "f12", "¿Cuánto es 7/8 - 1/3?",
            ["4/5", "11/24", "13/24", "4/24"], "C",
        ),
    ],
    "ecuaciones": [
        (
            "e07", "Si 3x + 2 = 14, ¿cuánto vale x?",
            ["3", "4", "5", "6"], "B",
        ),
        (
            "e08", "Si 2(x - 3) = 10, ¿cuánto vale x?",
            ["5", "7", "8", "13"], "C",
        ),
        (
            "e09", "Si 5x - 7 = 2x + 8, ¿cuánto vale x?",
            ["3", "5", "7", "15"], "B",
        ),
        (
            "e10", "Si 4x/3 = 12, ¿cuánto vale x?",
            ["3", "4", "6", "9"], "D",
        ),
        (
            "e11", "Si 2(x + 4) - 3 = 15, ¿cuánto vale x?",
            ["4", "5", "6", "7"], "B",
        ),
        (
            "e12", "Si 3(x - 2) + 4 = 2x + 9, ¿cuánto vale x?",
            ["7", "9", "11", "13"], "C",
        ),
    ],
}


LEVEL = {}

for topic, exercises in core.BANK.items():
    for exercise in exercises:
        LEVEL[exercise[0]] = 1

for topic, exercises in EXTRA.items():
    for position, exercise in enumerate(exercises):
        key, question, options, correct = exercise

        if key in core.KEYS:
            raise RuntimeError(
                "CLAVE_EJERCICIO_DUPLICADA:" + key
            )

        core.BANK[topic].append(exercise)

        core.KEYS[key] = (
            topic, question, options, correct
        )

        LEVEL[key] = 2 if position < 4 else 3


# Las pistas explican el procedimiento.
# No contienen letras de respuestas correctas.

HINTS = {
    "f01": (
        "Las fracciones equivalentes representan la misma cantidad.",
        "Piensa en multiplicar numerador y denominador por el mismo número.",
    ),
    "f02": (
        "Observa si las fracciones tienen el mismo denominador.",
        "Cuando los denominadores coinciden, trabaja con los numeradores.",
    ),
    "f03": (
        "Imagina ambas fracciones como partes de una misma figura.",
        "Compara cuánto representa cada una usando el mismo denominador.",
    ),
    "f04": (
        "Una fracción equivalente conserva la proporción.",
        "Busca un mismo factor para numerador y denominador.",
    ),
    "f05": (
        "Simplificar no cambia el valor de una fracción.",
        "Busca un divisor común del numerador y denominador.",
    ),
    "f06": (
        "Revisa primero los denominadores.",
        "Cuando son iguales, conserva el denominador y opera los numeradores.",
    ),
    "f07": (
        "Para sumar fracciones, necesitan un denominador común.",
        "Convierte ambas fracciones a sextos antes de sumar.",
    ),
    "f08": (
        "Primero expresa ambas fracciones en octavos.",
        "Después resta los numeradores, conservando el denominador.",
    ),
    "f09": (
        "La palabra 'de' puede representar una multiplicación.",
        "Divide primero la cantidad entre el denominador.",
    ),
    "f10": (
        "Busca un denominador común antes de sumar.",
        "Convierte los tercios a sextos y revisa si la suma supera la unidad.",
    ),
    "f11": (
        "La división de fracciones tiene una operación equivalente.",
        "Multiplica la primera fracción por el recíproco de la segunda.",
    ),
    "f12": (
        "Los denominadores son diferentes.",
        "Busca el mínimo común múltiplo antes de restar.",
    ),
    "e01": (
        "Piensa en la operación inversa de sumar.",
        "Mantén la igualdad realizando la misma operación en ambos lados.",
    ),
    "e02": (
        "La variable está multiplicada por un número.",
        "Aplica la operación inversa a ambos lados.",
    ),
    "e03": (
        "Piensa qué operación deshace una resta.",
        "Aísla la variable manteniendo ambos lados equivalentes.",
    ),
    "e04": (
        "Observa qué operación afecta a la variable.",
        "Usa la operación inversa de dividir.",
    ),
    "e05": (
        "La variable está multiplicada.",
        "Divide los dos lados por el mismo factor.",
    ),
    "e06": (
        "Aislar la variable requiere una resta.",
        "Recuerda que las soluciones pueden ser negativas.",
    ),
    "e07": (
        "Primero elimina el término constante.",
        "Después elimina el coeficiente que multiplica a la variable.",
    ),
    "e08": (
        "Hay una multiplicación aplicada a un paréntesis.",
        "Puedes dividir ambos lados antes de aislar la variable.",
    ),
    "e09": (
        "Hay términos con x a ambos lados.",
        "Agrupa las variables de un lado y las constantes del otro.",
    ),
    "e10": (
        "La variable está multiplicada y dividida.",
        "Deshaz las operaciones de manera ordenada.",
    ),
    "e11": (
        "Empieza revisando el paréntesis.",
        "Agrupa las constantes y luego aísla la variable.",
    ),
    "e12": (
        "Desarrolla el paréntesis con la distributiva.",
        "Agrupa las variables en un lado y las constantes en el otro.",
    ),
}


def _target_level(cursor, uid, topic):
    cursor.execute(
        """
        SELECT correct, exercise_key
        FROM public.conauti_assessment_attempts
        WHERE user_id = %s
          AND topic_key = %s
          AND answered_at IS NOT NULL
        ORDER BY answered_at DESC, id DESC
        LIMIT 8
        """,
        (uid, topic),
    )

    recent = cursor.fetchall()

    if (
        len(recent) >= 8
        and sum(bool(row[0]) for row in recent[:8]) >= 7
        and len({row[1] for row in recent[:8]}) >= 6
    ):
        return 3

    if (
        len(recent) >= 4
        and sum(bool(row[0]) for row in recent[:4]) >= 3
        and len({row[1] for row in recent[:4]}) >= 3
    ):
        return 2

    return 1


def _level_name(key):
    return {
        1: "básico",
        2: "intermedio",
        3: "avanzado",
    }[LEVEL.get(key, 1)]


@router.get("/start")
def adaptive_start(
    topic: Literal[
        "fracciones", "ecuaciones"
    ] = Query(default="fracciones"),
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
                SELECT id, exercise_key
                FROM public.conauti_assessment_attempts
                WHERE user_id = %s
                  AND topic_key = %s
                  AND answered_at IS NULL
                LIMIT 1
                """,
                (uid, topic),
            )

            pending = cursor.fetchone()

            if pending:
                attempt_id, key = pending

                if (
                    key not in core.KEYS
                    or core.KEYS[key][0] != topic
                ):
                    raise HTTPException(
                        409,
                        "Ejercicio pendiente no disponible.",
                    )

            else:
                target = _target_level(
                    cursor, uid, topic
                )

                cursor.execute(
                    """
                    SELECT
                        exercise_key,
                        COUNT(*)::integer
                    FROM public.conauti_assessment_attempts
                    WHERE user_id = %s
                      AND topic_key = %s
                      AND answered_at IS NOT NULL
                    GROUP BY exercise_key
                    """,
                    (uid, topic),
                )

                seen = dict(cursor.fetchall())

                candidates = [
                    row[0]
                    for row in core.BANK[topic]
                    if LEVEL.get(row[0], 1) == target
                ]

                if not candidates:
                    raise HTTPException(
                        503,
                        "No hay ejercicios disponibles.",
                    )

                key = min(
                    candidates,
                    key=lambda value: (
                        seen.get(value, 0),
                        value,
                    ),
                )

                attempt_id = uuid4()

                cursor.execute(
                    """
                    INSERT INTO public.conauti_assessment_attempts
                        (
                            id,
                            user_id,
                            topic_key,
                            exercise_key
                        )
                    VALUES (%s, %s, %s, %s)
                    """,
                    (attempt_id, uid, topic, key),
                )

            progress = core._stats(
                cursor, uid, topic
            )

    _, question, options, _ = core.KEYS[key]

    return {
        "attempt_id": str(attempt_id),
        "topic": topic,
        "difficulty": _level_name(key),
        "question": question,
        "options": dict(zip("ABCD", options)),
        "progress": progress,
    }


@router.get("/{attempt_id}/hint")
def guided_hint(
    attempt_id: UUID,
    level: int = Query(default=1, ge=1, le=2),
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
                SELECT topic_key, exercise_key, answered_at
                FROM public.conauti_assessment_attempts
                WHERE id = %s
                  AND user_id = %s
                """,
                (attempt_id, uid),
            )

            row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            404,
            "Ejercicio no encontrado.",
        )

    topic, key, answered_at = row

    if answered_at is not None:
        raise HTTPException(
            409,
            "El ejercicio ya fue respondido.",
        )

    if (
        key not in core.KEYS
        or core.KEYS[key][0] != topic
    ):
        raise HTTPException(
            409,
            "Ejercicio no disponible.",
        )

    hints = HINTS.get(key)

    if not hints:
        hints = (
            "Identifica primero qué te están preguntando.",
            "Resuelve el problema por pasos antes de elegir una opción.",
        )

    return {
        "level": level,
        "hint": hints[level - 1],
        "remaining": 2 - level,
    }
