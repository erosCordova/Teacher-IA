import { NatureCompanion } from './NatureWorld'

/**
 * Portada de bienvenida: contenido visual, sin repetir la navegación
 * que ya está disponible en el menú lateral.
 */
export default function NatureDashboard({ displayName }: { displayName: string }) {
  const nombre = (displayName.trim().split(/\s+/)[0] || 'estudiante').slice(0, 28)

  return (
    <section className="aur-home aur-home--focused" aria-label="Bienvenida a My Teacher IA">
      <div className="aur-home__hero">
        <div className="aur-home__robot" aria-hidden="true">
          <NatureCompanion />
        </div>
        <div className="aur-home__heading">
          <span className="aur-home__orb" aria-hidden="true">✦</span>
          <span className="aur-home__brand">My Teacher IA</span>
          <span className="aur-home__subtitle">Tu compañero de aprendizaje inteligente</span>
          <h1>¡Hola, {nombre}!</h1>
          <p>
            Estoy aquí para guiarte, responder tus dudas, practicar contigo
            y ayudarte a aprender de forma dinámica y divertida.
          </p>
        </div>
        <span className="aur-home__float aur-home__float--one" aria-hidden="true">✧</span>
        <span className="aur-home__float aur-home__float--two" aria-hidden="true">✦</span>
        <span className="aur-home__ground" aria-hidden="true" />
      </div>
    </section>
  )
}
