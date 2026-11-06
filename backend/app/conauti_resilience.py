"""Retries acotados y fallback explícito para el tutor.

No reintentamos 429, autenticación ni errores del usuario, para no agotar
las cuotas gratuitas. Un único intento adicional solo ante errores transitorios.
"""
from __future__ import annotations

import time
from typing import Any, Callable

import httpx


def status_code(error: BaseException) -> int | None:
    response = getattr(error, "response", None)
    raw = (getattr(error, "status_code", None) or getattr(error, "code", None)
           or getattr(response, "status_code", None))
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def is_transient(error: BaseException) -> bool:
    code = status_code(error)
    if code in (408, 500, 502, 503, 504):
        return True
    if code in (400, 401, 403, 404, 413, 422, 429):
        return False
    return isinstance(error, (TimeoutError, ConnectionError,
                              httpx.ConnectError, httpx.ConnectTimeout,
                              httpx.ReadTimeout))


def call_with_recovery(primary: Callable[[], Any],
                       fallback: Callable[[], Any] | None = None) -> Any:
    """Máximo dos solicitudes. El fallback solo ocurre si está configurado."""
    try:
        return primary()
    except Exception as first:
        if not is_transient(first):
            raise
        time.sleep(0.4)
        if fallback is not None:
            return fallback()
        return primary()
