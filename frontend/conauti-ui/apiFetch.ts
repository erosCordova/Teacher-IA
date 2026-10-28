/** Fetch compatible con las dos implementaciones: Vercel (proxy existente)
 * y el sitio de presentación temporal en Render (HTTPS directo a FastAPI).
 * No intercepta solicitudes a sitios de terceros ni modifica fetch global.
 */
const origenAPI = typeof window !== 'undefined' &&
  window.location.hostname === 'my-teacher-ia-presentacion.onrender.com'
    ? 'https://my-teacher-ia-api.onrender.com'
    : ''

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    return fetch(origenAPI + input, init)
  }
  return fetch(input, init)
}
