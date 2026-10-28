from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.conauti_auth import connect


def check(value, name):
    if not value:
        raise AssertionError(name)
    print(f"{name}=OK", flush=True)


suffix = uuid4().hex[:10]
user_a = "f05a_" + suffix
user_b = "f05b_" + suffix
password = "ConautiPruebaFase05!"

try:
    with TestClient(app, raise_server_exceptions=False) as client:
        tokens = {}

        for username in (user_a, user_b):
            response = client.post(
                "/api/conauti/auth/register",
                json={
                    "username": username,
                    "password": password,
                },
            )
            check(response.status_code == 201, "REGISTRO")

            response = client.post(
                "/api/conauti/auth/login",
                json={
                    "username": username,
                    "password": password,
                },
            )
            check(response.status_code == 200, "LOGIN")

            tokens[username] = {
                "Authorization":
                    "Bearer " + response.json()["access_token"]
            }

        a = tokens[user_a]
        b = tokens[user_b]

        ids = []

        for number in range(23):
            result = client.post(
                "/api/conauti/conversations",
                headers=a,
                json={
                    "title": f"TEMA F05 {number:02d}"
                },
            )
            check(result.status_code == 201, "CREAR_CONVERSACION")
            ids.append(result.json()["id"])

        private_id = ids[0]

        for number in range(55):
            result = client.post(
                f"/api/conauti/conversations/{private_id}/messages",
                headers=a,
                json={
                    "body": f"Mensaje educativo {number:02d}"
                    + (" palabraespecial" if number == 5 else "")
                },
            )
            if result.status_code != 201:
                raise AssertionError("INSERTAR_MENSAJES")

        check(True, "MENSAJES_55_GUARDADOS")

        root = "/api/conauti/history/conversations"

        response = client.get(
            root + "?limit=15&offset=0",
            headers=a,
        )

        check(
            response.status_code == 200
            and response.json()["total"] == 23
            and len(response.json()["items"]) == 15
            and response.json()["has_more"],
            "PAGINACION_PRIMERA_PAGINA",
        )

        first_ids = {
            row["id"] for row in response.json()["items"]
        }

        response = client.get(
            root + "?limit=15&offset=15",
            headers=a,
        )

        second_ids = {
            row["id"] for row in response.json()["items"]
        }

        check(
            response.status_code == 200
            and len(second_ids) == 8
            and not first_ids.intersection(second_ids),
            "PAGINACION_SIN_DUPLICADOS",
        )

        response = client.get(
            root + "?search=palabraespecial",
            headers=a,
        )

        check(
            response.status_code == 200
            and response.json()["total"] == 1
            and response.json()["items"][0]["id"] == private_id,
            "BUSQUEDA_DENTRO_DE_MENSAJES",
        )

        response = client.get(
            root + "?search=TEMA%20F05",
            headers=a,
        )

        check(
            response.status_code == 200
            and response.json()["total"] == 23,
            "BUSQUEDA_POR_TITULO",
        )

        route = (
            f"/api/conauti/history/conversations/"
            f"{private_id}/messages"
        )

        response = client.get(
            route + "?limit=30",
            headers=a,
        )

        first = response.json()

        check(
            response.status_code == 200
            and len(first["items"]) == 30
            and first["has_more"]
            and first["next_before"] is not None,
            "PRIMEROS_30_MENSAJES",
        )

        response = client.get(
            route + "?limit=30"
            + f"&before_id={first['next_before']}",
            headers=a,
        )

        second = response.json()

        combined = second["items"] + first["items"]
        message_ids = [item["id"] for item in combined]

        check(
            response.status_code == 200
            and len(second["items"]) == 25
            and not second["has_more"]
            and len(message_ids) == len(set(message_ids)) == 55
            and message_ids == sorted(message_ids),
            "RECUPERACION_DE_55_MENSAJES_ORDENADOS",
        )

        response = client.get(root, headers=b)

        check(
            response.status_code == 200
            and response.json()["total"] == 0,
            "HISTORIAL_AJENO_OCULTO",
        )

        response = client.get(route, headers=b)

        check(
            response.status_code == 404,
            "MENSAJES_AJENOS_BLOQUEADOS",
        )

        response = client.get(root)

        check(
            response.status_code == 401,
            "ACCESO_ANONIMO_BLOQUEADO",
        )

        response = client.get(
            "/api/conauti/privacy/export",
            headers=a,
        )

        check(
            response.status_code == 200
            and len(response.json()["conversations"]) == 23
            and len(response.json()["messages"]) == 55,
            "EXPORTACION_COMPLETA",
        )

        response = client.delete(
            f"/api/conauti/conversations/{private_id}",
            headers=a,
        )

        check(
            response.status_code == 200,
            "ELIMINACION_CONVERSACION",
        )

        response = client.get(route, headers=a)

        check(
            response.status_code == 404,
            "HISTORIAL_ELIMINADO_IRRECUPERABLE",
        )

    print("PRUEBAS_API_FASE05=EXITOSAS", flush=True)

finally:
    with connect() as conn:
        conn.execute(
            """
            DELETE FROM conauti_users
            WHERE username = ANY(%s)
            """,
            ([user_a, user_b],),
        )
    print("CUENTAS_TEMPORALES=LIMPIADAS", flush=True)
