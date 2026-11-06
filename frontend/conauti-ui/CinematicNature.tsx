import { useEffect, useRef } from 'react'

type Mode = 'auth' | 'workspace'

type CinematicNatureProps = {
  mode: Mode
}

type Particle = {
  x: number
  y: number
  size: number
  drift: number
  speed: number
  phase: number
  alpha: number
}

/**
 * Capa visual propia de My Teacher IA.
 * Usa Canvas nativo del navegador: no requiere una API ni servicio de pago.
 */
export default function CinematicNature({ mode }: CinematicNatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const surface = canvas?.parentElement
    const context = canvas?.getContext('2d')

    if (!canvas || !surface || !context) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )
    const pointer = { x: 0.5, y: 0.48 }
    let width = 0
    let height = 0
    let particles: Particle[] = []
    let frame = 0

    const makeParticles = () => {
      const amount = Math.max(24, Math.min(66, Math.round(width / 25)))
      particles = Array.from({ length: amount }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.5 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 0.32,
        speed: 0.12 + Math.random() * 0.44,
        phase: Math.random() * Math.PI * 2 + index,
        alpha: 0.16 + Math.random() * 0.48,
      }))
    }

    const resize = () => {
      const rect = surface.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      const ratio = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      makeParticles()
    }

    const draw = (now: number) => {
      const time = now * 0.001
      context.clearRect(0, 0, width, height)

      const glowX = width * pointer.x
      const glowY = height * pointer.y
      const aurora = context.createRadialGradient(
        glowX,
        glowY,
        0,
        glowX,
        glowY,
        Math.max(width, height) * 0.55,
      )
      aurora.addColorStop(0, mode === 'auth'
        ? 'rgba(115, 216, 255, 0.18)'
        : 'rgba(100, 205, 255, 0.11)')
      aurora.addColorStop(0.42, 'rgba(84, 107, 255, 0.035)')
      aurora.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = aurora
      context.fillRect(0, 0, width, height)

      const activeParticles = reduceMotion.matches ? particles.slice(0, 28) : particles
      for (const particle of activeParticles) {
        const wave = Math.sin(time * particle.speed + particle.phase)
        const x = particle.x + wave * 11 + pointer.x * 16
        const y = particle.y + Math.cos(time * particle.speed * 0.7 + particle.phase) * 7
        const opacity = particle.alpha * (0.66 + Math.sin(time + particle.phase) * 0.34)

        const light = context.createRadialGradient(x, y, 0, x, y, particle.size * 7)
        light.addColorStop(0, `rgba(211, 246, 255, ${opacity})`)
        light.addColorStop(0.24, `rgba(108, 218, 255, ${opacity * 0.52})`)
        light.addColorStop(1, 'rgba(108, 218, 255, 0)')
        context.fillStyle = light
        context.beginPath()
        context.arc(x, y, particle.size * 6, 0, Math.PI * 2)
        context.fill()
      }

      context.strokeStyle = 'rgba(167, 232, 255, 0.08)'
      context.lineWidth = 0.6
      for (let index = 0; index < activeParticles.length; index += 1) {
        const current = activeParticles[index]
        const next = activeParticles[(index + 9) % activeParticles.length]
        const x1 = current.x + Math.sin(time * current.speed + current.phase) * 11
        const y1 = current.y + Math.cos(time * current.speed * 0.7 + current.phase) * 7
        const x2 = next.x + Math.sin(time * next.speed + next.phase) * 11
        const y2 = next.y + Math.cos(time * next.speed * 0.7 + next.phase) * 7
        const distance = Math.hypot(x1 - x2, y1 - y2)

        if (distance < Math.min(width, height) * 0.22) {
          context.globalAlpha = 1 - distance / (Math.min(width, height) * 0.22)
          context.beginPath()
          context.moveTo(x1, y1)
          context.lineTo(x2, y2)
          context.stroke()
        }
      }
      context.globalAlpha = 1

      if (!reduceMotion.matches) {
        frame = requestAnimationFrame(draw)
      }
    }

    const move = (event: PointerEvent) => {
      pointer.x = Math.max(0, Math.min(1, event.clientX / window.innerWidth))
      pointer.y = Math.max(0, Math.min(1, event.clientY / window.innerHeight))
    }

    const observer = new ResizeObserver(resize)
    observer.observe(surface)
    window.addEventListener('pointermove', move, { passive: true })
    resize()
    frame = requestAnimationFrame(draw)

    return () => {
      observer.disconnect()
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(frame)
    }
  }, [mode])

  return (
    <div
      className={`cinematic-nature cinematic-nature--${mode}`}
      aria-hidden="true"
    >
      <div className="cinematic-nature__photo cinematic-nature__photo--ridge" />
      <div className="cinematic-nature__photo cinematic-nature__photo--forest" />
      <div className="cinematic-nature__halo cinematic-nature__halo--one" />
      <div className="cinematic-nature__halo cinematic-nature__halo--two" />
      <canvas className="cinematic-nature__canvas" ref={canvasRef} />
      <div className="cinematic-nature__grid" />
      <div className="cinematic-nature__vignette" />
    </div>
  )
}
