import asyncio
import io
import os

import pytest

from app import conauti_open_media as media


@pytest.mark.skipif(os.getenv("CONAUTI_LIVE_WHISPER") != "true", reason="Prueba real de voz solo en CI.")
def test_whisper_transcribes_generated_spanish_audio():
    if os.getenv("CONAUTI_FULL_APP") == "true":
        from app.main import app
        assert app is not None
    path = os.environ["CONAUTI_TEST_AUDIO"]
    with open(path, "rb") as source:
        result = asyncio.run(media.transcribe_open(source.read()))
    assert len(result.strip()) >= 3


@pytest.mark.skipif(os.getenv("CONAUTI_LIVE_VISION") != "true", reason="Prueba real de visión solo en CI.")
def test_qwen_vision_identifies_the_generated_red_image():
    from PIL import Image
    image = Image.new("RGB", (128, 128), color=(255, 0, 0))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    result, model = asyncio.run(media.analyze_open_image(
        buffer.getvalue(), "image/png", "¿Qué color ves?", "",
        "Responde en español y menciona el color visible.",
    ))
    assert model == media.LOCAL_VISION_MODEL
    assert "roj" in result.lower()
