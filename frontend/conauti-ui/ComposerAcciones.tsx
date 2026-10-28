import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type TipoIcono = 'mas' | 'microfono'

function Icono({ tipo }: { tipo: TipoIcono }) {
  if (tipo === 'mas') {
    return (
      <svg
        viewBox="0 0 24 24"
        width="23"
        height="23"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 4v16M4 12h16" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
    </svg>
  )
}

function buscarBoton(
  panel: HTMLElement,
  texto: string,
): HTMLButtonElement | undefined {
  return Array.from(
    panel.querySelectorAll<HTMLButtonElement>('button'),
  ).find(
    button =>
      button.textContent?.trim()
        .toLocaleLowerCase('es') ===
      texto.toLocaleLowerCase('es'),
  )
}

function abrirAjustes(
  seccion: 'voz' | 'aprendizaje',
): void {
  window.dispatchEvent(
    new CustomEvent('conauti:abrir-configuracion', {
      detail: seccion,
    }),
  )
}

export default function ComposerAcciones() {
  const [form, setForm] =
    useState<HTMLFormElement | null>(null)

  const [menu, setMenu] = useState(false)
  const [vozActiva, setVozActiva] = useState(false)
  const [aviso, setAviso] = useState('')

  // Detectar también el formulario cuando React
  // crea una conversación nueva.

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return

    let formularioActual: HTMLFormElement | null = null
    let editorActual: HTMLTextAreaElement | null = null
    let frame = 0

    const localizar = () => {
      const editores = Array.from(
        root.querySelectorAll<HTMLTextAreaElement>(
          'form textarea',
        ),
      )

      const editor =
        editores.find(
          item =>
            item.getAttribute('aria-label') ===
            'Escribe tu mensaje',
        ) ??
        editores.find(item =>
          item.closest('form')?.querySelector(
            'button[type="submit"]',
          ),
        ) ??
        editores[0]

      const formulario =
        editor?.closest('form') ?? null

      if (formularioActual !== formulario) {
        formularioActual?.classList.remove(
          'conauti-gpt-composer',
        )

        formularioActual = formulario

        setForm(previous =>
          previous === formulario
            ? previous
            : formulario,
        )
      }

      if (!formulario || !editor) {
        editorActual = null
        return
      }

      formulario.classList.add(
        'conauti-gpt-composer',
      )

      if (editorActual !== editor) {
        editorActual = editor
      }

      editor.placeholder =
        'Pregunta lo que quieras...'

      const botones = Array.from(
        formulario.querySelectorAll<HTMLButtonElement>(
          'button',
        ),
      )

      const envio =
        formulario.querySelector<HTMLButtonElement>(
          'button[type="submit"]',
        ) ??
        botones.find(button =>
          /enviar|send/i.test(
            [
              button.textContent,
              button.getAttribute('aria-label'),
              button.getAttribute('title'),
            ].join(' '),
          ),
        )

      if (envio) {
        envio.classList.add(
          'conauti-composer-send',
        )
        envio.setAttribute(
          'aria-label',
          'Enviar mensaje',
        )
        envio.setAttribute(
          'title',
          'Enviar mensaje',
        )
      }
    }

    localizar()

    const observer = new MutationObserver(() => {
      if (frame) return

      frame = requestAnimationFrame(() => {
        frame = 0
        localizar()
      })
    })

    observer.observe(root, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()

      if (frame) {
        cancelAnimationFrame(frame)
      }

      formularioActual?.classList.remove(
        'conauti-gpt-composer',
      )
    }
  }, [])

  // Sincronizar el indicador con el estado real
  // de la conversacion por voz, incluso si React
  // cambia de conversacion o reconstruye el panel.

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return

    let frame = 0

    const actualizar = () => {
      const panel = root.querySelector<HTMLElement>(
        '.conauti-gpt-voice-tools',
      )

      const botones = panel
        ? Array.from(
            panel.querySelectorAll<HTMLButtonElement>(
              'button',
            ),
          )
        : []

      const finalizar = botones.find(button =>
        button.textContent
          ?.trim()
          .toLocaleLowerCase('es') ===
        'finalizar conversación',
      )

      const activa = Boolean(
        finalizar && !finalizar.disabled,
      )

      setVozActiva(anterior =>
        anterior === activa ? anterior : activa,
      )
    }

    const programar = () => {
      if (frame) return

      frame = requestAnimationFrame(() => {
        frame = 0
        actualizar()
      })
    }

    actualizar()

    const observer = new MutationObserver(programar)

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'disabled',
        'aria-pressed',
      ],
    })

    return () => {
      observer.disconnect()

      if (frame) {
        cancelAnimationFrame(frame)
      }
    }
  }, [])

  function conversarPorVoz(): void {
    setMenu(false)
    setAviso('')

    const panel = document.querySelector<HTMLElement>(
      '.conauti-gpt-voice-tools',
    )

    const componente =
      panel?.querySelector<HTMLElement>(
        '.conauti-dialogo',
      ) ?? panel

    if (!componente) {
      setAviso(
        'No se encontró el módulo de conversación por voz.',
      )
      return
    }

    const finalizar = buscarBoton(
      componente,
      'Finalizar conversación',
    )

    if (finalizar && !finalizar.disabled) {
      finalizar.click()
      return
    }

    const iniciar = buscarBoton(
      componente,
      'Iniciar conversación',
    )

    if (!iniciar || iniciar.disabled) {
      setAviso(
        'La conversación por voz no está disponible ahora.',
      )
      return
    }

    // El clic ocurre directamente a partir del
    // gesto del usuario para solicitar el micrófono.
    // No abrimos el panel grande de configuración.

    iniciar.click()
  }

  if (!form) return null

  return (
    <>
      {createPortal(
        <div className="conauti-composer-left">
          <button
            type="button"
            className="conauti-composer-icon"
            aria-label="Herramientas"
            aria-expanded={menu}
            onClick={() => setMenu(value => !value)}
          >
            <Icono tipo="mas" />
          </button>

          {menu && (
            <div
              className="conauti-composer-menu"
              role="group"
              aria-label="Herramientas"
            >
              <button
                type="button"
                onClick={() => {
                  setMenu(false)
                  abrirAjustes('aprendizaje')
                }}
              >
                ✦ Herramientas de aprendizaje
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenu(false)
                  abrirAjustes('voz')
                }}
              >
                <Icono tipo="microfono" />
                Ajustes de voz y dictado
              </button>

              <button
                type="button"
                onClick={conversarPorVoz}
              >
                <Icono tipo="microfono" />
                {vozActiva
                  ? 'Finalizar conversación'
                  : 'Conversar por voz'}
              </button>
            </div>
          )}
        </div>,
        form,
      )}

      {createPortal(
        <div className="conauti-composer-right">
          <button
            type="button"
            className={
              vozActiva
                ? 'conauti-composer-icon conauti-mic-activo'
                : 'conauti-composer-icon'
            }
            aria-label={
              vozActiva
                ? 'Finalizar conversación por voz'
                : 'Iniciar conversación por voz'
            }
            aria-pressed={vozActiva}
            title={
              vozActiva
                ? 'Finalizar conversación'
                : 'Conversar por voz'
            }
            onClick={conversarPorVoz}
          >
            <Icono tipo="microfono" />
          </button>
        </div>,
        form,
      )}

      {vozActiva && createPortal(
        <div
          className="conauti-voz-indicador"
          role="status"
          aria-live="polite"
        >
          <span className="conauti-voz-punto" />
          <span>Conversación por voz activa</span>

          <button
            type="button"
            onClick={conversarPorVoz}
          >
            Finalizar
          </button>
        </div>,
        document.body,
      )}

      {aviso && createPortal(
        <div
          className="conauti-voz-aviso"
          role="alert"
        >
          {aviso}
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setAviso('')}
          >
            ×
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}
