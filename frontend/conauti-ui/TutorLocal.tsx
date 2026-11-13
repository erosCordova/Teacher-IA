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
  cancelar(): Promise<{ cancelacionSolicitada: boolean }>
}
type EstadoIdioma = {
  comprobacionSoportada: boolean
  espanolInstalado: boolean
  espanolDescargable: boolean
  motivo?: string
}
type VozLocal = {
  estado(): Promise<{ sintesisDisponible: boolean; reconocimientoDisponible: boolean; soloDispositivo: boolean }>
  comprobarIdioma?(): Promise<EstadoIdioma>
  prepararIdioma?(): Promise<{ estado: string; detalle?: string }>
  escuchar(): Promise<{ texto: string; origen: string }>
  cancelarEscucha(): Promise<void>
  hablar(options: { texto: string }): Promise<void>
  detener(): Promise<void>
  abrirAjustesVoz?(): Promise<void>
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

// Consultar el paquete de idioma real; un servicio STT instalado no demuestra
// que el español pueda ejecutarse sin Internet en este teléfono.
async function comprobarEstadoVoz(voz: VozLocal) {
  const estado = await voz.estado()
  let idioma: EstadoIdioma | undefined
  try { idioma = await voz.comprobarIdioma?.() } catch { /* No inferir un idioma instalado */ }
  const faltaEspanol = idioma?.comprobacionSoportada === true && !idioma.espanolInstalado
  return {
    estado: {
      sintesisDisponible: estado.sintesisDisponible,
      reconocimientoDisponible: estado.reconocimientoDisponible && !faltaEspanol,
    },
    idioma,
  }
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
  const [cancelando, setCancelando] = useState(false)
  const [limiteTokens, setLimiteTokens] = useState<48 | 96 | 180>(96)
  const [segundosGenerando, setSegundosGenerando] = useState(0)
  const [errorConsulta, setErrorConsulta] = useState('')
  const [vozEstado, setVozEstado] = useState<{
    sintesisDisponible: boolean; reconocimientoDisponible: boolean
  } | null>(null)
  const [escuchando, setEscuchando] = useState(false)
  const [idiomaLocal, setIdiomaLocal] = useState<EstadoIdioma | null>(null)
  const [instalandoIdioma, setInstalandoIdioma] = useState(false)
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
    const voz = puente<VozLocal>('VozLocal')
    if (voz) void comprobarEstadoVoz(voz)
      .then(({ estado, idioma }) => {
        if (live) { setVozEstado(estado); setIdiomaLocal(idioma ?? null) }
      }).catch(() => {})
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

  useEffect(() => {
    if (!ocupado) return
    const started = Date.now()
    const interval = window.setInterval(() =>
      setSegundosGenerando(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(interval)
  }, [ocupado])

  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState !== 'visible') return
      const voz = puente<VozLocal>('VozLocal')
      if (voz) void comprobarEstadoVoz(voz).then(({ estado, idioma }) => {
        setVozEstado(estado); setIdiomaLocal(idioma ?? null)
      }).catch(() => {})
    }
    document.addEventListener('visibilitychange', refrescar)
    return () => document.removeEventListener('visibilitychange', refrescar)
  }, [])

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
      const { estado, idioma } = await comprobarEstadoVoz(voz)
      setVozEstado(estado)
      setIdiomaLocal(idioma ?? null)
      if (idioma?.comprobacionSoportada && !idioma.espanolInstalado) {
        setAviso(idioma.espanolDescargable
          ? 'El reconocimiento de español es compatible, pero falta descargar el paquete sin conexión desde los ajustes de Android.'
          : 'El reconocimiento de español sin conexión no está instalado o no está disponible en este teléfono.')
      } else if (!estado.sintesisDisponible || !estado.reconocimientoDisponible) {
        setAviso('Comprueba los paquetes locales de voz española y reconocimiento en los ajustes de Android. ' + (idioma?.motivo || ''))
      } else setAviso('Voz española y reconocimiento local disponibles según Android. Falta comprobarlos hablando en un teléfono físico.')
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e))
    }
  }

  async function prepararVozEspanola() {
    const voz = puente<VozLocal>('VozLocal')
    if (!voz?.prepararIdioma || instalandoIdioma) return
    if (!window.confirm('Android puede necesitar Internet para descargar el reconocimiento de español. ¿Solicitar ahora el paquete de voz sin conexión?')) return
    setInstalandoIdioma(true)
    setAviso('Solicitando a Android el paquete local de español…')
    try {
      const resultado = await voz.prepararIdioma()
      setAviso(resultado.detalle || 'Android recibió la solicitud de instalación.')
      // No habilitar dictado hasta que el sistema confirme idioma instalado.
      const actualizado = await comprobarEstadoVoz(voz)
      setVozEstado(actualizado.estado)
      setIdiomaLocal(actualizado.idioma ?? null)
    } catch (error) {
      setAviso(error instanceof Error ? error.message : String(error))
    } finally {
      setInstalandoIdioma(false)
    }
  }

  async function escucharPregunta(enviarAutomatico = false) {
    const voz = puente<VozLocal>('VozLocal')
    if (!voz || escuchando || ocupado) return
    setEscuchando(true)
    setAviso('')
    try {
      const resultado = await voz.escuchar()
      if (resultado.origen !== 'dispositivo') throw new Error('El reconocimiento no se hizo localmente.')
      const frase = resultado.texto.trim()
      if (!frase) throw new Error('No se reconoció una pregunta. Inténtalo nuevamente.')
      if (enviarAutomatico) {
        // El botón de voz es una acción deliberada del estudiante:
        // preguntar sin pulsar un segundo botón y escuchar si hay TTS local.
        await enviarTexto(frase, true)
      } else {
        setPregunta(p => [p, frase].filter(Boolean).join(' ').slice(0, 800))
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (!/cancelad[ao]/i.test(message)) setAviso(message)
    } finally { setEscuchando(false) }
  }

  async function cancelarEscucha() {
    try {
      await puente<VozLocal>('VozLocal')?.cancelarEscucha()
      setAviso('Escucha detenida.')
    } catch (e) { setAviso(e instanceof Error ? e.message : String(e)) }
  }

  async function escucharRespuesta(texto: string) {
    try {
      const voz = puente<VozLocal>('VozLocal')
      if (!voz) throw new Error('La síntesis de voz no está disponible.')
      await voz.hablar({ texto })
    } catch (e) { setAviso(e instanceof Error ? e.message : String(e)) }
  }

  async function probarVoz() {
    setAviso('Comprobando el audio del dispositivo…')
    const voz = puente<VozLocal>('VozLocal')
    if (!voz) { setAviso('La síntesis de voz no está disponible.'); return }
    try {
      await voz.hablar({ texto: 'Hola. Soy My Teacher IA. Vamos a aprender juntos.' })
      setAviso('Android aceptó la lectura de prueba. Si no escuchas nada, comprueba el volumen multimedia y la voz española en ajustes.')
      await comprobarVozSilencioso()
    } catch (error) {
      setAviso(error instanceof Error ? error.message : String(error))
    }
  }

  async function comprobarVozSilencioso() {
    const voz = puente<VozLocal>('VozLocal')
    if (!voz) return
    try {
      const { estado, idioma } = await comprobarEstadoVoz(voz)
      setVozEstado(estado); setIdiomaLocal(idioma ?? null)
    } catch { /* el aviso de voz existente sigue visible */ }
  }

  async function abrirAjustesVoz() {
    const voz = puente<VozLocal>('VozLocal')
    try {
      if (!voz?.abrirAjustesVoz) throw new Error('Los ajustes de voz no están disponibles en esta versión.')
      await voz.abrirAjustesVoz()
      setAviso('Instala o selecciona una voz española que funcione sin conexión. Al volver, pulsa Comprobar voz.')
    } catch (error) { setAviso(error instanceof Error ? error.message : String(error)) }
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await enviarTexto(pregunta.trim())
  }

  async function cancelarGeneracion() {
    if (!ocupado || cancelando) return
    setCancelando(true)
    setAviso('Interrumpiendo la generación dentro del teléfono…')
    try {
      const motor = puente<MotorLocal>('MotorLocal')
      if (!motor) throw new Error('No se encontró el motor local.')
      await motor.cancelar()
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo detener la generación.')
      setCancelando(false)
    }
  }

  async function enviarTexto(texto: string, reproducirAudio = leerRespuestas) {
    if (ocupado || !texto || !motorEstado?.modelInstalled || !motorEstado.engineAvailable) return
    setOcupado(true)
    setCancelando(false)
    setSegundosGenerando(0)
    setErrorConsulta('')
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
      if (resultado.origen !== 'dispositivo' || !resultado.texto?.trim()) {
        throw new Error('La IA no produjo una respuesta visible. Puedes volver a intentarlo.')
      }
      const respuesta = resultado.texto.trim()
      setMensajes(previous => [...previous,
        { id: id + 1, rol: 'tutor' as const, texto: respuesta }].slice(-80))
      if (reproducirAudio && vozEstado?.sintesisDisponible) {
        void escucharRespuesta(respuesta)
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'El motor no pudo responder.'
      const esCancelacion = /cancelad[ao]/i.test(mensaje)
      setAviso(esCancelacion
        ? 'Generación detenida. Tu pregunta sigue disponible para enviarla otra vez.'
        : mensaje)
      setErrorConsulta(esCancelacion ? '' : mensaje)
      // No conservar mensajes duplicados o incompletos en el historial cifrado.
      setMensajes(previous => previous.filter(m => m.id !== id))
      setPregunta(texto)
    } finally {
      setOcupado(false)
      setCancelando(false)
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
          <span className="mtc-offline-pill">Modo local · Privado</span>
          <h1>Tu tutor, incluso sin Internet</h1>
          <p>Aprende con pistas y preguntas desde tu teléfono. El modelo y las conversaciones
            permanecen en el dispositivo hasta que decidas sincronizarlas.</p>
          <div className="mtc-offline-steps" aria-label="Estado del tutor">
            <span className={motorEstado?.modelInstalled ? 'ready' : ''}>
              <b>1</b> {motorEstado?.modelInstalled ? 'Modelo instalado' : 'Instalar modelo'}
            </span>
            <span className={listo ? 'ready' : ''}>
              <b>2</b> {listo ? 'Listo para preguntar' : 'Preparar tutor'}
            </span>
          </div>
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
                  <p>Escribe tu pregunta o elige una sugerencia. No necesitas Internet.</p>
                  <div className="mtc-offline-suggestions">
                    {['Ayúdame a entender fracciones', 'Explícame la fotosíntesis', 'Dame una pista para aprender ecuaciones'].map(texto => (
                      <button type="button" key={texto} onClick={() => setPregunta(texto)}>{texto}</button>
                    ))}
                  </div>
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
              {ocupado && (
                <div className="mtc-offline-thinking" role="status" aria-live="polite">
                  <span className="mtc-offline-spinner" aria-hidden="true"/>
                  <div><strong>{cancelando ? 'Deteniendo la IA…' : 'La IA está preparando una pista…'}</strong>
                    <small>{segundosGenerando} s · Procesamiento privado en el teléfono</small>
                    {segundosGenerando >= 20 && !cancelando && (
                      <small>La primera respuesta puede tardar en este teléfono. Puedes cancelar sin perder la pregunta.</small>
                    )}
                    <button type="button" className="mtc-offline-stop"
                      disabled={cancelando} onClick={() => void cancelarGeneracion()}>
                      {cancelando ? 'Cancelando…' : 'Cancelar generación'}
                    </button>
                  </div>
                </div>
              )}
              <div ref={finalChat}/>
            </div>
            <form onSubmit={event => void enviar(event)} className="mtc-offline-composer">
              {errorConsulta && (
                <div className="mtc-offline-query-error" role="alert">
                  <strong>No se pudo completar la respuesta</strong>
                  <p>{errorConsulta}</p>
                  <small>Tu pregunta se conservó. Puedes intentar enviarla otra vez.</small>
                </div>
              )}
              <div className="mtc-offline-voice-controls">
                <button type="button" disabled={ocupado || (!escuchando && !vozEstado?.reconocimientoDisponible)}
                  onClick={() => void (escuchando ? cancelarEscucha() : escucharPregunta(true))}>
                  {escuchando ? 'Detener micrófono' : 'Hablar y preguntar'}
                </button>
                <button type="button" disabled={ocupado || escuchando || !vozEstado?.reconocimientoDisponible}
                  onClick={() => void escucharPregunta(false)}>
                  Solo dictar
                </button>
                <button type="button" disabled={!vozEstado?.sintesisDisponible}
                  aria-pressed={leerRespuestas}
                  onClick={() => setLeerRespuestas(v => !v)}>
                  Voz en respuestas: {leerRespuestas ? 'Sí' : 'No'}
                </button>
                {idiomaLocal?.comprobacionSoportada && idiomaLocal.espanolDescargable && !idiomaLocal.espanolInstalado && (
                  <button type="button" disabled={instalandoIdioma}
                    onClick={() => void prepararVozEspanola()}>
                    {instalandoIdioma ? 'Preparando español…' : 'Descargar dictado en español'}
                  </button>
                )}
                <button type="button" disabled={instalandoIdioma} onClick={() => void comprobarVoz()}>Comprobar voz</button>
                <button type="button" disabled={!vozEstado?.sintesisDisponible}
                  onClick={() => void probarVoz()}>Probar audio</button>
                <button type="button" onClick={() => void abrirAjustesVoz()}>Ajustes de voz de Android</button>
              </div>
              {!vozEstado?.reconocimientoDisponible && (
                <p className="mtc-offline-voice-help">
                  Para dictar sin Internet, instala el reconocimiento en español en Android.
                  Puedes escribir preguntas mientras lo configuras.
                </p>
              )}
              <div className="mtc-offline-answer-mode">
                <label htmlFor="mtc-offline-mode">Extensión de la respuesta</label>
                <select id="mtc-offline-mode" value={limiteTokens} disabled={ocupado}
                  onChange={event => setLimiteTokens(Number(event.target.value) as 48 | 96 | 180)}>
                  <option value={48}>Breve · más rápida</option>
                  <option value={96}>Equilibrada · recomendada</option>
                  <option value={180}>Detallada · más lenta</option>
                </select>
              </div>
              <label htmlFor="mtc-offline-input">Escribe tu pregunta</label>
              <textarea id="mtc-offline-input" value={pregunta} maxLength={800} rows={2}
                onChange={event => setPregunta(event.target.value)}
                placeholder="Por ejemplo: ¿cómo se suman las fracciones?"
                disabled={ocupado}/>
              <button type="submit" disabled={ocupado || !pregunta.trim()}>
                {ocupado ? 'Generando…' : 'Enviar pregunta'}
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
