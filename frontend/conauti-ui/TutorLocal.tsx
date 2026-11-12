import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import ModeloSinConexion from './ModeloSinConexion'
import './TutorLocal.css'

type Mensaje = { id: number; rol: 'estudiante' | 'tutor'; texto: string }
type MotorEstado = { engineAvailable: boolean; modelInstalled: boolean; busy: boolean }
type MotorLocal = {
  estado(): Promise<MotorEstado>
  responder(args: { texto: string; maxTokens: number }): Promise<{ texto: string; origen: string }>
}
type HistorialLocal = {
  leer(): Promise<{ datos: string }>
  guardar(args: { datos: string }): Promise<void>
  borrar(): Promise<void>
}

function puente<T>(nombre: string): T | undefined {
  const capacitor = window.Capacitor
  return ((capacitor?.Plugins as Record<string, unknown> | undefined)?.[nombre]
    ?? capacitor?.registerPlugin?.(nombre)) as T | undefined
}

function mensajesValidos(raw: unknown): Mensaje[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is Mensaje =>
    v && typeof v.id === 'number' &&
    (v.rol === 'estudiante' || v.rol === 'tutor') &&
    typeof v.texto === 'string' && v.texto.length <= 16000
  ).slice(-80)
}

/**
 * Tutor Android totalmente independiente de FastAPI y de Google.
 * Una vez instalado el GGUF y cargada la biblioteca JNI, el texto nunca
 * sale del dispositivo. El historial se cifra mediante Android Keystore.
 * La sincronización con cuentas web y la voz offline siguen pendientes.
 */
export default function TutorLocal({ onVolverOnline }: { onVolverOnline: () => void }) {
  const [motorEstado, setMotorEstado] = useState<MotorEstado | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [cargado, setCargado] = useState(false)
  const [pregunta, setPregunta] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [tema, setTema] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('myteacher.ui.theme') === 'light' ? 'light' : 'dark' }
    catch { return 'dark' }
  })
  const guardados = useRef<Promise<void>>(Promise.resolve())
  const finalChat = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.dataset.myteacherPlatform = 'android'
    document.documentElement.dataset.myteacherTheme = tema
    try { localStorage.setItem('myteacher.ui.theme', tema) } catch { /* solo lectura */ }
  }, [tema])

  useEffect(() => {
    let live = true
    const iniciar = async () => {
      const motor = puente<MotorLocal>('MotorLocal')
      const historial = puente<HistorialLocal>('HistorialLocal')
      try {
        if (!motor || !historial) throw new Error('Esta compilación no incluye todos los módulos Android.')
        const [info, local] = await Promise.all([motor.estado(), historial.leer()])
        if (!live) return
        setMotorEstado(info)
        setMensajes(mensajesValidos(JSON.parse(local.datos)))
      } catch (error) {
        if (live) setAviso(error instanceof Error ? error.message : 'No se pudo abrir el tutor privado.')
      } finally {
        if (live) setCargado(true)
      }
    }
    void iniciar()
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!cargado) return
    const historial = puente<HistorialLocal>('HistorialLocal')
    if (!historial) return
    // Secuencia de guardado: una respuesta tardía nunca sobrescribe otra nueva.
    const copia = JSON.stringify(mensajes.slice(-80))
    guardados.current = guardados.current.catch(() => {}).then(async () => {
      await historial.guardar({ datos: copia })
    }).catch(() => setAviso('No se pudo guardar el historial cifrado.'))
  }, [mensajes, cargado])

  useEffect(() => {
    finalChat.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [mensajes, ocupado])

  async function actualizarModelo() {
    try {
      const info = await puente<MotorLocal>('MotorLocal')?.estado()
      if (info) setMotorEstado(info)
    } catch (error) {
      setAviso(error instanceof Error ? error.message : String(error))
    }
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const texto = pregunta.trim()
    if (ocupado || !texto || !motorEstado?.modelInstalled || !motorEstado.engineAvailable) return
    setOcupado(true)
    setAviso('')
    setPregunta('')
    const id = Date.now() + mensajes.length
    setMensajes(previous => [...previous, { id, rol: 'estudiante' as const, texto }].slice(-80))
    try {
      const motor = puente<MotorLocal>('MotorLocal')
      if (!motor) throw new Error('El motor local no se encuentra disponible.')
      const resultado = await motor.responder({ texto, maxTokens: 180 })
      setMensajes(previous => [...previous,
        { id: id + 1, rol: 'tutor' as const, texto: resultado.texto }].slice(-80))
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'El motor no pudo responder.')
    } finally {
      setOcupado(false)
    }
  }

  async function borrarHistorial() {
    if (!window.confirm('¿Eliminar todas las conversaciones locales de este dispositivo?')) return
    try {
      await guardados.current
      await puente<HistorialLocal>('HistorialLocal')?.borrar()
      setMensajes([])
      setAviso('Historial local eliminado.')
    } catch (error) {
      setAviso(error instanceof Error ? error.message : String(error))
    }
  }

  const listo = motorEstado?.engineAvailable && motorEstado?.modelInstalled
  return (
    <main className="mtc-offline-app" aria-label="Tutor educativo sin conexión">
      <header className="mtc-offline-topbar">
        <div className="mtc-offline-title"><span className="mtc-offline-symbol" aria-hidden="true">✦</span>
          <div><strong>My Teacher IA</strong><small>Aprendizaje privado en este dispositivo</small></div>
        </div>
        <div className="mtc-offline-topactions">
          <button type="button" onClick={() => setTema(t => t === 'dark' ? 'light' : 'dark')}
            aria-label={tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
            {tema === 'dark' ? '☀' : '☾'}
          </button>
          <button type="button" onClick={onVolverOnline}>Usar mi cuenta en línea</button>
        </div>
      </header>
      <section className="mtc-offline-content">
        <div className="mtc-offline-lead">
          <span className="mtc-offline-pill">Modo local · Sin servidor</span>
          <h1>Aprende donde estés</h1>
          <p>La IA analiza tus preguntas dentro del teléfono. Este espacio no necesita iniciar sesión y
            no comparte las conversaciones con tu cuenta en línea.</p>
        </div>
        {!cargado && <p role="status">Abriendo almacenamiento cifrado del dispositivo…</p>}
        {cargado && !listo && (
          <div className="mtc-offline-setup">
            <h2>Preparar la IA sin conexión</h2>
            <p>Necesitas descargar el modelo una sola vez con Internet. Después podrás
              conversar con el tutor local sin conexión, siempre que el motor sea compatible con tu teléfono.</p>
            <ModeloSinConexion mostrarPrueba={false} onInstalled={() => void actualizarModelo()}/>
            <button type="button" className="mtc-offline-refresh" onClick={() => void actualizarModelo()}>
              Revisar si el modelo está listo
            </button>
          </div>
        )}
        {cargado && listo && (
          <section className="mtc-offline-chat" aria-label="Conversación educativa local">
            <div className="mtc-offline-chat-head">
              <div><strong>Tutor local</strong><small>Historial cifrado en este dispositivo</small></div>
              <button type="button" disabled={ocupado || mensajes.length === 0}
                onClick={() => void borrarHistorial()}>Borrar historial</button>
            </div>
            <div className="mtc-offline-messages" aria-live="polite">
              {mensajes.length === 0 && (
                <div className="mtc-offline-empty">
                  <span aria-hidden="true">✦</span>
                  <h2>¿Qué quieres comprender hoy?</h2>
                  <p>Puedo ayudarte con preguntas y pistas para que descubras la respuesta.</p>
                </div>
              )}
              {mensajes.map(m => (
                <div key={m.id} className={'mtc-offline-msg mtc-offline-msg-' + m.rol}>
                  <strong>{m.rol === 'estudiante' ? 'Tú' : 'My Teacher IA'}</strong>
                  <p>{m.texto}</p>
                </div>
              ))}
              {ocupado && <p className="mtc-offline-thinking" role="status">Generando la respuesta dentro del teléfono…</p>}
              <div ref={finalChat}/>
            </div>
            <form onSubmit={event => void enviar(event)} className="mtc-offline-composer">
              <label htmlFor="mtc-offline-input">Escribe tu pregunta</label>
              <textarea id="mtc-offline-input" value={pregunta} maxLength={800} rows={2}
                onChange={event => setPregunta(event.target.value)}
                placeholder="Por ejemplo: ¿cómo se suman las fracciones?"
                disabled={ocupado}/>
              <button type="submit" disabled={ocupado || !pregunta.trim()}>
                {ocupado ? 'Pensando…' : 'Enviar'}
              </button>
            </form>
          </section>
        )}
        {aviso && <p className="mtc-offline-notice" role="status">{aviso}</p>}
        <p className="mtc-offline-disclaimer">
          Versión experimental: la calidad y velocidad de respuesta dependen del teléfono.
          La sincronización y la voz sin conexión todavía están en desarrollo.
        </p>
      </section>
    </main>
  )
}
