import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './BibliotecaVoces.css'

type Voice = {
  voice_id: string
  public_owner_id: string
  name: string
  description: string
  language: string
  accent: string
  gender: string
  category: string
  preview_url: string | null
}

type Catalog = {
  voices: Voice[]
  has_more: boolean
  page: number
}

const STORAGE_KEY = 'conauti.voice.selection.v1'

function readSelected(): Voice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Voice : null
  } catch {
    return null
  }
}

export default function BibliotecaVoces() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState('es')
  const [page, setPage] = useState(0)
  const [voices, setVoices] = useState<Voice[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] =
    useState<Voice | null>(readSelected)
  const [playing, setPlaying] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const handler = () => {
      setOpen(true)
    }

    window.addEventListener(
      'conauti:abrir-biblioteca',
      handler,
    )

    return () => {
      window.removeEventListener(
        'conauti:abrir-biblioteca',
        handler,
      )
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams({
          search,
          language,
          page: String(page),
        })

        const response = await fetch(
          `/api/conauti/voice-library/catalog?${params}`,
          {
            signal: controller.signal,
            credentials: 'same-origin',
          },
        )

        if (!response.ok) {
          let detail = 'No se pudo cargar el catálogo.'

          try {
            const data: { detail?: string } =
              await response.json()

            if (data.detail) detail = data.detail
          } catch {
            // Mantener el error general.
          }

          throw new Error(detail)
        }

        const result: Catalog = await response.json()

        if (controller.signal.aborted) return

        setVoices(result.voices)
        setHasMore(result.has_more)
      } catch (err) {
        if (controller.signal.aborted) return

        setVoices([])
        setHasMore(false)
        setError(
          err instanceof Error
            ? err.message
            : 'Ocurrió un error al buscar voces.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
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

  function stopPreview() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }

    setPlaying('')
  }

  function close() {
    stopPreview()
    setOpen(false)
  }

  function preview(voice: Voice) {
    if (!voice.preview_url) return

    if (playing === voice.voice_id) {
      stopPreview()
      return
    }

    stopPreview()

    const audio = new Audio(voice.preview_url)

    audioRef.current = audio
    audio.onended = () => {
      setPlaying('')
      audioRef.current = null
    }

    audio.onerror = () => {
      setPlaying('')
      setError(
        'No se pudo reproducir esta muestra de voz.',
      )
    }

    setError('')
    setPlaying(voice.voice_id)

    void audio.play().catch(() => {
      setPlaying('')
      setError(
        'El navegador bloqueó o no pudo reproducir el audio.',
      )
    })
  }

  function select(voice: Voice) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(voice),
      )

      setSelected(voice)

      window.dispatchEvent(
        new CustomEvent('conauti:voz-seleccionada', {
          detail: voice,
        }),
      )
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
                    disabled={!voice.preview_url}
                    onClick={() => preview(voice)}
                  >
                    {playing === voice.voice_id
                      ? 'Detener'
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
            La selección se guarda en este navegador.
            La conexión con las respuestas habladas
            se habilitará en la siguiente integración.
          </p>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
