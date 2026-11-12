# My Teacher IA — edición Android (desarrollo)

Estado: **fase 1 de 8**, la aplicación Android con motor GGUF local **todavía no está terminada**.

Este directorio prepara una app Android mediante Capacitor sin duplicar el frontend React ni modificar la publicación web de Render.

## Arquitectura de la primera etapa

- \`frontend/conauti-ui/\`: interfaz existente, login, módulos, chat, voz e historial.
- \`frontend/dist-conauti/\`: compilación web que se empaqueta dentro de Android.
- \`mobile/capacitor.config.json\`: nombre, identificador provisional y origen Android.
- \`mobile/android/\`: proyecto Android generado al compilar; no requiere que los alumnos instalen Ollama.
- \`backend/\`: FastAPI remoto durante la fase online. En Android necesita autorizar el origen \`http://localhost\` por CORS.
- Motor local GGUF (llama.cpp), modelo descargable e historial offline: **pendientes**; no se ha incluido un modelo ficticio.

## Proceso en CI

El workflow \`.github/workflows/android.yml\` instala dependencias móviles, valida configuración, genera el proyecto nativo y compila un **APK debug de prueba**. No genera una aplicación firmada para Google Play.

El bundle utiliza \`webDir: ../frontend/dist-conauti\`. No se establece \`server.url\` a una página remota, de modo que los recursos estáticos de la interfaz viajan dentro del APK.

## Comportamiento por ahora

La web pública mantiene su funcionamiento normal. La app Android empaquetada requiere Internet para autenticación, IA y acceso a PostgreSQL, como la versión web. El indicador \`progreso.json\` cuenta exclusivamente hitos concluidos; **no** significa que el tutor offline ya funcione.

## Requisitos posteriores para IA sin Internet

1. Implementar el plugin nativo Android de inferencia GGUF usando llama.cpp (no ejecutando Ollama Desktop).
2. Seleccionar y evaluar un modelo cuantizado con licencia compatible con distribución en Google Play.
3. Gestionar instalación/descarga/verificación de pesos y espacio requerido; no descargar modelos sin consentimiento.
4. Implementar base local privada y migración sincronizada tras reconectar Internet.
5. Añadir reconocimiento y síntesis de voz offline según compatibilidad de cada teléfono.
6. Probar rendimiento, batería, límites de memoria y modelos de dispositivos.
7. Crear paquete AAB firmado, política de privacidad y ficha para Play Store.

**No empaquetar tokens, llaves de producción ni secretos en el APK.**
