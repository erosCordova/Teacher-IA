import MechaEmblem from './MechaEmblem'

type Section = 'chat' | 'progress' | 'settings' | 'privacy' | 'games' |
  'facts' | 'achievements' | 'materials' | 'study'
type ArmorVariant = 'access' | 'chat' | 'adventure' | 'study' | 'materials' | 'assessment' | 'settings'

const SECTION_LABELS: Record<Section, { title: string; code: string }> = {
  chat: { title: 'Núcleo conversacional', code: '01' },
  games: { title: 'Simulaciones educativas', code: '02' },
  facts: { title: 'Exploración y descubrimientos', code: '03' },
  achievements: { title: 'Reconocimientos', code: '04' },
  progress: { title: 'Análisis de aprendizaje', code: '05' },
  materials: { title: 'Archivo de conocimiento', code: '06' },
  study: { title: 'Centro de entrenamiento', code: '07' },
  settings: { title: 'Configuración del sistema', code: '08' },
  privacy: { title: 'Identidad del estudiante', code: '09' },
}

/**
 * Armadura original, decorativa: SVG geométrico autosuficiente,
 * sin recursos remotos ni dependencias gráficas de pago.
 * SVG, partículas y paneles no capturan clics ni el foco.
 */
export function MechaHeroArmor({ variant = 'adventure' }: { variant?: ArmorVariant }) {
  return (
    <div className={'cx-hero-armor cx-hero-armor--' + variant} aria-hidden="true">
      <svg viewBox="0 0 620 650" className="cx-armor-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cx-steel" x1="118" y1="36" x2="512" y2="575" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F1FCFF" />
            <stop offset=".13" stopColor="#758FA8" />
            <stop offset=".3" stopColor="#14253D" />
            <stop offset=".5" stopColor="#3B678A" />
            <stop offset=".73" stopColor="#091323" />
            <stop offset=".89" stopColor="#7698B0" />
            <stop offset="1" stopColor="#DDF4FF" />
          </linearGradient>
          <linearGradient id="cx-wing" x1="70" y1="195" x2="520" y2="503" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8DDEF6" /><stop offset=".22" stopColor="#355E88" />
            <stop offset=".47" stopColor="#0A1425" /><stop offset=".74" stopColor="#254B75" />
            <stop offset="1" stopColor="#B6F0FF" />
          </linearGradient>
          <linearGradient id="cx-visor" x1="218" y1="200" x2="400" y2="222" gradientUnits="userSpaceOnUse">
            <stop stopColor="#229FFB"/><stop offset=".47" stopColor="#ECFCFF"/>
            <stop offset="1" stopColor="#4EDFFF"/>
          </linearGradient>
          <radialGradient id="cx-reactor"><stop stopColor="#F1FFFF"/>
            <stop offset=".26" stopColor="#91F4FF"/>
            <stop offset=".55" stopColor="#1B98FF"/>
            <stop offset="1" stopColor="#0B4D83" stopOpacity="0"/></radialGradient>
          <filter id="cx-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8"/>
          </filter>
        </defs>
        {/* Radar rings and radial calibrations. */}
        <circle cx="308" cy="279" r="247" stroke="#60C7FF" strokeOpacity=".16" strokeWidth="1"/>
        <circle className="cx-armor-svg__dial" cx="308" cy="279" r="215"
          stroke="#89DEFF" strokeOpacity=".36" strokeWidth="2" strokeDasharray="46 13 2 29"/>
        <circle className="cx-armor-svg__dial cx-armor-svg__dial--reverse" cx="308" cy="279" r="188"
          stroke="#8BCFFF" strokeOpacity=".22" strokeWidth="2" strokeDasharray="1 12"/>
        <path d="M307 18V57M307 502V546M42 279H81M534 279H575"
          stroke="#78D4FF" strokeOpacity=".65" strokeWidth="2"/>
        <path d="M118 76L142 76L177 111M501 76L478 76L443 111M118 483L142 483L177 448M501 483L478 483L443 448"
          stroke="#8CD5FF" strokeOpacity=".35" strokeWidth="2"/>
        {/* Articulated shoulders / outer armored shell. */}
        <g className="cx-armor-svg__shoulders">
          <path d="M178 346L79 316L30 372L26 463L135 531L229 489L244 420Z"
            fill="#07111F" stroke="#8ED6F6" strokeWidth="4"/>
          <path d="M171 354L81 330L40 386L48 459L131 502L205 474L229 421Z"
            fill="url(#cx-wing)" stroke="#C0E7FF" strokeOpacity=".45" strokeWidth="2"/>
          <path d="M442 346L541 316L590 372L594 463L485 531L391 489L376 420Z"
            fill="#07111F" stroke="#8ED6F6" strokeWidth="4"/>
          <path d="M449 354L539 330L580 386L572 459L489 502L415 474L391 421Z"
            fill="url(#cx-wing)" stroke="#C0E7FF" strokeOpacity=".45" strokeWidth="2"/>
          <path d="M78 393L147 411L123 449L54 447M542 393L473 411L497 449L566 447"
            stroke="#8BE6FF" strokeWidth="4" opacity=".8"/>
          <path d="M45 473L97 505L151 488M575 473L523 505L469 488"
            stroke="#081625" strokeWidth="17" strokeLinecap="round"/>
          <path d="M55 466L103 489L142 478M565 466L517 489L478 478"
            stroke="#5D9AC4" strokeWidth="3"/>
        </g>
        {/* Layered head: forehead antenna, cheek plating and jaw. */}
        <g className="cx-armor-svg__head">
          <path d="M204 116L181 42L237 84L273 70L310 45L349 70L385 84L441 42L418 116L432 158L403 291L359 359L310 390L261 359L217 291L188 158Z"
            fill="#050E19" stroke="#8BB6D9" strokeWidth="5"/>
          <path d="M206 111L187 62L242 100L265 83L309 56L353 83L376 100L431 62L414 111L426 163L405 289L359 349L310 376L261 349L215 289L194 163Z"
            fill="url(#cx-steel)" stroke="#E9F9FF" strokeOpacity=".45" strokeWidth="2"/>
          <path d="M218 124L244 90L261 146L242 201L203 177Z" fill="#294B6B" stroke="#A0D2E8" strokeWidth="2"/>
          <path d="M402 124L376 90L359 146L378 201L417 177Z" fill="#294B6B" stroke="#A0D2E8" strokeWidth="2"/>
          <path d="M247 148L308 106L373 148L379 197L352 267L310 282L268 267L241 197Z"
            fill="#0B182B" stroke="#89D5F6" strokeWidth="3"/>
          <path d="M309 109L323 137L316 200L310 222L301 200L295 137Z"
            fill="#8BC8E8" stroke="#F3FFFF" strokeOpacity=".5" strokeWidth="2"/>
          <path d="M233 184L271 168L300 188L289 218L259 224L227 210Z" fill="#030D19" stroke="#A9D4EB" strokeWidth="2"/>
          <path d="M387 184L349 168L320 188L331 218L361 224L393 210Z" fill="#030D19" stroke="#A9D4EB" strokeWidth="2"/>
          <path d="M236 192L268 183L292 197L270 209L230 203Z" fill="url(#cx-visor)" className="cx-armor-svg__eyes"/>
          <path d="M384 192L352 183L328 197L350 209L390 203Z" fill="url(#cx-visor)" className="cx-armor-svg__eyes"/>
          <path d="M265 239L310 264L355 239L362 291L335 327L310 344L285 327L258 291Z"
            fill="#102039" stroke="#8AC5EA" strokeWidth="3"/>
          <path d="M278 271L310 289L342 271M285 302L310 311L335 302M298 330H323"
            stroke="#80B1D2" strokeWidth="4" strokeLinecap="round"/>
          <path d="M212 245L246 260L260 322L235 302Z M408 245L374 260L360 322L385 302Z"
            fill="#081525" stroke="#C1E9F8" strokeWidth="2"/>
          <path d="M237 332L280 372L310 386L340 372L383 332L365 394L310 424L255 394Z"
            fill="#152943" stroke="#7AADE0" strokeWidth="3"/>
          <path d="M283 391L310 406L337 391" stroke="#7BE5FF" strokeWidth="2"/>
          <path d="M267 96L310 60L353 96L342 115L310 91L278 115Z" fill="#CFEBF8" opacity=".55"/>
        </g>
        {/* Chest armor with core: a machine, not just a colored card. */}
        <path d="M197 391L277 401L309 442L342 401L423 391L489 467L431 570L310 617L189 570L131 467Z"
          fill="#060F1D" stroke="#97D4EE" strokeWidth="5"/>
        <path d="M193 411L270 416L310 464L350 416L427 411L464 474L418 553L310 593L202 553L156 474Z"
          fill="url(#cx-wing)" stroke="#92C8E9" strokeWidth="2"/>
        <path d="M174 452L245 454L270 478L244 518L208 533L171 476Z"
          fill="#142A45" stroke="#8ABADB" strokeWidth="2"/>
        <path d="M446 452L375 454L350 478L376 518L412 533L449 476Z"
          fill="#142A45" stroke="#8ABADB" strokeWidth="2"/>
        <path d="M182 462L240 469L253 482M438 462L380 469L367 482"
          stroke="#83EDFF" strokeWidth="3" opacity=".85"/>
        <path d="M214 544L309 580L406 544M239 558L309 587L379 558"
          stroke="#8FBAD7" strokeWidth="2"/>
        <circle cx="310" cy="493" r="58" fill="#030E1A" stroke="#82D2FF" strokeWidth="7"/>
        <circle cx="310" cy="493" r="45" fill="#0B2036" stroke="#43799F" strokeWidth="3"/>
        <circle className="cx-armor-svg__core-glow" cx="310" cy="493" r="40" fill="url(#cx-reactor)"/>
        <circle className="cx-armor-svg__core-ring" cx="310" cy="493" r="32"
          stroke="#D7F9FF" strokeWidth="3" strokeDasharray="13 7"/>
        <path d="M310 463L327 485L310 519L293 485Z" fill="#C8F7FF" opacity=".94"/>
        <path d="M310 464V514M295 486H325" stroke="#1D8FFF" strokeWidth="2"/>
        {/* Rivets, engraved circuitry, glints. */}
        {[[49,392],[571,392],[178,448],[442,448],[237,129],[383,129],[253,405],[367,405]].map(([x,y],i) =>
          <g key={i}><circle cx={x} cy={y} r="6" fill="#071827" stroke="#ABD8F3" strokeWidth="2"/>
          <path d={'M'+(x-2)+' '+(y-2)+'l4 4'} stroke="#B9E4FF" strokeWidth="1.2"/></g>)}
        <path d="M155 370L99 352M465 370L521 352M139 516L100 532M481 516L520 532"
          stroke="#91D9FC" strokeWidth="2" strokeDasharray="8 11" opacity=".6"/>
        <path d="M74 285L93 271L112 285M508 285L527 271L546 285"
          stroke="#8FDCFF" strokeWidth="3"/>
      </svg>
      <span className="cx-hero-armor__serial">NÚCLEO · MT / SISTEMA EDUCATIVO</span>
    </div>
  )
}

/** Permanent holographic readout in the topbar; zero application state. */
export function MechaCommandCore() {
  return (
    <div className="cx-command" aria-hidden="true">
      <span className="cx-command__wing cx-command__wing--left"><span/><span/><span/></span>
      <div className="cx-command__machine">
        <span className="cx-command__gear cx-command__gear--outer" />
        <span className="cx-command__gear cx-command__gear--inner" />
        <span className="cx-command__reactor"><MechaEmblem /></span>
        <span className="cx-command__glare" />
      </div>
      <span className="cx-command__wing cx-command__wing--right"><span/><span/><span/></span>
    </div>
  )
}

/** Mechanized sidebar power plate. Purely ornamental, not another control. */
export function MechaPowerPanel() {
  return (
    <div className="cx-power-panel" aria-hidden="true">
      <span className="cx-power-panel__reactor"><span className="cx-power-panel__circuit"/></span>
      <span className="cx-power-panel__label">
        <strong>NÚCLEO EDUCATIVO</strong>
        <small>My Teacher IA · Sistema activo</small>
      </span>
      <span className="cx-power-panel__indicator"><i/><i/><i/><i/></span>
    </div>
  )
}

/** Decorative viewport frame and measurements, transparent to all input. */
export function MechaViewport() {
  return (
    <div className="cx-viewport" aria-hidden="true">
      <span className="cx-viewport__rail cx-viewport__rail--left"/>
      <span className="cx-viewport__rail cx-viewport__rail--right"/>
      <span className="cx-viewport__brace cx-viewport__brace--tl"/>
      <span className="cx-viewport__brace cx-viewport__brace--tr"/>
      <span className="cx-viewport__brace cx-viewport__brace--bl"/>
      <span className="cx-viewport__brace cx-viewport__brace--br"/>
      <span className="cx-viewport__diagonal"/>
    </div>
  )
}

/** Section status strips are labels, not buttons. */
export function MechaSystemStrip({ page }: { page: Section }) {
  const section = SECTION_LABELS[page]
  return (
    <div className="cx-system-strip" aria-hidden="true">
      <span className="cx-system-strip__bracket">◢</span>
      <span className="cx-system-strip__prefix">SECTOR {section.code}</span>
      <span className="cx-system-strip__cut"/>
      <strong>{section.title}</strong>
      <span className="cx-system-strip__signal"><i/><i/><i/><i/><i/></span>
      <span className="cx-system-strip__online">SISTEMA OPERATIVO</span>
      <span className="cx-system-strip__bracket">◣</span>
    </div>
  )
}
