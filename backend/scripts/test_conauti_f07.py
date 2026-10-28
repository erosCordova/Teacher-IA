from uuid import uuid4
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.conauti_auth import connect


counter = 0


def check(condition, name):
    global counter

    if not condition:
        raise AssertionError(name)

    counter += 1
    print(f"{name}=OK", flush=True)


suffix = uuid4().hex[:10]
student_a = "ped_a_" + suffix
student_b = "ped_b_" + suffix
password = "ClavePedagogicaSegura2026!"


def send(client, route, headers, text, request_id=None):
    return client.post(
        route,
        headers=headers,
        json={
            "request_id": request_id or str(uuid4()),
            "text": text,
        },
    )


try:
    with TestClient(
        app,
        raise_server_exceptions=False,
    ) as client:

        headers = {}

        for username in (student_a, student_b):
            response = client.post(
                "/api/conauti/auth/register",
                json={
                    "username": username,
                    "password": password,
                },
            )

            check(
                response.status_code == 201,
                "REGISTRO",
            )

            response = client.post(
                "/api/conauti/auth/login",
                json={
                    "username": username,
                    "password": password,
                },
            )

            check(
                response.status_code == 200,
                "AUTENTICACION",
            )

            headers[username] = {
                "Authorization":
                    "Bearer "
                    + response.json()["access_token"]
            }

        a = headers[student_a]
        b = headers[student_b]

        response = client.post(
            "/api/conauti/conversations",
            headers=a,
            json={"title": "Laboratorio pedagógico"},
        )

        check(
            response.status_code == 201,
            "CONVERSACION_CREADA",
        )

        cid = response.json()["id"]

        route = (
            f"/api/conauti/ai/conversations/"
            f"{cid}/respond"
        )

        state_route = (
            f"/api/conauti/pedagogy/"
            f"conversations/{cid}/state"
        )

        with patch(
            "app.conauti_ai.generate_reply"
        ) as provider:

            provider.return_value = (
                "Una fracción representa partes "
                "de un todo.",
                {
                    "input_tokens": 12,
                    "output_tokens": 10,
                },
            )

            response = send(
                client,
                route,
                a,
                "Explícame qué es una fracción.",
            )

            check(
                response.status_code == 200
                and "fracción" in response.json()[
                    "assistant_message"
                ]["body"],
                "EXPLICACION_CONCEPTUAL",
            )

            check(
                provider.call_count == 1,
                "CONCEPTO_CON_MODELO",
            )

            before = provider.call_count

            identifier = str(uuid4())

            response = send(
                client,
                route,
                a,
                "Resuélveme la tarea completa: "
                "¿cuánto es 7 x 8?",
                identifier,
            )

            check(
                response.status_code == 200
                and "56" not in response.json()[
                    "assistant_message"
                ]["body"],
                "TAREA_NO_RESUELTA",
            )

            check(
                provider.call_count == before,
                "REGLA_CRITICA_SIN_MODELO",
            )

            repeated = send(
                client,
                route,
                a,
                "Resuélveme la tarea completa: "
                "¿cuánto es 7 x 8?",
                identifier,
            )

            check(
                repeated.status_code == 200
                and repeated.json()["reused"],
                "SOLICITUD_IDEMPOTENTE",
            )

            response = send(
                client,
                route,
                a,
                "Activar modo sin pistas",
            )

            check(
                response.status_code == 200,
                "ACTIVAR_SIN_PISTAS",
            )

            state = client.get(
                state_route,
                headers=a,
            )

            check(
                state.status_code == 200
                and state.json()["no_hints"],
                "ESTADO_SIN_PISTAS_PERSISTIDO",
            )

            before = provider.call_count

            response = send(
                client,
                route,
                a,
                "Dame una pista para 7 x 8.",
            )

            check(
                response.status_code == 200
                and "56" not in response.json()[
                    "assistant_message"
                ]["body"],
                "PISTA_BLOQUEADA_EN_EVALUACION",
            )

            check(
                provider.call_count == before,
                "SIN_MODELO_DURANTE_EVALUACION",
            )

            response = send(
                client,
                route,
                a,
                "Salir del modo sin pistas",
            )

            check(
                response.status_code == 200,
                "FINALIZAR_EVALUACION",
            )

            provider.return_value = (
                "La respuesta es 56.",
                {
                    "input_tokens": 10,
                    "output_tokens": 8,
                },
            )

            response = send(
                client,
                route,
                a,
                "Dame una pista para 7 x 8.",
            )

            check(
                response.status_code == 200
                and "56" not in response.json()[
                    "assistant_message"
                ]["body"],
                "FILTRO_DE_SOLUCION_DIRECTA",
            )

            state = client.get(
                state_route,
                headers=a,
            )

            check(
                state.status_code == 200
                and not state.json()["no_hints"]
                and state.json()["hint_level"] == 1,
                "PRIMER_NIVEL_DE_PISTA",
            )

            provider.return_value = (
                "Identifica primero los datos conocidos.",
                {
                    "input_tokens": 12,
                    "output_tokens": 12,
                },
            )

            response = send(
                client,
                route,
                a,
                "Necesito otra pista.",
            )

            check(
                response.status_code == 200,
                "SEGUNDA_PISTA",
            )

            state = client.get(
                state_route,
                headers=a,
            )

            check(
                state.json()["hint_level"] == 2,
                "PROGRESION_DE_PISTAS",
            )

            check(
                client.get(
                    state_route,
                    headers=b,
                ).status_code == 404,
                "ESTADO_AJENO_PROTEGIDO",
            )

            check(
                client.get(
                    state_route,
                ).status_code == 401,
                "ESTADO_ANONIMO_PROTEGIDO",
            )

        print("====================================")
        print("PRUEBAS_PEDAGOGICAS=EXITOSAS")
        print(f"COMPROBACIONES={counter}")

finally:
    with connect() as conn:
        conn.execute(
            """
            DELETE FROM conauti_users
            WHERE username = ANY(%s)
            """,
            ([student_a, student_b],),
        )

    print("CUENTAS_TEMPORALES=LIMPIADAS")
