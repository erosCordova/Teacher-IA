"""Especialistas pedagógicos ligeros para LangGraph.

Clasificación determinista y transparente; no requiere llamadas adicionales
al modelo ni almacena información del estudiante.
"""
from __future__ import annotations

import re
import unicodedata


def simplify(value: str) -> str:
    text = unicodedata.normalize("NFKD", value.casefold())
    return "".join(c for c in text if not unicodedata.combining(c))


PATTERNS = (
    ("matemáticas", r"\b(fracciones?|ecuaciones?|algebra|matematicas?|geometria|"
     r"potencias?|porcentajes?|funciones?|derivadas?|integrales?|probabilidad|"
     r"estadistica|calculo|divisiones?|multiplicaciones?|angulos?)\b"),
    ("ciencias", r"\b(biologia|celulas?|organos?|neuronas?|cerebro|"
     r"fotosintesis|sistema nervioso|quimica|atomos?|moleculas?|"
     r"fisica|fuerza|energia|aceleracion|velocidad|electricidad|"
     r"ecosistemas?|mitocondria|planetas?|sistema solar)\b"),
    ("inglés", r"\b(ingles|english|pronunciacion|listening|speaking|"
     r"vocabulario en ingles|verbos irregulares|present simple|past simple)\b"),
    ("comunicación", r"\b(gramatica|ortografia|redaccion|texto argumentativo|"
     r"comprension lectora|literatura|narracion|sintaxis|"
     r"adjetivos?|adverbios?|sustantivos?)\b"),
    ("humanidades", r"\b(historia|geografia|cultura|peru|"
     r"imperio|independencia|civilizacion|continentes?|"
     r"revolucion|democracia|fuentes historicas)\b"),
)

STRATEGIES = {
    "matemáticas": (
        "Especialidad: razonamiento matemático. Diferencia definiciones, "
        "operaciones y comprobaciones. Pide primero el intento del estudiante; "
        "señala el siguiente paso y evita resolver automáticamente la tarea. "
        "Comprueba signos, unidades y supuestos cuando correspondan."
    ),
    "ciencias": (
        "Especialidad: ciencias naturales. Explica mecanismos y relaciones "
        "causa-efecto, separa observaciones de hipótesis y evita datos inventados. "
        "Usa ejemplos seguros y comprobables. Para diagramas, identifica "
        "sus etiquetas y limita las afirmaciones a lo observado."
    ),
    "inglés": (
        "Especialidad: inglés. Puedes conversar en inglés cuando la actividad "
        "lo solicite, pero explica instrucciones y correcciones en español. "
        "Adapta vocabulario al nivel y practica pronunciación sin afirmar "
        "haber escuchado sonidos que no estén disponibles."
    ),
    "comunicación": (
        "Especialidad: comunicación. Enseña comprensión, coherencia y gramática "
        "con ejemplos breves. Da retroalimentación sobre ideas y estructura, "
        "con preguntas que ayuden al estudiante a mejorar sus propios textos."
    ),
    "humanidades": (
        "Especialidad: historia y ciencias sociales. Distingue hechos "
        "verificados de interpretaciones, evita fechas sin fundamento "
        "y relaciona procesos con su contexto. Cuando haya fuentes "
        "recuperadas, indica documento y página."
    ),
    "general": (
        "Especialidad: tutoría integral. Identifica el objetivo académico, "
        "explica claramente y comprueba la comprensión con una pregunta."
    ),
}


def subject_for(question: str) -> str:
    text = simplify(str(question)[:1700])
    for domain, pattern in PATTERNS:
        if re.search(pattern, text):
            return domain
    return "general"


def specialist_instructions(question: str) -> tuple[str, str]:
    subject = subject_for(question)
    return subject, STRATEGIES[subject]
