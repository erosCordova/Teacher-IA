from uuid import uuid4

from fastapi.testclient import TestClient
from app.main import app
from app.conauti_auth import connect


def check(condition, label):
    if not condition:
        raise AssertionError(label)
    print(f"{label}=OK")


suffix = uuid4().hex[:10]
user_a = "alumnoa_" + suffix
user_b = "alumnob_" + suffix
password = "PruebaSegura2026!"

try:
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/conauti/health/db")
        check(response.status_code == 200, "BASE_DATOS_API")

        tokens = {}

        for username in (user_a, user_b):
            response = client.post(
                "/api/conauti/auth/register",
                json={
                    "username": username,
                    "password": password,
                },
            )
            check(response.status_code == 201, "REGISTRO_" + username[:7])

            response = client.post(
                "/api/conauti/auth/login",
                json={
                    "username": username,
                    "password": password,
                },
            )
            check(response.status_code == 200, "LOGIN_" + username[:7])

            tokens[username] = {
                "Authorization":
                    "Bearer " + response.json()["access_token"]
            }

        a = tokens[user_a]
        b = tokens[user_b]

        response = client.get(
            "/api/conauti/auth/me",
            headers=a,
        )
        check(response.status_code == 200, "SESION_AUTENTICADA")

        response = client.get("/api/conauti/conversations")
        check(response.status_code == 401, "ACCESO_ANONIMO_BLOQUEADO")

        response = client.post(
            "/api/conauti/conversations",
            headers=a,
            json={"title": "Matematicas - prueba"},
        )
        check(response.status_code == 201, "CREAR_CONVERSACION")

        cid = response.json()["id"]
        ruta = f"/api/conauti/conversations/{cid}"

        response = client.get(
            ruta + "/messages",
            headers=b,
        )
        check(response.status_code == 404, "LECTURA_AJENA_BLOQUEADA")

        response = client.post(
            ruta + "/messages",
            headers=b,
            json={"body": "Intento no autorizado"},
        )
        check(response.status_code == 404, "ESCRITURA_AJENA_BLOQUEADA")

        response = client.post(
            ruta + "/messages",
            headers=a,
            json={"body": "Necesito una pista sobre fracciones"},
        )
        check(response.status_code == 201, "GUARDAR_MENSAJE")

        response = client.get(
            ruta + "/messages",
            headers=a,
        )
        check(
            response.status_code == 200
            and len(response.json()) == 1,
            "RECUPERAR_HISTORIAL",
        )

        response = client.delete(ruta, headers=b)
        check(response.status_code == 404, "BORRADO_AJENO_BLOQUEADO")

        response = client.delete(ruta, headers=a)
        check(response.status_code == 200, "BORRADO_AUTORIZADO")

        response = client.get(
            ruta + "/messages",
            headers=a,
        )
        check(response.status_code == 404, "BORRADO_VERIFICADO")

        response = client.post(
            "/api/conauti/auth/logout",
            headers=a,
        )
        check(response.status_code == 200, "CERRAR_SESION")

        response = client.get(
            "/api/conauti/auth/me",
            headers=a,
        )
        check(response.status_code == 401, "TOKEN_REVOCADO")

    print("PRUEBAS_INTEGRACION=EXITOSAS")

finally:
    with connect() as conn:
        conn.execute(
            """
            DELETE FROM conauti_users
            WHERE username = ANY(%s)
            """,
            ([user_a, user_b],),
        )
    print("CUENTAS_DE_PRUEBA=LIMPIADAS")
