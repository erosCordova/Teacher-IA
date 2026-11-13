import { useEffect, useState } from 'react'
import { sesionNativaDisponible } from './SesionNativa'
import './ModeloSinConexion.css'

type EstadoModelo = {
  modelId: string
  filename: string
  installed: boolean
  bytes: number
  downloadBytes: number
  approximateBytes: number
  downloading: boolean
  engineAvailable: boolean
}
type Progreso = { received: number; expected: number; percentage: number }
type MotorLocalAPI = {
  responder(args: { texto: string; maxTokens: number }): Promise<{ texto: string; origen: string }>
}
function motorAndroid(): MotorLocalAPI | undefined {
  const c = window.Capacitor
  return (c?.Plugins as unknown as { MotorLocal?: MotorLocalAPI } | undefined)?.MotorLocal
    ?? c?.registerPlugin?.('MotorLocal') as unknown as MotorLocalAPI | undefined
}
type Suscripcion = { remove(): Promise<void> }
type ModeloEducativoAPI = {
  estado(): Promise<EstadoModelo>
  descargar(): Promise<EstadoModelo>
  cancelar(): Promise<void>
  eliminar(): Promise<EstadoModelo>
  addListener(name: 'progreso', callback: (progress: Progreso) => void): Suscripcion | Promise<Suscripcion>
}
function modeloAndroid(): ModeloEducativoAPI | undefined {
  const c = window.Capacitor
  return (c?.Plugins as unknown as { ModeloEducativo?: ModeloEducativoAPI } | undefined)?.ModeloEducativo
    ?? c?.registerPlugin?.('ModeloEducativo') as unknown as ModeloEducativoAPI | undefined
}
function readable(bytes: number) {
  return bytes ? (bytes / (1024 * 1024)).toFixed(1) + ' MB' : '0 MB'
}

/** Instalación opcional y verificable del modelo: NO afirma que el tutor offline funcione. */
export default function ModeloSinConexion({
  mostrarPrueba = true,
  onInstalled,
}: { mostrarPrueba?: boolean; onInstalled?: () => void } = {}) {
  const [estado, setEstado] = useState<EstadoModelo | null>(null)
  const [avance, setAvance] = useState<Progreso | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [pregunta, setPregunta] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [respondiendo, setRespondiendo] = useState(false)
  const available = sesionNativaDisponible()

  useEffect(() => {
    if (!available) return
    let live = true
    const model = modeloAndroid()
    if (!model) {
      setError('Este dispositivo no incluye el instalador de modelos.')
      return
    }
    void model.estado().then(value => {
      if (live) setEstado(value)
    }).catch(e => {
      if (live) setError(String(e))
    })
    let subscription: Suscripcion | undefined
    try {
      // Capacitor 8 puede entregar el listener directamente o como Promise.
      // No encadenar .then al valor sin normalizar: bloqueaba la interfaz.
      const listener = model.addListener('progreso', p => {
        if (live) setAvance(p)
      })
      void Promise.resolve(listener).then(value => {
        if (live) subscription = value
        else void value.remove()
      }).catch(() => {})
    } catch (e) {
      if (live) setError('No se pudo activar el seguimiento de descarga: ' + String(e))
    }
    return () => {
      live = false
      if (subscription) void subscription.remove()
    }
  }, [available])

  if (!available) return null

  async function descargar() {
    const model = modeloAndroid()
    if (!model || trabajando) return
    if (!window.confirm('El modelo educativo ocupa aproximadamente 484 MB y se descargará por Internet. ¿Deseas continuar? Se recomienda Wi-Fi y al menos 650 MB libres.')) return
    setTrabajando(true);setError('');setAvance(null)
    try {
      const result = await model.descargar()
      setEstado(result)
      if (result.installed) onInstalled?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      try { setEstado(await model.estado()) } catch { /* Conserva el estado anterior */ }
    } finally {setTrabajando(false)}
  }
  async function cancelar() {
    try { await modeloAndroid()?.cancelar() } catch(e) {setError(String(e))}
  }
  async function eliminar() {
    const model = modeloAndroid()
    if (!model || !window.confirm('¿Eliminar el modelo local y recuperar espacio?')) return
    try {setEstado(await model.eliminar());setAvance(null);setError('')}
    catch(e){setError(String(e))}
  }
  async function probarIA() {
    const motor = motorAndroid()
    if (!motor || respondiendo || !pregunta.trim()) return
    setRespondiendo(true); setRespuesta(''); setError('')
    try {
      const resultado = await motor.responder({ texto: pregunta.trim(), maxTokens: 180 })
      setRespuesta(resultado.texto)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRespondiendo(false)
    }
  }
  const downloaded = avance?.received ?? estado?.downloadBytes ?? 0
  const percentage = avance?.percentage ?? -1
  return (
    <section className="mtc-model-card" aria-label="Modelo educativo para estudiar sin conexión">
      <header>
        <span aria-hidden="true">◉</span>
        <div>
          <h2>Modelo educativo del dispositivo</h2>
          <p>Qwen3 0.6B · 4 bits · ~484 MB</p>
        </div>
      </header>
      <p className="mtc-model-note">
        {estado?.installed
          ? estado.engineAvailable
            ? 'El modelo y el motor están listos. En Android puedes conversar sin Internet y conservar un historial cifrado en el dispositivo.'
            : 'Modelo almacenado, pero este dispositivo no puede cargar el motor local de IA.'
          : 'Descarga el modelo educativo una sola vez con Internet. Después podrás usar el tutor local sin conexión, con respuestas más rápidas o más detalladas.'}
      </p>
      <div className="mtc-model-status" role="status">
        <strong>{estado?.installed ? 'Modelo almacenado' : trabajando ? 'Descargando modelo' : 'Modelo pendiente'}</strong>
        <span>{estado?.installed ? readable(estado.bytes) : downloaded ? readable(downloaded) : 'Requiere descarga'}</span>
      </div>
      {trabajando && (
        <div className="mtc-model-progress">
          <div className="mtc-model-track" role="progressbar"
            aria-label="Descarga del modelo"
            aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={percentage >= 0 ? percentage : undefined}>
            <div style={{width: (percentage >= 0 ? percentage : 0) + '%'}}/>
          </div>
          <small>{percentage >= 0 ? percentage + '% descargado' : readable(downloaded) + ' descargados'}</small>
        </div>
      )}
      {mostrarPrueba && estado?.installed && estado.engineAvailable && (
        <div className="mtc-model-local-preview">
          <label htmlFor="mtc-model-pregunta">Prueba experimental de la IA del dispositivo</label>
          <textarea id="mtc-model-pregunta" rows={3} maxLength={800}
            value={pregunta} onChange={e => setPregunta(e.target.value)}
            placeholder="¿Cómo puedo entender las fracciones?" disabled={respondiendo}/>
          <button type="button" onClick={() => void probarIA()}
            disabled={respondiendo || !pregunta.trim()}>
            {respondiendo ? 'Generando en este dispositivo…' : 'Probar respuesta sin Internet'}
          </button>
          {respuesta && <p className="mtc-model-local-answer" role="status">{respuesta}</p>}
          <small>No se sincroniza esta prueba ni se envía el texto a un servidor.</small>
        </div>
      )}
      {error && <p className="mtc-model-error" role="alert">{error}</p>}
      <div className="mtc-model-actions">
        {!estado?.installed && !trabajando &&
          <button type="button" onClick={() => void descargar()}>Descargar modelo</button>}
        {trabajando && <button type="button" onClick={() => void cancelar()}>Cancelar descarga</button>}
        {estado?.installed && !trabajando &&
          <button type="button" onClick={() => void eliminar()}>Eliminar modelo</button>}
      </div>
    </section>
  )
}
