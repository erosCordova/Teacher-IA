from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.conauti_auth import connect


suffix = uuid4().hex[:10]
username = "voztest_" + suffix
password = "ClaveEducativaVoz2026!"
route = "/api/conauti/voice/transcribe"
audio = b"RIFF" + b"\x00" * 1700

total = 0


def check(name, condition):
    global total

    if not condition:
        raise AssertionError(name)

    total += 1
    print(f"{name}=OK", flush=True)


try:
    with TestClient(
        app,
        raise_server_exceptions=False,
    ) as client:

        response = client.post(
            "/api/conauti/auth/register",
            json={
                "username": username,
                "password": password,
            },
        )

        check("REGISTRO", response.status_code == 201)

        response = client.post(
            "/api/conauti/auth/login",
            json={
                "username": username,
                "password": password,
            },
        )

        check("LOGIN", response.status_code == 200)

        headers = {
            "Authorization":
                "Bearer " + response.json()["access_token"]
        }

        response = client.get(
            "/api/conauti/voice/status",
            headers=headers,
        )

        check(
            "API_VOZ",
            response.status_code == 200,
        )

        check(
            "AUDIO_NO_GUARDADO",
            response.json().get("audio_saved") is False,
        )

        check(
            "REVISION_TEXTO",
            response.json().get("review_required") is True,
        )

        response = client.post(
            route,
            content=audio,
            headers={"Content-Type": "audio/wav"},
        )

        check(
            "SIN_AUTENTICACION_BLOQUEADO",
            response.status_code == 401,
        )

        response = client.post(
            route,
            content=audio,
            headers={
                **headers,
                "Content-Type": "text/plain",
            },
        )

        check(
            "FORMATO_INVALIDO_BLOQUEADO",
            response.status_code == 415,
        )

        response = client.post(
            route,
            content=b"123",
            headers={
                **headers,
                "Content-Type": "audio/wav",
            },
        )

        check(
            "AUDIO_CORTO_RECHAZADO",
            response.status_code == 422,
        )

        phrases = [
            "¿Qué son las fracciones?",
            "Explícame el sistema solar.",
            "Dame una pista de matemáticas.",
        ]

        with patch(
            "app.conauti_voice.recognize",
            new_callable=AsyncMock,
        ) as provider:

            for number, phrase in enumerate(phrases, 1):
                provider.return_value = phrase

                response = client.post(
                    route,
                    content=audio,
                    headers={
                        **headers,
                        "Content-Type": "audio/wav",
                    },
                )

                check(
                    f"TRANSCRIPCION_{number}",
                    response.status_code == 200
                    and response.json().get("text") == phrase
                    and response.json().get("review_required") is True,
                )

            check(
                "TRES_LLAMADAS_AL_RECONOCEDOR",
                provider.await_count == 3,
            )

        with connect() as conn:
            result = conn.execute(
                """
                SELECT
                    (SELECT COUNT(*)
                     FROM conauti_voice_usage v
                     JOIN conauti_users u
                       ON u.id = v.user_id
                     WHERE u.username = %s
                    ) AS uses,
                    (SELECT COUNT(*)
                     FROM conauti_messages m
                     JOIN conauti_conversations c
                       ON c.id = m.conversation_id
                     JOIN conauti_users u
                       ON u.id = c.user_id
                     WHERE u.username = %s
                    ) AS messages
                """,
                (username, username),
            ).fetchone()

        check(
            "USOS_REGISTRADOS",
            result["uses"] == 3,
        )

        check(
            "SIN_ENVIO_AUTOMATICO_AL_CHAT",
            result["messages"] == 0,
        )

    print("==========================================")
    print("PRUEBAS_F08=APROBADAS")
    print(f"COMPROBACIONES={total}")
    print("MICROFONO_REAL=PENDIENTE_VALIDACION")

finally:
    with connect() as conn:
        conn.execute(
            """
            DELETE FROM conauti_users
            WHERE username = %s
            """,
            (username,),
        )

    print("CUENTA_TEMPORAL=ELIMINADA")
