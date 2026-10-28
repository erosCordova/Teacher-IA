from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.conauti_auth import connect


def check(value, name):
    if not value:
        raise AssertionError(name)
    print(f"{name}=OK")


suffix = uuid4().hex[:12]
user_a = "est_a_" + suffix
user_b = "est_b_" + suffix
password = "ConautiPrueba2026!"

headers = {}

try:
    with TestClient(app, raise_server_exceptions=False) as client:

        for username in (user_a, user_b):

            response = client.post(
                "/api/conauti/auth/register",
                json={
                    "username": username,
                    "password": password,
                },
            )

            check(
                response.status_code == 201,
                "REGISTRO_" + username[:5],
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
                "LOGIN_" + username[:5],
            )

            headers[username] = {
                "Authorization":
                    "Bearer " + response.json()["access_token"]
            }

        a = headers[user_a]
        b = headers[user_b]

        response = client.get(
            "/api/conauti/auth/roles",
            headers=a,
        )

        check(
            response.status_code == 200
            and response.json()["roles"] == ["student"],
            "ROL_ESTUDIANTE_PREDETERMINADO",
        )

        response = client.post(
            "/api/conauti/conversations",
            headers=a,
            json={"title": "Historia privada"},
        )

        check(
            response.status_code == 201,
            "CONVERSACION_PRIVADA",
        )

        cid = response.json()["id"]
        route = "/api/conauti/conversations/" + cid

        response = client.patch(
            route,
            headers=b,
            json={"title": "Intento ajeno"},
        )

        check(
            response.status_code == 404,
            "EDICION_AJENA_BLOQUEADA",
        )

        response = client.patch(
            route,
            headers=a,
            json={"title": "Historia actualizada"},
        )

        check(
            response.status_code == 200
            and response.json()["title"] == "Historia actualizada",
            "EDICION_PROPIA_OK",
        )

        response = client.post(
            route + "/messages",
            headers=a,
            json={"body": "Explicame las fracciones"},
        )

        check(
            response.status_code == 201,
            "MENSAJE_PERSISTIDO",
        )

        response = client.get(
            "/api/conauti/privacy/export",
        )

        check(
            response.status_code == 401,
            "EXPORTACION_ANONIMA_BLOQUEADA",
        )

        response = client.get(
            "/api/conauti/privacy/export",
            headers=b,
        )

        check(
            response.status_code == 200
            and not response.json()["conversations"]
            and not response.json()["messages"],
            "EXPORTACION_SIN_DATOS_AJENOS",
        )

        response = client.get(
            "/api/conauti/privacy/export",
            headers=a,
        )

        check(
            response.status_code == 200
            and len(response.json()["conversations"]) == 1
            and len(response.json()["messages"]) == 1
            and response.json()["conversations"][0]["title"]
                == "Historia actualizada",
            "EXPORTACION_PROPIA_COMPLETA",
        )

        check(
            response.headers.get("cache-control") == "no-store",
            "EXPORTACION_SIN_CACHE",
        )

        response = client.request(
            "DELETE",
            "/api/conauti/privacy/account",
            headers=a,
            json={"password": "ContraseñaIncorrecta123!"},
        )

        check(
            response.status_code == 403,
            "ELIMINACION_SIN_CONFIRMACION_BLOQUEADA",
        )

        response = client.request(
            "DELETE",
            "/api/conauti/privacy/account",
            headers=b,
            json={"password": password},
        )

        check(
            response.status_code == 200,
            "ELIMINACION_CUENTA_B",
        )

        response = client.get(
            "/api/conauti/auth/me",
            headers=b,
        )

        check(
            response.status_code == 401,
            "SESION_ELIMINADA_B",
        )

        response = client.get(
            "/api/conauti/privacy/export",
            headers=a,
        )

        check(
            response.status_code == 200
            and len(response.json()["messages"]) == 1,
            "CUENTA_A_INTACTA",
        )

        response = client.request(
            "DELETE",
            "/api/conauti/privacy/account",
            headers=a,
            json={"password": password},
        )

        check(
            response.status_code == 200,
            "ELIMINACION_CUENTA_A",
        )

        response = client.get(
            "/api/conauti/auth/me",
            headers=a,
        )

        check(
            response.status_code == 401,
            "SESION_ELIMINADA_A",
        )

        with connect() as conn:

            count = conn.execute(
                """
                SELECT COUNT(*) AS total
                FROM conauti_conversations
                WHERE id = %s
                """,
                (cid,),
            ).fetchone()["total"]

            check(
                count == 0,
                "ELIMINACION_CONVERSACION_EN_CASCADA",
            )

            tables = (
                "conauti_roles",
                "conauti_user_roles",
                "conauti_memories",
                "conauti_progress",
            )

            for name in tables:
                row = conn.execute(
                    "SELECT to_regclass(%s) AS table_name",
                    (name,),
                ).fetchone()

                check(
                    row["table_name"] is not None,
                    "MODELO_" + name.upper(),
                )

    print("PRUEBAS_FASE_03=EXITOSAS")

finally:
    with connect() as conn:
        conn.execute(
            """
            DELETE FROM conauti_users
            WHERE username = ANY(%s)
            """,
            ([user_a, user_b],),
        )
    print("DATOS_TEMPORALES=LIMPIADOS")
