# Asistente Educativo IA – CONAUTI
## Requisitos funcionales y criterios de aceptación

**Versión:** 1.0
**Modalidad:** Desarrollo individual
**Objetivo:** Construir una plataforma educativa completa para estudiantes de secundaria, con inteligencia artificial real, memoria persistente, voz bidireccional y análisis autorizado de pantalla.

### Historias de usuario

| ID | Requisito | Fase | Validación |
|---|---|---|---|
| HU-01 | Chat educativo con IA real y orientación pedagógica | 06–07 | Conversación real y revisión de ejercicios |
| HU-02 | Historial persistente y recuperación de conversaciones | 05 | Guardar, buscar, renombrar, continuar y eliminar |
| HU-03 | Conversación por voz bidireccional | 08–09 | Micrófono, reconocimiento y respuesta audible |
| HU-04 | Compartir pantalla y analizar lo mostrado | 10 | Captura autorizada e interpretación visual |
| HU-05 | Memoria entre conversaciones | 11 | Recuperación de preferencias autorizadas |
| HU-06 | Edición y eliminación de recuerdos | 11 | Corrección y olvido verificables |
| HU-07 | Conversar por voz mientras se comparte pantalla | 10 | Sesión multimodal integrada |
| HU-08 | Evaluaciones y progreso independiente | 12 | Ejercicios sin pistas y rúbricas |
| HU-09 | Control y protección de datos | 03,13 | Exportación, eliminación y autorización |

### Diseño obligatorio

La aplicación deberá reproducir fielmente las cuatro interfaces aprobadas:

1. Chat educativo en tema claro.
2. Chat educativo en tema oscuro.
3. Historial de conversaciones y memoria.
4. Conversación por voz y pantalla compartida.

La estructura principal tendrá:

- Barra superior con marca, búsqueda, notificaciones, perfil y selector Claro/Oscuro.
- Menú izquierdo: Inicio, Chat, Historial, Materias, Memoria, Progreso, Configuración.
- Área central con el contenido principal.
- Panel derecho contextual con progreso, sugerencias o estado de la sesión.

El tema debe cambiar sin recargar la página y conservar la elección.

### Chat educativo

El estudiante podrá:

- Escribir consultas libremente.
- Seleccionar una materia.
- Obtener explicaciones comprensibles.
- Pedir pistas graduales.
- Solicitar explicaciones más sencillas.
- Obtener ejemplos diferentes.
- Enviar sus intentos para revisión.
- Adjuntar contenido permitido.
- Iniciar una conversación por voz.
- Retomar conversaciones guardadas.

Botones obligatorios:

- Dame una pista.
- Más fácil.
- Otro ejemplo.
- Revisa mi intento.

El asistente orientará al estudiante sin sustituir sistemáticamente su razonamiento.

### Historial y memoria

El historial permitirá buscar, continuar, renombrar, exportar y eliminar conversaciones.

La memoria conservará únicamente información pertinente y autorizada, como:

- Preferencias para aprender.
- Temas estudiados.
- Conceptos por reforzar.
- Dificultades observadas.
- Correcciones explícitas.
- Objetivos académicos.

El usuario podrá revisar, corregir, eliminar y desactivar la memoria.

La adaptación mediante memoria no equivale a modificar automáticamente los pesos del modelo de IA.

### Voz y pantalla compartida

- Solicitar permiso antes de usar micrófono.
- Escuchar preguntas habladas en español.
- Generar respuestas audibles.
- Permitir pausar, silenciar e interrumpir.
- Mostrar transcripción cuando corresponda.
- Solicitar compartir pestaña, ventana o pantalla.
- Visualizar la superficie autorizada.
- Analizar fotogramas realmente recibidos.
- Vincular la imagen a la conversación activa.
- Permitir dejar de compartir inmediatamente.
- No almacenar audio o capturas por defecto.

### Seguridad y accesibilidad

- Autorización estricta por cuenta.
- No exigir DNI a estudiantes.
- No revelar conversaciones entre usuarios.
- Controles de consentimiento independientes.
- Protección de credenciales y secretos.
- Navegación mediante teclado.
- Diseño adaptable a móviles.
- Etiquetas accesibles e indicadores de estado.
- Mensajes claros ante fallos o permisos denegados.
- Autorizaciones aplicables para pruebas con menores.

### Casos académicos iniciales

Matemática: artículo de S/80 con descuento del 25 %. El estudiante debe construir su respuesta con orientación.

Comunicación: redactar y justificar una opinión propia sobre el uso del celular en clase.

Evaluación independiente: artículo de S/150 con descuento del 20 %. El estudiante debe obtener S/120 y explicar el procedimiento sin pistas.

### Definición de producto terminado

El sistema solo estará completo cuando todos los requisitos esenciales estén implementados, integrados, probados y desplegados, y el piloto autorizado haya sido evaluado.
