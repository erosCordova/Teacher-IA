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
type Suscripcion = { remove(): Promise<void> }
type ModeloEducativoAPI = {
  estado(): Promise<EstadoModelo>
  descargar(): Promise<EstadoModelo>
  cancelar(): Promise<void>
  eliminar(): Promise<EstadoModelo>
  addListener(name: 'progreso', callback: (progress: Progreso) => void): Promise<Suscripcion>
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
export default function ModeloSinConexion() {
  const [estado, setEstado] = useState<EstadoModelo | null>(null)
  const [avance, setAvance] = useState<Progreso | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
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
    void model.addListener('progreso', p => {
      if (live) setAvance(p)
    }).then(value => { if (live) subscription = value; else void value.remove() })
      .catch(() => {})
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
    setTrabajando(true);setError('')
    try {
      const result = await model.descargar()
      setEstado(result)
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
          ? 'Archivo GGUF descargado y verificado. La conversación sin Internet se activará cuando integremos el motor de IA local.'
          : 'Puedes preparar el modelo local. Descargarlo todavía no habilita las respuestas sin Internet: el motor de IA sigue en desarrollo.'}
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
