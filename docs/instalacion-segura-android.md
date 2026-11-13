# My Teacher IA — instalación segura y firma permanente

## Diagnóstico confirmado (13/11/2026)

En el teléfono Android, Play Protect mostró **«Se bloqueó la app para proteger tu dispositivo»** y el motivo **«Play Protect no vio una app de este desarrollador antes. Podría no ser segura.»**

Esta redacción corresponde a la categoría **Uncommon / desarrollador no reconocido**, no demuestra por sí sola que haya software malicioso. **No se puede garantizar la seguridad únicamente porque el proyecto compile.** No recomendar desactivar Play Protect.

Los APK públicos anteriores eran `app-debug.apk`, **NO versiones de publicación**. Se comprobó mediante la firma criptográfica del APK (bloque APK Signature Scheme v2):

| APK | Certificado SHA-1 |
| --- | --- |
| `My-Teacher-IA-Android-Prueba.apk` | `23:C7:15:DD:13:BD:E3:B6:31:46:05:8A:94:83:3C:B5:2B:9B:40:E6` |
| `My-Teacher-IA-Android-Google-Nativo.apk` | `17:29:DC:09:C1:C5:84:83:48:B7:BF:3B:3C:21:50:EF:F1:32:AC:98` |

Son **certificados distintos**. Por eso Android no puede actualizar normalmente uno con otro usando el mismo identificador de paquete y Google Cloud no debe asociar la identidad de producción a cualquiera de esos certificados temporales. La huella `17:29:...` facilitada anteriormente corresponde solo al APK de prueba, no a la futura firma estable.

## Solución para distribuir la aplicación

1. El propietario debe generar **una sola vez** una clave privada permanente para `pe.myteacheria.alumno`, guardarla fuera del repositorio y conservar una copia segura. Nunca publicar el keystore ni sus contraseñas.
2. Crear el entorno protegido `android-release` en GitHub Actions y configurar los secretos `ANDROID_UPLOAD_KEYSTORE_B64`, `ANDROID_UPLOAD_KEYSTORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`.
3. Ejecutar manualmente [`android-firma-manual.yml`](../.github/workflows/android-firma-manual.yml). Este flujo audita, firma y verifica el APK instalable y el AAB con el **mismo certificado**, y genera `HUELLAS_CERTIFICADO.txt` (SHA-1/SHA-256 públicos) y `SHA256SUMS.txt`. **No se ha ejecutado todavía con clave definitiva**.
4. Registrar un cliente OAuth **Android** en el proyecto existente de Google Cloud, con nombre de paquete `pe.myteacheria.alumno` y **SHA-1 de `HUELLAS_CERTIFICADO.txt`**. Mantener el cliente OAuth web actual porque FastAPI verifica el token emitido para ese cliente web.
5. Registrar la aplicación como desarrollador en Android Developer Console o usar Play Console si se desea distribución amplia. Google ha habilitado **distribución limitada gratuita hasta 20 dispositivos** para estudiantes y aficionados; exige su propio registro y pasos de autorización. **No se garantiza que ello elimine todas las advertencias de Play Protect**, que realiza comprobaciones adicionales.
6. Realizar una prueba real de instalación con Play Protect activo en un Android físico. Si se identifica erróneamente una app ya revisada, consultar la apelación oficial. No publicar a estudiantes hasta completar las pruebas físicas, privacidad y política de datos.

**Para probar en el teléfono del desarrollador** Google sigue admitiendo Android Debug Bridge (ADB), desde un ordenador autorizado y después de verificar la huella SHA-256 del archivo. No es una vía de distribución para alumnos ni sustituye la seguridad de Play Protect. No se debe desinstalar la app anterior si existen conversaciones locales sin respaldar: la desinstalación elimina sus datos privados.

## Fuentes oficiales

- [Mensajes de Play Protect por categoría](https://developers.google.com/android/play-protect/warning-strings)
- [Guía del desarrollador para advertencias de Play Protect](https://developers.google.com/android/play-protect/warning-dev-guidance)
- [Distribución limitada de Android — gratuita hasta 20 dispositivos](https://developer.android.com/developer-verification/guides/limited-distribution)
- [Android Developer Console y tipos de cuenta](https://support.google.com/android-developer-console/answer/16604405)
- [Firma de aplicaciones Android](https://developer.android.com/studio/publish/app-signing)
