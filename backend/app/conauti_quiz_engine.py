"""Evaluaciones dinámicas a partir de tarjetas del estudiante, sin gastar cuota IA.

La respuesta correcta nunca se envía antes de entregar la evaluación.
Los resultados se almacenan por estudiante y no certifican dominio.
"""
from __future__ import annotations

import secrets
import threading
from uuid import UUID, uuid4

import psycopg
from psycopg.types.json import Jsonb
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.conauti_auth import current_user, database_url
from app.conauti_study import prepare as prepare_study

router = APIRouter(prefix="/api/conauti/study/exams", tags=["Evaluación dinámica"])
LOCK = threading.Lock()
READY = False
SCHEMA = """
CREATE TABLE IF NOT EXISTS public.conauti_study_exams (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.conauti_users(id) ON DELETE CASCADE,
 topic varchar(110) NOT NULL,
 questions jsonb NOT NULL,
 score integer,
 total integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 submitted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_study_exams_user
 ON public.conauti_study_exams(user_id,created_at DESC);
ALTER TABLE public.conauti_study_exams ENABLE ROW LEVEL SECURITY;
"""


def prepare(conn):
    global READY
    if READY:
        return
    with LOCK:
        if READY:
            return
        try:
            conn.execute(SCHEMA)
            conn.commit()
        except psycopg.Error as exc:
            conn.rollback()
            raise HTTPException(503, "No se pueden iniciar evaluaciones en este momento.") from exc
        READY = True


def make_exam(rows, count=5, rng=None):
    """Construye preguntas con tres distractores diferentes sin revelar claves."""
    rng = rng or secrets.SystemRandom()
    unique = {}
    for row in rows:
        # Filtrar respuestas duplicadas para evitar varias respuestas correctas.
        key=" ".join(str(row[3]).casefold().split())
        if key not in unique:
            unique[key]=row
    pool=list(unique.values())
    if len(pool)<4:
        raise ValueError("Necesitas al menos cuatro tarjetas con respuestas diferentes.")
    selected=rng.sample(pool,min(count,len(pool)))
    result=[]
    for card in selected:
        card_id,topic,question,answer,source,page=card[:6]
        source_doc=card[6] if len(card)>6 else None
        distractors=[other for other in pool if other[0]!=card_id]
        # Preferir distractores de la misma materia si existen.
        distractors.sort(key=lambda other:other[1]!=topic)
        candidates=distractors[:max(3,min(7,len(distractors)))]
        wrong=rng.sample(candidates,3)
        options=[answer]+[x[3] for x in wrong]
        rng.shuffle(options)
        letters=dict(zip("ABCD",options))
        right=next(key for key,value in letters.items() if value==answer)
        result.append({
            "id":str(uuid4()),"topic":topic,"question":question,
            "options":letters,"correct":right,"explanation":answer,
            "source":source,"page":page,
            "source_document_id":str(source_doc) if source_doc else None,
        })
    return result


def public_exam(questions):
    """No incluye la clave correcta, la explicación ni la respuesta original."""
    return [
        {"id":q["id"],"topic":q["topic"],"question":q["question"],
         "options":q["options"]}
        for q in questions
    ]


def grade_exam(questions,answers):
    feedback=[]
    correct=0
    for q in questions:
        selected=answers.get(q["id"])
        is_correct=selected==q["correct"]
        correct+=int(is_correct)
        feedback.append({
            "id":q["id"],"question":q["question"],"selected":selected,
            "correct":is_correct,"correct_option":q["correct"],
            "explanation":q["explanation"],
            "source":q["source"],"page":q["page"],
        })
    return correct,feedback


class StartBody(BaseModel):
    topic: str = Field(default="",max_length=110)
    count: int = Field(default=5,ge=3,le=5)


class SubmitBody(BaseModel):
    answers: dict[str,str] = Field(min_length=1,max_length=5)


@router.post("/start",status_code=201)
def start_exam(body:StartBody,user=Depends(current_user)):
    uid=user["id"]
    with psycopg.connect(database_url(),connect_timeout=10) as conn:
        prepare_study(conn)
        prepare(conn)
        # Cuota para proteger el plan gratuito: 5 evaluaciones al día.
        conn.execute("SELECT pg_advisory_xact_lock(89138,hashtext(%s))",(str(uid),))
        taken=conn.execute(
            "SELECT count(*) FROM public.conauti_study_exams "
            "WHERE user_id=%s AND created_at::date=CURRENT_DATE",
            (uid,),
        ).fetchone()[0]
        if taken>=5:
            raise HTTPException(429,"Has alcanzado el máximo de cinco evaluaciones diarias.")
        sql=(
            "SELECT id,topic,question,answer,source_name,source_page,source_document_id "
            "FROM public.conauti_study_cards WHERE user_id=%s"
        )
        args=[uid]
        if body.topic.strip():
            sql+=" AND lower(topic)=lower(%s)"
            args.append(body.topic.strip())
        sql+=" ORDER BY due_at,created_at LIMIT 50"
        rows=conn.execute(sql,tuple(args)).fetchall()
        try:
            questions=make_exam(rows,body.count)
        except ValueError as exc:
            raise HTTPException(422,str(exc)) from exc
        exam_id=uuid4()
        conn.execute(
            "INSERT INTO public.conauti_study_exams(id,user_id,topic,questions,total) "
            "VALUES (%s,%s,%s,%s,%s)",
            (exam_id,uid,body.topic.strip() or "Repaso general",
             Jsonb(questions),len(questions)),
        )
    return {"id":str(exam_id),"topic":body.topic.strip() or "Repaso general",
            "questions":public_exam(questions),"total":len(questions)}


@router.post("/{exam_id}/submit")
def submit_exam(exam_id:UUID,body:SubmitBody,user=Depends(current_user)):
    uid=user["id"]
    with psycopg.connect(database_url(),connect_timeout=10) as conn:
        prepare(conn)
        row=conn.execute(
            "SELECT questions,submitted_at FROM public.conauti_study_exams "
            "WHERE id=%s AND user_id=%s FOR UPDATE",(exam_id,uid),
        ).fetchone()
        if not row:
            raise HTTPException(404,"Evaluación no encontrada.")
        questions,submitted=row
        if submitted is not None:
            raise HTTPException(409,"Esta evaluación ya fue registrada.")
        allowed={q["id"] for q in questions}
        if set(body.answers)!=allowed:
            raise HTTPException(422,"Responde todas las preguntas para finalizar.")
        if any(answer not in ("A","B","C","D") for answer in body.answers.values()):
            raise HTTPException(422,"Opción de respuesta inválida.")
        score,feedback=grade_exam(questions,body.answers)
        conn.execute(
            "UPDATE public.conauti_study_exams SET score=%s,submitted_at=now() "
            "WHERE id=%s AND user_id=%s",(score,exam_id,uid),
        )
    return {"score":score,"total":len(questions),
            "percentage":round(score/max(1,len(questions))*100),
            "feedback":feedback,
            "recommendation":(
                "Repasa las tarjetas que no recordaste y vuelve a intentarlo."
                if score<len(questions)*.7 else
                "Buen progreso. Explica con tus palabras lo aprendido."
            )}


@router.get("/history")
def history(limit:int=Query(default=12,ge=1,le=30),user=Depends(current_user)):
    with psycopg.connect(database_url(),connect_timeout=10) as conn:
        prepare(conn)
        rows=conn.execute(
            "SELECT id,topic,score,total,submitted_at "
            "FROM public.conauti_study_exams "
            "WHERE user_id=%s AND submitted_at IS NOT NULL "
            "ORDER BY submitted_at DESC LIMIT %s",
            (user["id"],limit),
        ).fetchall()
    return {"exams":[{
        "id":str(row[0]),"topic":row[1],"score":row[2],
        "total":row[3],"percentage":round(row[2]/row[3]*100),
        "date":row[4].isoformat(),
    } for row in rows]}
