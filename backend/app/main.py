import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def conauti_cors_origins():
    """Orígenes autorizados para desarrollo y producción."""
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        # Demo temporal verificada para la presentación: solo este origen.
        "https://my-teacher-ia-presentacion.onrender.com",
    ]

    extra = os.getenv("CONAUTI_CORS_ORIGINS", "")

    for origin in extra.split(","):
        origin = origin.strip().rstrip("/")

        if origin.startswith(("https://", "http://")):
            origins.append(origin)

    return list(dict.fromkeys(origins))


app = FastAPI(
    title="Asistente Educativo IA - CONAUTI",
    version="0.1.0",
    description="API del asistente educativo con IA.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=conauti_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.get("/")
def inicio():
    return {
        "aplicacion": "Asistente Educativo IA",
        "estado": "desarrollo",
        "fase": 2,
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "servicio": "asistente-educativo-api",
        "fase": 2,
    }


# Inicio Microsoft (OAuth 2.0, PKCE) solo cuando está configurado en Entra.
from app.conauti_microsoft_auth import router as microsoft_auth_router
app.include_router(microsoft_auth_router)

# Códigos de un solo uso: verificación del buzón sin contraseñas adicionales.
from app.conauti_email_auth import router as email_auth_router
app.include_router(email_auth_router)

# Autenticación de correo con identidad verificada por Google.
from app.conauti_google_auth import router as google_auth_router
app.include_router(google_auth_router)

# CONAUTI - Rutas de autenticacion y conversaciones
from app.conauti_auth import router as conauti_auth_router
app.include_router(conauti_auth_router)


from app.conauti_privacy import router as conauti_privacy_router
app.include_router(conauti_privacy_router)


from app.conauti_history import router as conauti_history_router
app.include_router(conauti_history_router)


from app.conauti_ai import router as conauti_ai_router
app.include_router(conauti_ai_router)


from app.conauti_pedagogy import router as conauti_pedagogy_router
app.include_router(conauti_pedagogy_router)


from app.conauti_voice import router as conauti_voice_router
app.include_router(conauti_voice_router)


# CONAUTI VOICE LIBRARY ROUTER
from app.conauti_voice_library import router as conauti_voice_library_router
app.include_router(conauti_voice_library_router)


# CONAUTI KOKORO LOCAL TTS
from app.conauti_kokoro import router as conauti_kokoro_router
app.include_router(conauti_kokoro_router)


# MY TEACHER IA - VOICE PREFERENCES
from app.conauti_voice_preferences import (
    router as conauti_voice_preferences_router,
)
app.include_router(conauti_voice_preferences_router)


# MY TEACHER IA - LEARNING MEMORY
from app.conauti_learning_memory import (
    router as conauti_learning_memory_router,
)
app.include_router(conauti_learning_memory_router)


# MYTEACHER_ASSESSMENT_V1
from app.conauti_assessments import (
    router as conauti_assessment_router,
)
app.include_router(conauti_assessment_router)


# MYTEACHER_ADAPTIVE_V1
from app.conauti_assessment_adaptive import (
    router as conauti_adaptive_router,
)
app.include_router(conauti_adaptive_router)


# MYTEACHER_HISTORY_V1
from app.conauti_assessment_history import (
    router as conauti_history_router,
)
app.include_router(conauti_history_router)


# MYTEACHER_SCREEN_SHARE_V1
from app.conauti_screen import (
    router as conauti_screen_router,
)
app.include_router(conauti_screen_router)


# MYTEACHER_FILES_V1 - subir documentos académicos
from app.conauti_files import router as conauti_files_router
app.include_router(conauti_files_router)

# MYTEACHER_ERROR_COACH_GRID_V3
from app.conauti_error_coach import (
    router as conauti_error_coach_router,
)
app.include_router(conauti_error_coach_router)
