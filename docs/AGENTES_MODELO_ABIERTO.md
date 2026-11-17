# Tutor multiagente con modelos abiertos

El chat usa un flujo LangGraph con coordinador, diagnóstico, planificación,
tutor y verificación. Diagnóstico, tutor y verificación realizan llamadas
separadas a Qwen3; el coordinador y la planificación usan reglas y herramientas.
Se aprovechan la memoria académica y los materiales que ya proporciona el
backend. No se registran diagnósticos ni niveles inventados.

## Configuración de ejecución

- Local: AI_PROVIDER=ollama, OLLAMA_ENABLED=true, OLLAMA_MODEL=qwen3:4b y
  OLLAMA_VISION_MODEL=qwen3-vl:2b-instruct. Ollama y los modelos deben estar en
  la misma máquina del backend.
- Nube: AI_PROVIDER=openrouter, OPENROUTER_MODEL=qwen/qwen3-4b:free,
  OPENROUTER_VISION_MODEL=qwen/qwen3-vl-235b-a22b-thinking:free y
  OPENROUTER_API_KEY almacenada como secreto. Las conversaciones y las
  imágenes enviadas se procesan a través de OpenRouter. Se solicita a los
  proveedores no recopilar datos; si no hay uno compatible, la petición falla.

El chat, la visión, las tarjetas y la orientación de errores usan modelos
abiertos cuando se configura uno de estos proveedores. Whisper procesa la voz
en el servidor, con OPEN_ASR_ENABLED=true y OPEN_WHISPER_MODEL=base.
El modelo de voz se descarga al primer uso. La búsqueda documental mantiene
el método léxico en modo abierto y no envía embeddings a Gemini.

Las opciones gratuitas pueden imponer límites y no se cambia automáticamente
a modelos de pago. La selección predeterminada del servicio existente permanece
sin cambios hasta configurar un proveedor y desplegar esta versión.

## Alcance y validación

La integración continua incluye pruebas con respuestas simuladas y pruebas
independientes con Qwen3 0.6B, Qwen3-VL 2B y Whisper base. Estas pruebas no
garantizan calidad pedagógica, velocidad o consumo de memoria en producción;
el nivel gratuito de Render tiene recursos limitados.

La estrategia CPA guía las explicaciones, pero aún no es una secuencia completa
de actividades manipulativas y gráficas ni acredita un nivel PISA. Todavía
faltan predicciones basadas en datos y un informe específico para padres.
