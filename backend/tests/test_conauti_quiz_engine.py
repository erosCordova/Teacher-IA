import random
from uuid import uuid4
from app.conauti_quiz_engine import make_exam, public_exam, grade_exam, SCHEMA


def rows():
    return [
        (uuid4(),"biología","¿Qué hace la membrana?","Regula el intercambio","",None),
        (uuid4(),"física","¿Qué es la fuerza?","Una interacción que puede cambiar el movimiento","",None),
        (uuid4(),"matemáticas","¿Qué significa sumar?","Combinar cantidades","",None),
        (uuid4(),"historia","¿Qué es una fuente histórica?","Un testimonio del pasado","",None),
        (uuid4(),"geografía","¿Qué representa un mapa?","Una representación de un espacio","",None),
        (uuid4(),"inglés","¿Qué es un sustantivo?","Una palabra que nombra entidades","",None),
    ]


def test_quiz_never_exposes_answers_before_submission():
    data=make_exam(rows(),5,random.Random(4))
    assert len(data)==5
    public=public_exam(data)
    assert set(public[0])=={"id","topic","question","options"}
    assert "correct" not in public[0] and "explanation" not in public[0]
    assert all(len(q["options"])==4 for q in public)
    assert all(q["correct"] in "ABCD" for q in data)


def test_scoring_is_server_side():
    data=make_exam(rows(),4,random.Random(7))
    answers={q["id"]:q["correct"] for q in data}
    score,feedback=grade_exam(data,answers)
    assert score==4
    assert all(x["correct"] for x in feedback)
    wrong={q["id"]:"A" if q["correct"]!="A" else "B" for q in data}
    score,_=grade_exam(data,wrong)
    assert score==0


def test_rejects_too_few_distinct_answers():
    same=[(uuid4(),"t","¿Pregunta diferente número "+str(i)+"?","Igual","","") for i in range(5)]
    try:
        make_exam(same,5,random.Random(1))
        assert False, "No debe construir un examen con una sola respuesta."
    except ValueError:
        pass


def test_table_is_owned_by_student_and_cascades_on_account_deletion():
    assert "user_id uuid NOT NULL REFERENCES public.conauti_users(id) ON DELETE CASCADE" in SCHEMA
