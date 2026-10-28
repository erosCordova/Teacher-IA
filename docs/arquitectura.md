# Asistente Educativo IA – Arquitectura técnica

**Estado:** Arquitectura propuesta, todavía no implementada.

## Stack principal

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | React + TypeScript + Vite | Interfaz y experiencia del estudiante |
| Backend | Python + FastAPI | API, autenticación y lógica educativa |
| Base de datos | PostgreSQL | Persistencia de usuarios, mensajes y progreso |
| IA | Modelo de lenguaje con visión | Comprensión y generación de respuestas |
| Voz entrante | STT o modelo de audio | Reconocimiento de voz |
| Voz saliente | TTS o modelo de audio | Respuestas habladas |
| Tiempo real | WebSocket y/o WebRTC | Comunicación multimedia |
| Memoria | PostgreSQL + recuperación contextual | Personalización entre conversaciones |
| Testing | pytest + Vitest + Playwright | Validaciones automatizadas |
| Versionado | Git + GitHub | Control de cambios |
| CI | GitHub Actions | Compilación y pruebas |

Los proveedores concretos de IA, voz y visión se elegirán tras comprobar compatibilidad, costos y capacidades.

## Componentes del sistema

### Frontend

- Aplicación de acceso.
- Dashboard.
- Chat educativo.
- Historial de conversaciones.
- Panel de memoria.
- Materias.
- Seguimiento académico.
- Voz y pantalla compartida.
- Configuración y privacidad.
- Sistema de temas claro y oscuro.

### Backend

- Autenticación.
- Administración de usuarios.
- Gestión de conversaciones.
- Orquestación de IA.
- Motor pedagógico.
- Procesamiento de voz.
- Procesamiento de imágenes autorizadas.
- Gestión de memoria.
- Evaluaciones.
- Auditoría y seguridad.

## Entidades principales

- Usuario.
- Rol.
- Conversación.
- Mensaje.
- Preferencia.
- Recuerdo.
- Consentimiento.
- Actividad.
- Intento.
- Evaluación.
- Progreso.

Cada recurso privado estará vinculado a su propietario.

## Flujo del chat

1. El estudiante realiza una pregunta.
2. La API valida identidad y permisos.
3. Se recupera el contexto autorizado.
4. Se identifican la intención y el estado pedagógico.
5. El motor decide la estrategia de ayuda.
6. El modelo genera una respuesta.
7. Se verifican las reglas aplicables.
8. Se devuelve la respuesta.
9. Se almacena el mensaje autorizado.
10. Se actualiza el estado correspondiente.

## Flujo de voz

1. El usuario activa voluntariamente el micrófono.
2. Se procesa la entrada hablada.
3. Se obtiene una transcripción o representación equivalente.
4. Se consulta al asistente.
5. Se genera respuesta textual.
6. Se reproduce audio.
7. Se permite detener, cancelar o continuar.

## Flujo de pantalla

1. El estudiante solicita compartir una superficie.
2. El navegador presenta su selector de permisos.
3. Se obtiene la superficie autorizada.
4. Se toman fotogramas limitados.
5. Se envían con autorización al backend.
6. Un modelo visual interpreta lo recibido.
7. Se responde usando el contexto de la conversación.
8. Se detiene la captura al cancelar el permiso.

La aplicación no puede afirmar que ve contenido que no ha recibido.

## Estrategia de memoria

- Contexto inmediato: mensajes actuales.
- Historial: conversaciones persistentes.
- Memoria personal: recuerdos consentidos.
- Progreso: resultados observables.
- Conocimiento académico: contenido revisado.

Los recuerdos incluirán procedencia y mecanismos de corrección y eliminación.

## Estructura inicial prevista

Asistente_Educativo_IA_CONAUTI/
- frontend/
- backend/
- docs/
- README.md
- .env.example

Se crearán las carpetas técnicas durante la Fase 02.

## Orden del desarrollo

01. Alcance y criterios.
02. Entorno y repositorio.
03. Base de datos y usuarios.
04. Interfaz y navegación.
05. Historial.
06. Inteligencia artificial real.
07. Motor pedagógico.
08. Reconocimiento de voz.
09. Respuesta hablada.
10. Pantalla compartida.
11. Memoria y personalización.
12. Progreso educativo.
13. Seguridad y privacidad.
14. Pruebas integrales.
15. Despliegue.
16. Piloto educativo.

Cada fase se valida antes de acreditar su porcentaje.
