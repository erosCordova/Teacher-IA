import pytest

from app.conauti_rag import (
    cosine, document_pages, lexical_score, make_excerpt, search_chunks,
    split_chunks, validate_filename,
)


def test_chunking_is_bounded_and_retains_pages():
    chunks = split_chunks([(1, "Sistema nervioso simpático. " * 90),
                           (2, "Sistema parasimpático. " * 85)])
    assert 2 < len(chunks) < 48
    assert [c["ordinal"] for c in chunks] == list(range(len(chunks)))
    assert {c["page"] for c in chunks} == {1, 2}
    assert all(len(c["text"]) <= 950 for c in chunks)


def test_retrieval_rejects_unrelated_document():
    chunks = [{"page": 2, "ordinal": 0, "text": "La fotosíntesis usa luz y clorofila."},
              {"page": 4, "ordinal": 1, "text": "El corazón bombea sangre."}]
    selected = search_chunks("¿Qué hace el corazón?", chunks)
    assert len(selected) == 1
    assert selected[0]["page"] == 4
    assert search_chunks("mitocondria", chunks) == []


def test_retrieval_accepts_unicode_accents():
    assert lexical_score("¿Qué es una célula?", "La celula contiene un núcleo.") > 0


def test_citations_are_explicit():
    selected = [{"page": 3, "ordinal": 0, "text": "Las plantas absorben agua."}]
    assert "[Fuente: leccion.pdf; página 3]" in make_excerpt(selected, "leccion.pdf")


def test_cosine_requires_matching_model_dimensions():
    assert cosine([1,0], [1,0]) == 1
    assert cosine([1,0], [1,0,1]) == 0


def test_restricted_format_and_no_executable():
    with pytest.raises(ValueError):
        validate_filename("../malware.exe")
    assert validate_filename("../../apunte.pdf") == "apunte.pdf"


def test_document_text_is_not_persisted_by_parser():
    pages = document_pages("tema.txt", b"La materia tiene energia.")
    assert pages == [(1, "La materia tiene energia.")]
