# My Teacher IA — Android con tutor local

**Avance verificado: 86 %**, medido por los hitos ponderados en [`progreso.json`](./progreso.json). Los cambios de código aún no validados en CI o en teléfono físico no aumentan ese valor.

## Qué funciona y qué está probado

- Interfaz React integrada en Android mediante Capacitor, con los estilos y funcionalidades existentes de My Teacher IA.
- Inicio de sesión, chat en línea y sincronización voluntaria con dos estudiantes ficticios, desde Android contra PostgreSQL de pruebas.
- Motor privado `llama.cpp` integrado por JNI. Un GGUF Qwen3 0.6B real generó pistas educativas en español sin conexión al backend en el emulador.
- Instalación del GGUF desde la interfaz, cancelación, reanudación y comprobación SHA-256 en almacenamiento privado.
- Historial local cifrado con Android Keystore y recuperado tras reiniciar la interfaz.
- Puente de síntesis de voz local verificado en emulador; dictado y audición sin Internet en celulares físicos **pendientes**.
- APK de depuración y AAB sin firma compilados. La compilación release dispone de auditoría de privacidad, integridad de archivos y compatibilidad ELF de 16 KB.

El archivo del modelo (**aprox. 484 MB**) no va dentro del APK. El estudiante debe descargarlo una vez con autorización; después, el tutor local puede funcionar sin datos móviles. No debe instalar Ollama de escritorio en el teléfono. El tiempo de inferencia registrado en emulador es de 117 segundos, **no** una medida representativa de rendimiento en un teléfono real.

## Cómo se genera el APK de prueba

El flujo [`android.yml`](../.github/workflows/android.yml) compila `frontend/dist-conauti`, prepara Capacitor, incorpora los plugins, compila la biblioteca JNI para ARM64/x86_64 y crea un APK debug. Además, valida AAB sin firma, privacidad, firma desechable para pruebas y apertura del proyecto en emulador.

El resultado se obtiene en **GitHub > Actions > My Teacher IA - Android (prueba APK) > ejecución exitosa > Artifacts > my-teacher-ia-android-debug**. Un APK debug es solo de prueba: no es la aplicación de publicación.

## APK para instalar desde navegador y AAB para Google Play

El flujo [`android-firma-manual.yml`](../.github/workflows/android-firma-manual.yml) está preparado para generar en una misma ejecución:

- `my-teacher-ia-release.apk`: para distribución directa por navegador, firmado y verificado con `apksigner`.
- `my-teacher-ia-firmado.aab`: paquete firmado de subida a Google Play.
- `SHA256SUMS.txt`: huellas SHA-256 de ambos archivos.

**La firma de producción no está ejecutada ni acreditada.** El workflow requiere configurar primero un entorno protegido `android-release` en GitHub con cuatro secretos: `ANDROID_UPLOAD_KEYSTORE_B64`, `ANDROID_UPLOAD_KEYSTORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS` y `ANDROID_UPLOAD_KEY_PASSWORD`. La clave privada debe generarse y conservarse fuera del repositorio, nunca en el chat, el código, ni los artefactos. Se usa un almacenamiento temporal que se destruye al terminar. El workflow no publica automáticamente en Google Play.

**Importante sobre actualizaciones:** si Google Play firma la app con un certificado diferente al de la descarga directa, Android no permite sustituir una instalación por la otra mediante actualización normal. Se debe planificar la estrategia de certificados antes de distribuir a estudiantes.

## Seguridad y publicación

- La app usa `pe.myteacheria.alumno`, assets locales en `http://localhost`, sin cargar el frontend desde un servidor remoto.
- La conexión al backend online se hace por HTTPS. No se deben incrustar contraseñas ni claves de Gemini o de otros servicios.
- La auditoría de release prohíbe copias automáticas del historial, inspección de WebView en producción, permisos sensibles innecesarios y transporte HTTP claro.
- La biblioteca nativa se compila con alineación de páginas ELF de 16 KB y la auditoría verifica esa propiedad; la ejecución real debe confirmarse también en hardware compatible.
- Google Play exige requisitos externos de cuenta de desarrollador, privacidad, seguridad de datos, ficha y pruebas. No están cubiertos simplemente por obtener un AAB firmado.

## Pendientes para llegar al 100 %

| Hito | Peso |
| --- | ---: |
| Autenticación con proveedor real y generación IA online desde Android | 2 % |
| Dictado sin Internet y audio audible en teléfonos físicos | 4 % |
| Rendimiento, batería y privacidad en teléfonos ARM64 | 5 % |
| Firma definitiva, entrega y revisión de publicación | 3 % |

El porcentaje oficial solo cambia tras registrar evidencia verificable en `mobile/progreso.json`. El último respaldo funcional de la web permanece separado en las ramas de trabajo; la compilación Android no modifica Render ni elimina funcionalidades existentes.
