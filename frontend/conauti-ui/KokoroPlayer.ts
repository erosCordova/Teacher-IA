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
 * Prepara el modelo Kokoro REAL en el navegador al activar la voz.
 * Render no incluye un servidor local TTS: evitamos bloquear el inicio
 * en una consulta HTTP a un motor que no existe.
 * Modelo y fonemizador comparten una promesa, sin descargas duplicadas.
 */
let motorLocalListo = false
let preparandoLocal: Promise<void> | null = null

function prepararMotorLocal(): Promise<void> {
  if (motorLocalListo) return Promise.resolve()
  if (preparandoLocal) return preparandoLocal

  const tarea = import('./KokoroBrowser')
    .then(modulo => modulo.prepararKokoroEnNavegador())
    .then(() => { motorLocalListo = true })

  preparandoLocal = tarea
  // No se almacena indefinidamente un fallo de descarga; permitir reintentar.
  void tarea.then(
    () => { if (preparandoLocal === tarea) preparandoLocal = null },
    error => {
      if (preparandoLocal === tarea) preparandoLocal = null
      console.warn('No se pudo preparar Kokoro local.', error)
    },
  )
  return tarea
}

export function prepararVozKokoroRapida(): void {
  // Llamado en el clic del micrófono; STT e IA avanzan mientras carga Kokoro.
  void prepararMotorLocal().catch(() => {})
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
  /** Compatibilidad con integraciones anteriores; siempre se usa el motor real local. */
  omitirServidor?: boolean
  /** Límite solo para el arranque inicial, no para el tiempo de reproducción. */
  esperaLocalMs?: number
  /** Espera acotada mientras se precarga Kokoro en paralelo con la IA. */
  priorizarRapidez?: boolean
  onPreparando?: () => void
  onKokoroIniciado?: () => void
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


  /** Un fallo o descarga lenta no debe dejar el chat bloqueado indefinidamente. */
  const esperarConLimite = <T,>(tarea: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (abort.signal.aborted) {
        reject(new Error('Reproducción cancelada.'))
        return
      }

      let completado = false
      const limpiar = () => {
        clearTimeout(temporizador)
        abort.signal.removeEventListener('abort', cancelar)
      }
      const cancelar = () => {
        if (completado) return
        completado = true
        limpiar()
        reject(new Error('Reproducción cancelada.'))
      }
      const temporizador = setTimeout(() => {
        if (completado) return
        completado = true
        limpiar()
        reject(new Error('El motor Kokoro está tardando en prepararse.'))
      }, ms)

      abort.signal.addEventListener('abort', cancelar, { once: true })
      tarea.then(
        valor => {
          if (completado) return
          completado = true
          limpiar()
          resolve(valor)
        },
        error => {
          if (completado) return
          completado = true
          limpiar()
          reject(error)
        },
      )
    })

  const reproducir = async (blob: Blob) => {
    if (!vigente()) return
    // Emitir "hablando" cuando COMIENZA el audio, no durante la descarga.
    await reproducirBlobKokoro(blob, volumen, abort.signal, () => {
      if (!vigente() || iniciado) return
      iniciado = true
      opciones.onKokoroIniciado?.()
      mensaje.onstart?.call(
        mensaje,
        new Event('start') as SpeechSynthesisEvent,
      )
    })
  }

  const ejecutar = async () => {
    const fragmentos = dividirTexto(mensaje.text)
    if (!fragmentos.length) {
      finalizar()
      return
    }

    try {
      if (!motorLocalListo) opciones.onPreparando?.()
      const limiteCarga = opciones.esperaLocalMs ??
        (opciones.priorizarRapidez ? 35000 : 60000)

      // El primer modelo pesa cerca de 92 MB y se conserva en la caché.
      // No usar una voz falsa inmediatamente: dar oportunidad real a Kokoro.
      await esperarConLimite(prepararMotorLocal(), limiteCarga)
      if (!vigente()) return

      const { sintetizarKokoroEnNavegador } = await import('./KokoroBrowser')
      for (const fragmento of fragmentos) {
        if (!vigente()) return

        // Cada fragmento tiene su propio límite de seguridad. Kokoro
        // tiene prioridad; la voz del navegador solo es contingencia.
        const blob = await esperarConLimite(
          sintetizarKokoroEnNavegador(fragmento, voz, velocidad),
          30000,
        )
        if (!vigente()) return
        if (!blob.size || !blob.type.startsWith('audio/')) {
          throw new Error('Kokoro no generó audio válido.')
        }
        await reproducir(blob)
      }

      finalizar()
    } catch (error) {
      if (!vigente()) return
      console.warn('Kokoro no pudo generar o reproducir el audio.', error)
      respaldo()
    }
  }

  void ejecutar()
}
