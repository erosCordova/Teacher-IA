#!/usr/bin/env python3
"""Crear dos usuarios *solo* en PostgreSQL efímero de GitHub Actions.

Esta prueba nunca debe ejecutarse sobre una base de producción.
"""
import os
from pathlib import Path

import psycopg

from app.conauti_auth import hash_password

url = os.environ["CONAUTI_TEST_DATABASE_URL"]
assert "teacher_ci" in url and "127.0.0.1" in url, (
    "Se prohíbe crear cuentas de prueba fuera del PostgreSQL efímero de CI."
)
credentials = (
    ("android_ci_alumno_a", "ClaveAndroidCI_2026_AlumnoA"),
    ("android_ci_alumno_b", "ClaveAndroidCI_2026_AlumnoB"),
)
with psycopg.connect(url) as conn:
    for username, password in credentials:
        conn.execute(
            "INSERT INTO conauti_users(username,password_hash) VALUES (%s,%s)"
            " ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash",
            (username, hash_password(password))
        )
print("Dos usuarios de prueba aislados creados en PostgreSQL efímero.")
