from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.conauti_auth import connect
from app.conauti_ai import config


def check(value, name):
    if not value:
        raise AssertionError(name)
    print(f"{name}=OK", flush=True)


suffix = uuid4().hex[:10]
username_a = "ia_a_" + suffix
username_b = "ia_b_" + suffix
password = "ClaveEducativaSegura2026!"

try:
    with TestClient(app, raise_server_exceptions=False) as client:
        headers = {}

        for username in (username_a, username_b):
            r = client.post(
                "/api/conauti/auth/register",
                json={
                    "username": username,
                    "password": password,
                },
            )
            check(r.status_code == 201, "REGISTRO")

            r = client.post(
                "/api/conauti/auth/login",
                json={
                    "username": username,
                    "password": password,
                },
            )
            check(r.status_code == 200, "LOGIN")

            headers[username] = {
                "Authorization":
                    "Bearer " + r.json()["access_token"]
            }

        a = headers[username_a]
        b = headers[username_b]

        r = client.post(
            "/api/conauti/conversations",
            headers=a,
            json={"title": "Prueba IA educativa"},
        )

        check(r.status_code == 201, "CONVERSACION")
        cid = r.json()["id"]

        route = f"/api/conauti/ai/conversations/{cid}/respond"
        identifier = str(uuid4())
        payload = {
            "request_id": identifier,
            "text": "Ayúdame con fracciones",
        }

        mock_answer = (
            "Primero piensa en qué representan "
            "el numerador y el denominador.",
            {
                "input_tokens": 20,
                "output_tokens": 18,
            },
        )

        with patch(
            "app.conauti_ai.generate_reply",
            return_value=mock_answer,
        ) as provider:

            r = client.post(
                route,
                headers=a,
                json=payload,
            )

            check(
                r.status_code == 200
                and r.json()["user_message"]["role"] == "user"
                and r.json()["assistant_message"]["role"] == "assistant",
                "RESPUESTA_Y_MENSAJES",
            )

            original = r.json()

            r = client.post(
                route,
                headers=a,
                json=payload,
            )

            check(
                r.status_code == 200
                and r.json()["reused"]
                and r.json()["assistant_message"]["id"]
                == original["assistant_message"]["id"],
                "IDEMPOTENCIA",
            )

            check(
                provider.call_count == 1,
                "SIN_SEGUNDA_LLAMADA_AL_PROVEEDOR",
            )

        r = client.post(
            route,
            headers=b,
            json={
                "request_id": str(uuid4()),
                "text": "Consulta ajena",
            },
        )

        check(
            r.status_code == 404,
            "CONVERSACION_AJENA_BLOQUEADA",
        )

        r = client.post(
            route,
            json={
                "request_id": str(uuid4()),
                "text": "Consulta sin sesión",
            },
        )

        check(
            r.status_code == 401,
            "SIN_AUTENTICACION_BLOQUEADO",
        )

        with patch(
            "app.conauti_ai.generate_reply",
            side_effect=RuntimeError("Fallo simulado"),
        ):
            try:
                client.post(
                    route,
                    headers=a,
                    json={
                        "request_id": str(uuid4()),
                        "text": "Consulta con falla simulada",
                    },
                )
            except RuntimeError:
                pass

        with connect() as conn:
            total = conn.execute(
                """
                SELECT COUNT(*) AS total
                FROM conauti_messages
                WHERE conversation_id = %s
                """,
                (cid,),
            ).fetchone()["total"]

        check(
            total == 2,
            "SIN_MENSAJES_FALSOS_TRAS_ERROR",
        )

        r = client.get(
            "/api/conauti/ai/status",
            headers=a,
        )

        check(
            r.status_code == 200
            and r.json()["provider"] == "Gemini",
            "ESTADO_PROVEEDOR",
        )

    print("PRUEBAS_SIMULADAS=EXITOSAS", flush=True)

    if config("GEMINI_API_KEY"):
        print("===== PRUEBA CON PROVEEDOR REAL =====", flush=True)

        with TestClient(
            app, raise_server_exceptions=False
        ) as client:
            auth = client.post(
                "/api/conauti/auth/login",
                json={
                    "username": username_a,
                    "password": password,
                },
            )

            real_headers = {
                "Authorization":
                    "Bearer " + auth.json()["access_token"]
            }

            r = client.post(
                route,
                headers=real_headers,
                json={
                    "request_id": str(uuid4()),
                    "text":
                        "Soy estudiante de secundaria. "
                        "Explícame qué es una fracción "
                        "con un ejemplo sencillo.",
                },
            )

            check(
                r.status_code == 200
                and len(
                    r.json()["assistant_message"]["body"]
                ) >= 25,
                "RESPUESTA_PROVEEDOR_REAL",
            )

        print("IA_REAL=VALIDADA", flush=True)

    else:
        print("IA_REAL=PENDIENTE_DE_CLAVE_API", flush=True)

finally:
    with connect() as conn:
        conn.execute(
            """
            DELETE FROM conauti_users
            WHERE username = ANY(%s)
            """,
            ([username_a, username_b],),
        )

    print("CUENTAS_TEMPORALES=LIMPIADAS", flush=True)
