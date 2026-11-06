import { NatureCompanion } from './NatureWorld'

type Destination='study'|'games'|'materials'|'progress'|'achievements'|'settings'
type Tile={page:Destination;title:string;description:string;symbol:string;tone:string}

const TILES:Tile[]=[
  {page:'study',title:'Centro de estudio',description:'Organiza, repasa y profundiza tus temas',symbol:'book',tone:'aqua'},
  {page:'games',title:'Aprende jugando',description:'Juegos, retos y rompecabezas educativos',symbol:'game',tone:'purple'},
  {page:'materials',title:'Mis materiales',description:'Guarda y consulta tus archivos de estudio',symbol:'folder',tone:'gold'},
  {page:'progress',title:'Evaluaciones',description:'Pon a prueba tus conocimientos',symbol:'check',tone:'pink'},
  {page:'achievements',title:'Mis logros',description:'Descubre tus avances y reconocimientos',symbol:'trophy',tone:'amber'},
  {page:'settings',title:'Configuración',description:'Personaliza tu experiencia',symbol:'settings',tone:'blue'},
]

function Icon({name}:{name:string}){
  const common={stroke:'currentColor',strokeWidth:1.65,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,fill:'none'};
  return <svg viewBox="0 0 64 64" width="55" height="55" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...common}>
    {name==='book'&&<><path d="M31 48C24 41 14 41 7 42V15c9-3 18 0 24 7zm2 0c7-7 17-7 24-6V15c-9-3-18 0-24 7zM32 22v26"/><path d="M13 21c6-1 10 1 14 4M37 25c5-3 9-4 14-4M13 28c5 0 9 1 13 4M38 32c4-3 8-4 13-4"/></>}
    {name==='game'&&<><path d="M13 28Q15 21 25 21h14q10 0 12 7l7 15q3 11-5 12-5 1-12-8H23q-9 9-14 8-9-1-5-12z"/><path d="M21 31v15m-7-7h14"/><circle cx="42" cy="34" r="2.6" fill="currentColor" stroke="none"/><circle cx="48" cy="40" r="2.6" fill="currentColor" stroke="none"/></>}
    {name==='folder'&&<><path d="M7 18h22l7 8h22v25H7zM7 27h51M10 51l5-18h42l-5 18z"/></>}
    {name==='check'&&<><path d="M17 10h30l5 7v39H12V17zM23 10v8h18v-8"/><path d="m20 38 7 7 17-18M22 25h8"/></>}
    {name==='trophy'&&<><path d="M20 11h24v19q0 14-12 16-12-2-12-16zM20 17H9v8q0 12 12 13M44 17h11v8q0 12-12 13M32 46v8m-13 0h26"/><path d="m32 20 3.1 5.8 6.5.9-4.7 4.6 1.1 6.7-6-3.3-6 3.3 1.1-6.7-4.7-4.6 6.5-.9z"/></>}
    {name==='settings'&&<><path d="m26 7 12 0 2 7 6 3 7-2 6 10-5 5v7l5 5-6 10-7-2-6 4-2 6H26l-2-6-6-4-7 2-6-10 5-5v-7l-5-5 6-10 7 2 6-3z" transform="translate(2 -2) scale(.88)"/><circle cx="32" cy="32" r="11"/></>}
  </svg>
}

export default function NatureDashboard({
  displayName,onNavigate,
}:{displayName:string;onNavigate:(page:Destination)=>void}){
  const greeting=(displayName.trim().split(/\s+/)[0]||'estudiante').slice(0,28)
  return <section className="aur-home" aria-label="Inicio de aprendizaje">
    <div className="aur-home__hero">
      <div className="aur-home__robot"><NatureCompanion /></div>
      <div className="aur-home__heading">
        <span className="aur-home__orb" aria-hidden="true">✦</span>
        <span className="aur-home__brand">My Teacher IA</span>
        <span className="aur-home__subtitle">Tu compañero de aprendizaje inteligente</span>
        <h1>¡Hola, {greeting}!</h1>
        <p>Estoy aquí para guiarte, responder tus dudas, practicar contigo y ayudarte a aprender de forma dinámica y divertida.</p>
      </div>
      <span className="aur-home__float aur-home__float--one" aria-hidden="true">✧</span>
      <span className="aur-home__float aur-home__float--two" aria-hidden="true">✦</span>
    </div>
    <div className="aur-home__tiles">
      {TILES.map(t=><button key={t.page} type="button"
        className={'aur-tile aur-tile--'+t.tone}
        onClick={()=>onNavigate(t.page)}>
        <span className="aur-tile__icon"><Icon name={t.symbol}/></span>
        <span className="aur-tile__copy"><strong>{t.title}</strong><small>{t.description}</small></span>
        <span className="aur-tile__arrow" aria-hidden="true">›</span>
        <span className="aur-tile__circuit" aria-hidden="true"/>
      </button>)}
    </div>
    <div className="aur-home__bottom" aria-label="Tu espacio de aprendizaje">
      <div><span aria-hidden="true">✧</span><strong>Aprende a tu ritmo</strong></div>
      <div><span aria-hidden="true">◈</span><strong>Explora con curiosidad</strong></div>
      <div><span aria-hidden="true">✦</span><strong>Crece con cada práctica</strong></div>
    </div>
  </section>
}
