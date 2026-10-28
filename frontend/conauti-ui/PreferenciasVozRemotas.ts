
import {
  obtenerVozKokoro,
  obtenerVelocidadKokoro,
  obtenerVolumenKokoro,
  type KokoroVoice,
} from './KokoroPlayer'

export type RemoteVoicePreferences = {
  voice: KokoroVoice
  speed: number
  volume: number
}

const AUTH_KEY = "conauti_token"
const AUTH_STORAGE = "sessionStorage"

const URL = '/api/conauti/preferences/voice'

function accessToken(): string | null {
  try {
    const storage =
      AUTH_STORAGE === 'sessionStorage'
        ? window.sessionStorage
        : window.localStorage

    const raw = storage.getItem(AUTH_KEY)

    if (!raw) return null

    let token = raw

    try {
      const parsed: unknown = JSON.parse(raw)

      if (typeof parsed === 'string') {
        token = parsed
      } else if (
        parsed &&
        typeof parsed === 'object' &&
        'token' in parsed
      ) {
        const value = (
          parsed as { token?: unknown }
        ).token

        if (typeof value === 'string') {
          token = value
        }
      }
    } catch {
      // El token puede estar guardado como texto.
    }

    token = token.replace(/^Bearer\s+/i, '').trim()

    return token || null
  } catch {
    return null
  }
}

function validPreferences(
  value: unknown,
): value is RemoteVoicePreferences {
  if (!value || typeof value !== 'object') {
    return false
  }

  const data = value as Record<string, unknown>

  return (
    ['ef_dora', 'em_alex', 'em_santa']
      .includes(String(data.voice)) &&
    typeof data.speed === 'number' &&
    Number.isFinite(data.speed) &&
    data.speed >= 0.75 &&
    data.speed <= 1.25 &&
    typeof data.volume === 'number' &&
    Number.isFinite(data.volume) &&
    data.volume >= 0 &&
    data.volume <= 1
  )
}

export async function recuperarPreferenciasRemotas(
  signal: AbortSignal,
): Promise<RemoteVoicePreferences | null> {
  const token = accessToken()
  if (!token) return null

  const response = await fetch(URL, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) return null

  const data: unknown = await response.json()

  return validPreferences(data) ? data : null
}

let timer: ReturnType<typeof setTimeout> | null = null

export function programarGuardadoRemoto(): void {
  if (timer !== null) clearTimeout(timer)

  timer = setTimeout(() => {
    timer = null
    void guardarPreferenciasRemotas()
  }, 650)
}

async function guardarPreferenciasRemotas(): Promise<void> {
  const token = accessToken()
  if (!token) return

  try {
    const response = await fetch(URL, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        voice: obtenerVozKokoro(),
        speed: obtenerVelocidadKokoro(),
        volume: obtenerVolumenKokoro(),
      }),
    })

    if (!response.ok) {
      console.warn(
        'No fue posible sincronizar las preferencias de voz.',
      )
    }
  } catch {
    console.warn(
      'Preferencias guardadas localmente; '
      + 'sincronización remota pendiente.',
    )
  }
}


// MYTEACHER_GUARDADO_VERIFICADO_V1
export type ResultadoGuardadoVoz = {
  ok: boolean
  mensaje: string
}

export async function guardarPreferenciasVozAhora():
  Promise<ResultadoGuardadoVoz> {

  const token = accessToken()

  if (!token) {
    return {
      ok: false,
      mensaje:
        'No se encontró una sesión activa. '
        + 'Inicia sesión para guardar en tu cuenta.',
    }
  }

  const preferencias = {
    voice: obtenerVozKokoro(),
    speed: obtenerVelocidadKokoro(),
    volume: obtenerVolumenKokoro(),
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  try {
    const response = await fetch(URL, {
      method: 'PUT',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify(preferencias),
    })

    if (!response.ok) {
      if (response.status === 401 ||
          response.status === 403) {
        return {
          ok: false,
          mensaje:
            `Error ${response.status}: `
            + 'el servidor rechazó la autorización.',
        }
      }

      return {
        ok: false,
        mensaje:
          `Error ${response.status}: `
          + 'no se pudieron guardar las preferencias.',
      }
    }

    // No confiar únicamente en el HTTP 200.
    // Leer nuevamente lo almacenado.

    const verification = await fetch(URL, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    if (!verification.ok) {
      return {
        ok: false,
        mensaje:
          `Guardado recibido, pero la lectura `
          + `falló (${verification.status}).`,
      }
    }

    const persisted: unknown =
      await verification.json()

    if (!validPreferences(persisted)) {
      return {
        ok: false,
        mensaje:
          'El servidor devolvió preferencias '
          + 'con un formato inesperado.',
      }
    }

    const sameVoice =
      persisted.voice === preferencias.voice

    const sameSpeed =
      Math.abs(
        persisted.speed - preferencias.speed
      ) < 0.011

    const sameVolume =
      Math.abs(
        persisted.volume - preferencias.volume
      ) < 0.011

    if (!sameVoice || !sameSpeed || !sameVolume) {
      return {
        ok: false,
        mensaje:
          'Los valores recuperados no coinciden '
          + 'con los enviados.',
      }
    }

    return {
      ok: true,
      mensaje:
        'Preferencias guardadas y verificadas '
        + 'en tu cuenta.',
    }

  } catch {
    return {
      ok: false,
      mensaje:
        'Error de conexión al guardar o '
        + 'verificar las preferencias.',
    }
  }
}
