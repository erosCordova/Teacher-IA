import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  KOKORO_VOICE_KEY,
  obtenerVozKokoro,
  obtenerVelocidadKokoro,
  obtenerVolumenKokoro,
  type KokoroVoice,
} from './KokoroPlayer'
import {
  habilitarAudioKokoro,
  reproducirBlobKokoro,
} from './KokoroAudio'
import { programarGuardadoRemoto } from './PreferenciasVozRemotas'
import './BibliotecaVoces.css'

type Voice = {
  voice_id: KokoroVoice
  public_owner_id: string
  name: string
  description: string
  language: string
  accent: string
  gender: string
  category: string
  preview_url: string | null
}

// Son las voces Kokoro españolas que la aplicación puede
// sintetizar de verdad, sin API externa ni pago por minuto.
const LOCAL_VOICES: Voice[] = [
  {
    voice_id: 'ef_dora',
    public_owner_id: 'kokoro',
    name: 'Dora',
    description: 'Voz femenina natural para aprender en español.',
    language: 'es',
    accent: 'Español',
    gender: 'female',
    category: 'Kokoro',
    preview_url: null,
  },
  {
    voice_id: 'em_alex',
    public_owner_id: 'kokoro',
    name: 'Alex',
    description: 'Voz masculina para explicaciones y conversaciones.',
    language: 'es',
    accent: 'Español',
    gender: 'male',
    category: 'Kokoro',
    preview_url: null,
  },
  {
    voice_id: 'em_santa',
    public_owner_id: 'kokoro',
    name: 'Santa',
    description: 'Voz masculina para acompañar las actividades.',
    language: 'es',
    accent: 'Español',
    gender: 'male',
    category: 'Kokoro',
    preview_url: null,
  },
]

function readSelected(): Voice {
  const voz = obtenerVozKokoro()
  return LOCAL_VOICES.find(item => item.voice_id === voz)
    ?? LOCAL_VOICES[0]
}

export default function BibliotecaVoces() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState('es')
  const [page, setPage] = useState(0)
  const [voices, setVoices] = useState<Voice[]>(LOCAL_VOICES)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Voice>(readSelected)
  const [playing, setPlaying] = useState('')
  const [generating, setGenerating] = useState(false)
  const previewAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const abrir = () => {
      setSelected(readSelected())
      setError('')
      setOpen(true)
    }
    window.addEventListener('conauti:abrir-biblioteca', abrir)
    return () => {
      window.removeEventListener('conauti:abrir-biblioteca', abrir)
    }
  }, [])

  // El catálogo funciona sin red: ElevenLabs rechazaba las
  // consultas y sus voces no estaban conectadas al TTS.
  useEffect(() => {
    if (!open) return
    const term = search.toLocaleLowerCase('es').trim()
    const matching = LOCAL_VOICES.filter(item => {
      if (language !== 'all' && item.language !== language) {
        return false
      }
      return !term || [
        item.name, item.description, item.accent,
        item.category, item.gender,
      ].some(value => value.toLocaleLowerCase('es').includes(term))
    })
    const offset = page * 24
    setVoices(matching.slice(offset, offset + 24))
    setHasMore(matching.length > offset + 24)
    setLoading(false)
  }, [open, search, language, page])

  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  useEffect(() => {
    return () => {
      previewAbortRef.current?.abort()
    }
  }, [])

  function stopPreview() {
    previewAbortRef.current?.abort()
    previewAbortRef.current = null
    setPlaying('')
    setGenerating(false)
  }

  function close() {
    stopPreview()
    setOpen(false)
  }

  function preview(voice: Voice) {
    if (playing === voice.voice_id) {
      stopPreview()
      return
    }

    stopPreview()
    // Se habilita WebAudio inmediatamente dentro del clic.
    habilitarAudioKokoro()

    const controller = new AbortController()
    previewAbortRef.current = controller
    setPlaying(voice.voice_id)
    setGenerating(true)
    setError('')

    const play = async () => {
      try {
        const { sintetizarKokoroEnNavegador } =
          await import('./KokoroBrowser')
        if (controller.signal.aborted) return

        const sample = 'Hola, soy ' + voice.name +
          ', tu voz educativa. Aprenderemos juntos paso a paso.'
        const blob = await sintetizarKokoroEnNavegador(
          sample,
          voice.voice_id,
          obtenerVelocidadKokoro(),
        )
        if (controller.signal.aborted) return
        setGenerating(false)
        await reproducirBlobKokoro(
          blob,
          obtenerVolumenKokoro(),
          controller.signal,
        )
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(
          'No se pudo reproducir la muestra de Kokoro. ' +
          (cause instanceof Error ? cause.message : ''),
        )
      } finally {
        if (previewAbortRef.current === controller) {
          previewAbortRef.current = null
          setPlaying('')
          setGenerating(false)
        }
      }
    }
    void play()
  }

  function select(voice: Voice) {
    try {
      // La misma clave utilizada por las respuestas de Gemini.
      localStorage.setItem(KOKORO_VOICE_KEY, voice.voice_id)
      setSelected(voice)
      programarGuardadoRemoto()

      window.dispatchEvent(
        new CustomEvent('conauti:voz-seleccionada', {
          detail: { voice: voice.voice_id },
        }),
      )
      setError('')
    } catch {
      setError(
        'No se pudo guardar la voz en este navegador.',
      )
    }
  }

  if (!open) return null

  return createPortal(
    <div className="cv-overlay">
      <button
        type="button"
        className="cv-backdrop"
        aria-label="Cerrar biblioteca"
        onClick={close}
      />

      <section
        className="cv-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Biblioteca de voces"
      >
        <header className="cv-header">
          <div>
            <h2>Biblioteca de voces</h2>
            <p>Busca, escucha y elige tu voz favorita.</p>
          </div>

          <button
            type="button"
            className="cv-close"
            onClick={close}
            aria-label="Cerrar biblioteca"
          >
            ×
          </button>
        </header>

        <form
          className="cv-search"
          onSubmit={event => {
            event.preventDefault()
            setPage(0)
            setSearch(query.trim())
          }}
        >
          <input
            value={query}
            onChange={event =>
              setQuery(event.target.value)
            }
            maxLength={80}
            placeholder="Buscar voces..."
            aria-label="Buscar voces"
          />

          <button type="submit">
            Buscar
          </button>
        </form>

        <div className="cv-filters">
          <label htmlFor="cv-language">
            Idioma
          </label>

          <select
            id="cv-language"
            value={language}
            onChange={event => {
              setLanguage(event.target.value)
              setPage(0)
            }}
          >
            <option value="es">Español</option>
            <option value="all">Todos los idiomas</option>
          </select>
        </div>

        {selected && (
          <div className="cv-selected">
            <span>Voz favorita seleccionada</span>
            <strong>{selected.name}</strong>
          </div>
        )}

        {loading && (
          <p role="status" className="cv-info">
            Consultando voces...
          </p>
        )}

        {error && (
          <p role="alert" className="cv-error">
            {error}
          </p>
        )}

        {!loading && !error && voices.length === 0 && (
          <p className="cv-info">
            No se encontraron voces. Prueba otra búsqueda.
          </p>
        )}

        <div className="cv-list">
          {voices.map(voice => {
            const isSelected =
              selected?.voice_id === voice.voice_id

            return (
              <article
                className="cv-voice"
                key={`${voice.public_owner_id}:${voice.voice_id}`}
              >
                <div className="cv-avatar" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
                  </svg>
                </div>

                <div className="cv-detail">
                  <strong>{voice.name}</strong>

                  <small>
                    {[
                      voice.language,
                      voice.accent,
                      voice.category,
                    ].filter(Boolean).join(' · ')}
                  </small>

                  {voice.description && (
                    <p>{voice.description}</p>
                  )}
                </div>

                <div className="cv-actions">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => preview(voice)}
                  >
                    {playing === voice.voice_id
                      ? generating ? 'Generando...' : 'Detener'
                      : 'Escuchar'}
                  </button>

                  <button
                    type="button"
                    className={
                      isSelected
                        ? 'cv-pick cv-picked'
                        : 'cv-pick'
                    }
                    onClick={() => select(voice)}
                  >
                    {isSelected
                      ? 'Elegida'
                      : 'Elegir'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        <footer className="cv-footer">
          <div className="cv-pagination">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => setPage(
                previous => Math.max(0, previous - 1),
              )}
            >
              Anterior
            </button>

            <span>Página {page + 1}</span>

            <button
              type="button"
              disabled={!hasMore || loading}
              onClick={() => setPage(
                previous => previous + 1,
              )}
            >
              Siguiente
            </button>
          </div>

          <p>
            La voz elegida se utiliza en las respuestas habladas
            y se guarda también en tu cuenta al iniciar sesión.
          </p>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
