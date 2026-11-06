from uuid import uuid4
from app.conauti_rag import chat_references, search_chunks

class Result:
    def __init__(self, rows): self.rows = rows
    def fetchone(self): return self.rows
    def fetchall(self): return self.rows

class Connection:
    def __init__(self, rows): self.rows = rows; self.calls = []
    def execute(self, query, params=()):
        self.calls.append((query, params))
        if "to_regclass" in query:
            return Result({"found": "conauti_rag_documents"})
        return Result(self.rows)

def test_references_for_saved_document():
    student = uuid4()
    doc = uuid4()
    conn = Connection([
        {"doc_id":doc,"filename":"Biología.pdf","page":3,"ordinal":0,
         "body":"El corazón bombea sangre por el organismo."},
        {"doc_id":doc,"filename":"Biología.pdf","page":4,"ordinal":1,
         "body":"Las células tienen núcleo."},
    ])
    found = chat_references(conn, student, "¿Qué hace el corazón?")
    assert found["status"] == "matched"
    assert found["sources"] == [{"filename":"Biología.pdf","page":3}]
    assert conn.calls[1][1][0] == student

def test_offtopic_question_does_not_read_context():
    conn = Connection([{"doc_id":uuid4(),"filename":"Manual.pdf","page":2,"ordinal":0,
                        "body":"Las plantas contienen clorofila."}])
    result = chat_references(conn, uuid4(), "Explícame el sistema solar")
    assert result["status"] == "no_match"
    assert not result["sources"]

def test_generic_summaries_allow_document_reference():
    conn = Connection([{"doc_id":uuid4(),"filename":"Manual.pdf","page":1,"ordinal":0,
                        "body":"Administración de tareas escolares."}])
    assert chat_references(conn, uuid4(), "¿Qué dice mi manual?")["status"] == "matched"

def test_generic_explication_is_not_any_document_match():
    chunks = [{"text":"Estructura de la célula.","ordinal":0,"page":1}]
    assert search_chunks("Explica el sistema solar", chunks, allow_generic=False) == []
