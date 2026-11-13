# My Teacher IA — aplicación Android

**Avance ponderado verificado: 89 %.** Consultar `mobile/progreso.json` para los subhitos y sus evidencias. **No es una versión final ni está publicada en Google Play.**

## Arquitectura

La aplicación empaqueta el frontend React de My Teacher IA mediante Capacitor 8.6; no depende de una página remota para mostrar la interfaz. La autenticación y el chat online usan FastAPI por HTTPS. El modo offline funciona sin iniciar sesión con `llama.cpp` nativo y el modelo Qwen3 0.6B cuantizado, que se descarga una sola vez desde la app y se comprueba con SHA-256. El modelo completo ocupa alrededor de 484 MB y **no viene dentro del APK**.

El historial del estudiante se cifra mediante Android Keystore. La sincronización con la cuenta es voluntaria, requiere consentimiento explícito y bloquea accesos de otros estudiantes. El módulo de voz usa solo capacidades del dispositivo; su comportamiento oral completo en teléfonos físicos aún requiere validación.

## Evidencia verificable

- APK Android, biblioteca JNI y AAB sin firmar compilados: [GitHub Actions](https://github.com/erosCordova/Teacher-IA/actions/runs/43340560284).
- Generación de respuesta real con Qwen3 en emulador, sin API remota: [Prueba de inferencia](https://github.com/erosCordova/Teacher-IA/actions/runs/43301708400).
- Chat offline, historial cifrado y restauración tras recargar: [Prueba de chat](https://github.com/erosCordova/Teacher-IA/actions/runs/43303896571).
- Descarga, cancelación y reanudación de los pesos GGUF desde Android: [Prueba del instalador](https://github.com/erosCordova/Teacher-IA/actions/runs/43332714425).
- Inicio de sesión y sincronización desde Android con dos usuarios de prueba aislados: [Prueba de autenticación](https://github.com/erosCordova/Teacher-IA/actions/runs/43337881805).
- Auditoría del APK de publicación (copia en nube y transferencia Android 12+ desactivadas; permisos y ELF de ARM64 comprobados) y firma con clave **temporal desechada**: [Pasos aprobados en CI](https://github.com/erosCordova/Teacher-IA/actions/runs/43348693408). La ejecución global fue cancelada después, durante la prueba del emulador; los pasos de auditoría y firma sí aprobaron.

## Lo pendiente

- Autenticación con un proveedor real de correo/OAuth e IA online desde Android.
- Dictado offline y calidad audible con micrófono real.
- Rendimiento, memoria, batería, privacidad y compatibilidad en teléfonos ARM64.
- Firma final con clave privada de subida, datos de privacidad y publicación en Google Play.

**Privacidad:** los tokens y las conversaciones locales no se transfieren automáticamente; Android 12+ utiliza `data_extraction_rules.xml` para excluirlos de migración entre dispositivos. La rama de desarrollo móvil no altera el sitio web publicado.

**Publicación:** `.github/workflows/android-firma-manual.yml` prepara la firma real con secretos protegidos de GitHub. Su ejecución requiere la configuración autorizada de claves y entorno de publicación. No almacena claves privadas en el repositorio.

