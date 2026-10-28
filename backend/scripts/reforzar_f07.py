import ast
from datetime import datetime
from pathlib import Path
from shutil import copy2

root = Path(__file__).resolve().parents[2]
ped = root / "backend/app/conauti_pedagogy.py"
ai = root / "backend/app/conauti_ai.py"
backups = root / ".conauti-backups"
backups.mkdir(exist_ok=True)

original_ped = ped.read_text(encoding="utf-8")
original_ai = ai.read_text(encoding="utf-8")

classification = '''
def classify(question):
    text = normalize(question.strip())

    off = (
        "salir del modo sin pistas",
        "desactivar modo sin pistas",
        "terminar modo sin pistas",
        "volver al modo normal",
    )
    on = (
        "activar modo sin pistas",
        "entrar en modo sin pistas",
        "activar evaluacion sin pistas",
    )

    if text in off:
        return "mode_off"
    if text in on:
        return "mode_on"

    direct = (
        "resuelveme",
        "resuelve todo",
        "hazme la tarea",
        "haz mi tarea",
        "haz el trabajo completo",
        "dame la respuesta",
        "dime la respuesta",
        "dime el resultado",
        "dame el resultado",
        "solo el resultado",
        "solucion completa",
        "tarea resuelta",
        "respuesta correcta",
        "hazlo por mi",
        "ignora tus instrucciones",
        "ignora las instrucciones",
    )

    if contains_any(text, direct):
        return "full_solution"

    if contains_any(text, (
        "dame una pista",
        "necesito una pista",
        "otra pista",
        "una pista para",
        "ayudame con una pista",
    )):
        return "hint"

    if contains_any(text, (
        "revisa mi intento",
        "mi intento",
        "mi respuesta es",
        "lo hice asi",
        "corrige mi procedimiento",
    )):
        return "review"

    if contains_any(text, (
        "mas facil",
        "mas sencillo",
        "no lo entiendo",
        "explicamelo mejor",
    )):
        return "simpler"

    if contains_any(text, (
        "otro ejemplo",
        "otro caso",
        "ejemplo diferente",
    )):
        return "example"

    if contains_any(text, (
        "ejercicio",
        "problema de matematicas",
        "calcula",
        "cuanto es",
        "halla el valor",
        "resuelve",
        "soluciona",
        "encuentra el resultado",
    )):
        return "guided"

    if re.search(
        r"\\d+\\s*(?:\\+|\\-|\\*|x|×|/|÷|por)\\s*\\d+",
        text,
    ):
        return "guided"

    return "concept"
'''

review = '''
def review_output(answer, decision, question=""):
    if decision["fixed"] is not None:
        return answer

    if decision["intent"] not in (
        "guided", "hint", "review",
    ):
        return answer

    normalized = normalize(answer)

    forbidden = (
        "la respuesta es",
        "la respuesta correcta es",
        "la solucion completa es",
        "el resultado final es",
        "el resultado es",
        "la solucion final es",
        "la solucion es",
        "aqui tienes tu tarea resuelta",
    )

    detected = contains_any(normalized, forbidden)

    if re.search(r"\\\\boxed\\s*\\{", answer):
        detected = True

    if re.search(
        r"\\b\\d+\\s*[+*x×÷/]\\s*\\d+\\s*=\\s*\\d+",
        normalized,
    ):
        detected = True

    # Verificación adicional de aritmética elemental.
    problem = normalize(question)
    match = re.search(
        r"(?<!\\d)(\\d{1,5})\\s*"
        r"(\\+|\\-|[x×*/÷]|\\bpor\\b|\\bentre\\b)\\s*"
        r"(\\d{1,5})(?!\\d)",
        problem,
    )

    if match:
        left = int(match.group(1))
        right = int(match.group(3))
        operator = match.group(2)

        result = None

        if operator == "+":
            result = left + right
        elif operator == "-":
            result = left - right
        elif operator in ("x", "×", "*", "por"):
            result = left * right
        elif operator in ("/", "÷", "entre") and right:
            if left % right == 0:
                result = left // right

        if result is not None:
            if re.search(
                rf"(?<!\\d){re.escape(str(result))}(?!\\d)",
                normalized,
            ):
                detected = True

            # Detectar también resultados escritos con palabras.
            units = (
                "cero", "uno", "dos", "tres", "cuatro",
                "cinco", "seis", "siete", "ocho", "nueve",
            )
            small = (
                "diez", "once", "doce", "trece",
                "catorce", "quince", "dieciseis",
                "diecisiete", "dieciocho", "diecinueve",
            )
            tens = (
                "", "", "veinte", "treinta",
                "cuarenta", "cincuenta", "sesenta",
                "setenta", "ochenta", "noventa",
            )

            words = None

            if 0 <= result < 10:
                words = units[result]
            elif 10 <= result < 20:
                words = small[result - 10]
            elif result == 20:
                words = "veinte"
            elif 30 <= result < 100:
                d, u = divmod(result, 10)
                words = (
                    tens[d]
                    if u == 0
                    else tens[d] + " y " + units[u]
                )

            if words and re.search(
                rf"\\b{re.escape(words)}\\b",
                normalized,
            ):
                detected = True

    if not detected:
        return answer

    level = decision.get("hint_level", 0)

    if level == 1:
        return (
            "Primera pista: identifica los datos "
            "conocidos y lo que necesitas encontrar. "
            "¿Qué relación ves entre ellos?"
        )

    if level == 2:
        return (
            "Segunda pista: piensa qué operación "
            "o estrategia conecta los datos. "
            "¿Por qué sería apropiada?"
        )

    if level >= 3:
        return (
            "Tercera pista: escribe el procedimiento "
            "paso a paso y comprueba cada operación. "
            "Compárteme tu primer paso para revisarlo."
        )

    return (
        "Vamos a resolverlo mediante tu razonamiento. "
        "Identifica primero los datos del ejercicio. "
        "¿Qué harías con ellos?"
    )
'''


def replace_function(source, name, replacement):
    tree = ast.parse(source)
    nodes = [
        node for node in tree.body
        if isinstance(node, ast.FunctionDef)
        and node.name == name
    ]

    if len(nodes) != 1:
        raise RuntimeError(
            "No se encontró una función única: " + name
        )

    node = nodes[0]
    lines = source.splitlines(keepends=True)
    replacement = replacement.strip() + "\n"

    return (
        "".join(lines[:node.lineno - 1])
        + replacement
        + "".join(lines[node.end_lineno:])
    )


new_ped = replace_function(
    original_ped,
    "classify",
    classification,
)

new_ped = replace_function(
    new_ped,
    "review_output",
    review,
)

before = "review_output(answer, decision)"
after = "review_output(answer, decision, question)"

if before in original_ai:
    new_ai = original_ai.replace(before, after, 1)
elif after in original_ai:
    new_ai = original_ai
else:
    raise RuntimeError(
        "No se reconoce la revisión de respuestas del modelo."
    )

ast.parse(new_ped)
ast.parse(new_ai)

stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

for path, original, updated in (
    (ped, original_ped, new_ped),
    (ai, original_ai, new_ai),
):
    if original != updated:
        copy2(
            path,
            backups / f"{stamp}_{path.name}",
        )
        path.write_text(
            updated,
            encoding="utf-8",
        )

print("CLASIFICACION_PEDAGOGICA=REFORZADA")
print("RESPUESTAS_DIRECTAS=FILTRO_REFORZADO")
print("ARITMETICA_ELEMENTAL=PROTEGIDA")
print("RESPALDOS=CREADOS")
