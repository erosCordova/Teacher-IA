import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './ConfiguracionSidebar.css'

type Seccion = 'voz' | 'aprendizaje' | null

function encontrarSidebar(): HTMLElement | null {
  const root = document.getElementById('root')
  if (!root) return null

  const selectores = [
    'aside',
    '[data-testid*="sidebar"]',
    '[class*="sidebar"]',
    '[class*="Sidebar"]',
    '[class*="side-panel"]',
  ]

  for (const selector of selectores) {
    const elemento: HTMLElement | null =
      root.querySelector<HTMLElement>(selector)

    if (elemento) return elemento
  }

  const controles = root.querySelectorAll<HTMLElement>(
    'button, a, [role="button"]',
  )

  for (const control of controles) {
    if (!/nueva conversaci[oó]n/i.test(
      control.textContent ?? '',
    )) {
      continue
    }

    let padre: HTMLElement | null =
      control.parentElement

    for (let i = 0; i < 8 && padre; i++) {
      const actual: HTMLElement = padre
      const rect = actual.getBoundingClientRect()

      if (
        rect.width >= 170 &&
        rect.width <= 420 &&
        rect.height >= 300
      ) {
        return actual
      }

      padre = actual.parentElement
    }
  }

  return null
}

function obtenerPanel(
  tipo: Exclude<Seccion, null>,
): HTMLDetailsElement | null {
  return document.querySelector<HTMLDetailsElement>(
    tipo === 'voz'
      ? '.conauti-gpt-voice-tools'
      : '.conauti-gpt-learning-tools',
  )
}

export default function ConfiguracionSidebar() {
  const [sidebar, setSidebar] =
    useState<HTMLElement | null>(null)

  const [abierto, setAbierto] = useState(false)
  const [seccion, setSeccion] =
    useState<Seccion>(null)

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return

    let frame = 0

    const actualizar = () => {
      const siguiente = encontrarSidebar()

      setSidebar(actual =>
        actual === siguiente ? actual : siguiente,
      )
    }

    actualizar()

    const observer = new MutationObserver(() => {
      if (frame) return

      frame = requestAnimationFrame(() => {
        frame = 0
        actualizar()
      })
    })

    observer.observe(root, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle(
      'conauti-ajustes-visibles',
      abierto,
    )

    document.body.classList.toggle(
      'conauti-ajustes-voz',
      abierto && seccion === 'voz',
    )

    document.body.classList.toggle(
      'conauti-ajustes-aprendizaje',
      abierto && seccion === 'aprendizaje',
    )

    return () => {
      document.body.classList.remove(
        'conauti-ajustes-visibles',
        'conauti-ajustes-voz',
        'conauti-ajustes-aprendizaje',
      )
    }
  }, [abierto, seccion])

  function cerrarPaneles(): void {
    const voz = obtenerPanel('voz')
    const aprendizaje = obtenerPanel('aprendizaje')

    if (voz) voz.open = false
    if (aprendizaje) aprendizaje.open = false
  }

  function cerrar(): void {
    cerrarPaneles()
    setSeccion(null)
    setAbierto(false)
  }

  function abrir(
    destino: Exclude<Seccion, null>,
  ): void {
    cerrarPaneles()

    const panel = obtenerPanel(destino)
    if (!panel) return

    panel.open = true
    setSeccion(destino)
    setAbierto(true)
  }

  function abrirPrincipal(): void {
    cerrarPaneles()
    setSeccion(null)
    setAbierto(true)
  }

  useEffect(() => {
    const escuchar = (event: Event) => {
      const requested = (
        event as CustomEvent<'voz' | 'aprendizaje'>
      ).detail

      if (
        requested === 'voz' ||
        requested === 'aprendizaje'
      ) {
        abrir(requested)
      }
    }

    window.addEventListener(
      'conauti:abrir-configuracion',
      escuchar,
    )

    return () => {
      window.removeEventListener(
        'conauti:abrir-configuracion',
        escuchar,
      )
    }
  }, [])

  useEffect(() => {
    if (!abierto) return

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cerrar()
    }

    window.addEventListener('keydown', keydown)

    return () => {
      window.removeEventListener('keydown', keydown)
    }
  }, [abierto, seccion])

  return (
    <>
      {sidebar && createPortal(
        <button
          type="button"
          className="conauti-sidebar-configuracion"
          onClick={abrirPrincipal}
        >
          <svg
            viewBox="0 0 24 24"
            width="19"
            height="19"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a2 2 0 0 0 .4 2.2l-1.6 1.6a2 2 0 0 0-2.2-.4l-1 .4a2 2 0 0 0-1.3 1.9h-2.3a2 2 0 0 0-1.3-1.9l-1-.4a2 2 0 0 0-2.2.4l-1.6-1.6a2 2 0 0 0 .4-2.2l.4-1A2 2 0 0 0 3.4 12v-1a2 2 0 0 0 1.9-1.3l.4-1a2 2 0 0 0-.4-2.2l1.6-1.6a2 2 0 0 0 2.2-.4l1.6 1.6a2 2 0 0 0-.4 2.2l.4 1a2 2 0 0 0 1.9 1.3v1a2 2 0 0 0-1.9 1.3Z"
            />
          </svg>
          <span>Configuración</span>
        </button>,
        sidebar,
      )}

      {abierto && createPortal(
        <div
          className="conauti-ajustes-capa"
          role="presentation"
        >
          <button
            type="button"
            className="conauti-ajustes-fondo"
            aria-label="Cerrar configuración"
            onClick={cerrar}
          />

          {seccion === null ? (
            <section
              className="conauti-ajustes-ventana"
              role="dialog"
              aria-modal="true"
              aria-label="Configuración"
            >
              <header className="conauti-ajustes-header">
                <h2>Configuración</h2>
                <button
                  type="button"
                  onClick={cerrar}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </header>

              <p>
                Ajusta las herramientas a tu manera.
              </p>

              <button
                type="button"
                className="conauti-ajustes-opcion"
                onClick={() => abrir('voz')}
              >
                <span>🎙️</span>
                <span>
                  <strong>Voz y micrófono</strong>
                  <small>
                    Conversación, dictado y selección de voz.
                  </small>
                </span>
                <span>›</span>
              </button>

              <button
                type="button"
                className="conauti-ajustes-opcion"
                onClick={() => abrir('aprendizaje')}
              >
                <span>✦</span>
                <span>
                  <strong>Aprendizaje</strong>
                  <small>
                    Pistas y apoyo pedagógico.
                  </small>
                </span>
                <span>›</span>
              </button>
            
              <button
                type="button"
                className="conauti-ajustes-opcion conauti-biblioteca-entrada"
                onClick={() => {
                  cerrar()
                  window.dispatchEvent(
                    new Event('conauti:abrir-biblioteca'),
                  )
                }}
              >
                <span>🎧</span>
                <span>
                  <strong>Biblioteca de voces</strong>
                  <small>
                    Explorar, escuchar y elegir una voz.
                  </small>
                </span>
                <span>›</span>
              </button>

              <button
                type="button"
                className="conauti-ajustes-opcion conauti-opcion-kokoro"
                onClick={() => {
                  cerrar()
                  window.dispatchEvent(
                    new Event('conauti:abrir-kokoro'),
                  )
                }}
              >
                <span>🎧</span>
                <span>
                  <strong>Voces naturales</strong>
                  <small>
                    Escuchar y elegir Dora, Alex o Santa.
                  </small>
                </span>
                <span>›</span>
              </button>


        <button
          type="button"
          className="conauti-ajustes-opcion myteacher-kokoro-option"
          onClick={() => {
            window.dispatchEvent(
              new Event('conauti:abrir-kokoro'),
            )
          }}
        >
          <span>🎧</span>
          <span>
            <strong>Voces naturales</strong>
            <small>Escuchar y elegir Dora, Alex o Santa.</small>
          </span>
          <span>›</span>
        </button>
</section>
          ) : (
            <nav className="conauti-ajustes-navegacion">
              <button
                type="button"
                onClick={abrirPrincipal}
              >
                ← Configuración
              </button>

              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar configuración"
              >
                ×
              </button>
            </nav>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
