from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Asistente Educativo IA - CONAUTI",
    version="0.1.0",
    description="API del asistente educativo con IA.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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


# MYTEACHER_ERROR_COACH_GRID_V3
from app.conauti_error_coach import (
    router as conauti_error_coach_router,
)
app.include_router(conauti_error_coach_router)
