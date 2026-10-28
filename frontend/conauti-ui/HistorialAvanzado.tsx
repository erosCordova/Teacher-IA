import { apiFetch } from './apiFetch'
import { useEffect, useState } from 'react'

type Conversacion = {
  id: string
  title: string
  created_at: string
  message_count: number
}

type Resultado = {
  items: Conversacion[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

type Propiedades = {
  token: string
  selected: string | null
  revision: number
  onOpen: (id: string) => void
  onRename: (item: Conversacion) => void
  onDelete: (item: Conversacion) => void
}

const TAMANO = 15

export default function HistorialAvanzado({
  token,
  selected,
  revision,
  onOpen,
  onRename,
  onDelete,
}: Propiedades) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [items, setItems] = useState<Conversacion[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams({
          search: search.trim(),
          limit: String(TAMANO),
          offset: String(page * TAMANO),
        })

        const response = await apiFetch(
          `/api/conauti/history/conversations?${params}`,
          {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )

        if (!response.ok) {
          throw new Error(
            'No se pudo recuperar el historial.'
          )
        }

        const data = await response.json() as Resultado

        if (!cancelled) {
          setItems(data.items)
          setTotal(data.total)
        }
      } catch {
        if (!cancelled) {
          setError(
            'No se pudo cargar el historial. Comprueba la conexión.'
          )
          setItems([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [token, search, page, revision])

  const totalPages = Math.max(
    1,
    Math.ceil(total / TAMANO),
  )

  return (
    <section className="historial-avanzado">
      <h3>Mis conversaciones</h3>

      <label htmlFor="busqueda-historial" className="sr-only">
        Buscar en títulos y mensajes
      </label>

      <input
        id="busqueda-historial"
        type="search"
        value={search}
        placeholder="Buscar en títulos y mensajes..."
        onChange={event => {
          setSearch(event.target.value)
          setPage(0)
        }}
      />

      <div
        className="historial-estado"
        role="status"
        aria-live="polite"
      >
        {loading
          ? 'Buscando conversaciones...'
          : error || `${total} conversaciones encontradas`}
      </div>

      <div className="historial-lista">
        {!loading && !error && items.length === 0 && (
          <p className="historial-vacio">
            No se encontraron conversaciones.
          </p>
        )}

        {items.map(item => (
          <div
            className={
              'historial-fila ' +
              (selected === item.id ? 'elegida' : '')
            }
            key={item.id}
          >
            <button
              className="historial-titulo"
              title={item.title}
              onClick={() => onOpen(item.id)}
            >
              <span>{item.title}</span>
              <small>
                {item.message_count} mensajes
              </small>
            </button>

            <button
              aria-label={`Renombrar ${item.title}`}
              title="Renombrar"
              onClick={() => onRename(item)}
            >
              ✎
            </button>

            <button
              aria-label={`Eliminar ${item.title}`}
              title="Eliminar"
              onClick={() => onDelete(item)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {total > TAMANO && (
        <div className="historial-paginacion">
          <button
            type="button"
            disabled={loading || page === 0}
            onClick={() => setPage(value => value - 1)}
          >
            Anterior
          </button>

          <span>
            {page + 1} / {totalPages}
          </span>

          <button
            type="button"
            disabled={
              loading || (page + 1) >= totalPages
            }
            onClick={() => setPage(value => value + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </section>
  )
}
