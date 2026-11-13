/** Fetch compatible con las dos implementaciones: Vercel (proxy existente)
 * y el sitio de presentación temporal en Render (HTTPS directo a FastAPI).
 * No intercepta solicitudes a sitios de terceros ni modifica fetch global.
 */
// El WebView Android ejecuta la interfaz empaquetada en http://localhost.
// Solo el modo nativo y la presentación publicada usan FastAPI en HTTPS.
const esAplicacionNativa = typeof window !== 'undefined' &&
  (Boolean((window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean }
  }).Capacitor?.isNativePlatform?.()) ||
    (window.location.origin === 'http://localhost' &&
     typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)))

const origenAPI = typeof window !== 'undefined' &&
  (window.location.hostname === 'my-teacher-ia-presentacion.onrender.com' || esAplicacionNativa)
    ? 'https://my-teacher-ia-api.onrender.com'
    : ''

// Sustitución solo al compilar el APK efímero de integración Android.
// El APK normal y la web pública conservan su origen HTTPS fijo.
const origenCI = import.meta.env.VITE_ANDROID_CI_TESTS === '1' &&
  import.meta.env.DEV === false &&
  esAplicacionNativa &&
  import.meta.env.VITE_ANDROID_CI_API_ORIGIN === 'http://localhost:8010'
    ? 'http://localhost:8010'
    : ''

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    return fetch((origenCI || origenAPI) + input, init)
  }
  return fetch(input, init)
}
