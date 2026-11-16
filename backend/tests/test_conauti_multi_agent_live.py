import os
import pytest

from app.conauti_multi_agent import run_open_graph


@pytest.mark.skipif(os.getenv("CONAUTI_LIVE_OLLAMA") != "true", reason="Prueba de modelo real solo en CI.")
def test_qwen_real_runs_through_all_agents():
    result, usage = run_open_graph(
        [{"role": "user", "body": "¿Qué es una fracción? Explícamelo brevemente."}],
        "Explica el concepto en español con un ejemplo sencillo.",
        "Eres un tutor educativo que responde en español.",
    )
    assert isinstance(result, str)
    assert len(result.strip()) >= 5
    assert usage["input_tokens"] > 0
    assert usage["output_tokens"] > 0
