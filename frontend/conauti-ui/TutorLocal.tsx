import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import ModeloSinConexion from './ModeloSinConexion'
import SincronizarLocal, { ID_CONVERSACION_LOCAL } from './SincronizarLocal'
import './TutorLocal.css'

type Mensaje = { id: number; rol: 'estudiante' | 'tutor'; texto: string }
type MotorEstado = { engineAvailable: boolean; modelInstalled: boolean; busy: boolean }
type MotorLocal = {
  estado(): Promise<MotorEstado>
  responder(args: { texto: string; maxTokens: number; contexto?: string }): Promise<{ texto: string; origen: string }>
}
type VozLocal = {
  estado(): Promise<{ sintesisDisponible: boolean; reconocimientoDisponible: boolean; soloDispositivo: boolean }>
  escuchar(): Promise<{ texto: string; origen: string }>
  cancelarEscucha(): Promise<void>
  hablar(options: { texto: string }): Promise<void>
  detener(): Promise<void>
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
  const [historialListo, setHistorialListo] = useState(false)
  const [pregunta, setPregunta] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [limiteTokens, setLimiteTokens] = useState<32 | 96 | 180>(32)
  const [vozEstado, setVozEstado] = useState<{
    sintesisDisponible: boolean; reconocimientoDisponible: boolean
  } | null>(null)
  const [escuchando, setEscuchando] = useState(false)
  const [leerRespuestas, setLeerRespuestas] = useState(false)
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
        setHistorialListo(true)
      } catch (error) {
        if (live) setAviso(error instanceof Error ? error.message : 'No se pudo abrir el tutor privado.')
      } finally {
        if (live) setCargado(true)
      }
    }
    void iniciar()
    void puente<VozLocal>('VozLocal')?.estado()
      .then(estado => { if (live) setVozEstado(estado) }).catch(() => {})
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!cargado || !historialListo) return
    const historial = puente<HistorialLocal>('HistorialLocal')
    if (!historial) return
    // Secuencia de guardado: una respuesta tardía nunca sobrescribe otra nueva.
    const copia = JSON.stringify(mensajes.slice(-80))
    guardados.current = guardados.current.catch(() => {}).then(async () => {
      await historial.guardar({ datos: copia })
    }).catch(() => setAviso('No se pudo guardar el historial cifrado.'))
  }, [mensajes, cargado, historialListo])

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

  async function comprobarVoz() {
    try {
      const voz = puente<VozLocal>('VozLocal')
      if (!voz) throw new Error('La voz nativa no está instalada.')
      const estado = await voz.estado()
      setVozEstado(estado)
      if (!estado.sintesisDisponible && !estado.reconocimientoDisponible) {
        setAviso('Descarga las voces y el reconocimiento de español sin conexión desde los ajustes de Android.')
      } else setAviso('')
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e))
    }
  }

  async function escucharPregunta() {
    const voz = puente<VozLocal>('VozLocal')
    if (!voz || escuchando || ocupado) return
    setEscuchando(true)
    setAviso('')
    try {
      const resultado = await voz.escuchar()
      if (resultado.origen !== 'dispositivo') throw new Error('El reconocimiento no se hizo localmente.')
      setPregunta(p => [p, resultado.texto].filter(Boolean).join(' ').slice(0, 800))
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e))
    } finally { setEscuchando(false) }
  }

  async function cancelarEscucha() {
    try { await puente<VozLocal>('VozLocal')?.cancelarEscucha() }
    catch (e) { setAviso(e instanceof Error ? e.message : String(e)) }
  }

  async function escucharRespuesta(texto: string) {
    try { await puente<VozLocal>('VozLocal')?.hablar({ texto }) }
    catch (e) { setAviso(e instanceof Error ? e.message : String(e)) }
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
      const contexto = mensajes.slice(-8)
        .map(m => (m.rol === 'tutor' ? 'Tutor' : 'Estudiante') + ': ' + m.texto.slice(0, 250))
        .join('\n').slice(-1400)
      const resultado = await motor.responder({ texto, contexto, maxTokens: limiteTokens })
      setMensajes(previous => [...previous,
        { id: id + 1, rol: 'tutor' as const, texto: resultado.texto }].slice(-80))
      if (leerRespuestas && vozEstado?.sintesisDisponible) {
        void escucharRespuesta(resultado.texto)
      }
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
      // Al empezar otra conversación, usar un ID distinto de sincronización.
      try { localStorage.removeItem(ID_CONVERSACION_LOCAL) } catch { /* no afecta al cifrado nativo */ }
      setAviso('Historial local eliminado.')
    } catch (error) {
      setAviso(error instanceof Error ? error.message : String(error))
    }
  }

  const listo = motorEstado?.engineAvailable && motorEstado?.modelInstalled && historialListo
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
        {cargado && !historialListo && (
          <p role="alert" className="mtc-offline-notice">El historial cifrado no está accesible. No se sobrescribirá hasta resolver el problema.</p>
        )}
        {cargado && historialListo && !listo && (
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
                  {m.rol === 'tutor' && vozEstado?.sintesisDisponible && (
                    <button type="button" className="mtc-offline-speak"
                      onClick={() => void escucharRespuesta(m.texto)}>
                      Escuchar respuesta
                    </button>
                  )}
                </div>
              ))}
              {ocupado && <p className="mtc-offline-thinking" role="status">Generando la respuesta dentro del teléfono…</p>}
              <div ref={finalChat}/>
            </div>
            <form onSubmit={event => void enviar(event)} className="mtc-offline-composer">
              <div className="mtc-offline-voice-controls">
                <button type="button" disabled={ocupado || !vozEstado?.reconocimientoDisponible}
                  onClick={() => void (escuchando ? cancelarEscucha() : escucharPregunta())}>
                  {escuchando ? 'Detener micrófono' : 'Dictar pregunta'}
                </button>
                <button type="button" disabled={!vozEstado?.sintesisDisponible}
                  aria-pressed={leerRespuestas}
                  onClick={() => setLeerRespuestas(v => !v)}>
                  Voz en respuestas: {leerRespuestas ? 'Sí' : 'No'}
                </button>
                <button type="button" onClick={() => void comprobarVoz()}>Comprobar voz</button>
              </div>
              <div className="mtc-offline-answer-mode">
                <label htmlFor="mtc-offline-mode">Extensión de la respuesta</label>
                <select id="mtc-offline-mode" value={limiteTokens} disabled={ocupado}
                  onChange={event => setLimiteTokens(Number(event.target.value) as 32 | 96 | 180)}>
                  <option value={32}>Rápida · pistas breves</option>
                  <option value={96}>Equilibrada</option>
                  <option value={180}>Detallada · más lenta</option>
                </select>
              </div>
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
        {cargado && historialListo && mensajes.length > 0 && (
          <SincronizarLocal mensajes={mensajes} ocupado={ocupado} />
        )}
        {aviso && <p className="mtc-offline-notice" role="status">{aviso}</p>}
        <p className="mtc-offline-disclaimer">
          Versión experimental: la calidad y velocidad de respuesta dependen del teléfono.
          El micrófono y la lectura de respuestas solo funcionan cuando Android tiene
          instaladas las voces y el reconocimiento local en español. No se utiliza la nube.
        </p>
      </section>
    </main>
  )
}
