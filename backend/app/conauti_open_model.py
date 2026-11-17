"""Transporte acotado para modelos abiertos; nunca cambia a un modelo de pago."""
from __future__ import annotations

import httpx

FREE_MODEL = "qwen/qwen3-4b:free"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def _config(name: str, default: str = "") -> str:
    # Importación diferida: conauti_ai también utiliza este módulo.
    from app.conauti_ai import config
    return config(name) or default


def provider_name() -> str:
    return _config("AI_PROVIDER", "gemini").strip().casefold()


def active_details() -> tuple[str, str, bool]:
    provider = provider_name()
    if provider == "openrouter":
        model = _config("OPENROUTER_MODEL", FREE_MODEL)
        return "OpenRouter", model, bool(_config("OPENROUTER_API_KEY")) and model == FREE_MODEL
    if provider == "ollama":
        from app.conauti_local_model import local_enabled, local_model
        try:
            model = local_model()
        except ValueError:
            return "Ollama", "configuración inválida", False
        return "Ollama", model, local_enabled() and _is_qwen(model)
    from app.conauti_ai import current_model
    return "Gemini", current_model(), bool(_config("GEMINI_API_KEY"))


def _is_qwen(model: str) -> bool:
    # Estas variantes de Qwen3 están publicadas bajo Apache 2.0.
    return model in {"qwen3:0.6b", "qwen3:1.7b", "qwen3:4b", "qwen3:8b"}


def open_reply(history: list[dict], instructions: str, *, max_tokens: int = 350) -> tuple[str, dict]:
    provider = provider_name()
    if provider == "ollama":
        from app.conauti_local_model import local_enabled, local_model, local_reply
        if not local_enabled() or not _is_qwen(local_model()):
            raise ValueError("Configura una variante admitida de Qwen3 en Ollama.")
        return local_reply(history, instructions, max_tokens=max_tokens)

    if provider != "openrouter":
        raise ValueError("El proveedor de modelo abierto no está configurado.")
    model = _config("OPENROUTER_MODEL", FREE_MODEL)
    if model != FREE_MODEL:
        raise ValueError("Solo se admite el modelo Qwen3 gratuito configurado.")
    key = _config("OPENROUTER_API_KEY")
    if not key:
        raise ValueError("Falta configurar la clave del proveedor de IA.")

    messages = [{"role": "system", "content": instructions[:12000]}]
    for item in history[-10:]:
        role = item.get("role")
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": str(item.get("body", ""))[:4000]})

    response = httpx.post(
        OPENROUTER_URL,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": messages,
            "stream": False,
            "temperature": 0.4,
            "reasoning": {"enabled": False},
            "max_tokens": max(32, min(int(max_tokens), 700)),
            "provider": {"data_collection": "deny"},
        },
        timeout=httpx.Timeout(100.0, connect=10.0),
        follow_redirects=False,
        trust_env=False,
    )
    response.raise_for_status()
    data = response.json()
    choices = data.get("choices") or []
    content = choices[0].get("message", {}).get("content") if choices else None
    if not isinstance(content, str) or not content.strip():
        raise ValueError("El modelo abierto no devolvió texto.")
    usage = data.get("usage") or {}
    return content.strip()[:6000], {
        "input_tokens": int(usage.get("prompt_tokens") or 0),
        "output_tokens": int(usage.get("completion_tokens") or 0),
    }
