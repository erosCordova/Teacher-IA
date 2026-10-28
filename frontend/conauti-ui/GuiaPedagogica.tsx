import { apiFetch } from './apiFetch'
import { useEffect, useState } from 'react'

type Estado = {
  hint_level: number
  no_hints: boolean
  last_intent: string
}

type Propiedades = {
  token: string
  conversationId: string | null
  revision: number
  onPrepare: (message: string) => void
}

export default function GuiaPedagogica({
  token,
  conversationId,
  revision,
  onPrepare,
}: Propiedades) {
  const [estado, setEstado] = useState<Estado>({
    hint_level: 0,
    no_hints: false,
    last_intent: 'concept',
  })

  useEffect(() => {
    if (!conversationId || !token) {
      setEstado({
        hint_level: 0,
        no_hints: false,
        last_intent: 'concept',
      })
      return
    }

    let cancelado = false

    apiFetch(
      `/api/conauti/pedagogy/conversations/${conversationId}/state`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
      .then(async response => {
        if (!response.ok) throw new Error('Sin conexión')
        return response.json() as Promise<Estado>
      })
      .then(data => {
        if (!cancelado) setEstado(data)
      })
      .catch(() => {
        if (!cancelado) {
          setEstado({
            hint_level: 0,
            no_hints: false,
            last_intent: 'concept',
          })
        }
      })

    return () => {
      cancelado = true
    }
  }, [token, conversationId, revision])

  return (
    <section
      className="guia-pedagogica"
      aria-label="Herramientas de aprendizaje"
    >
      <div className="guia-pedagogica-cabecera">
        <strong>Aprende a tu ritmo</strong>
        <span role="status">
          {estado.no_hints
            ? 'Modo sin pistas activo'
            : `Pistas utilizadas: ${estado.hint_level} de 3`}
        </span>
      </div>

      <div className="guia-pedagogica-acciones">
        {!estado.no_hints ? (
          <button
            type="button"
            onClick={() =>
              onPrepare('Activar modo sin pistas')
            }
          >
            Activar modo sin pistas
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onPrepare('Salir del modo sin pistas')
            }
          >
            Salir del modo sin pistas
          </button>
        )}
      </div>

      <p>
        {estado.no_hints
          ? 'Practica de forma independiente y comprueba tu razonamiento.'
          : 'Pregunta, explora ejemplos y avanza con ayuda gradual.'}
      </p>
    </section>
  )
}
