# Publicación Android — My Teacher IA

Estado del producto: **89 % verificado** en `mobile/progreso.json`. Esta guía no equivale a haber publicado la aplicación.

## Dos vías de distribución

| Canal | Paquete | Cuenta de tienda | Situación |
| --- | --- | --- | --- |
| Descarga directa desde navegador | APK de distribución firmado con clave permanente | No necesita Play Console para alojar el archivo en un servidor propio | Workflow de firma disponible, **sin ejecutar aún con clave de producción** |
| Google Play | Android App Bundle AAB firmado | Registro del desarrollador, revisión y cumplimiento de políticas | Pendiente |

No compartir un APK de depuración como versión pública. Un APK de producción requiere una clave permanente; si esa clave se pierde, pueden quedar bloqueadas las futuras actualizaciones de instalaciones directas.

**Costes**: el desarrollo, las pruebas en GitHub Actions dentro de las cuotas y la distribución desde un servidor gratuito pueden no requerir pagos, pero **publicar en Google Play tiene una tarifa de registro de US$25**. Antes de usar una cuenta personal nueva, verificar si Google exige 12 probadores inscritos durante 14 días consecutivos (cuentas creadas después del 13-11-2023).

Fuentes oficiales:
- https://support.google.com/googleplay/android-developer/answer/6112435
- https://support.google.com/googleplay/android-developer/answer/14151465

## Requisitos técnicos que debe verificar el release

- ID de paquete `pe.myteacheria.alumno`, versión incrementada (`versionCode`) y APK/AAB firmados.
- Desde el 31-08-2026, nueva app y actualizaciones móviles deben apuntar a **targetSdkVersion 36 o superior**. El proyecto usa Capacitor 8, preparado para targetSdk 36.
- Binarios nativos ARM64 con segmentos ELF compatibles con páginas de memoria de **16 KB**, y alineación del paquete APK. Comprobar además el AAB con herramientas oficiales de Android.
- Sin depuración WebView activa, sin datos del estudiante incluidos en Android Backup, sin HTTP claro a la API, sin permisos sensibles que no se necesitan.
- La aplicación debe abrir sin Internet para acceder al tutor local **después** de instalar voluntariamente el GGUF (~484 MB). El modo online necesita HTTPS y la API operativa.
- Pruebas en teléfonos físicos ARM64: apertura, rendimiento, memoria, inferencia, audio audible, dictado español offline, temperatura, batería, recuperación y comportamiento con poca memoria.
- La firma final debe realizarse mediante `.github/workflows/android-firma-manual.yml` en un entorno protegido `android-release`; los secretos y el keystore **nunca** deben estar en GitHub como archivos, logs o artefactos.
- **No considerar aprobada una prueba solo porque compile**. El avance oficial depende de evidencia real almacenada en `mobile/progreso.json`.

Fuentes oficiales:
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://capacitorjs.com/docs/updating/8-0
- https://developer.android.com/guide/practices/page-sizes

## Revisión de privacidad (no completar con respuestas inventadas)

Antes de enviar la ficha de Play Console, auditar qué datos transmite el código real y los SDK utilizados, incluidas llamadas desde WebView, frontend, backend y proveedores externos. **El modo offline y el online tienen flujos de datos diferentes**.

| Área | Comprobación necesaria |
| --- | --- |
| Identidad | Qué correo, identificadores y tokens obtiene el servidor y qué terceros intervienen en login/OAuth |
| Chat online | Qué mensajes y archivos se guardan en PostgreSQL, se envían a un modelo remoto, cuánto se retienen y cómo se eliminan |
| Chat offline | Confirmar que texto, modelos descargados e historial cifrado permanecen en el teléfono salvo sincronización voluntaria |
| Historial | Revisar si el alumno puede eliminar datos y si una cuenta puede acceder a los de otra |
| Voz | Determinar si los paquetes de reconocimiento/TTS instalados pertenecen al sistema y si existen transmisiones a sus proveedores |
| Servicios terceros | Revisar cookies, SDK, registro de fallos, métricas y telemetría realmente activadas |
| Menores | Revisar la audiencia, las políticas correspondientes a menores y los requisitos de consentimiento y supervisión cuando apliquen |

Preparar y alojar una política de privacidad accesible por URL pública. La sección *Seguridad de los datos* de Google Play debe coincidir con lo que hace la aplicación; no declarar «no recopila datos» porque exista modo offline cuando el modo en línea sí transmite información. Google Play considera también los datos enviados desde WebViews bajo control de la app.

Fuente oficial:
- https://support.google.com/googleplay/android-developer/answer/10787469

## Verificación final de entregables

1. CI de frontend, backend y pruebas Android en estado **success** y artefactos presentes.
2. Firma real con certificado de subida protegido y conservación segura del keystore original.
3. APK y AAB verificados con las herramientas de firma y hashes SHA-256.
4. Pruebas reales en teléfonos; evidencia de dictado y audio offline en español.
5. Revisión de privacidad, contenido, público objetivo, ficha, iconos, capturas, correo de soporte y política de privacidad.
6. Decidir entre entrega APK directa (sin publicación en Play) o gestión de cuenta Play Console y sus requisitos.

**Importante**: el cumplimiento técnico y la disponibilidad de un AAB no garantizan la aprobación de Google Play; la revisión, la cuenta y la publicación requieren acciones externas.
