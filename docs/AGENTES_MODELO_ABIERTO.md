# Tutor multiagente con Qwen3

Este cambio incorpora al chat un flujo LangGraph con coordinador, diagnóstico,
planificación, tutor y verificación. Diagnóstico, tutor y verificación realizan
llamadas separadas a Qwen3; el coordinador y la planificación utilizan reglas y
herramientas verificables. El flujo usa la memoria académica y los materiales
que ya entrega el backend por cada solicitud, sin registrar diagnósticos inventados.

## Ejecución

- Ollama en el mismo servidor: AI_PROVIDER=ollama, OLLAMA_ENABLED=true y
  OLLAMA_MODEL=qwen3:4b. Se admiten variantes Qwen3 0.6B, 1.7B, 4B y 8B.
- En un servidor remoto sin Ollama: AI_PROVIDER=openrouter,
  OPENROUTER_MODEL=qwen/qwen3-4b:free y OPENROUTER_API_KEY almacenada como secreto.
  Las solicitudes se envían a OpenRouter; se pide a los proveedores no recopilar
  datos. Si no hay proveedor compatible o se agota la cuota se muestra un error.
  No se usa automáticamente un modelo de pago o Gemini como sustituto.

El modelo gratuito puede tener límites de disponibilidad y de consultas.
La prueba CI con Ollama utiliza Qwen3 0.6B por recursos; no mide la calidad ni
el rendimiento de Qwen3 4B en un teléfono o en producción.

## Alcance pendiente

La generación del chat usa el modelo abierto cuando se configura una de las
opciones anteriores. Las rutas existentes de análisis de pantalla, transcripción
de audio y orientación de errores siguen utilizando Gemini. Los embeddings de
Gemini continúan siendo opcionales. No afirmar que toda la plataforma utiliza
exclusivamente modelos abiertos hasta sustituir y probar también esas rutas.

El método CPA se incorpora como estrategia de orientación del tutor, pero
todavía no constituye una secuencia completa de actividades manipulativas y
gráficas ni acredita un nivel PISA. El planificador no guarda predicciones
de habilidades ni crea informes parentales.
