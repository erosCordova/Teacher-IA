import PantallaCompartida from "./PantallaCompartida";
import EvaluacionesAcademicas from "./EvaluacionesAcademicas";
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { createRoot } from 'react-dom/client'
import HistorialAvanzado from './HistorialAvanzado'
import GuiaPedagogica from './GuiaPedagogica'
import EntradaVoz from './EntradaVoz'
import ConversacionVoz from './ConversacionVoz'
import Estilo6Home from './Estilo6Home'
import './composerGlobal'
import './style.css'
import './estilo6.css'
import './ConfiguracionGlobal'

type User = {
  id: string
  username: string
}

type Conversation = {
  id: string
  title: string
  created_at: string
}

type Message = {
  id: number
  role: string
  body: string
  created_at: string
}

type Page = 'chat' | 'progress' | 'evaluations' | 'settings' | 'privacy' | 'subjects' | 'notes' | 'explore'

const BASE = '/api/conauti'

async function api<T>(
  path: string,
  token: string | null = null,
  method = 'GET',
  data?: unknown
): Promise<T> {
  let response: Response

  try {
    response = await fetch(BASE + path, {
      method,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
      },
      ...(data === undefined
        ? {}
        : { body: JSON.stringify(data) }),
    })
  } catch {
    throw new Error('No se pudo conectar con FastAPI.')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(
      typeof error?.detail === 'string'
        ? error.detail
        : `Error HTTP ${response.status}`
    )
  }

  return response.json() as Promise<T>
}

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Error inesperado'
}

function App() {
  const [token, setToken] = useState<string | null>(
    () => sessionStorage.getItem('conauti_token')
  )
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [checking, setChecking] = useState(true)
  const [register, setRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [page, setPage] = useState<Page>('chat')
  const [history, setHistory] = useState<Conversation[]>([])
  const [historyVersion, setHistoryVersion] = useState(0)
  const [hasOlder, setHasOlder] = useState(false)
  const [beforeId, setBeforeId] = useState<number | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const editor = useRef<HTMLTextAreaElement>(null)
  const retryId = useRef<string | null>(null)
  const requestNumber = useRef(0)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('myteacher.estilo6.theme') === 'light' ? 'light' : 'dark' }
    catch { return 'dark' }
  })
  const [showVoice, setShowVoice] = useState(false)
  const [showScreen, setShowScreen] = useState(false)
  const [studyNotes, setStudyNotes] = useState(() => {
    try { return localStorage.getItem('myteacher.study.notes') || '' }
    catch { return '' }
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-myteacher-theme', theme)
    try { localStorage.setItem('myteacher.estilo6.theme', theme) }
    catch { /* Sesión actual solamente */ }
  }, [theme])


  useEffect(() => {
    let valid = true

    if (!token) {
      setChecking(false)
      return
    }

    setChecking(true)

    Promise.all([
      api<User>('/auth/me', token),
      api<Conversation[]>('/conversations', token),
      api<{ roles: string[] }>('/auth/roles', token),
    ])
      .then(([account, conversations, access]) => {
        if (!valid) return
        setUser(account)
        setHistory(conversations)
        setRoles(access.roles)
        setChecking(false)
      })
      .catch(error => {
        if (!valid) return
        sessionStorage.removeItem('conauti_token')
        setToken(null)
        setUser(null)
        setNotice(errorText(error))
        setChecking(false)
      })

    return () => {
      valid = false
    }
  }, [token])

  async function refresh(key: string) {
    const data = await api<Conversation[]>(
      '/conversations', key
    )
    setHistory(data)
    setHistoryVersion(value => value + 1)
  }

  async function authenticate(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setNotice('')

    try {
      if (register) {
        await api(
          '/auth/register', null, 'POST',
          { username, password }
        )
      }

      const result = await api<{ access_token: string }>(
        '/auth/login', null, 'POST',
        { username, password }
      )

      sessionStorage.setItem(
        'conauti_token', result.access_token
      )
      setPassword('')
      setChecking(true)
      setToken(result.access_token)
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    const key = token
    sessionStorage.removeItem('conauti_token')
    setToken(null)
    setUser(null)
    setRoles([])
    setHistory([])
    setMessages([])
    setActive(null)
    setPage('chat')

    if (key) {
      try {
        await api('/auth/logout', key, 'POST')
      } catch {
        setNotice('Sesión local cerrada.')
      }
    }
  }

  async function openChat(id: string) {
    if (!token) return
    setShowVoice(false)
    setShowScreen(false)
    const number = ++requestNumber.current
    setActive(id)
    setMessages([])
    setLoadingMessages(true)
    setPage('chat')
    setNotice('')

    try {
      const data = await api<{
        items: Message[]
        has_more: boolean
        next_before: number | null
      }>(
        `/history/conversations/${id}/messages?limit=30`,
        token
      )
      if (number === requestNumber.current) {
        setMessages(data.items)
        setHasOlder(data.has_more)
        setBeforeId(data.next_before)
      }
    } catch (error) {
      if (number === requestNumber.current) {
        setNotice(errorText(error))
      }
    } finally {
      if (number === requestNumber.current) {
        setLoadingMessages(false)
      }
    }
  }

  function newChat() {
    setShowVoice(false)
    setShowScreen(false)
    requestNumber.current++
    setActive(null)
    setMessages([])
    setHasOlder(false)
    setBeforeId(null)
    setDraft('')
    retryId.current = null
    setNotice('')
    setLoadingMessages(false)
    setPage('chat')
    editor.current?.focus()
  }

  async function loadOlder() {
    if (!token || !active || !beforeId || loadingOlder) return

    const number = requestNumber.current
    const conversation = active

    setLoadingOlder(true)

    try {
      const result = await api<{
        items: Message[]
        has_more: boolean
        next_before: number | null
      }>(
        `/history/conversations/${conversation}/messages`
        + `?limit=30&before_id=${beforeId}`,
        token
      )

      if (number === requestNumber.current) {
        setMessages(previous => {
          const existing = new Set(previous.map(m => m.id))
          return [
            ...result.items.filter(m => !existing.has(m.id)),
            ...previous,
          ]
        })
        setHasOlder(result.has_more)
        setBeforeId(result.next_before)
      }
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setLoadingOlder(false)
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault()
    if (!token || !draft.trim() || busy) return

    setBusy(true)
    setNotice('')

    try {
      let id = active

      if (!id) {
        const created = await api<Conversation>(
          '/conversations', token, 'POST',
          { title: draft.trim().slice(0, 100) }
        )
        id = created.id
        setActive(id)
      }

      if (!retryId.current) {
        retryId.current = crypto.randomUUID()
      }

      const response = await api<{
        user_message: Message
        assistant_message: Message
        reused: boolean
      }>(
        `/ai/conversations/${id}/respond`,
        token,
        'POST',
        {
          text: draft.trim(),
          request_id: retryId.current,
        }
      )

      setMessages(previous => {
        const existing = new Set(previous.map(m => m.id))

        const nuevos = [
          response.user_message,
          response.assistant_message,
        ].filter(message => {
          if (existing.has(message.id)) return false
          existing.add(message.id)
          return true
        })

        return [...previous, ...nuevos]
      })

      retryId.current = null
      setDraft('')
      await refresh(token)
      setNotice('Respuesta educativa generada correctamente.')
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  async function rename(item: Conversation) {
    if (!token) return
    const title = prompt('Nuevo título', item.title)
    if (!title?.trim()) return

    try {
      await api(
        `/conversations/${item.id}`,
        token, 'PATCH',
        { title: title.trim() }
      )
      await refresh(token)
      setNotice('Conversación renombrada.')
    } catch (error) {
      setNotice(errorText(error))
    }
  }

  async function remove(item: Conversation) {
    if (!token) return
    if (!confirm(`¿Eliminar "${item.title}"?`)) return

    try {
      await api(
        `/conversations/${item.id}`,
        token, 'DELETE'
      )
      if (active === item.id) newChat()
      await refresh(token)
      setNotice('Conversación eliminada.')
    } catch (error) {
      setNotice(errorText(error))
    }
  }

  async function exportData() {
    if (!token || busy) return
    setBusy(true)

    try {
      const response = await fetch(
        BASE + '/privacy/export',
        {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('No se pudo exportar.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'conauti_datos.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Datos exportados.')
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount() {
    if (!token || !deletePassword || busy) return
    if (!confirm(
      '¿Eliminar definitivamente tu cuenta y tus datos?'
    )) return

    setBusy(true)

    try {
      await api(
        '/privacy/account', token, 'DELETE',
        { password: deletePassword }
      )
      setDeletePassword('')
      await logout()
      setNotice('Cuenta eliminada.')
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  if (checking) {
    return <main className="center">Verificando sesión...</main>
  }

  if (!token || !user) {
    return (
      <main className="auth">
        <section className="auth-card">
          <div className="logo">C</div>
          <span className="eyebrow">CONAUTI · EDUCACIÓN CON IA</span>
          <h1>Aprender es descubrir</h1>
          <p>Tu espacio para practicar, preguntar y avanzar.</p>

          <div className="tabs">
            <button
              className={!register ? 'selected' : ''}
              onClick={() => setRegister(false)}
            >
              Ingresar
            </button>
            <button
              className={register ? 'selected' : ''}
              onClick={() => setRegister(true)}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={authenticate}>
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
              placeholder="Nombre de usuario"
              required
            />

            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={12}
              maxLength={128}
              autoComplete={
                register ? 'new-password' : 'current-password'
              }
              placeholder="Mínimo 12 caracteres"
              required
            />

            <button className="primary full" disabled={busy}>
              {busy ? 'Procesando...' :
                register ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>
          </form>

          <small>No necesitas DNI para registrarte.</small>
          {notice && <p role="status" className="notice">{notice}</p>}
        </section>
      </main>
    )
  }

  const isHome = page === 'chat' && !active && messages.length === 0 &&
    !loadingMessages && !showVoice
  const iniciarMateria = (pregunta: string) => {
    setPage('chat')
    setShowVoice(false)
    setDraft(pregunta)
    setTimeout(() => document.querySelector<HTMLTextAreaElement>('#e6-pregunta')?.focus(), 0)
  }
  const cambiarTema = () => setTheme(previous => previous === 'dark' ? 'light' : 'dark')
  return (
    <div className="app estilo6-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo compact">✦</div>
          <div>
            <strong>My Teacher IA</strong>
            <small>Tu compañero de aprendizaje</small>
          </div>
        </div>

        <button className="primary full e6-new" onClick={newChat}>
          ＋ Nuevo chat
        </button>

        <nav className="e6-sidebar-links" aria-label="Menú principal">
          {([
            ['chat','⌂','Inicio'],
            ['subjects','◇','Mis materias'],
            ['evaluations','▤','Evaluaciones'],
            ['progress','▥','Progreso'],
            ['notes','▣','Notas'],
            ['explore','◎','Explorar'],
          ] as const).map(([id, icon, label]) => (
            <button key={id} type="button"
              className={page === id ? 'active' : ''}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => {
                if (id === 'chat') newChat()
                else {setShowVoice(false);setShowScreen(false);setPage(id)}
              }}>
              <span className="e6-nav-icon" aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <HistorialAvanzado
          token={token}
          selected={active}
          revision={historyVersion}
          onOpen={id => void openChat(id)}
          onRename={item => void rename(item)}
          onDelete={item => void remove(item)}
        />

        <div className="account">
          <span>👤 {user.username}</span>
          <button type="button" onClick={() => setPage('privacy')} title="Mis datos personales">Privacidad</button>
          <button type="button" onClick={() => void logout()}>Salir</button>
        </div>
      </aside>

      <main className={isHome ? 'main e6-home-active' : 'main'}>
        <header className="topbar">
          <div>
            <span className="eyebrow">ASISTENTE EDUCATIVO</span>
            <h1>{
              page === 'chat'
                ? history.find(c => c.id === active)?.title
                  || '¡Vamos a aprender!'
                : page === 'progress' ? 'Mi progreso'
                : page === 'evaluations' ? 'Evaluaciones'
                : page === 'subjects' ? 'Mis materias'
                : page === 'notes' ? 'Mis notas'
                : page === 'explore' ? 'Explorar temas'
                : page === 'settings' ? 'Configuración'
                : 'Privacidad'
            }</h1>
          </div>
          <button type="button" className="e6-common-switch"
            aria-label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
            title={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
            onClick={cambiarTema}>{theme === 'dark' ? '☀' : '☾'}</button>
        </header>

        {notice && (
          <div className="notice" role="status">
            {notice}
            <button
              aria-label="Cerrar aviso"
              onClick={() => setNotice('')}
            >×</button>
          </div>
        )}

        {page === 'chat' && (
          <>
<section className="chat">

            <details className="conauti-gpt-voice-tools">
              <summary>
                <span aria-hidden="true">🎙</span>
                <span>Modo de voz</span>
                <small>Hablar y escuchar respuestas</small>
              </summary>
              <div className="conauti-gpt-voice-body">
            <ConversacionVoz
              token={token ?? ''}
              conversationId={active}
              onConversationCreated={id => {
                setActive(id)
                setMessages([])
                setHistoryVersion(value => value + 1)
              }}
              onMessages={incoming => {
                setMessages(previous => {
                  const known = new Set(
                    previous.map(message => String(message.id))
                  )
                  const fresh = (
                    incoming as Array<(typeof previous)[number]>
                  ).filter(message =>
                    message && !known.has(String(message.id))
                  )
                  return [...previous, ...fresh]
                })
                setHistoryVersion(value => value + 1)
              }}
            />
            <EntradaVoz
              token={token ?? ''}
              disabled={busy}
              onTranscription={text => {
                retryId.current = null
                setDraft(previous =>
                  previous.trim()
                    ? previous.trimEnd() + ' ' + text
                    : text
                )
                editor.current?.focus()
              }}
            />
              </div>
            </details>
            <details className="conauti-gpt-learning-tools">
              <summary>
                <span aria-hidden="true">✦</span>
                <span>Herramientas de aprendizaje</span>
              </summary>
            <GuiaPedagogica
              token={token ?? ''}
              conversationId={active}
              revision={historyVersion}
              onPrepare={message => {
                setDraft(message)
                editor.current?.focus()
              }}
            />
            </details>
            <div className="messages" aria-live="polite">
              {loadingMessages ? (
                <p>Cargando...</p>
              ) : messages.length === 0 ? (
                <div className="welcome">
                  <div className="star">✦</div>
                  <h2>¿Qué quieres aprender hoy?</h2>
                  <p>
                    Pregunta, explora y descubre
                    a tu propio ritmo.
                  </p>

                  <div className="subjects">
                    {[
                      ['📐 Matemática', 'Ayúdame con ecuaciones: '],
                      ['📖 Comunicación', 'Ayúdame a comprender: '],
                      ['🔬 Ciencias', 'Explícame este tema: ']
                    ].map(([label, value]) => (
                      <button
                        key={label}
                        onClick={() => setDraft(value)}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="message-list">
                  {hasOlder && (
                    <button
                      type="button"
                      className="mensajes-anteriores"
                      disabled={loadingOlder}
                      onClick={() => void loadOlder()}
                    >
                      {loadingOlder
                        ? 'Cargando mensajes anteriores...'
                        : 'Cargar mensajes anteriores'}
                    </button>
                  )}
                  {messages.map(m => (
                    <article
                      key={m.id}
                      className={
                        'message ' +
                        (m.role === 'user' ? 'mine' : '')
                      }
                    >
                      <strong>{
                        m.role === 'user' ? 'Tú' : 'Asistente'
                      }</strong>
                      <p>{m.body}</p>
                      <small>{
                        new Date(m.created_at)
                          .toLocaleString('es-PE')
                      }</small>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="composer-area">
              <div className="actions">
                {[
                  ['Dame una pista', 'Dame una pista para: '],
                  ['Más fácil', 'Explícame más fácil: '],
                  ['Otro ejemplo', 'Dame otro ejemplo de: '],
                  ['Revisa mi intento', 'Revisa mi intento: ']
                ].map(([label, value]) => (
                  <button
                    key={label}
                    onClick={() => setDraft(value)}
                  >{label}</button>
                ))}
              </div>

              <form className="composer" onSubmit={send}>
                <label htmlFor="chat-input" className="sr-only">
                  Escribe tu mensaje
                </label>
                <textarea
                  ref={editor}
                  id="chat-input"
                  rows={3}
                  maxLength={4000}
                  placeholder="Escribe lo que quieres aprender..."
                  value={draft}
                  onChange={e => {
                    retryId.current = null
                    setDraft(e.target.value)
                  }}
                  onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault()
                      void send()
                    }
                  }}
                  disabled={busy}
                />
                <div className="composer-bottom">
                  <small>Ctrl + Enter para enviar</small>
                  <button
                    className="primary"
                    disabled={busy || !draft.trim()}
                  >
                    {busy ? 'Guardando...' : 'Enviar ➜'}
                  </button>
                </div>
              </form>
              <p className="muted centered">
                Las respuestas se generan mediante IA real cuando el proveedor está configurado.
              </p>
            </div>
          </section>
<PantallaCompartida />
</>
        )}

        {page === 'progress' && (
          <>
<section className="panel">
            <h2>📊 Mi progreso académico</h2>
            <p>
              Aquí podrás visualizar actividades,
              evaluaciones y recomendaciones de repaso.
            </p>
            <div className="info">
              Módulo de aprendizaje pendiente de la fase 12.
              No se muestran estadísticas inventadas.
            </div>
          </section>
<EvaluacionesAcademicas />
</>
        )}

        {page === 'settings' && (
          <section className="panel">
            <h2>⚙ Mi configuración</h2>
            <p><strong>Usuario:</strong> {user.username}</p>
            <p><strong>Roles:</strong> {roles.join(', ')}</p>
            <p>
              <strong>Conversaciones:</strong> {history.length}
            </p>
            <div className="info">
              Las preferencias pedagógicas se integrarán
              con la memoria personalizada en la fase 11.
            </div>
            <button
              className="secondary"
              onClick={() => void logout()}
            >
              Cerrar sesión
            </button>
          </section>
        )}

        {page === 'privacy' && (
          <section className="panel">
            <h2>🔐 Mis datos personales</h2>
            <p>
              Exporta tus datos o elimina tu cuenta.
              Estas operaciones están conectadas a FastAPI.
            </p>

            <button
              className="primary"
              disabled={busy}
              onClick={() => void exportData()}
            >
              Exportar mis datos
            </button>

            <div className="danger-zone">
              <h3>Eliminar mi cuenta</h3>
              <p>
                Esta acción elimina los datos asociados
                y no se puede deshacer desde la aplicación.
              </p>

              <label htmlFor="delete-password">
                Contraseña actual
              </label>
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
              />

              <button
                className="danger"
                disabled={busy || deletePassword.length < 12}
                onClick={() => void deleteAccount()}
              >
                Eliminar definitivamente
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

createRoot(
  document.getElementById('root')!
).render(<App />)
