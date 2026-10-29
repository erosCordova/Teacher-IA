"""Progreso de juegos educativos vinculado a la cuenta del estudiante.

Solo se guardan contadores académicos: no se envían imágenes, audio ni textos
de las conversaciones. La tabla se crea de forma idempotente al primer acceso
para no requerir acciones manuales en la demo de Render.
"""
import threading

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.conauti_auth import connect, current_user

router = APIRouter(prefix="/api/conauti/games", tags=["My Teacher IA - Aprende jugando"])

_init_lock = threading.Lock()
_prepared = False


def prepare_table():
    global _prepared
    if _prepared:
        return
    with _init_lock:
        if _prepared:
            return
        with connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS conauti_game_progress (
                  user_id UUID PRIMARY KEY REFERENCES conauti_users(id) ON DELETE CASCADE,
                  xp INTEGER NOT NULL DEFAULT 0,
                  completados INTEGER NOT NULL DEFAULT 0,
                  aciertos INTEGER NOT NULL DEFAULT 0,
                  intentos INTEGER NOT NULL DEFAULT 0,
                  por_materia JSONB NOT NULL DEFAULT '{}'::jsonb,
                  dias JSONB NOT NULL DEFAULT '[]'::jsonb,
                  insignias JSONB NOT NULL DEFAULT '[]'::jsonb,
                  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        _prepared = True


class Progress(BaseModel):
    xp: int = Field(0, ge=0, le=1_000_000)
    completados: int = Field(0, ge=0, le=100_000)
    aciertos: int = Field(0, ge=0, le=100_000)
    intentos: int = Field(0, ge=0, le=100_000)
    porMateria: dict[str, int] = Field(default_factory=dict)
    dias: list[str] = Field(default_factory=list, max_length=180)
    insignias: list[str] = Field(default_factory=list, max_length=40)

    @field_validator("porMateria")
    @classmethod
    def validate_subjects(cls, value):
        permitidas = {
            "biologia", "matematicas", "ingles", "comunicacion", "peru",
            "universal", "cultura", "fisica", "quimica", "geografia",
            "tecnologia", "ciudadania", "arte", "ambiente",
        }
        if set(value) - permitidas:
            raise ValueError("Materia no admitida")
        if any(not isinstance(n, int) or isinstance(n, bool) or n < 0 or n > 100_000 for n in value.values()):
            raise ValueError("Progreso de materia no válido")
        return value

    @field_validator("dias")
    @classmethod
    def validate_dates(cls, value):
        import re
        if any(not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day) for day in value):
            raise ValueError("Fecha no válida")
        return value

    @field_validator("insignias")
    @classmethod
    def validate_badges(cls, value):
        nombres = {
            "¡Primer desafío!", "Explorador del saber",
            "Mente brillante", "Imparable", "Leyenda del conocimiento",
        }
        if any(badge not in nombres for badge in value):
            raise ValueError("Insignia desconocida")
        return value


class ProgressBody(BaseModel):
    progress: Progress


def as_progress(row):
    if not row:
        return Progress().model_dump(by_alias=True)
    return {
        "xp": row["xp"], "completados": row["completados"],
        "aciertos": row["aciertos"], "intentos": row["intentos"],
        "porMateria": row["por_materia"], "dias": row["dias"],
        "insignias": row["insignias"],
    }


@router.get("/progress")
def get_progress(user=Depends(current_user)):
    prepare_table()
    with connect() as conn:
        row = conn.execute(
            """
            SELECT xp, completados, aciertos, intentos,
              por_materia, dias, insignias
            FROM conauti_game_progress WHERE user_id = %s
            """,
            (user["id"],),
        ).fetchone()
    return {"progress": as_progress(row), "storage": "postgresql"}


@router.put("/progress")
def update_progress(body: ProgressBody, user=Depends(current_user)):
    prepare_table()
    p = body.progress
    if p.aciertos > p.intentos or p.completados > p.intentos:
        raise HTTPException(422, "Los contadores de progreso no coinciden.")
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO conauti_game_progress (
                user_id, xp, completados, aciertos, intentos,
                por_materia, dias, insignias
            ) VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb)
            ON CONFLICT (user_id) DO UPDATE SET
                xp = GREATEST(conauti_game_progress.xp,EXCLUDED.xp),
                completados = GREATEST(conauti_game_progress.completados,EXCLUDED.completados),
                aciertos = GREATEST(conauti_game_progress.aciertos,EXCLUDED.aciertos),
                intentos = GREATEST(conauti_game_progress.intentos,EXCLUDED.intentos),
                por_materia = EXCLUDED.por_materia,
                dias = EXCLUDED.dias,
                insignias = EXCLUDED.insignias,
                actualizado_en = NOW()
            """,
            (
                user["id"], p.xp, p.completados, p.aciertos, p.intentos,
                __import__("json").dumps(p.porMateria),
                __import__("json").dumps(p.dias),
                __import__("json").dumps(p.insignias),
            ),
        )
    return {"ok": True, "storage": "postgresql"}
