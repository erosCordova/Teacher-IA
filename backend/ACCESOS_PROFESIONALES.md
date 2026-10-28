# My Teacher IA — acceso y registro profesional

Esta implementación conserva Google, agrega acceso por código enviado al correo y
prepara Microsoft. Ningún método adicional se habilita sin la configuración de
un proveedor real. No se compran dominios ni servicios.

## Seguridad y unicidad
- Un correo verificado solo puede registrarse una vez en el registro central
  \`conauti_verified_email_identities\`, sin importar el proveedor.
- Las cuentas Google existentes se incorporan automáticamente de manera idempotente.
- Los proveedores no se vinculan automáticamente por un simple nombre de correo.
- El usuario anterior puede seguir entrando con su nombre y contraseña.
- El acceso por correo requiere que el destinatario reciba e introduzca un código
  de ocho dígitos: diez minutos de caducidad, cinco intentos máximos, espera
  mínima entre envíos y un máximo de cinco envíos por hora por correo.
- Los códigos se almacenan como HMAC-SHA256, no en texto plano.
- Microsoft utiliza código de autorización OAuth 2.0 con PKCE, state y nonce,
  cookie HttpOnly, firma del ID token y un ticket de sesión de un solo uso.
  No se acepta como verificado un simple \`email\` o \`preferred_username\`
  del token Microsoft.

## Opción gratuita: correo Mailjet por HTTPS en Render Free

Render Free bloquea los puertos de salida SMTP 25, 465 y 587. Usar una
API de envío vía HTTPS para mantener el proyecto gratuito.

1. Crear una cuenta gratuita en Mailjet y verificar el remitente en el
   panel del proveedor. Mailjet requiere que el remitente esté activo.
2. Configurar en Render las variables secretas `MAILJET_API_KEY`,
   `MAILJET_SECRET_KEY` y `MAILJET_SENDER_EMAIL`.
3. Configurar `EMAIL_OTP_PEPPER` con al menos 32 caracteres aleatorios.
4. Verificar la entrega a un buzón de prueba y sus límites de uso.

La API de Mailjet utilizada es `https://api.mailjet.com/v3.1/send`.
La entrega puede verse afectada por requisitos de dominio verificado,
filtros de spam o límites de cuenta del proveedor.

## Correo de un solo uso — configurar en Render

Opción SMTP solo para desarrollo local o instancias que permitan SMTP.\nActivar `EMAIL_OTP_SMTP_ENABLED=true` únicamente cuando ese transporte funcione.\nConfigurar estas variables del servicio backend mediante el panel de Render,
nunca compartir las claves en el chat ni almacenarlas en GitHub:

- \`SMTP_HOST\`: servidor SMTP compatible con STARTTLS.
- \`SMTP_PORT\`: normalmente \`587\`.
- \`SMTP_USERNAME\`: credencial del proveedor de correo.
- \`SMTP_PASSWORD\`: contraseña o clave específica para envíos.
- \`SMTP_FROM\`: remitente autorizado.
- \`EMAIL_OTP_PEPPER\`: valor aleatorio seguro de al menos 32 caracteres,
  conservado solo como variable secreta.

El método aparecerá habilitado cuando \`/api/conauti/auth/email/config\`
responda \`{"enabled":true}\`. Enviar mensajes depende del proveedor SMTP; hay
que probar la entrega real, sus límites gratuitos y la ubicación de spam.
No utilizar una contraseña personal ordinaria de correo.

## Microsoft — configurar en Microsoft Entra

En el portal Microsoft Entra (registro de aplicaciones):

1. Registrar una aplicación Web para My Teacher IA compatible con cuentas
   personales y, si corresponde, educativas.
2. Configurar el Redirect URI Web (NO SPA):
   \`https://my-teacher-ia-api.onrender.com/api/conauti/auth/microsoft/callback\`
3. Activar los ID tokens/correo verificado que requiere la aplicación; el
   código rechaza cualquier correo que Microsoft no acredite.
4. Guardar las variables exclusivamente en Render:
   \`MICROSOFT_OAUTH_CLIENT_ID\`,
   \`MICROSOFT_OAUTH_CLIENT_SECRET\` y
   \`MICROSOFT_OAUTH_REDIRECT_URI\` (la dirección exacta anterior).

El backend mantiene el proveedor desactivado si falta alguna variable.
La aplicación no solicita Microsoft Graph ni permisos sobre mensajes/contactos.

## Validación de publicación
- Verificar que Google existente sigue iniciando sesión.
- Comprobar que no se puede registrar nuevamente el mismo correo con otro
  proveedor.
- Verificar entrega real de código, caducidad y máximo de intentos.
- Verificar rechazo de tokens Microsoft falsos, no emitidos por Microsoft
  o sin identidad de correo verificado.
- Probar la versión móvil y los temas claro/oscuro.

Los servicios pueden modificar límites y requisitos en el futuro. No prometer
disponibilidad hasta que el proveedor externo esté configurado y probado.
