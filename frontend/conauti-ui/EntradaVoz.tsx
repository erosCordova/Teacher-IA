import { useEffect, useRef, useState } from 'react'

type Estado = 'listo' | 'permiso' | 'grabando' | 'transcribiendo'

type Props = {
  token: string
  disabled: boolean
  onTranscription: (text: string) => void
}

const MAX_SECONDS = 20

export default function EntradaVoz({
  token,
  disabled,
  onTranscription,
}: Props) {
  const [estado, setEstado] = useState<Estado>('listo')
  const [mensaje, setMensaje] = useState(
    'Activa el micrófono cuando quieras hablar.',
  )
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)

  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const cancelled = useRef(false)
  const generation = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const context = useRef<AudioContext | null>(null)
  const frame = useRef<number | null>(null)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearMedia() {
    if (interval.current !== null) {
      clearInterval(interval.current)
      interval.current = null
    }

    if (timeout.current !== null) {
      clearTimeout(timeout.current)
      timeout.current = null
    }

    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }

    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null

    if (context.current) {
      void context.current.close().catch(() => {})
      context.current = null
    }

    setLevel(0)
  }

  function watchVolume(media: MediaStream) {
    try {
      const audio = new AudioContext()
      const source = audio.createMediaStreamSource(media)
      const analyser = audio.createAnalyser()

      analyser.fftSize = 512
      source.connect(analyser)
      context.current = audio

      const data = new Uint8Array(analyser.fftSize)

      const update = () => {
        analyser.getByteTimeDomainData(data)

        let sum = 0

        for (const sample of data) {
          const amplitude = (sample - 128) / 128
          sum += amplitude * amplitude
        }

        setLevel(
          Math.min(
            100,
            Math.round(
              Math.sqrt(sum / data.length) * 550,
            ),
          ),
        )

        frame.current = requestAnimationFrame(update)
      }

      update()
    } catch {
      setLevel(0)
    }
  }

  async function transcribe(audio: Blob) {
    if (audio.size < 900) {
      setEstado('listo')
      setMensaje(
        'La grabación fue demasiado corta. Intenta nuevamente.',
      )
      return
    }

    const request = new AbortController()
    abort.current = request
    setEstado('transcribiendo')
    setMensaje('Reconociendo las palabras pronunciadas...')

    try {
      const response = await fetch(
        '/api/conauti/voice/transcribe',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': audio.type || 'audio/webm',
          },
          body: audio,
          signal: request.signal,
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof result.detail === 'string'
            ? result.detail
            : 'No se pudo reconocer el audio.',
        )
      }

      if (request.signal.aborted) return

      const text = String(result.text || '').trim()

      if (!text) {
        throw new Error('No se reconocieron palabras.')
      }

      onTranscription(text)

      setMensaje(
        'Texto reconocido. Revísalo y corrígelo antes de enviarlo.',
      )
    } catch (error) {
      if (!request.signal.aborted) {
        setMensaje(
          error instanceof Error
            ? error.message
            : 'No se pudo completar la transcripción.',
        )
      }
    } finally {
      if (abort.current === request) {
        abort.current = null
        setEstado('listo')
      }
    }
  }

  async function begin() {
    if (
      estado !== 'listo'
      || disabled
      || !token
    ) return

    if (
      !navigator.mediaDevices?.getUserMedia
      || typeof MediaRecorder === 'undefined'
    ) {
      setMensaje(
        'El navegador no admite grabación de audio. Usa Edge o Chrome actualizado.',
      )
      return
    }

    const attempt = ++generation.current
    cancelled.current = false
    chunks.current = []
    setSeconds(0)
    setEstado('permiso')
    setMensaje('Esperando autorización del micrófono...')

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      })

      if (attempt !== generation.current) {
        media.getTracks().forEach(track => track.stop())
        return
      }

      stream.current = media

      const mime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ].find(item => MediaRecorder.isTypeSupported(item))

      const device = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      )

      recorder.current = device

      device.ondataavailable = event => {
        if (event.data.size > 0) {
          chunks.current.push(event.data)
        }
      }

      device.onstop = () => {
        clearMedia()
        recorder.current = null

        if (cancelled.current) {
          chunks.current = []
          setEstado('listo')
          setMensaje('Grabación cancelada. No se envió audio.')
          return
        }

        const audio = new Blob(chunks.current, {
          type: device.mimeType || 'audio/webm',
        })

        chunks.current = []
        void transcribe(audio)
      }

      device.onerror = () => {
        cancelled.current = true
        clearMedia()
        setEstado('listo')
        setMensaje('Ocurrió un error al grabar audio.')
      }

      device.start(250)
      watchVolume(media)
      setEstado('grabando')
      setMensaje('Habla con claridad. Puedes detener o cancelar.')

      let elapsed = 0

      interval.current = setInterval(() => {
        elapsed += 1
        setSeconds(elapsed)

        if (elapsed >= MAX_SECONDS && device.state === 'recording') {
          device.stop()
        }
      }, 1000)

      timeout.current = setTimeout(() => {
        if (device.state === 'recording') device.stop()
      }, MAX_SECONDS * 1000)
    } catch (error) {
      clearMedia()
      setEstado('listo')
      setMensaje(
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'No autorizaste el micrófono. Puedes cambiar el permiso en el navegador.'
          : 'No se pudo iniciar el micrófono.',
      )
    }
  }

  function stop() {
    if (recorder.current?.state === 'recording') {
      recorder.current.stop()
    }
  }

  function cancel() {
    generation.current++
    cancelled.current = true
    abort.current?.abort()

    if (recorder.current?.state === 'recording') {
      recorder.current.stop()
    } else {
      clearMedia()
      setEstado('listo')
      setMensaje('Operación cancelada.')
    }
  }

  useEffect(() => {
    return () => {
      generation.current++
      cancelled.current = true
      abort.current?.abort()

      if (recorder.current?.state === 'recording') {
        recorder.current.stop()
      }

      stream.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  return (
    <section
      className="conauti-voz"
      aria-label="Entrada por voz"
    >
      <div className="conauti-voz-superior">
        <strong>🎙️ Habla con CONAUTI</strong>
        <span>
          {estado === 'grabando'
            ? `Grabando: ${seconds}/${MAX_SECONDS} s`
            : estado === 'transcribiendo'
              ? 'Reconociendo voz'
              : estado === 'permiso'
                ? 'Solicitando permiso'
                : 'Micrófono apagado'}
        </span>
      </div>

      <div className="conauti-voz-botones">
        {estado === 'listo' && (
          <button
            type="button"
            disabled={disabled || !token}
            onClick={() => void begin()}
          >
            Hablar
          </button>
        )}

        {estado === 'grabando' && (
          <>
            <button type="button" onClick={stop}>
              Detener y transcribir
            </button>
            <button type="button" onClick={cancel}>
              Cancelar grabación
            </button>
          </>
        )}

        {(estado === 'permiso' ||
          estado === 'transcribiendo') && (
          <button type="button" onClick={cancel}>
            Cancelar
          </button>
        )}
      </div>

      {estado === 'grabando' && (
        <div
          className="conauti-voz-nivel"
          role="progressbar"
          aria-label="Nivel del micrófono"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={level}
        >
          <div style={{ width: `${level}%` }} />
        </div>
      )}

      <p role="status" aria-live="polite">{mensaje}</p>
      <small>
        El audio solo se envía para transcribirlo
        y no se almacena en CONAUTI.
      </small>
    </section>
  )
}
