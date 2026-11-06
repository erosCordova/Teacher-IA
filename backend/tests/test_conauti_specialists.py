from app.conauti_specialists import subject_for, specialist_instructions
from app.conauti_orchestrator import assign_specialist, select_route, GRAPH


def test_specialists_understand_spanish_educational_topics():
    assert subject_for("No entiendo las ecuaciones cuadráticas") == "matemáticas"
    assert subject_for("Dibuja una célula y su membrana") == "ciencias"
    assert subject_for("Necesito practicar speaking en inglés") == "inglés"
    assert subject_for("Ayúdame con la ortografía") == "comunicación"
    assert subject_for("¿Qué pasó con la independencia del Perú?") == "humanidades"
    assert subject_for("Hola, ¿cómo estás?") == "general"


def test_specialist_instructions_are_educational_and_safe():
    subject,instructions=specialist_instructions("Una ecuación de segundo grado")
    assert subject=="matemáticas"
    assert "evita resolver automáticamente" in instructions
    state=assign_specialist({"question":"Explícame la fotosíntesis"})
    assert state["subject"]=="ciencias"
    assert "observaciones" in state["specialist_rules"]


def test_langgraph_routes_to_specialist_without_extra_llm_call():
    assert select_route({"intent":"guided"})=="especialista"
    assert select_route({"intent":"full_solution"})=="proteger"
    graph=GRAPH.get_graph()
    assert "especialista" in graph.nodes
