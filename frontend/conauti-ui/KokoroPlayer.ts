import { apiFetch } from './apiFetch'
import {
  reproducirBlobKokoro,
} from './KokoroAudio'

export const KOKORO_VOICE_KEY = 'myteacher.voice.v1'

export type KokoroVoice =
  | 'ef_dora'
  | 'em_alex'
  | 'em_santa'

const VOICES: KokoroVoice[] = [
  'ef_dora',
  'em_alex',
  'em_santa',
]

export function obtenerVozKokoro(): KokoroVoice {
  try {
    const saved = localStorage.getItem(KOKORO_VOICE_KEY)

    if (saved && VOICES.includes(saved as KokoroVoice)) {
      return saved as KokoroVoice
    }
  } catch {
    // Utilizar valor predeterminado.
  }

  return 'ef_dora'
}


// MYTEACHER_VOICE_SETTINGS_V1
export const KOKORO_SPEED_KEY =
  'myteacher.voice.speed.v1'

export const KOKORO_VOLUME_KEY =
  'myteacher.voice.volume.v1'

function leerNumero(
  clave: string,
  predeterminado: number,
  minimo: number,
  maximo: number,
): number {
  try {
    const guardado = localStorage.getItem(clave)

    if (guardado === null || guardado.trim() === '') {
      return predeterminado
    }

    const numero = Number(guardado)

    if (!Number.isFinite(numero)) {
      return predeterminado
    }

    return Math.min(
      maximo,
      Math.max(minimo, numero),
    )
  } catch {
    return predeterminado
  }
}

export function obtenerVelocidadKokoro(): number {
  return leerNumero(
    KOKORO_SPEED_KEY,
    1,
    0.75,
    1.25,
  )
}

export function obtenerVolumenKokoro(): number {
  return leerNumero(
    KOKORO_VOLUME_KEY,
    1,
    0,
    1,
  )
}

let version = 0
let controller: AbortController | null = null
let audioActual: HTMLAudioElement | null = null
let urlActual: string | null = null

function limpiarAudio() {
  controller?.abort()
  controller = null

  if (audioActual) {
    audioActual.pause()
    audioActual.onended = null
    audioActual.onerror = null
    audioActual.removeAttribute('src')
    audioActual = null
  }

  if (urlActual) {
    URL.revokeObjectURL(urlActual)
    urlActual = null
  }
}

export function cancelarVozKokoro(
  sintetizador: SpeechSynthesis,
): void {
  version += 1
  limpiarAudio()
  sintetizador.cancel()
}

function dividirTexto(texto: string): string[] {
  const resultado: string[] = []
  let restante = texto.trim()

  while (restante.length > 0) {
    let corte = Math.min(220, restante.length)

    if (corte < restante.length) {
      const espacio = restante.lastIndexOf(' ', corte)

      if (espacio > 65) {
        corte = espacio + 1
      }
    }

    const fragmento = restante.slice(0, corte).trim()

    if (fragmento) {
      resultado.push(fragmento)
    }

    restante = restante.slice(corte).trim()
  }

  return resultado
}

export type OpcionesKokoro = {
  /** Evitar el intento de conexión a un servidor Kokoro inexistente. */
  omitirServidor?: boolean
  /** Tiempo máximo del primer intento de Kokoro local antes de responder con la voz del navegador. */
  esperaLocalMs?: number
  onFallback?: () => void
}

export function hablarConKokoro(
  mensaje: SpeechSynthesisUtterance,
  sintetizador: SpeechSynthesis,
  opciones: OpcionesKokoro = {},
): void {
  version += 1
  limpiarAudio()

  const velocidad = obtenerVelocidadKokoro()
  const volumen = obtenerVolumenKokoro()
  const voz = obtenerVozKokoro()

  mensaje.rate = velocidad
  mensaje.volume = volumen

  const turno = version
  const abort = new AbortController()
  controller = abort

  const vigente = () =>
    version === turno && !abort.signal.aborted

  let iniciado = false

  const finalizar = () => {
    if (!vigente()) return
    const handler = mensaje.onend
    limpiarAudio()
    handler?.call(
      mensaje,
      new Event('end') as SpeechSynthesisEvent,
    )
  }

  const respaldo = () => {
    if (!vigente()) return

    // No reproducir de nuevo una frase que ya comenzó a oírse.
    if (iniciado) {
      finalizar()
      return
    }

    limpiarAudio()
    opciones.onFallback?.()
    try {
      sintetizador.speak(mensaje)
    } catch (error) {
      console.error('No pudo iniciarse la voz del navegador.', error)
      mensaje.onerror?.call(
        mensaje,
        new Event('error') as SpeechSynthesisErrorEvent,
      )
    }
  }

  const reproducir = async (blob: Blob) => {
    if (!vigente()) return

    // AudioContext se desbloquea desde el boton "Iniciar"
    // antes de acceder al microfono y consultar a Gemini.
    await reproducirBlobKokoro(blob, volumen, abort.signal)

    if (vigente() && !iniciado) {
      iniciado = true
      mensaje.onstart?.call(
        mensaje,
        new Event('start') as SpeechSynthesisEvent,
      )
    }
  }

  const ejecutar = async () => {
    const fragmentos = dividirTexto(mensaje.text)
    if (!fragmentos.length) {
      finalizar()
      return
    }

    let motorLocal = false

    try {
      for (const fragmento of fragmentos) {
        if (!vigente()) return

        let blob: Blob | null = null

        if (!motorLocal && !opciones.omitirServidor) {
          try {
            const respuesta = await apiFetch(
              '/api/conauti/kokoro/speech',
              {
                method: 'POST',
                credentials: 'same-origin',
                signal: abort.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: fragmento,
                  voice: voz,
                  speed: velocidad,
                }),
              },
            )

            if (!respuesta.ok) {
              throw new Error(`Kokoro remoto: HTTP ${respuesta.status}`)
            }
            blob = await respuesta.blob()
            if (!blob.type.startsWith('audio/')) {
              throw new Error('Audio remoto inválido.')
            }
          } catch (error) {
            if (!vigente()) return
            console.info(
              'Kokoro remoto no disponible; iniciando Kokoro local.',
              error,
            )
            motorLocal = true
          }
        }

        if (motorLocal || opciones.omitirServidor) {
          // Se carga bajo demanda, sin aumentar el paquete de inicio.
          const { sintetizarKokoroEnNavegador } =
            await import('./KokoroBrowser')
          if (!vigente()) return

          // Una primera descarga larga no debe dejar al estudiante
          // esperando en silencio indefinidamente. El modelo sigue
          // cargandose y queda listo para el siguiente turno.
          let temporizador: ReturnType<typeof setTimeout> | null = null
          try {
            blob = await Promise.race([
              sintetizarKokoroEnNavegador(
                fragmento,
                voz,
                velocidad,
              ),
              new Promise<never>((_, reject) => {
                temporizador = setTimeout(() => {
                  reject(
                    new Error(
                      'Kokoro aun se esta descargando.',
                    ),
                  )
                }, opciones.esperaLocalMs ?? 12000)
              }),
            ])
          } finally {
            if (temporizador !== null) {
              clearTimeout(temporizador)
            }
          }
        }

        if (!vigente()) return
        if (!blob) throw new Error('No se generó audio.')
        await reproducir(blob)
      }

      finalizar()
    } catch (error) {
      if (!vigente()) return
      console.warn(
        'Kokoro no pudo sintetizar en este dispositivo.',
        error,
      )
      respaldo()
    }
  }

  void ejecutar()
}
