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
    let corte = Math.min(1200, restante.length)

    if (corte < restante.length) {
      const espacio = restante.lastIndexOf(' ', corte)

      if (espacio > 400) {
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

export function hablarConKokoro(
  mensaje: SpeechSynthesisUtterance,
  sintetizador: SpeechSynthesis,
): void {
  version += 1
  limpiarAudio()

  const velocidad = obtenerVelocidadKokoro()
  const volumen = obtenerVolumenKokoro()

  // Mantener las preferencias en el respaldo
  // de voz del navegador.
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

    if (iniciado) {
      console.warn(
        'Kokoro dejó de responder durante el audio.',
      )
      finalizar()
      return
    }

    limpiarAudio()

    try {
      sintetizador.speak(mensaje)
    } catch (error) {
      console.error(
        'No se pudo activar la voz de respaldo.',
        error,
      )
    }
  }

  const ejecutar = async () => {
    const fragmentos = dividirTexto(mensaje.text)

    if (!fragmentos.length) {
      finalizar()
      return
    }

    try {
      for (const fragmento of fragmentos) {
        if (!vigente()) return

        const respuesta = await fetch(
          '/api/conauti/kokoro/speech',
          {
            method: 'POST',
            credentials: 'same-origin',
            signal: abort.signal,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: fragmento,
              voice: obtenerVozKokoro(),
              speed: velocidad,
            }),
          },
        )

        if (!respuesta.ok) {
          throw new Error(
            `Kokoro HTTP ${respuesta.status}`,
          )
        }

        const blob = await respuesta.blob()

        if (!vigente()) return

        if (!blob.size || !blob.type.startsWith('audio/')) {
          throw new Error('Kokoro devolvió audio inválido')
        }

        const objectUrl = URL.createObjectURL(blob)
        urlActual = objectUrl

        const reproductor = new Audio(objectUrl)
        reproductor.volume = volumen
        audioActual = reproductor

        await new Promise<void>((resolve, reject) => {
          const quitar = () => {
            abort.signal.removeEventListener(
              'abort',
              cancelar,
            )
          }

          const cancelar = () => {
            quitar()
            reject(new Error('Audio cancelado'))
          }

          const terminado = () => {
            quitar()
            resolve()
          }

          const fallo = () => {
            quitar()
            reject(new Error('Error al reproducir audio'))
          }

          abort.signal.addEventListener(
            'abort',
            cancelar,
            { once: true },
          )

          reproductor.onended = terminado
          reproductor.onerror = fallo

          void reproductor.play().then(() => {
            if (vigente() && !iniciado) {
              iniciado = true

              mensaje.onstart?.call(
                mensaje,
                new Event('start') as SpeechSynthesisEvent,
              )
            }
          }).catch(fallo)
        })

        if (!vigente()) return

        audioActual = null
        URL.revokeObjectURL(objectUrl)
        urlActual = null
      }

      finalizar()
    } catch (error) {
      if (!vigente()) return

      console.warn(
        'Error en Kokoro. Evaluando respaldo.',
        error,
      )

      respaldo()
    }
  }

  void ejecutar()
}
