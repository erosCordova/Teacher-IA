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


/**
 * Camino rápido de voz: comprobar una sola vez si existe Kokoro remoto.
 * Si no existe, la primera respuesta sale inmediatamente con la voz
 * española del navegador mientras Kokoro local se prepara en segundo plano.
 */
let servidorKokoro: 'desconocido' | 'disponible' | 'no_disponible' = 'desconocido'
let comprobacionKokoro: Promise<void> | null = null
let motorLocalListo = false
let preparandoLocal: Promise<void> | null = null

function prepararMotorLocal(): void {
  if (motorLocalListo || preparandoLocal) return
  const tarea = import('./KokoroBrowser')
    .then(modulo => modulo.prepararKokoroEnNavegador())
    .then(() => { motorLocalListo = true })
    .catch(() => {
      // No detener la conversación. Se puede intentar otra vez más adelante.
    })
    .finally(() => { preparandoLocal = null })
  preparandoLocal = tarea
}

export function prepararVozKokoroRapida(): void {
  if (comprobacionKokoro || servidorKokoro !== 'desconocido') return
  const tarea = (async () => {
    const cancelacion = new AbortController()
    const limite = setTimeout(() => cancelacion.abort(), 1600)
    try {
      const respuesta = await apiFetch('/api/conauti/kokoro/status', {
        signal: cancelacion.signal,
      })
      if (!respuesta.ok) throw new Error('Kokoro remoto no disponible')
      const estado: { available?: boolean } = await respuesta.json()
      servidorKokoro = estado.available === true ? 'disponible' : 'no_disponible'
    } catch {
      servidorKokoro = 'no_disponible'
    } finally {
      clearTimeout(limite)
    }
  })()
  comprobacionKokoro = tarea
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
  /** Responder ya con TTS del navegador si Kokoro todavía no está listo. */
  priorizarRapidez?: boolean
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

  if (opciones.priorizarRapidez) {
    prepararVozKokoroRapida()
    if (servidorKokoro !== 'disponible' && !motorLocalListo) {
      // No esperar la descarga del modelo: la frase se escucha inmediatamente.
      if (servidorKokoro === 'no_disponible') prepararMotorLocal()
      respaldo()
      return
    }
  }

  const reproducir = async (blob: Blob) => {
    if (!vigente()) return

    // Avisar al componente ANTES de empezar a reproducir.
    // La implementación anterior emitía onstart al terminar TODO el primer
    // fragmento y no permitía detener a tiempo una respuesta Kokoro larga.
    if (!iniciado) {
      iniciado = true
      mensaje.onstart?.call(
        mensaje,
        new Event('start') as SpeechSynthesisEvent,
      )
    }
    if (!vigente()) return
    await reproducirBlobKokoro(blob, volumen, abort.signal)
  }

  const ejecutar = async () => {
    const fragmentos = dividirTexto(mensaje.text)
    if (!fragmentos.length) {
      finalizar()
      return
    }

    let motorLocal = Boolean(opciones.omitirServidor) || (
      Boolean(opciones.priorizarRapidez) && servidorKokoro !== 'disponible'
    )

    try {
      for (const fragmento of fragmentos) {
        if (!vigente()) return

        let blob: Blob | null = null

        if (!motorLocal && !opciones.omitirServidor) {
          try {
            const remoto = new AbortController()
            const cancelarRemoto = () => remoto.abort()
            abort.signal.addEventListener('abort', cancelarRemoto, { once: true })
            const limiteRemoto = setTimeout(
              cancelarRemoto, opciones.priorizarRapidez ? 3500 : 12000,
            )
            let respuesta: Response
            try {
              respuesta = await apiFetch('/api/conauti/kokoro/speech', {
                method: 'POST',
                credentials: 'same-origin',
                signal: remoto.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: fragmento, voice: voz, speed: velocidad }),
              })
            } finally {
              clearTimeout(limiteRemoto)
              abort.signal.removeEventListener('abort', cancelarRemoto)
            }

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
            if (opciones.priorizarRapidez && !motorLocalListo) {
              servidorKokoro = 'no_disponible'
              prepararMotorLocal()
              respaldo()
              return
            }
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
                }, opciones.esperaLocalMs ?? (opciones.priorizarRapidez ? 3000 : 12000))
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
