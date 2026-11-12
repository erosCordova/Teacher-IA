"""El entorno móvil solo añade el origen de la WebView de Android, sin comodines."""
from app.main import conauti_cors_origins

def test_android_capacitor_origin_explicitly_allowed():
    origins = conauti_cors_origins()
    assert "http://localhost" in origins
    assert "https://my-teacher-ia-presentacion.onrender.com" in origins
    assert "*" not in origins
    assert all(origin.startswith(("http://", "https://")) for origin in origins)
