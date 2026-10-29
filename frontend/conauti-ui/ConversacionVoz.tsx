import { apiFetch } from './apiFetch'
import { hablarConKokoro, cancelarVozKokoro } from './KokoroPlayer'
import { habilitarAudioKokoro } from './KokoroAudio'
import { useEffect, useRef, useState } from 'react'

type Phase =
  | 'inactivo'
  | 'escuchando'
  | 'transcribiendo'
  | 'pensando'
  | 'hablando'
  | 'pausado'

type Props = {
  token: string
  conversationId: string | null
  onConversationCreated: (id: string) => void
  onMessages: (messages: unknown[]) => void
  autoStart?: boolean
  compact?: boolean
  onClose?: () => void
}

export default function ConversacionVoz({
  token,
  conversationId,
  onConversationCreated,
  onMessages,
  autoStart = false,
  compact = false,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>('inactivo')
  const [notice, setNotice] = useState(
    'Inicia una conversación por voz cuando quieras.',
  )
  const [heard, setHeard] = useState('')
  const [answered, setAnswered] = useState('')
  const [volume, setVolume] = useState(0)
  const [voiceName, setVoiceName] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  const running = useRef(false)
  const session = useRef(0)
  const speechTurn = useRef(0)
  const activeConversation = useRef<string | null>(conversationId)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const monitor = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controller = useRef<AbortController | null>(null)
  const parts = useRef<Blob[]>([])
  const manualStop = useRef(false)

  function releaseMicrophone() {
    if (monitor.current) clearInterval(monitor.current)
    if (maxTimer.current) clearTimeout(maxTimer.current)

    monitor.current = null
    maxTimer.current = null

    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null

    if (audioContext.current) {
      void audioContext.current.close().catch(() => {})
    }

    audioContext.current = null
    setVolume(0)
  }

  function halt(
    label = 'Conversación finalizada. Micrófono apagado.',
  ) {
    running.current = false
    session.current += 1
    speechTurn.current += 1

    controller.current?.abort()
    controller.current = null

    if ('speechSynthesis' in window) {
      cancelarVozKokoro(window.speechSynthesis)
    }

    const current = recorder.current
    recorder.current = null

    if (current && current.state !== 'inactive') {
      current.onstop = null
      current.stop()
    }

    parts.current = []
    releaseMicrophone()

    setPhase('inactivo')
    setNotice(label)
  }

  useEffect(() => {
    const update = () => {
      if ('speechSynthesis' in window) {
        setVoices(
          window.speechSynthesis.getVoices().filter(
            voice => voice.lang.toLowerCase().startsWith('es'),
          ),
        )
      }
    }

    update()

    window.speechSynthesis?.addEventListener(
      'voiceschanged',
      update,
    )

    return () => {
      window.speechSynthesis?.removeEventListener(
        'voiceschanged',
        update,
      )
    }
  }, [])

  useEffect(() => {
    if (
      running.current &&
      activeConversation.current &&
      conversationId !== activeConversation.current
    ) {
      halt(
        'Cambiaste de conversación. El micrófono está apagado.',
      )
    }

    activeConversation.current = conversationId
  }, [conversationId])

  useEffect(() => () => {
    running.current = false
    session.current += 1
    speechTurn.current += 1

    controller.current?.abort()

    if ('speechSynthesis' in window) {
      cancelarVozKokoro(window.speechSynthesis)
    }

    const current = recorder.current

    if (current && current.state !== 'inactive') {
      current.onstop = null
      current.stop()
    }

    if (monitor.current) clearInterval(monitor.current)
    if (maxTimer.current) clearTimeout(maxTimer.current)

    stream.current?.getTracks().forEach(track => track.stop())

    if (audioContext.current) {
      void audioContext.current.close().catch(() => {})
    }
  }, [])

  async function listen(id: number) {
    if (!running.current || id !== session.current) return

    setPhase('escuchando')
    setNotice(
      'Te escucho. Después de una pausa, enviaré tu pregunta.',
    )

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })

      if (!running.current || id !== session.current) {
        media.getTracks().forEach(track => track.stop())
        return
      }

      stream.current = media

      const formats = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ]

      const mime = formats.find(item =>
        MediaRecorder.isTypeSupported(item),
      )

      const device = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      )

      recorder.current = device
      parts.current = []
      manualStop.current = false

      let heardVoice = false
      let lastSpeech = Date.now()
      const started = Date.now()

      device.ondataavailable = event => {
        if (event.data.size > 0) {
          parts.current.push(event.data)
        }
      }

      device.onstop = () => {
        releaseMicrophone()
        recorder.current = null

        if (!running.current || id !== session.current) {
          return
        }

        const blob = new Blob(parts.current, {
          type: device.mimeType || 'audio/webm',
        })

        parts.current = []

        if (
          (!heardVoice && !manualStop.current) ||
          blob.size < 900
        ) {
          halt(
            'No se escuchó una frase clara. Vuelve a iniciar la conversación.',
          )
          return
        }

        void processAudio(blob, id)
      }

      device.onerror = () => {
        halt('Error al grabar. Comprueba el micrófono.')
      }

      const context = new AudioContext()
      audioContext.current = context

      const analyser = context.createAnalyser()
      analyser.fftSize = 512

      context.createMediaStreamSource(media).connect(analyser)

      const values = new Uint8Array(analyser.fftSize)

      device.start(250)

      monitor.current = setInterval(() => {
        analyser.getByteTimeDomainData(values)

        let sum = 0

        for (const value of values) {
          sum += ((value - 128) / 128) ** 2
        }

        const rms = Math.sqrt(sum / values.length)

        setVolume(
          Math.min(100, Math.round(rms * 500)),
        )

        const now = Date.now()

        if (rms > 0.018) {
          heardVoice = true
          lastSpeech = now
        }

        const silenceAfterSpeech =
          heardVoice &&
          now - lastSpeech > 1700 &&
          now - started > 950

        const noSpeech =
          !heardVoice &&
          now - started > 10000

        if (silenceAfterSpeech || noSpeech) {
          if (device.state === 'recording') {
            device.stop()
          }
        }
      }, 180)

      maxTimer.current = setTimeout(() => {
        if (device.state === 'recording') {
          device.stop()
        }
      }, 20000)

    } catch (error) {
      const message =
        error instanceof Error &&
        error.name === 'NotAllowedError'
          ? 'Debes permitir el micrófono en Edge.'
          : 'No se pudo iniciar el micrófono. Revisa los permisos.'

      halt(message)
    }
  }

  async function processAudio(
    audio: Blob,
    id: number,
  ) {
    const request = new AbortController()
    controller.current = request

    try {
      setPhase('transcribiendo')
      setNotice('Reconociendo lo que dijiste...')

      const stt = await apiFetch(
        '/api/conauti/voice/transcribe',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': audio.type,
          },
          body: audio,
          signal: request.signal,
        },
      )

      const transcription = await stt.json()

      if (!stt.ok) {
        throw new Error(
          String(
            transcription.detail ||
            'No pude transcribir el audio.',
          ),
        )
      }

      if (!running.current || id !== session.current) {
        return
      }

      const text = String(
        transcription.text || '',
      ).trim()

      if (!text) {
        throw new Error(
          'No se reconoció ninguna pregunta.',
        )
      }

      setHeard(text)

      let conversation = activeConversation.current

      if (!conversation) {
        const created = await apiFetch(
          '/api/conauti/conversations',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: text.slice(0, 70),
            }),
            signal: request.signal,
          },
        )

        const data = await created.json()

        if (!created.ok || !data.id) {
          throw new Error(
            'No se pudo crear la conversación.',
          )
        }

        if (!running.current || id !== session.current) {
          return
        }

        conversation = String(data.id)
        activeConversation.current = conversation

        onConversationCreated(conversation)
      }

      setPhase('pensando')
      setNotice(
        'My Teacher IA está preparando su respuesta...',
      )

      const reply = await apiFetch(
        `/api/conauti/ai/conversations/${conversation}/respond`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            request_id: crypto.randomUUID(),
            text,
          }),
          signal: request.signal,
        },
      )

      const result = await reply.json()

      if (!reply.ok) {
        throw new Error(
          String(
            result.detail ||
            'No se obtuvo respuesta de Gemini.',
          ),
        )
      }

      if (!running.current || id !== session.current) {
        return
      }

      onMessages([
        result.user_message,
        result.assistant_message,
      ])

      const answer = String(
        result.assistant_message?.body || '',
      ).trim()

      if (!answer) {
        throw new Error(
          'La IA respondió sin contenido de voz.',
        )
      }

      setAnswered(answer)
      say(answer, id)

    } catch (error) {
      if (
        running.current &&
        id === session.current
      ) {
        halt(
          error instanceof Error
            ? error.message
            : 'La conversación por voz falló.',
        )
      }
    } finally {
      if (controller.current === request) {
        controller.current = null
      }
    }
  }

  function say(text: string, id: number) {
    const synth = window.speechSynthesis
    cancelarVozKokoro(synth)

    const seq = ++speechTurn.current

    setPhase('hablando')
    setNotice(
      'My Teacher IA te está respondiendo. Puedes pausarlo o interrumpirlo.',
    )

    const normalized = text
      .replace(/[`*_#]/g, ' ')
      .replace(/https?:\/\/\S+/g, 'un enlace')
      .replace(/\s+/g, ' ')
      .trim()

    const words = normalized.slice(0, 2800).split(' ')
    const chunks: string[] = []

    let chunk = ''

    for (const word of words) {
      if (
        chunk.length + word.length > 175 &&
        chunk
      ) {
        chunks.push(chunk)
        chunk = ''
      }

      chunk += (chunk ? ' ' : '') + word
    }

    if (chunk) chunks.push(chunk)

    let index = 0

    const next = () => {
      if (
        !running.current ||
        id !== session.current ||
        seq !== speechTurn.current
      ) {
        return
      }

      if (index === chunks.length) {
        void listen(id)
        return
      }

      const utterance = new SpeechSynthesisUtterance(
        chunks[index++],
      )

      utterance.lang = 'es-PE'
      utterance.rate = 1

      const choice =
        voices.find(item => item.name === voiceName) ||
        voices.find(
          item => item.lang.toLowerCase() === 'es-pe',
        ) ||
        voices[0]

      if (choice) {
        utterance.voice = choice
      }

      utterance.onend = next

      utterance.onerror = () => {
        if (
          running.current &&
          id === session.current &&
          seq === speechTurn.current
        ) {
          halt(
            'La voz no pudo reproducirse. Cambia de voz o revisa el volumen.',
          )
        }
      }

      hablarConKokoro(utterance, synth)
    }

    next()
  }

  function begin() {
    if (!token) {
      setNotice(
        'Inicia sesión antes de hablar.',
      )
      return
    }

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setNotice(
        'Este navegador no permite capturar audio.',
      )
      return
    }

    if (!('speechSynthesis' in window)) {
      setNotice(
        'El navegador no permite responder con voz.',
      )
      return
    }

    if (running.current) return

    // Desbloquear WebAudio durante el clic inicial del estudiante.
    habilitarAudioKokoro()

    running.current = true

    const id = ++session.current

    setHeard('')
    setAnswered('')

    void listen(id)
  }

  function interrupt() {
    if (!running.current) return

    speechTurn.current += 1

    cancelarVozKokoro(window.speechSynthesis)

    void listen(session.current)
  }

  // La conversación principal comienza al abrirse, sin un segundo clic.
  // Se solicita el micrófono únicamente al activarse esta interfaz.
  useEffect(() => {
    if (autoStart) begin()
    // El modo se monta una sola vez por cada apertura del usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  if (compact) {
    const estado = {
      inactivo: 'Micrófono apagado',
      escuchando: 'Te estoy escuchando',
      transcribiendo: 'Reconociendo tu voz',
      pensando: 'Preparando respuesta',
      hablando: 'My Teacher IA está hablando',
      pausado: 'Respuesta en pausa',
    }[phase]

    return (
      <section className="mtc-live-voice" aria-label="Conversación por voz">
        <div className={'mtc-live-voice-orb phase-' + phase} aria-hidden="true">
          <svg viewBox="0 0 80 80" width="64" height="64" fill="none">
            <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="2" opacity=".22" />
            <rect x="34" y="19" width="12" height="30" rx="6" fill="currentColor" />
            <path d="M26 37a14 14 0 0 0 28 0M40 52v11m-10 0h20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
        <strong className="mtc-live-voice-title">{estado}</strong>
        <p className="mtc-live-voice-description" role="status">{notice}</p>
        {phase === 'escuchando' && (
          <div className="mtc-live-voice-meter" aria-label="Nivel de entrada del micrófono">
            <div style={{width: volume + '%'}} />
          </div>
        )}
        {heard && <div className="mtc-live-voice-line">
          <small>Tu pregunta</small><p>{heard}</p>
        </div>}
        {answered && <div className="mtc-live-voice-line mtc-live-voice-answer">
          <small>My Teacher IA</small><p>{answered}</p>
        </div>}
        <div className="mtc-live-voice-actions">
          {phase === 'inactivo' && (
            <button type="button" onClick={begin} className="mtc-live-action-primary">Activar micrófono</button>
          )}
          {phase === 'escuchando' && (
            <button type="button" className="mtc-live-action-primary" onClick={() => {
              if (recorder.current?.state === 'recording') {
                manualStop.current = true
                recorder.current.stop()
              }
            }}>Enviar mi frase</button>
          )}
          {(phase === 'hablando' || phase === 'pausado') && (
            <button type="button" className="mtc-live-action-primary" onClick={interrupt}>
              Interrumpir y hablar
            </button>
          )}
          <button type="button" className="mtc-live-action-end" onClick={() => {
            halt()
            onClose?.()
          }}>Finalizar</button>
        </div>
        <small className="mtc-live-voice-help">Habla con naturalidad. Después de una pausa enviaré tu pregunta y responderé con voz.</small>
      </section>
    )
  }

  return (
    <section
      className="conauti-dialogo"
      aria-label="Conversación por voz"
    >
      <div className="conauti-dialogo-top">
        <strong>🎧 Conversación por voz</strong>

        <span role="status">
          {phase === 'inactivo'
            ? 'Apagado'
            : phase}
        </span>
      </div>

      <p>{notice}</p>

      <div className="conauti-dialogo-buttons">
        {phase === 'inactivo' && (
          <button
            type="button"
            disabled={!token}
            onClick={begin}
          >
            Iniciar conversación
          </button>
        )}

        {phase === 'escuchando' && (
          <button
            type="button"
            onClick={() => {
              if (
                recorder.current?.state === 'recording'
              ) {
                manualStop.current = true
                recorder.current.stop()
              }
            }}
          >
            Terminar frase
          </button>
        )}

        {phase === 'hablando' && (
          <>
            <button
              type="button"
              onClick={() => {
                window.speechSynthesis.pause()
                setPhase('pausado')
              }}
            >
              Pausar respuesta
            </button>

            <button
              type="button"
              onClick={interrupt}
            >
              Interrumpir y hablar
            </button>
          </>
        )}

        {phase === 'pausado' && (
          <>
            <button
              type="button"
              onClick={() => {
                window.speechSynthesis.resume()
                setPhase('hablando')
              }}
            >
              Reanudar respuesta
            </button>

            <button
              type="button"
              onClick={interrupt}
            >
              Interrumpir y hablar
            </button>
          </>
        )}

        {phase !== 'inactivo' && (
          <button
            type="button"
            onClick={() => halt()}
          >
            Finalizar conversación
          </button>
        )}
      </div>

      {phase === 'escuchando' && (
        <div
          className="conauti-dialogo-level"
          role="progressbar"
          aria-label="Nivel del micrófono"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={volume}
        >
          <div
            style={{ width: `${volume}%` }}
          />
        </div>
      )}

      {voices.length > 0 && (
        <label className="conauti-dialogo-voice">
          Voz en español

          <select
            value={voiceName}
            onChange={event =>
              setVoiceName(event.target.value)
            }
          >
            <option value="">
              Automática
            </option>

            {voices.map(voice => (
              <option
                key={voice.voiceURI}
                value={voice.name}
              >
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </label>
      )}

      {heard && (
        <p>
          <strong>Tú:</strong> {heard}
        </p>
      )}

      {answered && (
        <p>
          <strong>My Teacher IA:</strong> {answered}
        </p>
      )}

      <small>
        En este modo, las frases reconocidas se envían
        automáticamente a la IA. El micrófono se apaga
        durante la respuesta y cuando finalizas la
        conversación. Utiliza el botón Hablar del
        modo anterior si prefieres revisar el texto
        antes de enviarlo.
      </small>
    </section>
  )
}
