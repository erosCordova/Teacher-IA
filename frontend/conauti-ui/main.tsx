import MarcaMyTeacher from "./MarcaMyTeacher";
import PantallaCompartida from "./PantallaCompartida";
import EvaluacionesAcademicas from "./EvaluacionesAcademicas";
import CinematicNature from './CinematicNature'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { createRoot } from 'react-dom/client'
import HistorialAvanzado from './HistorialAvanzado'
import GuiaPedagogica from './GuiaPedagogica'
import EntradaVoz from './EntradaVoz'
import ConversacionVoz from './ConversacionVoz'
import './composerGlobal'
import './style.css'
import './ConfiguracionGlobal'
import './cinematic-theme.css'

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

type Page = 'chat' | 'progress' | 'settings' | 'privacy'

type GoogleAccountAPI = {
  accounts: {
    id: {
      initialize: (data: {
        client_id: string
        callback: (answer: { credential: string }) => void
      }) => void
      renderButton: (element: HTMLElement, options: {
        theme: string
        size: string
        width: number
        text: string
      }) => void
    }
  }
}

function googleIdentity(): GoogleAccountAPI | undefined {
  return (window as Window & { google?: GoogleAccountAPI }).google
}

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
  const [legacyLoginOpen, setLegacyLoginOpen] = useState(false)
  const [googleConfig, setGoogleConfig] = useState<{
    enabled: boolean
    client_id: string | null
  } | null>(null)
  const [googleConfigurationError, setGoogleConfigurationError] = useState('')
  const [emailMethodReady, setEmailMethodReady] = useState(false)
  const [microsoftReady, setMicrosoftReady] = useState(false)
  const [emailMethodOpen, setEmailMethodOpen] = useState(false)
  const [emailAddress, setEmailAddress] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailStep, setEmailStep] = useState<'address' | 'code'>('address')
  const [emailFeedback, setEmailFeedback] = useState('')
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
  const googleButton = useRef<HTMLDivElement>(null)
  const googleInitialized = useRef(false)
  const googleMode = useRef<'login' | 'register'>('login')

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

  function completeSignIn(tokenValue: string) {
    sessionStorage.setItem('conauti_token', tokenValue)
    setPassword('')
    setChecking(true)
    setToken(tokenValue)
  }

  async function handleGoogleIdentity(
    credential: string,
    mode: 'login' | 'register',
  ) {
    if (busy) return
    setBusy(true)
    setNotice('')

    try {
      const result = await api<{ access_token: string }>(
        '/auth/google', null, 'POST', { credential, mode },
      )
      completeSignIn(result.access_token)
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (token) return
    let active = true

    api<{ enabled: boolean; client_id: string | null }>('/auth/google/config')
      .then(configuration => {
        if (!active) return
        setGoogleConfig(configuration)
        setGoogleConfigurationError(
          configuration.enabled
            ? ''
            : 'El acceso con Google todavía no está configurado.',
        )
      })
      .catch(() => {
        if (active) {
          setGoogleConfigurationError(
            'Google todavía no está disponible en este servidor.',
          )
        }
      })

    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (token) return
    let active = true

    api<{ enabled: boolean }>('/auth/email/config')
      .then(result => { if (active) setEmailMethodReady(result.enabled) })
      .catch(() => { if (active) setEmailMethodReady(false) })

    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (token) return
    let active = true

    api<{ enabled: boolean }>('/auth/microsoft/config')
      .then(result => { if (active) setMicrosoftReady(result.enabled) })
      .catch(() => { if (active) setMicrosoftReady(false) })

    return () => { active = false }
  }, [token])

  useEffect(() => {
    const url = new URL(window.location.href)
    const ticket = url.searchParams.get('ms_ticket')
    const error = url.searchParams.get('login_error')

    if (!ticket && !error) return

    url.searchParams.delete('ms_ticket')
    url.searchParams.delete('login_error')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)

    if (error) {
      setNotice(
        'No se pudo completar el acceso con Microsoft. Comprueba tu cuenta y vuelve a intentarlo.',
      )
      return
    }

    if (ticket) {
      setChecking(true)
      api<{ access_token: string }>(
        '/auth/microsoft/complete?ticket=' + encodeURIComponent(ticket),
        null,
        'POST',
      )
        .then(result => completeSignIn(result.access_token))
        .catch(reason => {
          setNotice(errorText(reason))
          setChecking(false)
        })
    }
  }, [])

  function startMicrosoft() {
    if (!microsoftReady || busy) return
    const mode = register ? 'register' : 'login'
    window.location.assign(
      'https://my-teacher-ia-api.onrender.com/api/conauti/auth/microsoft/start?mode='
      + mode,
    )
  }

  async function requestEmailCode(event: FormEvent) {
    event.preventDefault()
    if (busy || !emailMethodReady) return
    setBusy(true)
    setEmailFeedback('')

    try {
      const result = await api<{ sent: boolean; message: string }>(
        '/auth/email/start',
        null,
        'POST',
        { email: emailAddress.trim(), mode: register ? 'register' : 'login' },
      )
      setEmailStep('code')
      setEmailFeedback(result.message)
      setEmailCode('')
    } catch (error) {
      setEmailFeedback(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  async function confirmEmailCode(event: FormEvent) {
    event.preventDefault()
    if (busy || !emailMethodReady || !/^[0-9]{8}$/.test(emailCode)) return
    setBusy(true)
    setEmailFeedback('')

    try {
      const result = await api<{ access_token: string }>(
        '/auth/email/verify',
        null,
        'POST',
        {
          email: emailAddress.trim(),
          code: emailCode,
          mode: register ? 'register' : 'login',
        },
      )
      setEmailCode('')
      completeSignIn(result.access_token)
    } catch (error) {
      setEmailFeedback(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    googleMode.current = register ? 'register' : 'login'
    if (token || checking || !googleConfig?.enabled || !googleConfig.client_id) {
      return
    }

    let cancelled = false
    const holder = googleButton.current
    if (!holder) return

    function renderGoogle() {
      const google = googleIdentity()
      if (cancelled || !google || !holder || !googleConfig?.client_id) return

      holder.replaceChildren()
      if (!googleInitialized.current) {
        google.accounts.id.initialize({
          client_id: googleConfig.client_id,
          callback: result => {
            if (result.credential) {
              void handleGoogleIdentity(result.credential, googleMode.current)
            }
          },
        })
        googleInitialized.current = true
      }

      google.accounts.id.renderButton(holder, {
        theme: 'filled_black',
        size: 'large',
        width: 340,
        text: register ? 'signup_with' : 'signin_with',
      })
    }

    const scriptId = 'myteacher-google-identity'
    let script = document.getElementById(scriptId) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.async = true
      script.defer = true
      script.src = 'https://accounts.google.com/gsi/client'
      script.onerror = () => setGoogleConfigurationError(
        'No se pudo cargar el acceso de Google. Comprueba tu conexión y vuelve a intentarlo.',
      )
      document.head.appendChild(script)
    }

    if (googleIdentity()) renderGoogle()
    else script.addEventListener('load', renderGoogle)

    return () => {
      cancelled = true
      script?.removeEventListener('load', renderGoogle)
    }
  }, [token, checking, googleConfig, register])

  async function authenticate(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setNotice('')

    try {
      const result = await api<{ access_token: string }>(
        '/auth/login', null, 'POST',
        { username, password }
      )
      completeSignIn(result.access_token)
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
      <main className="auth cinematic-auth">
        <CinematicNature mode="auth" />
        <section className="auth-intro" aria-label="Presentación de My Teacher IA">
          <div className="auth-intro__brand">
            <MarcaMyTeacher />
            <span>MY TEACHER IA</span>
          </div>
          <p className="auth-intro__kicker">EDUCACIÓN QUE SE SIENTE VIVA</p>
          <h1>Explora.<br />Comprende.<br /><em>Avanza.</em></h1>
          <p className="auth-intro__copy">
            Un espacio inmersivo para aprender con una IA que guía tu proceso,
            respeta tu ritmo y convierte cada duda en un nuevo camino.
          </p>
          <div className="auth-intro__meta">
            <span><i /> APRENDE A TU MANERA</span>
            <span>01 — AULA DIGITAL</span>
          </div>
          <div className="auth-beacon">
            <div className="auth-beacon__ring auth-beacon__ring--outer" />
            <div className="auth-beacon__ring auth-beacon__ring--inner" />
            <div className="auth-beacon__core"><MarcaMyTeacher /></div>
          </div>
        </section>
        <section className="auth-card auth-card--professional">
          <div className="auth-card__line">
            <span>ACCESO AL AULA</span>
            <span>● EN LÍNEA</span>
          </div>
          <div className="auth-card__brand">
            <MarcaMyTeacher />
            <span className="eyebrow">MY TEACHER IA</span>
          </div>
          <h2>{
            register
              ? 'Crea tu espacio de aprendizaje.'
              : '¡Qué bueno verte de nuevo!'
          }</h2>
          <p>
            {register
              ? 'Elige un método seguro y empieza a aprender a tu manera.'
              : 'Vuelve a tus conversaciones, prácticas y descubrimientos.'}
          </p>

          <div className="tabs" role="group" aria-label="Tipo de acceso">
            <button
              type="button"
              className={!register ? 'selected' : ''}
              aria-pressed={!register}
              onClick={() => {
                setRegister(false)
                setLegacyLoginOpen(false)
                setEmailMethodOpen(false)
                setEmailStep('address')
                setEmailFeedback('')
                setNotice('')
              }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={register ? 'selected' : ''}
              aria-pressed={register}
              onClick={() => {
                setRegister(true)
                setLegacyLoginOpen(false)
                setEmailMethodOpen(false)
                setEmailStep('address')
                setEmailFeedback('')
                setNotice('')
              }}
            >
              Crear cuenta
            </button>
          </div>

          <div className="auth-provider">
            <div className="auth-provider__head">
              <span className="auth-provider__google" aria-hidden="true">G</span>
              <span>
                <strong>Accede con tu cuenta Google</strong>
                <small>Una forma rápida y segura de entrar</small>
              </span>
            </div>

            {googleConfig?.enabled && !googleConfigurationError ? (
              <div
                ref={googleButton}
                className="auth-google-button"
                aria-label="Iniciar con Google"
              />
            ) : (
              <p role="status" className="auth-provider__unavailable">
                {googleConfigurationError
                  || 'Conectando con Google de forma segura...'}
              </p>
            )}

            <div className="auth-divider"><span>O utiliza otro método</span></div>

            <button
              type="button"
              className="auth-method"
              aria-expanded={emailMethodOpen}
              onClick={() => {
                setEmailMethodOpen(value => !value)
                setEmailFeedback('')
              }}
              disabled={!emailMethodReady}
              title={
                emailMethodReady
                  ? 'Continuar con código enviado al correo'
                  : 'Pendiente de configurar el envío seguro de correos'
              }
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
                strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              <span>Continuar con correo electrónico</span>
              <b aria-hidden="true">›</b>
            </button>
            {!emailMethodReady && (
              <p className="auth-method__pending" role="status">
                El acceso por código está preparado, pero falta activar el envío seguro de correos.
              </p>
            )}

            <button
              type="button"
              className="auth-method auth-method--microsoft"
              disabled={!microsoftReady}
              onClick={startMicrosoft}
              title={
                microsoftReady
                  ? 'Continuar con Microsoft'
                  : 'Pendiente de registrar la aplicación en Microsoft Entra'
              }
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 2h9.3v9.3H2zm10.7 0H22v9.3h-9.3zM2 12.7h9.3V22H2zm10.7 0H22V22h-9.3z" />
              </svg>
              <span>Continuar con Microsoft</span>
              <b aria-hidden="true">›</b>
            </button>
            {!microsoftReady && (
              <p className="auth-method__pending">
                Microsoft estará disponible cuando se complete la configuración de Entra.
              </p>
            )}

            {emailMethodOpen && emailMethodReady && (
              <form
                className="auth-email-form"
                onSubmit={emailStep === 'address'
                  ? requestEmailCode
                  : confirmEmailCode}
              >
                <label htmlFor="mtc-email-address">Tu correo electrónico</label>
                <input
                  id="mtc-email-address"
                  type="email"
                  required
                  maxLength={254}
                  value={emailAddress}
                  disabled={emailStep === 'code'}
                  onChange={event => setEmailAddress(event.target.value)}
                  autoComplete="email"
                  placeholder="tu-correo@ejemplo.com"
                />
                {emailStep === 'code' && (
                  <>
                    <label htmlFor="mtc-email-code">Código de 8 dígitos</label>
                    <input
                      id="mtc-email-code"
                      inputMode="numeric"
                      required
                      autoComplete="one-time-code"
                      minLength={8}
                      maxLength={8}
                      pattern="[0-9]{8}"
                      placeholder="00000000"
                      value={emailCode}
                      onChange={event => setEmailCode(
                        event.target.value.replace(/[^0-9]/g, '').slice(0, 8),
                      )}
                    />
                  </>
                )}
                <button type="submit" className="primary" disabled={busy}>
                  {busy
                    ? 'Procesando...'
                    : emailStep === 'code'
                      ? 'Verificar e ingresar'
                      : 'Enviar código seguro'}
                </button>
                {emailStep === 'code' && (
                  <button
                    type="button"
                    className="auth-email-form__back"
                    onClick={() => {
                      setEmailStep('address')
                      setEmailCode('')
                      setEmailFeedback('')
                    }}
                  >
                    Cambiar correo
                  </button>
                )}
                {emailFeedback && (
                  <p role="status" className="auth-email-form__feedback">
                    {emailFeedback}
                  </p>
                )}
              </form>
            )}
          </div>

          <p className="auth-security">
            <span aria-hidden="true">♧</span>
            {register
              ? 'Solo correos verificados · No se permiten cuentas duplicadas.'
              : 'Tu historial y progreso están asociados a tu cuenta.'}
          </p>

          {!register && (
            <div className="auth-legacy">
              <button
                type="button"
                className="auth-legacy__toggle"
                aria-expanded={legacyLoginOpen}
                onClick={() => setLegacyLoginOpen(value => !value)}
              >
                <span>Tengo una cuenta anterior con usuario</span>
                <span aria-hidden="true">{legacyLoginOpen ? '−' : '+'}</span>
              </button>
              {legacyLoginOpen && (
                <form className="auth-legacy__form" onSubmit={authenticate}>
                  <label htmlFor="username">Nombre de usuario</label>
                  <input
                    id="username"
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    minLength={3}
                    maxLength={32}
                    autoComplete="username"
                    placeholder="Tu usuario anterior"
                    required
                  />
                  <label htmlFor="password">Contraseña</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    minLength={12}
                    maxLength={128}
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                    required
                  />
                  <button className="primary full" disabled={busy}>
                    {busy ? 'Ingresando...' : 'Ingresar a mi cuenta anterior'}
                  </button>
                </form>
              )}
            </div>
          )}

          <small>Tu información está protegida. No necesitas DNI.</small>
          {notice && <p role="status" className="notice">{notice}</p>}
        </section>
      </main>
    )
  }

  return (
    <div className="app cinematic-app">
      <CinematicNature mode="workspace" />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-orb"><MarcaMyTeacher /></div>
          <div>
            <strong>MY TEACHER<br />IA</strong>
            <small>Aprende a tu manera</small>
          </div>
        </div>

        <button className="primary full" onClick={newChat}>
          + Nueva conversación
        </button>

        <nav aria-label="Menú principal">
          {([
            ['chat', '✦ Conversaciones'],
            ['progress', '◈ Mi progreso'],
            ['settings', '⚙ Configuración'],
            ['privacy', '♧ Privacidad']
          ] as const).map(([id, label]) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              onClick={() => setPage(id)}
              aria-current={page === id ? 'page' : undefined}
            >
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
          <button onClick={() => void logout()}>Salir</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
          <span className="eyebrow">AULA VIVA · ASISTENTE EDUCATIVO</span>
            <h1>{
              page === 'chat'
                ? history.find(c => c.id === active)?.title
                  || '¡Vamos a aprender!'
                : page === 'progress' ? 'Mi progreso'
                : page === 'settings' ? 'Configuración'
                : 'Privacidad'
            }</h1>
          </div>
          <span className="phase"><i /> IA CONECTADA</span>
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
                  <div className="welcome-orbit" aria-label="Logotipo My Teacher IA">
                    <span className="welcome-orbit__ring" />
                    <span className="welcome-orbit__ring welcome-orbit__ring--small" />
                    <MarcaMyTeacher />
                  </div>
                  <span className="welcome-kicker">ELIGE UNA RUTA</span>
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
