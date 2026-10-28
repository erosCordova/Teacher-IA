import {
  recuperarPreferenciasRemotas,
  programarGuardadoRemoto,
  guardarPreferenciasVozAhora,
} from './PreferenciasVozRemotas'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  KOKORO_VOICE_KEY,
  KOKORO_SPEED_KEY,
  KOKORO_VOLUME_KEY,
  obtenerVelocidadKokoro,
  obtenerVolumenKokoro,
  obtenerVozKokoro,
  type KokoroVoice,
} from './KokoroPlayer'
import {
  habilitarAudioKokoro,
  reproducirBlobKokoro,
  actualizarVolumenAudioKokoro,
} from './KokoroAudio'
import './VocesKokoro.css'

const opciones: {
  id: KokoroVoice
  nombre: string
  descripcion: string
}[] = [
  {
    id: 'ef_dora',
    nombre: 'Dora',
    descripcion: 'Voz femenina · Español',
  },
  {
    id: 'em_alex',
    nombre: 'Alex',
    descripcion: 'Voz masculina · Español',
  },
  {
    id: 'em_santa',
    nombre: 'Santa',
    descripcion: 'Voz masculina · Español',
  },
]

export default function VocesKokoro() {
  const [abierto, setAbierto] = useState(false)
  const [elegida, setElegida] =
    useState<KokoroVoice>(obtenerVozKokoro)
  const [activa, setActiva] =
    useState<KokoroVoice | null>(null)
  // MYTEACHER_VOICE_SETTINGS_V1
  const [velocidad, setVelocidad] =
    useState(obtenerVelocidadKokoro)

  const [volumen, setVolumen] =
    useState(obtenerVolumenKokoro)

  const [cargando, setCargando] = useState(false)

  // MYTEACHER_GUARDADO_VERIFICADO_V1
  const [guardandoCuenta, setGuardandoCuenta] =
    useState(false)

  const [mensajeCuenta, setMensajeCuenta] =
    useState('')

  const [guardadoCorrecto, setGuardadoCorrecto] =
    useState(false)
  const [error, setError] = useState('')

  const audio = useRef<HTMLAudioElement | null>(null)
  const url = useRef<string | null>(null)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    const abrir = () => {
      setError('')
      setAbierto(true)
    }

    window.addEventListener(
      'conauti:abrir-kokoro',
      abrir,
    )

    return () => {
      window.removeEventListener(
        'conauti:abrir-kokoro',
        abrir,
      )
    }
  }, [])


  // MYTEACHER_PREFERENCIAS_REMOTAS_V1
  useEffect(() => {
    if (!abierto) return

    const abort = new AbortController()

    void recuperarPreferenciasRemotas(
      abort.signal,
    ).then(preferencias => {
      if (abort.signal.aborted || !preferencias) {
        return
      }

      try {
        localStorage.setItem(
          KOKORO_VOICE_KEY,
          preferencias.voice,
        )

        localStorage.setItem(
          KOKORO_SPEED_KEY,
          String(preferencias.speed),
        )

        localStorage.setItem(
          KOKORO_VOLUME_KEY,
          String(preferencias.volume),
        )
      } catch {
        // Los estados React siguen siendo utilizables.
      }

      setElegida(preferencias.voice)
      setVelocidad(preferencias.speed)
      setVolumen(preferencias.volume)

    }).catch(() => {
      // Conservar preferencias locales sin conexión.
    })

    return () => abort.abort()
  }, [abierto])

  function detener() {
    controller.current?.abort()
    controller.current = null

    if (audio.current) {
      audio.current.pause()
      audio.current.onended = null
      audio.current.onerror = null
      audio.current.removeAttribute('src')
      audio.current = null
    }

    if (url.current) {
      URL.revokeObjectURL(url.current)
      url.current = null
    }

    // Detener tambien una muestra de respaldo del navegador.
    window.speechSynthesis?.cancel()

    setCargando(false)
    setActiva(null)
  }

  function cerrar() {
    detener()
    setAbierto(false)
  }

  async function escuchar(voz: KokoroVoice) {
    detener()
    habilitarAudioKokoro()

    if (volumen <= 0) {
      setError('El volumen esta en 0 %. Sube el volumen para escuchar.')
      return
    }

    const abort = new AbortController()
    controller.current = abort
    const texto =
      'Hola, soy tu asistente educativo. ' +
      'Aprenderemos juntos, paso a paso.'

    setError('')
    setCargando(true)
    setActiva(voz)

    try {
      let blob: Blob | null = null

      try {
        const response = await fetch(
          '/api/conauti/kokoro/speech',
          {
            method: 'POST',
            credentials: 'same-origin',
            signal: abort.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: texto,
              voice: voz,
              speed: velocidad,
            }),
          },
        )

        if (!response.ok) {
          throw new Error('Kokoro remoto no disponible.')
        }

        blob = await response.blob()
        if (!blob.size || !blob.type.startsWith('audio/')) {
          throw new Error('La respuesta remota no contiene audio.')
        }
      } catch {
        if (abort.signal.aborted) return

        // La instalacion en Render no tiene Kokoro local.
        // La muestra utiliza el mismo modelo que la conversacion.
        setError(
          'Preparando Kokoro en tu navegador. ' +
          'La primera descarga puede tardar; ' +
          'no cierres esta ventana.',
        )

        const { sintetizarKokoroEnNavegador } =
          await import('./KokoroBrowser')

        if (abort.signal.aborted) return
        // La primera carga necesita descargar un modelo neuronal.
        // Mantener el indicador visible hasta completar el audio;
        // no descartar la voz a los 15 segundos.
        blob = await sintetizarKokoroEnNavegador(
          texto,
          voz,
          velocidad,
        )
      }

      if (abort.signal.aborted || !blob) return

      setCargando(false)
      setError('')
      await reproducirBlobKokoro(
        blob,
        volumen,
        abort.signal,
      )

      if (!abort.signal.aborted) detener()
    } catch (error) {
      if (abort.signal.aborted) return

      // Mostrar claramente que el respaldo NO es una voz Kokoro.
      setCargando(false)

      if (!('speechSynthesis' in window)) {
        detener()
        setError(
          'Kokoro no pudo generar audio y este navegador ' +
          'no dispone de una voz alternativa.',
        )
        return
      }

      setError(
        'Kokoro todavia no esta listo. ' +
        (error instanceof Error ? error.message + ' ' : '') +
        'La muestra actual utiliza temporalmente la voz ' +
        'del navegador; vuelve a pulsar Escuchar cuando ' +
        'termine la descarga para probar Dora, Alex o Santa.',
      )

      try {
        const muestra = new SpeechSynthesisUtterance(texto)
        muestra.lang = 'es-PE'
        muestra.rate = velocidad
        muestra.volume = volumen

        const voces = window.speechSynthesis.getVoices()
        muestra.voice =
          voces.find(v => v.lang.toLowerCase() === 'es-pe') ||
          voces.find(v => v.lang.toLowerCase().startsWith('es')) ||
          null

        muestra.onend = () => {
          if (controller.current === abort) detener()
        }
        muestra.onerror = () => {
          if (controller.current !== abort) return
          detener()
          setError(
            'El navegador tambien bloqueo la salida de audio. ' +
            'Comprueba volumen y permisos de sonido.',
          )
        }

        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(muestra)
      } catch {
        detener()
        setError(
          'El navegador no permitio reproducir sonido. ' +
          'Comprueba el volumen y los permisos de audio.',
        )
      }
    }
  }

  async function guardarEnMiCuenta() {
    if (guardandoCuenta) return

    setGuardandoCuenta(true)
    setGuardadoCorrecto(false)
    setMensajeCuenta('Guardando y verificando...')

    try {
      const resultado =
        await guardarPreferenciasVozAhora()

      setGuardadoCorrecto(resultado.ok)
      setMensajeCuenta(resultado.mensaje)

    } catch {
      setGuardadoCorrecto(false)
      setMensajeCuenta(
        'No se pudo completar la verificación.',
      )

    } finally {
      setGuardandoCuenta(false)
    }
  }

  function actualizarVelocidad(nueva: number) {
    const normalizada = Math.max(
      0.75,
      Math.min(1.25, nueva),
    )

    setVelocidad(normalizada)
    setGuardadoCorrecto(false)
    setMensajeCuenta(
      'Cambios pendientes de confirmar.',
    )
    programarGuardadoRemoto()

    try {
      localStorage.setItem(
        KOKORO_SPEED_KEY,
        String(normalizada),
      )
      setError('')
    } catch {
      setError('No se pudo guardar la velocidad.')
    }
  }

  function actualizarVolumen(nuevo: number) {
    const normalizado = Math.max(
      0,
      Math.min(1, nuevo),
    )

    setVolumen(normalizado)
    setGuardadoCorrecto(false)
    setMensajeCuenta(
      'Cambios pendientes de confirmar.',
    )
    programarGuardadoRemoto()

    if (audio.current) {
      audio.current.volume = normalizado
    }
    actualizarVolumenAudioKokoro(normalizado)

    try {
      localStorage.setItem(
        KOKORO_VOLUME_KEY,
        String(normalizado),
      )
      setError('')
    } catch {
      setError('No se pudo guardar el volumen.')
    }
  }

  function restablecerAjustes() {
    actualizarVelocidad(1)
    actualizarVolumen(1)
  }

  function seleccionar(voz: KokoroVoice) {
    try {
      localStorage.setItem(KOKORO_VOICE_KEY, voz)
      setElegida(voz)
      setGuardadoCorrecto(false)
      setMensajeCuenta(
        'Cambios pendientes de confirmar.',
      )
      programarGuardadoRemoto()

      window.dispatchEvent(
        new CustomEvent('conauti:voz-seleccionada', {
          detail: { voice: voz },
        }),
      )

      setError('')
    } catch {
      setError('No se pudo guardar la voz seleccionada.')
    }
  }

  useEffect(() => {
    if (!abierto) return

    const tecla = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cerrar()
    }

    window.addEventListener('keydown', tecla)

    return () => {
      window.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  if (!abierto) return null

  return createPortal(
    <div className="myteacher-voices-overlay">
      <button
        type="button"
        className="myteacher-voices-backdrop"
        aria-label="Cerrar selección de voces"
        onClick={cerrar}
      />

      <section
        className="myteacher-voices-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Voces naturales"
      >
        <div className="myteacher-voices-heading">
          <div>
            <h2>Voces naturales</h2>
            <p>
              Personaliza cómo quieres escuchar
              a My Teacher IA.
            </p>
          </div>

          <button
            type="button"
            className="myteacher-voices-close"
            aria-label="Cerrar"
            onClick={cerrar}
          >
            ×
          </button>
        </div>

        <div className="myteacher-voices-list">
          {opciones.map(voz => (
            <article
              className="myteacher-voices-card"
              key={voz.id}
            >
              <div className="myteacher-voices-icon">
                <svg
                  viewBox="0 0 24 24"
                  width="23"
                  height="23"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
                </svg>
              </div>

              <div className="myteacher-voices-info">
                <strong>{voz.nombre}</strong>
                <small>{voz.descripcion}</small>
              </div>

              <div className="myteacher-voices-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (activa === voz.id) {
                      detener()
                    } else {
                      void escuchar(voz.id)
                    }
                  }}
                >
                  {activa === voz.id
                    ? cargando
                      ? 'Generando...'
                      : 'Detener'
                    : 'Escuchar'}
                </button>

                <button
                  type="button"
                  className={
                    elegida === voz.id ? 'is-selected' : ''
                  }
                  aria-pressed={elegida === voz.id}
                  onClick={() => seleccionar(voz.id)}
                >
                  {elegida === voz.id
                    ? 'Seleccionada'
                    : 'Elegir'}
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="myteacher-voices-adjustments">
          <div className="myteacher-voices-adjustments-header">
            <h3>Ajustes de reproducción</h3>
            <button
              type="button"
              onClick={restablecerAjustes}
            >
              Restablecer
            </button>
          </div>

          <div className="myteacher-voices-control">
            <div className="myteacher-voices-control-heading">
              <label htmlFor="myteacher-voice-speed">
                Velocidad
              </label>
              <strong>
                {velocidad.toFixed(2)}×
              </strong>
            </div>

            <input
              id="myteacher-voice-speed"
              type="range"
              min={0.75}
              max={1.25}
              step={0.05}
              value={velocidad}
              onChange={event => {
                actualizarVelocidad(
                  Number(event.target.value),
                )
              }}
            />

            <div className="myteacher-voices-range-labels">
              <span>Más lenta</span>
              <span>Normal</span>
              <span>Más rápida</span>
            </div>
          </div>

          <div className="myteacher-voices-control">
            <div className="myteacher-voices-control-heading">
              <label htmlFor="myteacher-voice-volume">
                Volumen
              </label>
              <strong>
                {Math.round(volumen * 100)}%
              </strong>
            </div>

            <input
              id="myteacher-voice-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(volumen * 100)}
              onChange={event => {
                actualizarVolumen(
                  Number(event.target.value) / 100,
                )
              }}
            />

            <div className="myteacher-voices-range-labels">
              <span>Silencio</span>
              <span>Máximo</span>
            </div>
          </div>

          <p className="myteacher-voices-hint">
            El volumen cambia inmediatamente.
            La velocidad se aplica al generar
            el siguiente audio.
          </p>
        </div>

        <div className="myteacher-voices-save-account">
          <button
            type="button"
            disabled={guardandoCuenta}
            onClick={() => {
              void guardarEnMiCuenta()
            }}
          >
            {guardandoCuenta
              ? 'Guardando...'
              : 'Guardar en mi cuenta'}
          </button>

          {mensajeCuenta && (
            <p
              role="status"
              aria-live="polite"
              className={
                guardadoCorrecto
                  ? 'myteacher-voices-save-success'
                  : 'myteacher-voices-save-message'
              }
            >
              {mensajeCuenta}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="myteacher-voices-error">
            {error}
          </p>
        )}

        <p className="myteacher-voices-note">
          Kokoro genera las voces localmente y sin
          pagos por minuto. La selección se guarda
          en este navegador.
        </p>

        <button
          type="button"
          className="myteacher-voices-done"
          onClick={cerrar}
        >
          Listo
        </button>
      </section>
    </div>,
    document.body,
  )
}
