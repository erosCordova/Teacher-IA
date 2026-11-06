"""Herramientas tipadas de LangChain para el agente educativo.

No ejecutan código del estudiante ni acceden a datos de otros usuarios.
"""
import ast
import operator
import re
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

_OPERATIONS = {
    ast.Add: operator.add, ast.Sub: operator.sub,
    ast.Mult: operator.mul, ast.Div: operator.truediv,
}


class ExpressionArgs(BaseModel):
    expresion: str = Field(
        min_length=3, max_length=70,
        description="Operación aritmética simple para verificar un intento."
    )


def _eval_tree(node, depth=0):
    if depth > 7:
        raise ValueError("La expresión es demasiado compleja.")
    if isinstance(node, ast.Expression):
        return _eval_tree(node.body, depth+1)
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        if abs(node.value) > 1e6:
            raise ValueError("Número fuera de rango.")
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        value = _eval_tree(node.operand, depth+1)
        return value if isinstance(node.op, ast.UAdd) else -value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPERATIONS:
        left, right = _eval_tree(node.left, depth+1), _eval_tree(node.right, depth+1)
        if right == 0 and isinstance(node.op, ast.Div):
            raise ValueError("No se puede dividir entre cero.")
        value = _OPERATIONS[type(node.op)](left, right)
        if abs(value) > 1e8:
            raise ValueError("Resultado fuera de rango.")
        return value
    raise ValueError("Operación no permitida.")


def evaluate_arithmetic(expresion: str) -> dict:
    if not re.fullmatch(r"[\d\s.,+\-*/()]+", expresion):
        raise ValueError("Solo se admiten números y operaciones básicas.")
    normalized = expresion.replace(",", ".")
    result = _eval_tree(ast.parse(normalized, mode="eval"))
    return {"resultado_de_comprobacion": round(float(result), 6),
            "mensaje": "Dato interno de revisión: orienta al estudiante sin darle la solución final."}


verificar_operacion = StructuredTool.from_function(
    name="verificar_operacion",
    func=evaluate_arithmetic,
    description="Comprueba una operación breve durante la revisión guiada de un intento.",
    args_schema=ExpressionArgs,
)


class StrategyArgs(BaseModel):
    tema: str = Field(min_length=3, max_length=100)


def next_learning_step(tema: str) -> dict:
    return {
        "objetivo": tema.strip()[:100],
        "pasos": [
            "Identificar los conocimientos previos.",
            "Pedir un intento al estudiante.",
            "Ofrecer una pista si hay dificultades.",
            "Comprobar la comprensión antes de avanzar.",
        ],
    }


planificar_refuerzo = StructuredTool.from_function(
    name="planificar_refuerzo",
    func=next_learning_step,
    description="Propone pasos pedagógicos para reforzar un tema sin resolver tareas.",
    args_schema=StrategyArgs,
)


EDUCATIONAL_TOOLS = [verificar_operacion, planificar_refuerzo]


def tool_catalog() -> list[dict]:
    return [{"name": tool.name, "description": tool.description}
            for tool in EDUCATIONAL_TOOLS]
