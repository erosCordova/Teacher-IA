"""Proveedor local optativo para sesiones de desarrollo con Ollama.

No se ejecuta en Render Free: requiere Ollama instalado en la misma máquina.
Nunca se aceptan URLs aportadas por estudiantes (previene SSRF).
"""
from __future__ import annotations
import os
import re
import httpx


def local_enabled() -> bool:
    from app.conauti_ai import config
    return (config("OLLAMA_ENABLED", "false").lower() == "true"
            and config("AI_PROVIDER", "gemini").lower() == "ollama")


def local_model() -> str:
    from app.conauti_ai import config
    model = config("OLLAMA_MODEL", "qwen3:4b").strip()
    if not re.fullmatch(r"[\w.:-]{2,70}", model):
        raise ValueError("Modelo local no válido.")
    return model


def local_reply(history: list[dict], instructions: str, *, max_tokens: int = 650) -> tuple[str,dict]:
    if not local_enabled():
        raise RuntimeError("El proveedor local no está habilitado.")
    messages = [{"role": "system", "content": instructions[:12000]}]
    for entry in history[-10:]:
        role = entry.get("role")
        if role in ("user","assistant"):
            messages.append({"role":role, "content":str(entry.get("body", ""))[:3000]})
    answer = httpx.post(
        "http://127.0.0.1:11434/api/chat",
        json={"model": local_model(), "stream": False, "think": False, "messages": messages,
              "options": {"temperature": 0.4, "num_predict": max(32, min(int(max_tokens), 700))}},
        timeout=180.0,
        trust_env=False,
    )
    answer.raise_for_status()
    result = answer.json()
    text = result.get("message", {}).get("content", "")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("El modelo local no devolvió contenido.")
    return text[:6000], {
        "input_tokens": int(result.get("prompt_eval_count", 0) or 0),
        "output_tokens": int(result.get("eval_count", 0) or 0),
    }
