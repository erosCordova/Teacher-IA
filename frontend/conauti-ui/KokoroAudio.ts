/**
 * Reproduccion Kokoro con AudioContext habilitado desde una
 * interaccion real del usuario, evitando bloqueo de autoplay.
 */
let contexto: AudioContext | null = null
let ganancia: GainNode | null = null

export function habilitarAudioKokoro(): void {
  try {
    if (typeof AudioContext === 'undefined') return
    if (!contexto || contexto.state === 'closed') {
      contexto = new AudioContext()
    }
    // Se llama dentro del click del microfono o de "Escuchar".
    void contexto.resume().catch(() => {})
  } catch (error) {
    console.warn('No se pudo habilitar AudioContext.', error)
  }
}

export function actualizarVolumenAudioKokoro(valor: number): void {
  if (ganancia) {
    ganancia.gain.value = Math.max(0, Math.min(1, valor))
  }
}

export async function reproducirBlobKokoro(
  blob: Blob,
  volumen: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return
  if (!blob.size) throw new Error('Audio Kokoro vacio.')

  const ctx = contexto

  if (ctx?.state === 'running') {
    const bytes = await blob.arrayBuffer()
    const datos = await ctx.decodeAudioData(bytes)
    if (signal.aborted) return

    const fuente = ctx.createBufferSource()
    const control = ctx.createGain()
    control.gain.value = volumen
    ganancia = control
    fuente.buffer = datos
    fuente.connect(control)
    control.connect(ctx.destination)

    try {
      await new Promise<void>((resolve, reject) => {
        let terminado = false

        const limpiar = () => {
          signal.removeEventListener('abort', cancelar)
          fuente.onended = null
          fuente.disconnect()
          control.disconnect()
        }

        const completar = () => {
          if (terminado) return
          terminado = true
          limpiar()
          resolve()
        }

        const cancelar = () => {
          if (terminado) return
          terminado = true
          try { fuente.stop() } catch { /* Ya finalizo */ }
          limpiar()
          reject(new Error('Reproduccion cancelada.'))
        }

        signal.addEventListener('abort', cancelar, { once: true })
        fuente.onended = completar

        try {
          fuente.start()
        } catch (error) {
          terminado = true
          limpiar()
          reject(error)
        }
      })
    } finally {
      if (ganancia === control) ganancia = null
    }
    return
  }

  // Compatibilidad con navegadores sin WebAudio disponible.
  const objectUrl = URL.createObjectURL(blob)
  const audio = new Audio(objectUrl)
  audio.volume = volumen

  try {
    await new Promise<void>((resolve, reject) => {
      let terminado = false

      const limpiar = () => {
        signal.removeEventListener('abort', cancelar)
        audio.onended = null
        audio.onerror = null
      }
      const completar = () => {
        if (terminado) return
        terminado = true
        limpiar()
        resolve()
      }
      const fallar = () => {
        if (terminado) return
        terminado = true
        limpiar()
        reject(new Error('El navegador no pudo reproducir audio.'))
      }
      const cancelar = () => {
        audio.pause()
        fallar()
      }

      signal.addEventListener('abort', cancelar, { once: true })
      audio.onended = completar
      audio.onerror = fallar
      void audio.play().catch(fallar)
    })
  } finally {
    audio.pause()
    audio.removeAttribute('src')
    URL.revokeObjectURL(objectUrl)
  }
}
