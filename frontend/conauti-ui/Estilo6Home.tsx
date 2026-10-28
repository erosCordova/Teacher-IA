import type { FormEvent } from 'react'

type Theme = 'dark' | 'light'

type Props = {
  username: string
  theme: Theme
  draft: string
  busy: boolean
  onTheme: () => void
  onDraft: (value: string) => void
  onSend: () => void
  onChat: () => void
  onVoice: () => void
  onExercise: () => void
  onEvaluations: () => void
  onScreen: () => void
  onSubjects: () => void
  onSubject: (prompt: string) => void
  onVoices: () => void
}

const acciones = [
  { name: 'Chat con IA', hint: 'Resuelve tus dudas', symbol: '▣', kind: 'chat' },
  { name: 'Ejercicios', hint: 'Practica y mejora', symbol: '✎', kind: 'exercise' },
  { name: 'Evaluaciones', hint: 'Pon a prueba tus conocimientos', symbol: '▤', kind: 'evaluation' },
  { name: 'Analizar imagen', hint: 'Analiza contenido', symbol: '▧', kind: 'image' },
  { name: 'Compartir pantalla', hint: 'Comparte tus ejercicios', symbol: '▣', kind: 'screen' },
] as const

const materias = [
  { name: 'Matemáticas', symbol: '𝑥', prompt: 'Quiero aprender matemáticas. Guíame paso a paso.', kind: 'math' },
  { name: 'Ciencias', symbol: '⚗', prompt: 'Quiero aprender ciencias. Guíame paso a paso.', kind: 'science' },
  { name: 'Historia', symbol: '▤', prompt: 'Quiero aprender historia. Guíame paso a paso.', kind: 'history' },
  { name: 'Lenguaje', symbol: '▣', prompt: 'Quiero practicar comprensión lectora. Guíame paso a paso.', kind: 'language' },
  { name: 'Inglés', symbol: '◈', prompt: 'Quiero practicar inglés. Guíame paso a paso.', kind: 'english' },
  { name: 'Computación', symbol: '▧', prompt: 'Quiero aprender computación. Guíame paso a paso.', kind: 'computing' },
] as const

export default function Estilo6Home({
  username, theme, draft, busy, onTheme, onDraft,
  onSend, onChat, onVoice, onExercise, onEvaluations,
  onScreen, onSubjects, onSubject, onVoices,
}: Props) {
  const nombre = username.trim().split(/\s+/)[0] || 'estudiante'
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!busy && draft.trim()) onSend()
  }

  const ejecutar = (kind: typeof acciones[number]['kind']) => {
    if (kind === 'chat') onChat()
    if (kind === 'exercise') onExercise()
    if (kind === 'evaluation') onEvaluations()
    if (kind === 'image' || kind === 'screen') onScreen()
  }

  return (
    <section className="e6-home" aria-label="Inicio My Teacher IA">
      <header className="e6-hero-top">
        <span className="e6-hero-mark" aria-label="Tu tutor educativo">✧</span>
        <div className="e6-hero-top-right">
          <span className="e6-model">✦ Tutor con Gemini</span>
          <button
            type="button"
            className="e6-theme-button"
            onClick={onTheme}
            title={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
            aria-label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
          >{theme === 'dark' ? '☀' : '☾'}</button>
          <span className="e6-profile" title={username}>◉</span>
        </div>
      </header>
      <div className="e6-hero-copy">
        <h1>Hola, {nombre}</h1>
        <h2>¿Qué te gustaría aprender hoy?</h2>
      </div>
      <form className="e6-compose" onSubmit={enviar}>
        <label className="e6-sr" htmlFor="e6-pregunta">Escribe tu pregunta</label>
        <button type="button" className="e6-form-tool e6-plus" onClick={onScreen} title="Compartir o subir imagen">＋</button>
        <textarea id="e6-pregunta" aria-label="Escribe tu mensaje" rows={1}
          placeholder="Escribe tu pregunta, sube una imagen o habla..."
          value={draft} maxLength={4000} disabled={busy}
          onChange={e => onDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (!busy && draft.trim()) onSend()
            }
          }}
        />
        <div className="e6-compose-tools">
          <button type="button" className="e6-form-tool" onClick={onScreen} title="Analizar imagen" aria-label="Analizar imagen">▧</button>
          <button type="button" className="e6-form-tool" onClick={onVoice} title="Conversación por voz" aria-label="Conversación por voz">♩</button>
          <button type="submit" className="e6-send" disabled={busy || !draft.trim()} title="Enviar pregunta" aria-label="Enviar pregunta">↑</button>
        </div>
      </form>
      <div className="e6-action-grid">
        {acciones.map(a => (
          <button type="button" key={a.kind} className={'e6-action e6-action-' + a.kind} onClick={() => ejecutar(a.kind)}>
            <span className="e6-action-icon">{a.symbol}</span>
            <strong>{a.name}</strong>
            <small>{a.hint}</small>
          </button>
        ))}
      </div>
      <div className="e6-subject-grid">
        {materias.map(m => (
          <button type="button" key={m.kind} className={'e6-subject e6-subject-' + m.kind} onClick={() => onSubject(m.prompt)}>
            <span className="e6-subject-icon">{m.symbol}</span>
            <strong>{m.name}</strong>
          </button>
        ))}
        <button type="button" className="e6-subject e6-more" onClick={onSubjects}><span className="e6-subject-icon">⊙</span><strong>Más</strong></button>
      </div>
      <div className="e6-hidden-support">
        <button type="button" onClick={onVoices}>Biblioteca de voces</button>
      </div>
    </section>
  )
}
