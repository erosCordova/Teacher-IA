import { useEffect, useRef } from 'react'
import MarcaMyTeacher from './MarcaMyTeacher'

type Props = { variant: 'intro' | 'welcome' }
type Spark = {
  x: number
  y: number
  depth: number
  size: number
  phase: number
  tint: number
}

/**
 * Escenografía visual separada del contenido funcional.
 * Canvas 2D + SVG, sin peticiones a API, sin bloquear botones ni formularios.
 */
export default function ActiveTheoryStage({ variant }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !container || !ctx) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let w = 1
    let h = 1
    let raf = 0
    let visible = !document.hidden
    let previous = 0
    const mouse = { x: .5, y: .5 }
    const sparks: Spark[] = Array.from({ length: variant === 'intro' ? 245 : 95 }, (_, i) => ({
      x: ((i * .61803398875) % 1),
      y: ((i * .75487766624 + Math.sin(i * 9.27) * .06 + 8) % 1),
      depth: .25 + ((i * 17.731) % 1) * .75,
      size: .65 + ((i * 23.451) % 1) * 2.4,
      phase: i * 2.39996,
      tint: ((i * 11.193) % 1),
    }))

    function resize() {
      const rect = container!.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      const scale = Math.min(window.devicePixelRatio || 1, 1.7, 2100 / w)
      canvas!.width = Math.max(1, Math.round(w * scale))
      canvas!.height = Math.max(1, Math.round(h * scale))
      ctx!.setTransform(scale, 0, 0, scale, 0, 0)
    }

    function render(ms: number) {
      if (!visible) return
      if (ms - previous >= 32 || media.matches) {
        previous = ms
        ctx!.clearRect(0, 0, w, h)
        const t = media.matches ? 0 : ms * .0002
        const centerX = w * (variant === 'intro' ? .43 : .5)
        const centerY = h * (variant === 'intro' ? .49 : .48)
        const field = Math.min(w, h) * (variant === 'intro' ? .47 : .54)

        // Dense constellation beneath the central object, with real parallax.
        for (const spark of sparks) {
          const swirl = spark.phase + t * (.20 + spark.depth * .32)
          const offsetX = Math.cos(swirl) * spark.depth * 11
          const offsetY = Math.sin(swirl * .67) * spark.depth * 9
          const x = (spark.x * w + offsetX + (mouse.x - .5) * 26 * spark.depth)
          const y = spark.y * h + offsetY + (mouse.y - .5) * 14 * spark.depth
          const dx = (x - centerX) / Math.max(field, 1)
          const dy = (y - centerY) / Math.max(field, 1)
          const density = Math.min(1, Math.max(.12, .26 + .56 * Math.max(0, dy)))
          const alpha = (.12 + .43 * spark.depth) * density * (.82 + .18 * Math.sin(t * 5 + spark.phase))
          const tint = spark.tint > .71 ? '164,210,255' : spark.tint > .35 ? '105,238,247' : '230,240,255'
          const radius = spark.size * (.66 + spark.depth)
          if (spark.depth > .74) {
            const glow = ctx!.createRadialGradient(x, y, 0, x, y, radius * 5)
            glow.addColorStop(0, 'rgba(' + tint + ',' + (alpha * .34) + ')')
            glow.addColorStop(1, 'rgba(' + tint + ',0)')
            ctx!.fillStyle = glow
            ctx!.beginPath()
            ctx!.arc(x, y, radius * 5, 0, Math.PI * 2)
            ctx!.fill()
          }
          ctx!.fillStyle = 'rgba(' + tint + ',' + alpha + ')'
          ctx!.beginPath()
          ctx!.arc(x, y, radius, 0, Math.PI * 2)
          ctx!.fill()
          void dx
        }
      }
      if (!media.matches) raf = window.requestAnimationFrame(render)
    }

    function move(event: PointerEvent) {
      mouse.x = Math.min(1, Math.max(0, event.clientX / Math.max(window.innerWidth, 1)))
      mouse.y = Math.min(1, Math.max(0, event.clientY / Math.max(window.innerHeight, 1)))
      container!.style.setProperty('--at-mouse-x', String((mouse.x - .5) * 20) + 'px')
      container!.style.setProperty('--at-mouse-y', String((mouse.y - .5) * 13) + 'px')
    }

    function onVisibility() {
      visible = !document.hidden
      window.cancelAnimationFrame(raf)
      if (visible) raf = window.requestAnimationFrame(render)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    raf = window.requestAnimationFrame(render)
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('pointermove', move)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [variant])

  const metal = 'at-metal-' + variant
  const fiber = 'at-fiber-' + variant
  const shine = 'at-shine-' + variant
  const glow = 'at-glow-' + variant

  return (
    <div className={'at-stage at-stage--' + variant} aria-hidden="true">
      <div className="at-stage__haze" />
      <div className="at-stage__rays" />
      <canvas className="at-stage__particles" ref={canvasRef} />
      <div className="at-stage__object">
        <svg className="at-stage__sculpture" viewBox="0 0 900 900" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={metal} x1="280" y1="215" x2="655" y2="480" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#030816"/>
              <stop offset=".17" stopColor="#6fc7ed"/>
              <stop offset=".22" stopColor="#f7fbff"/>
              <stop offset=".31" stopColor="#253c5e"/>
              <stop offset=".44" stopColor="#050a18"/>
              <stop offset=".59" stopColor="#26385e"/>
              <stop offset=".67" stopColor="#e9fbff"/>
              <stop offset=".74" stopColor="#5ff5ff"/>
              <stop offset=".83" stopColor="#182c53"/>
              <stop offset="1" stopColor="#020511"/>
            </linearGradient>
            <linearGradient id={fiber} x1="239" y1="300" x2="720" y2="820" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0a1222"/>
              <stop offset=".22" stopColor="#d2f4ff"/>
              <stop offset=".41" stopColor="#4fb8ff"/>
              <stop offset=".59" stopColor="#09142b"/>
              <stop offset=".8" stopColor="#bec8ed"/>
              <stop offset="1" stopColor="#26344f"/>
            </linearGradient>
            <linearGradient id={shine} x1="280" y1="250" x2="650" y2="560" gradientUnits="userSpaceOnUse">
              <stop stopColor="#70fff3" stopOpacity="0"/>
              <stop offset=".3" stopColor="#4ab9ff" stopOpacity=".8"/>
              <stop offset=".55" stopColor="#cfeaff" stopOpacity=".05"/>
              <stop offset=".85" stopColor="#60dcff" stopOpacity=".9"/>
              <stop offset="1" stopColor="#8c74ff" stopOpacity="0"/>
            </linearGradient>
            <filter id={glow} x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="18"/>
            </filter>
          </defs>
          <path d="M336 327C260 456 282 595 468 772C640 606 661 464 574 323" stroke={'url(#' + fiber + ')'} strokeWidth="18" opacity=".25" filter={'url(#' + glow + ')'} />
          <path d="M333 340C255 461 297 613 646 810" stroke="#020613" strokeWidth="18" strokeLinecap="round"/>
          <path d="M333 340C255 461 297 613 646 810" stroke={'url(#' + fiber + ')'} strokeWidth="9" strokeLinecap="round"/>
          <path d="M575 339C658 463 619 606 287 807" stroke="#040818" strokeWidth="18" strokeLinecap="round"/>
          <path d="M575 339C658 463 619 606 287 807" stroke={'url(#' + fiber + ')'} strokeWidth="8.5" strokeLinecap="round"/>
          <path d="M333 340C255 461 297 613 646 810" stroke={'url(#' + shine + ')'} strokeWidth="2.8" strokeLinecap="round"/>
          <path d="M575 339C658 463 619 606 287 807" stroke={'url(#' + shine + ')'} strokeWidth="2.6" strokeLinecap="round"/>
          <circle cx="454" cy="317" r="125" stroke="#08b6ff" strokeOpacity=".36" strokeWidth="29" filter={'url(#' + glow + ')'}/>
          <circle cx="454" cy="317" r="126" stroke="#070c19" strokeWidth="32"/>
          <circle cx="454" cy="317" r="126" stroke={'url(#' + metal + ')'} strokeWidth="23"/>
          <circle cx="454" cy="317" r="126" stroke="#d8ffff" strokeOpacity=".22" strokeWidth="2"/>
          <circle className="at-stage__rotor" cx="454" cy="317" r="124" stroke={'url(#' + shine + ')'} strokeWidth="5" strokeLinecap="round" strokeDasharray="115 664"/>
          <circle cx="454" cy="317" r="91" stroke="#699cce" strokeOpacity=".22" strokeWidth="1"/>
          <circle className="at-stage__inner-rotor" cx="454" cy="317" r="105" stroke="#b6edff" strokeOpacity=".28" strokeWidth="1" strokeDasharray="2 12"/>
          <path d="M437 279L481 290L485 331L456 360L415 350L409 310Z" stroke="#ccfaff" strokeOpacity=".74" strokeWidth="5" strokeLinejoin="round"/>
          <path d="M425 317L443 297L472 301L476 331L453 346" stroke="#4bc5ff" strokeWidth="7" strokeLinecap="round"/>
          <circle cx="320" cy="410" r="5" fill="#c2faff"/>
          <circle cx="585" cy="230" r="4" fill="#e5e9ff"/>
          <circle cx="601" cy="521" r="3" fill="#c1fdff"/>
        </svg>
        <span className="at-stage__core"><MarcaMyTeacher /></span>
      </div>
      <span className="at-stage__scanline" />
      <span className="at-stage__edge" />
    </div>
  )
}
