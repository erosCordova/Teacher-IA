import { useId, type SyntheticEvent } from 'react'

type Variante = 'acceso' | 'aplicacion'


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
        <g fill="#020b1d" stroke="#3367a2" strokeWidth="2" transform="translate(-215 -45)">
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

        {/* Composición cinematográfica: santuario, camino y luces nocturnas. */}
        <defs>
          <linearGradient id={'cinema-path-' + id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#275689" stopOpacity=".85"/>
            <stop offset=".55" stopColor="#091a37"/>
            <stop offset="1" stopColor="#041022"/>
          </linearGradient>
          <linearGradient id={'cinema-roof-' + id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#223b60"/>
            <stop offset=".4" stopColor="#090f21"/>
            <stop offset="1" stopColor="#040918"/>
          </linearGradient>
          <radialGradient id={'cinema-light-' + id}>
            <stop stopColor="#ffe6ab" stopOpacity=".94"/>
            <stop offset=".16" stopColor="#e4a767" stopOpacity=".45"/>
            <stop offset="1" stopColor="#e4a767" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id={'cinema-haze-' + id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#76b7ff" stopOpacity="0"/>
            <stop offset=".7" stopColor="#2b6fa8" stopOpacity=".09"/>
            <stop offset="1" stopColor="#95c9ff" stopOpacity=".19"/>
          </linearGradient>
        </defs>
        {/* Siluetas de bosque y nubes en capas para aumentar profundidad. */}
        <path d="M0 620L38 564 62 596 106 517 139 573 165 502 204 595 249 543 282 619
                 342 554 381 628 432 549 480 611 516 574 559 627 612 565 659 621
                 704 583 760 633 806 562 852 621 920 560 979 614 1057 554
                 1110 621 1178 561 1230 604 1283 530 1329 622 1380 559
                 1450 611 1508 533 1572 606 1600 570V930H0Z" fill="#020a19" opacity=".77"/>
        <path d="M0 699Q196 617 398 683T792 673Q950 626 1160 663T1600 690V930H0Z"
              fill="#061a36" opacity=".91"/>
        <path d="M0 737Q200 677 422 725T819 716Q1126 662 1600 735V930H0Z"
              fill="#06172d" opacity=".89"/>
        {/* Santuario central con arquitectura japonesa retroiluminada. */}
        <g transform="translate(800 651)" strokeLinejoin="round">
          <path d="M-195 -20L-126 -64H126L195 -20L167 -8H-168Z" fill={'url(#cinema-roof-' + id + ')'}
                stroke="#2a5280" strokeWidth="3"/>
          <path d="M-140 -7H140V110H-140Z" fill="#08152a" stroke="#1d426d" strokeWidth="3"/>
          <path d="M-162 -20H162L175 -4H-175Z" fill="#050a1a"/>
          <path d="M-112 13H112V99H-112Z" fill="#0a1b32" stroke="#345f87"/>
          <path d="M-67 13V99M0 13V99M67 13V99" stroke="#32516d" strokeWidth="6"/>
          <path d="M-108 16H108V95H-108Z" fill="#f0ac68" opacity=".12"/>
          <path d="M-100 22H-74V76H-100ZM-55 22H-8V76H-55ZM8 22H55V76H8ZM74 22H100V76H74Z"
                fill="#df9857" opacity=".38"/>
          <path d="M-168 109H168L192 124H-194Z" fill="#0a2744" stroke="#38577b"/>
          <path d="M-25 12H25V110H-25Z" fill="#040a18" stroke="#4b6383" strokeWidth="2"/>
          <path d="M-28 109H28V125H-28Z" fill="#0f2848"/>
          <path d="M-100 -67H100L126 -61H-126Z" fill="#355579" opacity=".42"/>
          <path d="M-25 -70V-89L0 -99L25 -89V-70Z" fill="#122845" stroke="#3a5579"/>
        </g>
        {/* Sendero reflectante con perspectiva y luz dispersa. */}
        <path d="M648 777L952 777L1485 930H115Z" fill={'url(#cinema-path-' + id + ')'} opacity=".9"/>
        <path d="M648 777L952 777L1485 930H115Z" fill="none" stroke="#5b91bb" strokeOpacity=".44"/>
        <g stroke="#6cbbf1" strokeWidth="1" opacity=".22">
          <path d="M619 795H984M549 819H1043M463 852H1136M362 887H1246M235 922H1398"/>
          <path d="M790 778L745 930M810 778L845 930M705 779L532 930M890 779L1052 930"/>
        </g>
        <path d="M775 779L821 779L866 930H730Z" fill="#8ec7ff" opacity=".09"/>
        <g stroke="#283f5c" fill="#091322" strokeWidth="3">
          {[-1,1].map((sign) => (
            <g key={sign} transform={'translate(' + (800+sign*370) + ' 665)'}>
              <path d="M-45 -45L0 -75L45 -45L34 -38H-34Z" fill="#0b172c" stroke="#3a5782"/>
              <rect x="-27" y="-38" width="54" height="60" rx="3"/>
              <rect x="-18" y="-27" width="36" height="39" fill="#e0a66a" opacity=".74"/>
              <path d="M0 23V78M-8 78H8" strokeWidth="8"/>
              <circle cx="0" cy="-4" r="78" fill={'url(#cinema-light-' + id + ')'} stroke="none"/>
            </g>
          ))}
        </g>
        {Array.from({length:18},(_,i) => {
          const side=i%2 ? 1 : -1
          const depth=Math.floor(i/2)
          const center=800+side*(330-depth*26)
          const y=697+depth*21
          const scale=1-depth*.065
          return <g key={'lamp'+i} transform={'translate('+center+' '+y+') scale('+scale+')'}>
            <path d="M-17 -10L0 -21L17 -10L14 -5H-14Z" fill="#142943" stroke="#456e9c" strokeWidth="2"/>
            <rect x="-11" y="-5" width="22" height="25" fill="#ce915c" opacity=".71"/>
            <path d="M0 19V39" stroke="#183b62" strokeWidth="5"/>
            <circle r="31" fill={'url(#cinema-light-' + id + ')'} opacity=".9"/>
          </g>
        })}
        <rect y="530" width="1600" height="400" fill={'url(#cinema-haze-' + id + ')'}/>

        <rect width="1600" height="930" fill="#000a17" opacity=".10"/>
      </svg>


      {/* Recursos proporcionados por el estudiante, almacenados en la app.
          El fondo de las imágenes originales se integra mediante máscaras CSS. */}
      <svg className="shonen-character shonen-character--gojo" viewBox="0 0 284 505" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        <defs><clipPath id="shonen-clean-gojo"><path d="M128,20 L117,52 L96,32 L113,54 L86,58 L86,76 L93,78 L76,91 L73,124 L86,137 L91,160 L84,194 L74,184 L68,190 L79,212 L35,232 L45,277 L34,276 L20,290 L0,290 L0,504 L283,504 L283,327 L253,300 L268,250 L223,221 L227,198 L219,154 L231,133 L218,114 L240,90 L231,74 L215,67 L211,51 L188,41 L157,40 L181,31 L151,32 L127,46Z"/></clipPath></defs>
        <image href="/anime/gojo-usuario.avif" x="0" y="0" width="284" height="505" clipPath="url(#shonen-clean-gojo)" />
      </svg>
      <svg className="shonen-character shonen-character--naruto" viewBox="0 0 300 342" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        <defs><clipPath id="shonen-clean-naruto"><path d="M293,3 L284,3 L276,32 L256,8 L255,39 L216,10 L216,25 L185,11 L173,23 L159,3 L160,58 L120,51 L113,40 L97,44 L89,55 L74,54 L46,64 L53,76 L74,64 L84,64 L85,72 L58,83 L42,80 L40,90 L17,95 L5,111 L11,117 L21,108 L30,112 L31,117 L17,125 L20,134 L0,118 L0,274 L24,288 L77,279 L103,330 L111,335 L119,325 L127,329 L154,318 L168,325 L181,304 L190,265 L207,237 L244,231 L266,210 L299,198 L294,159 L299,136 L299,18Z"/></clipPath></defs>
        <image href="/anime/naruto-usuario.avif" x="0" y="0" width="300" height="342" clipPath="url(#shonen-clean-naruto)" />
      </svg>
      <img className="shonen-character shonen-character--luffy" src="/anime/luffy-usuario.avif" alt="" decoding="async" loading="eager"/>
      <svg className="shonen-character shonen-character--ichigo" viewBox="0 0 296 505" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        <defs><clipPath id="shonen-clean-warrior"><path d="M84,0 L80,34 L22,60 L1,76 L1,119 L6,119 L37,93 L79,70 L88,72 L72,149 L53,174 L1,201 L1,315 L42,356 L50,387 L68,400 L54,425 L57,437 L68,433 L80,460 L67,494 L79,492 L94,450 L108,454 L123,447 L129,452 L131,444 L146,434 L163,436 L167,446 L194,446 L194,467 L231,483 L234,479 L206,451 L207,440 L218,448 L230,440 L219,422 L219,406 L235,387 L222,330 L244,311 L295,302 L295,262 L291,264 L281,250 L295,243 L264,243 L256,194 L235,167 L255,176 L268,195 L257,174 L244,164 L249,143 L231,120 L206,114 L225,104 L243,104 L252,111 L251,107 L226,102 L200,113 L177,112 L200,98 L180,107 L164,105 L158,99 L159,91 L164,94 L158,87 L161,80 L153,72 L160,69 L147,66 L152,60 L140,57 L212,43 L253,20 L261,5 L253,0 L212,5 L234,10 L215,28 L152,33 L142,25 L166,13 L127,22 L123,0Z M204,77 L227,88 L232,97 L295,119 L271,84 L256,76Z"/></clipPath></defs>
        <image href="/anime/guerrero-usuario.avif" x="0" y="0" width="296" height="505" clipPath="url(#shonen-clean-warrior)" />
      </svg>
      <img className="shonen-character shonen-character--frieren" src="https://frieren-anime.jp/wp-content/uploads/2023/08/chara01_full1.png" alt="" decoding="async" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display="none" }} />

      <div className="shonen-scene__mist"/>
      <div className="shonen-scene__vignette"/>
    </div>
  )
}
