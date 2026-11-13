import { useEffect, useState } from 'react'
import { recuperarSesionAndroid } from './SesionNativa'
import { apiFetch } from './apiFetch'

type MensajeLocal = { id: number; rol: 'estudiante' | 'tutor'; texto: string }
type Resultado = { conversation_id: string; added: number; total: number; already_synced: boolean }

export const ID_CONVERSACION_LOCAL = 'myteacher.android.offline.conversation-id.v1'

function idLocal(): string {
  let value = localStorage.getItem(ID_CONVERSACION_LOCAL)
  if (!value) {
    value = crypto.randomUUID()
    localStorage.setItem(ID_CONVERSACION_LOCAL, value)
  }
  return value
}

/**
 * La sincronización es SIEMPRE opt-in: jamás se invoca desde un efecto
 * ni cuando el teléfono recupera Internet sin confirmación del alumno.
 * No existe un token sin sesión válida conservada en Android Keystore.
 */
export default function SincronizarLocal({
  mensajes, ocupado
}: { mensajes: MensajeLocal[]; ocupado: boolean }) {
  const [sesion, setSesion] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let vigente = true
    void recuperarSesionAndroid().then(token => {
      if (vigente) setSesion(Boolean(token))
    }).catch(() => { if (vigente) setSesion(false) })
    return () => { vigente = false }
  }, [])

  async function sincronizar() {
    if (ocupado || sincronizando || !mensajes.length) return
    const cantidad = mensajes.length
    if (!window.confirm(
      '¿Copiar ' + cantidad + ' intervenciones de este dispositivo a tu cuenta? ' +
      'Se enviarán por HTTPS al servidor y podrán verse al iniciar sesión. ' +
      'Las conversaciones locales no se eliminarán.'
    )) return
    setSincronizando(true)
    setAviso('')
    try {
      const token = await recuperarSesionAndroid()
      if (!token) throw new Error('Necesitas iniciar sesión en línea antes de sincronizar.')
      const response = await apiFetch('/api/conauti/offline/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          local_conversation_id: idLocal(),
          messages: mensajes.slice(-80)
        })
      })
      if (response.status === 401) {
        setSesion(false)
        throw new Error('Tu sesión venció. Inicia sesión en línea nuevamente.')
      }
      if (response.status === 404) {
        throw new Error('El servidor todavía no tiene habilitada la sincronización.')
      }
      if (response.status === 409) {
        throw new Error('Hay diferencias entre el historial local y el de tu cuenta. No se modificó el historial guardado.')
      }
      if (!response.ok) throw new Error('No se pudo sincronizar el historial (HTTP ' + response.status + ').')
      const result = await response.json() as Resultado
      if (!result.conversation_id || typeof result.added !== 'number') {
        throw new Error('La respuesta de sincronización no es válida.')
      }
      setAviso(result.already_synced
        ? 'Esta conversación ya está guardada en tu cuenta. No se crearon duplicados.'
        : 'Se guardaron ' + result.added + ' nuevas intervenciones en tu cuenta. Tu copia local permanece cifrada.')
    } catch (error) {
      setAviso(error instanceof Error ? error.message : String(error))
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <section className="mtc-offline-sync" aria-label="Sincronizar historial local">
      <div>
        <strong>Guardar una copia en mi cuenta</strong>
        <p>Tu historial permanece cifrado en el teléfono. Solo se comparte cuando lo autorizas.</p>
      </div>
      <button type="button" onClick={() => void sincronizar()}
        disabled={!sesion || ocupado || sincronizando || mensajes.length === 0}>
        {sincronizando ? 'Guardando copia…' : 'Sincronizar ahora'}
      </button>
      {!sesion && <small>Primero inicia sesión en línea para habilitar esta opción.</small>}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  )
}
