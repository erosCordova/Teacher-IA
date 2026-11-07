import { useId, type SyntheticEvent } from 'react'

type Variante = 'acceso' | 'aplicacion'

/** Reintentar una fuente alternativa si falla la ilustración remota. */
function usarAlternativa(evento: SyntheticEvent<HTMLImageElement>, url: string) {
  const imagen = evento.currentTarget
  if (imagen.dataset.alternativa === 'intentada') {
    imagen.style.display = 'none'
    return
  }
  imagen.dataset.alternativa = 'intentada'
  imagen.src = url
}


/**
 * Escenografía decorativa. No contiene rutas, estado ni controles.
 * Los personajes pertenecen a series de anime existentes y se muestran
 * únicamente como referencias visuales decorativas.
 */
export default function ShonenScene({ variante = 'aplicacion' }: { variante?: Variante }) {
  const id = useId().replace(/:/g, '')
  const sky = 'shonen-sky-' + id
  const moon = 'shonen-moon-' + id
  const halo = 'shonen-halo-' + id
  const water = 'shonen-water-' + id

  return (
    <div className={'shonen-scene shonen-scene--' + variante} aria-hidden="true">
      <svg className="shonen-scene__landscape" viewBox="0 0 1600 930"
        preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={sky} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#060c1b" />
            <stop offset=".36" stopColor="#0a2046" />
            <stop offset=".72" stopColor="#07162e" />
            <stop offset="1" stopColor="#030919" />
          </linearGradient>
          <radialGradient id={halo}>
            <stop stopColor="#9bceff" stopOpacity=".65"/>
            <stop offset=".28" stopColor="#5cafff" stopOpacity=".28"/>
            <stop offset="1" stopColor="#1c59b7" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id={moon} cx=".31" cy=".25" r=".85">
            <stop stopColor="#e9fbff"/>
            <stop offset=".45" stopColor="#9dcdf7"/>
            <stop offset=".73" stopColor="#6a9fd3"/>
            <stop offset="1" stopColor="#3569ab"/>
          </radialGradient>
          <linearGradient id={water} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#123b67"/>
            <stop offset=".65" stopColor="#06162c"/>
            <stop offset="1" stopColor="#020915"/>
          </linearGradient>
        </defs>
        <rect width="1600" height="930" fill={'url(#' + sky + ')'}/>
        <ellipse cx="811" cy="299" rx="493" ry="430" fill={'url(#' + halo + ')'}/>
        <circle cx="810" cy="266" r="156" fill={'url(#' + moon + ')'} opacity=".88"/>
        <circle cx="810" cy="266" r="158" stroke="#c4eaff" strokeOpacity=".36" strokeWidth="2" fill="none"/>
        <g fill="#c3dcff" opacity=".22">
          <path d="M730 150c-18 12-24 35-14 58 27 23 54 3 48-26-8-32-22-32-34-32Z"/>
          <path d="M875 184c20-8 38 17 35 44-3 12-23 26-42 7-16-17-4-43 7-51Z"/>
          <path d="M773 285c-22 10-19 37 4 47 25 0 33-18 20-38Z"/>
          <path d="M847 340c-17 11-9 31 8 35 15-1 24-19 15-29Z"/>
          <path d="M809 210c-9 11-16 34 5 41 14 3 22-21 10-37Z"/>
        </g>
        <g fill="#eff9ff">
          {Array.from({ length: 100 }, (_, i) => (
            <circle key={i} cx={(i * 193 + 29) % 1600} cy={(i * 73 + 41) % 550}
              r={i % 17 === 0 ? 1.8 : i % 4 === 0 ? 1.1 : .55}
              opacity={.12 + (i % 8) * .055}/>
          ))}
        </g>
        {/* Far temples and distant mountain ridge */}
        <path d="M0 552L142 436L229 511L324 403L457 527L596 414L728 544L884 415L1054 519L1176 414L1314 522L1491 418L1600 492V930H0Z"
          fill="#08142b"/>
        <path d="M0 603L146 493L252 571L342 485L473 584L598 497L730 608L875 507L1014 578L1133 472L1316 598L1439 504L1600 565V930H0Z"
          fill="#030d1d"/>
        <path d="M0 692C186 646 322 693 463 662S774 675 912 655s302-32 406 0 202 0 282 2V930H0Z"
          fill={'url(#' + water + ')'}/>
        <g stroke="#61adf0" strokeWidth="1" fill="none" opacity=".23">
          <path d="M416 722q166 14 317 0M819 725q174-10 276-4M487 769q218 13 420 0M1069 778q196-9 309 0M81 823q160-9 303 0"/>
          <path d="M610 746q95 7 160 0M650 812q244 8 403 0M1090 855q174-8 248-3"/>
        </g>
        {/* Japanese torii — dark architectural silhouette */}
        <g fill="#010b19" stroke="#174170" strokeWidth="2">
          <path d="M1000 239l283-17 69-34c-19 49-44 71-92 74l-268 18-42-20 50-21Z"/>
          <path d="M1011 287l249-18 15 21-271 19Z"/>
          <rect x="1035" y="299" width="27" height="250"/>
          <rect x="1210" y="286" width="28" height="272"/>
          <path d="M1057 356h161v21h-161Z"/>
          <path d="M1168 382l22 39h-48Z" fill="#0b294b" />
        </g>
        <g fill="#020a19">
          <path d="M300 556l59-39 55 40v62H300Z"/>
          <path d="M276 539l84-56 84 57v14H276Z"/>
          <path d="M337 468h46v37h-46Z"/>
          <path d="M328 468l32-28 34 28Z"/>
          <path d="M1263 558l54-39 50 41v45h-104Z"/>
          <path d="M1238 547l76-58 78 58v13h-154Z"/>
          <path d="M1286 485h57v29h-57Z"/>
          <path d="M1276 488l39-29 40 29Z"/>
        </g>
        <g stroke="#3c7eb8" strokeWidth="1.6" opacity=".38">
          <path d="M351 565v21m22-20v20M1295 573v20m29-20v20"/>
          <path d="M1050 327v222M1226 312v243"/>
        </g>
        {/* Cherry tree branches */}
        <g fill="none" strokeLinecap="round">
          <path d="M0 16L142 89L234 156L358 146M139 91l24-91M227 156l46-112M273 145l56-83M143 90L44 159"
            stroke="#241c38" strokeWidth="22"/>
          <path d="M1600 50L1474 104L1406 147L1333 166M1458 111l-9-69M1406 148l-39-86M1333 165l-51-60"
            stroke="#191b3b" strokeWidth="18"/>
        </g>
        {Array.from({ length: 98 }, (_, i) => {
          const left = i < 56
          const x = left ? (i * 79 + 11) % 400 : 1200 + (i * 89 + 13) % 400
          const y = left ? (i * 51 + 17) % 188 : (i * 37 + 21) % 191
          const size = 2.2 + i % 5
          return <g key={i} transform={'translate(' + x + ' ' + y + ') rotate(' + i * 41 + ')'}>
            <ellipse cy={-size} rx={size * .55} ry={size} fill={i % 3 ? '#ac769f' : '#d9a2ca'} opacity=".67"/>
            <ellipse cx={size} rx={size} ry={size * .52} fill="#e9b7d9" opacity=".78"/>
            <ellipse cx={-size} rx={size} ry={size * .52} fill="#ab79b0" opacity=".75"/>
            <circle r={size * .32} fill="#e1b7cf"/>
          </g>
        })}
        {Array.from({ length: 18 }, (_, i) => (
          <ellipse key={'petal-' + i} className="shonen-petal"
            cx={(i * 103 + 97) % 1600} cy={(i * 119 + 47) % 800}
            rx={4 + i % 4} ry="2.5" fill={i % 2 ? '#cc9aba' : '#ecd1e6'} opacity=".42"/>
        ))}
        <rect width="1600" height="930" fill="#000a17" opacity=".10"/>
      </svg>


      {/*
        Corrección de PNG con cuadrícula integrada (Luffy/Ichigo).
        La matriz reduce alpha de píxeles luminosos neutros preservando
        el personaje y los píxeles ya transparentes.
        La imagen final sigue siendo arte del anime original, no un dibujo generado.
      */}
      <svg className="shonen-scene__filters" aria-hidden="true"
        width="0" height="0" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shonen-eliminar-cuadricula" x="-5%" y="-5%" width="110%" height="110%"
            colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix"
              values="1 0 0 0 0   0 1 0 0 0   0 0 1 0 0   -0.38 -0.38 -0.38 1.15 0"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="8" intercept="-1.85"/>
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {/* Personajes originales de animes existentes: decoración, no controles. */}
      <img className="shonen-character shonen-character--gojo"
        src="https://jujutsukaisen.jp/images/chara_category6/chara_detail1_2nd.png"
        alt="" decoding="async" loading="eager" referrerPolicy="no-referrer"
        onError={evento => usarAlternativa(evento, "https://anibase.net/files/3284b7f9e5f5b3e83893ae921bf8cf8a")}/>
      <img className="shonen-character shonen-character--naruto"
        src="https://pngimg.com/uploads/naruto/naruto_PNG4.png"
        alt="" decoding="async" loading="eager" referrerPolicy="no-referrer"
        onError={evento => usarAlternativa(evento, "https://www.pngfind.com/pngs/m/57-574187_naruto-shippuden-naruto-official-art-hd-png-download.png")}/>
      <img className="shonen-character shonen-character--luffy"
        src="/anime/luffy-usuario.avif"
        alt="" decoding="async" loading="eager"/>
      <img className="shonen-character shonen-character--ichigo"
        src="https://www.vhv.rs/dpng/d/434-4342176_ichigo-kurosaki-png-png-download-j-stars-ichigo.png"
        alt="" decoding="async" loading="eager" referrerPolicy="no-referrer"
        onError={evento => usarAlternativa(evento, "https://www.pngfind.com/pngs/m/79-793358_bleach-ichigo-hd-png-download.png")}/>

      <div className="shonen-scene__mist"/>
      <div className="shonen-scene__vignette"/>
    </div>
  )
}
