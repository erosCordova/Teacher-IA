import { useId } from 'react'

/**
 * Mundo original de naturaleza holográfica. SVG local: sin API, sin
 * imágenes externas, sin costes de alojamiento y accesible sin animación.
 */
export function NatureScenery({ compact = false }: { compact?: boolean }) {
  const uid = useId().replaceAll(':', '')
  const sky = 'aur-sky-' + uid
  const water = 'aur-water-' + uid
  const land = 'aur-land-' + uid
  const mist = 'aur-mist-' + uid
  const glow = 'aur-glow-' + uid
  const moon = 'aur-moon-' + uid
  const tree = 'aur-tree-' + uid
  const stars = Array.from({ length: 142 }, (_, i) => ({
    x: (i * 118.371 + 61) % 1280, y: (i * 89.91 + 13.75) % 420,
    size: i % 11 === 0 ? 2 : i % 4 === 0 ? 1.5 : .75,
    opacity: .18 + (i % 7) / 10,
  }))
  const petals = Array.from({ length: 52 }, (_, i) => ({
    x: 10 + (i * 83.3) % 1230, y: 9 + (i * 69.8) % 580,
    rotation: (i * 31) % 360, size: 3 + i % 5,
  }))
  const blossoms = Array.from({ length: 112 }, (_, i) => ({
    x: 52 + (i * 37.91) % 395, y: 1 + (i * 59.7) % 180,
    s: 5 + i % 8, o: .54 + (i % 5) / 12
  }))
  return (
    <svg className={'aur-scene' + (compact ? ' aur-scene--compact' : '')}
      viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sky} x1="0" x2=".55" y1="0" y2="1">
          <stop stopColor="#051027"/><stop offset=".28" stopColor="#10285b"/>
          <stop offset=".58" stopColor="#1e4179"/><stop offset=".75" stopColor="#5a69ad"/>
          <stop offset=".94" stopColor="#122b58"/><stop offset="1" stopColor="#050d24"/>
        </linearGradient>
        <linearGradient id={water} x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor="#f6fdff"/><stop offset=".25" stopColor="#b0f5ff"/>
          <stop offset=".58" stopColor="#2dabef"/><stop offset=".76" stopColor="#075eac"/>
          <stop offset="1" stopColor="#143d87"/>
        </linearGradient>
        <linearGradient id={land} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#427b9b"/><stop offset=".19" stopColor="#122f59"/>
          <stop offset=".55" stopColor="#0a2042"/><stop offset=".85" stopColor="#07162b"/>
          <stop offset="1" stopColor="#030b22"/>
        </linearGradient>
        <linearGradient id={tree} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#273e73"/><stop offset=".54" stopColor="#0a1836"/>
          <stop offset=".7" stopColor="#554173"/><stop offset="1" stopColor="#0b1228"/>
        </linearGradient>
        <radialGradient id={moon}><stop stopColor="#e9ffff" stopOpacity=".8"/>
          <stop offset=".42" stopColor="#79cfff" stopOpacity=".48"/>
          <stop offset="1" stopColor="#5096fe" stopOpacity="0"/></radialGradient>
        <radialGradient id={mist}><stop stopColor="#67d9ff" stopOpacity=".47"/>
          <stop offset="1" stopColor="#62cbff" stopOpacity="0"/></radialGradient>
        <filter id={glow} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5"/>
        </filter>
      </defs>
      <rect width="1280" height="720" fill={'url(#' + sky + ')'} />
      <ellipse cx="879" cy="219" rx="390" ry="320" fill={'url(#' + moon + ')'} opacity=".85"/>
      <circle cx="955" cy="209" r="132" fill="#b3ccff" opacity=".16"/>
      <circle cx="955" cy="209" r="124" fill="#759ff3" opacity=".19" stroke="#b5d6ff" strokeWidth="1"/>
      <path d="M882 140c36-18 89-18 128 5m-127 89c53 29 104 30 143 4m-67-133 24 200"
        stroke="#d0edff" opacity=".13" strokeWidth="19" strokeLinecap="round"/>
      {stars.map((s,i)=><circle key={'star'+i} cx={s.x} cy={s.y} r={s.size}
        fill="#dcf9ff" opacity={s.opacity}/>)}
      <path d="M0 432L72 365L116 390L185 308L238 359L316 269L399 364L487 288L585 377L672 303L744 373L834 270L948 390L1059 306L1130 385L1225 278L1280 342V720H0Z"
        fill="#182e5c" opacity=".72"/>
      <path d="M0 455L119 325L163 365L234 277L301 373L358 315L455 408L524 345L602 392L696 295L763 397L849 338L961 428L1020 362L1087 399L1190 332L1280 403V720H0Z"
        fill="#071f46" opacity=".92"/>
      <path d="M0 509L129 419L183 477L283 384L365 467L471 397L565 466L665 407L746 473L838 418L940 471L1017 393L1136 486L1228 433L1280 466V720H0Z"
        fill="#07182f"/>
      <ellipse cx="689" cy="518" rx="570" ry="100" fill={'url(#' + mist + ')'} opacity=".48"/>
      <path d="M0 583C182 547 241 565 392 591S687 616 839 571s280-5 441-3v152H0Z" fill="#102348"/>
      <path d="M0 600C229 548 305 584 428 614S779 607 1007 583s248 20 273 17V720H0Z"
        fill="#051429"/>
      {/* Floating islands: stacked rock faces, bio-luminescent canopies and water falls. */}
      <g className="aur-islands">
        <path d="M790 340L839 316L922 319L959 334L946 351L909 368L851 370Z"
          fill="#559296" stroke="#b7f6e2" strokeOpacity=".6"/>
        <path d="M801 351L836 368L918 366L947 350L914 412L883 436L838 405Z"
          fill={'url(#' + land + ')'} stroke="#4f91a3" strokeWidth="1.5"/>
        <path d="M797 334c43-30 101-34 158-8l-12 13-141 7Z" fill="#2c6c67"/>
        <path d="M815 326q20-49 38 0m12-6q20-52 44 0m7 6q13-44 24 0"
          stroke="#93f8d1" strokeWidth="5" strokeLinecap="round" opacity=".48"/>
        <path d="M859 370c4 38 1 69-8 104m15-102c5 24-1 71-5 124"
          stroke="#b8faff" strokeWidth="7" opacity=".72"/>
        <path d="M887 368c4 55-3 98-8 148m18-150c7 51 1 91-8 144"
          stroke="#4ad5ff" strokeWidth="3" opacity=".5"/>
        <path d="M1030 364L1094 325L1172 334L1212 368L1175 385L1097 393L1054 381Z"
          fill="#3a7882" stroke="#adf5e6" strokeOpacity=".5"/>
        <path d="M1050 378L1100 396L1180 385L1210 368L1174 451L1128 474L1089 429Z"
          fill={'url(#' + land + ')'} stroke="#367996"/>
        <path d="M1070 343q34-47 60 0m18-6q24-45 38 2" stroke="#69d8bb" strokeWidth="6"/>
        <path d="M1113 390c-3 64-3 118-13 184m23-180c0 77-11 131-12 189m25-192c0 72-4 132-8 200"
          stroke="#90edff" strokeWidth="9" opacity=".55"/>
        <path d="M1120 399c-6 87-6 132-14 190m33-190c-5 71-5 139-13 202"
          stroke="#edffff" strokeWidth="2.5" opacity=".74"/>
      </g>
      {/* Distant futuristic terraces carved into mountains. */}
      <g fill="#081c37" stroke="#61c8fc" strokeOpacity=".3" strokeWidth="1.4">
        <path d="M957 410L971 381L1017 375L1030 414L1008 436L977 435Z"/>
        <path d="M1023 402L1043 363L1060 364L1072 410L1062 446L1039 442Z"/>
        <path d="M1182 439L1198 405L1238 399L1251 445L1237 471L1191 467Z"/>
      </g>
      <g stroke="#2bb8ff" strokeWidth="3" opacity=".72">
        <path d="M960 408H1026M984 427H1021M1043 404h21M1201 436h37"/>
        <path d="M972 391h41M1198 418h35" strokeWidth="1"/>
      </g>
      <g fill="#96eaff">
        <circle cx="990" cy="380" r="2"/><circle cx="1044" cy="362" r="3"/>
        <circle cx="1213" cy="400" r="2"/>
      </g>
      {/* Foreground illuminated lake and moving ripples */}
      <path d="M0 608Q250 588 419 619t418-11q242-41 443-12v124H0Z" fill="#061a39" opacity=".88"/>
      <g stroke="#40d5ff" strokeWidth="1.2" fill="none" opacity=".35">
        <path d="M414 620q133 14 254 0m-195 15q184 15 345-5m-503 36q214 7 381-11m173-17q142-21 240-13"/>
        <path d="M794 581q118-13 208-3m-54 39q115-15 179-7M124 641q82-12 158-4"/>
      </g>
      <path d="M0 689C236 630 479 674 679 654s442-29 601 5v61H0Z" fill="#051128"/>
      {/* Cherry blossom canopy: trunk, branches and many clustered flowers */}
      <path d="M0 34L91 47L164 111L221 132L304 144M107 49l37-39M164 111l14-80M221 132l39-100M299 145l41-60M125 81L57 139"
        stroke={'url(#' + tree + ')'} strokeWidth="25" fill="none" strokeLinecap="round"/>
      <path d="M0 28L111 53L167 105L225 126L313 139M159 107L180 31M217 120L259 43"
        stroke="#ac78b5" strokeOpacity=".48" strokeWidth="5" fill="none"/>
      {blossoms.map((p,i)=><g key={'flower'+i} transform={'translate('+p.x+' '+p.y+') rotate('+(i*42)%360+')'}
          opacity={p.o}>
        <ellipse cx="0" cy={-p.s*.58} rx={p.s*.47} ry={p.s*.79} fill={i%4===0?'#a587f2':i%3===0?'#ffd3f5':'#f9a9e9'}/>
        <ellipse cx={p.s*.56} cy={-p.s*.08} rx={p.s*.7} ry={p.s*.41} fill={i%3===0?'#e0a7ff':'#fbd0f3'}/>
        <ellipse cx={-p.s*.5} cy={p.s*.24} rx={p.s*.65} ry={p.s*.44} fill="#fcbbf0"/>
        <circle r={p.s*.21} fill="#ffeaff"/>
      </g>)}
      {/* Holographic blue whale as a friendly environmental discovery motif */}
      <g className="aur-whale" transform="translate(735 124)" opacity=".87">
        <path d="M-20 34Q58-14 180 27Q232 40 270 19Q257 53 215 64Q174 103 82 83L45 104L63 77Q1 77-20 34Z"
          fill="#32a7f5" fillOpacity=".08" stroke="#6bd9ff" strokeWidth="2.5"/>
        <path d="M52 30q60-34 143 2m-137 9q70 7 131 11M69 60q61 22 140 1"
          fill="none" stroke="#c7fcff" strokeOpacity=".54" strokeWidth="1.1"/>
        <path d="M250 32Q294 3 318-3L310 28L344 42L285 56L258 42Z"
          fill="#64d1ff" fillOpacity=".14" stroke="#89ecff" strokeWidth="2"/>
        <circle cx="14" cy="37" r="3" fill="#e2ffff"/>
        <path d="M73 49L96 96L116 57" fill="#72d7ff" fillOpacity=".11" stroke="#70d7ff"/>
        <ellipse cx="145" cy="43" rx="194" ry="58" stroke="#3fd7ff" strokeOpacity=".24" transform="rotate(-8 145 43)"/>
      </g>
      {/* Petals fly on a separate overlay layer */}
      {petals.map((p,i)=><ellipse key={'petal'+i} className="aur-petal"
        cx={p.x} cy={p.y} rx={p.size} ry={p.size*.45}
        fill={i%3===0?'#a6d6ff':'#ffc5f5'} opacity={.22+(i%5)*.095}
        transform={'rotate('+p.rotation+' '+p.x+' '+p.y+')'}/>)}
      <ellipse cx="668" cy="616" rx="550" ry="42" fill={'url(#' + mist + ')'} opacity=".39"/>
      <path d="M0 0H1280V720H0Z" fill="none" stroke="#82cfff" strokeOpacity=".1"/>
    </svg>
  )
}

/**
 * Acompañante androide de diseño original; vector transparente y responsivo.
 * No representa un modelo, personaje ni marca de terceros.
 */
export function NatureCompanion() {
  return (
    <svg className="aur-companion" viewBox="0 0 470 610" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="au-metal" x1="30" y1="95" x2="436" y2="530" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f3ffff"/><stop offset=".22" stopColor="#98bce7"/>
          <stop offset=".42" stopColor="#34446f"/><stop offset=".62" stopColor="#d4eaff"/>
          <stop offset=".78" stopColor="#608db9"/><stop offset="1" stopColor="#fafbff"/>
        </linearGradient>
        <linearGradient id="au-hair" x1="163" y1="100" x2="390" y2="519" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7faff"/><stop offset=".37" stopColor="#b0c6ff"/>
          <stop offset=".64" stopColor="#7c99e9"/><stop offset="1" stopColor="#bcd8fe" stopOpacity=".1"/>
        </linearGradient>
        <linearGradient id="au-screen" x1="162" y1="119" x2="293" y2="256" gradientUnits="userSpaceOnUse">
          <stop stopColor="#051020"/><stop offset=".43" stopColor="#0c2652"/>
          <stop offset="1" stopColor="#020917"/>
        </linearGradient>
        <radialGradient id="au-core"><stop stopColor="#faffff"/>
          <stop offset=".3" stopColor="#97ffff"/><stop offset=".62" stopColor="#0c98ef"/>
          <stop offset="1" stopColor="#1651a9" stopOpacity=".15"/></radialGradient>
        <filter id="au-eye-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5"/>
        </filter>
      </defs>
      <ellipse cx="247" cy="548" rx="184" ry="37" fill="#87ccff" opacity=".12"/>
      {/* Long flowing artificial hair */}
      <path d="M142 154Q40 195 65 386Q81 481 22 570Q173 548 181 400L214 277Z"
        fill="url(#au-hair)" opacity=".78"/>
      <path d="M288 140Q366 157 398 332Q414 439 465 547Q323 537 308 362L277 252Z"
        fill="url(#au-hair)" opacity=".76"/>
      <path d="M106 305Q73 434 51 549M129 284Q115 423 85 532M334 297Q355 447 426 543"
        stroke="#e0eeff" strokeWidth="4" strokeLinecap="round" opacity=".67"/>
      {/* Ear-mounted audio and head shell */}
      <path d="M138 131Q151 67 227 56Q296 68 315 132L330 205L299 262L152 258L119 205Z"
        fill="#f3f9ff" stroke="#bddbff" strokeWidth="5"/>
      <path d="M148 126Q164 87 227 77Q289 82 307 130L299 223L249 257L175 240L138 209Z"
        fill="url(#au-metal)" stroke="#d8ecff" strokeWidth="2"/>
      <path d="M147 130Q182 109 226 101Q283 106 310 136L294 230Q261 268 205 259Q159 254 144 211Z"
        fill="url(#au-screen)" stroke="#85ceff" strokeWidth="4"/>
      <ellipse cx="130" cy="185" rx="24" ry="48" fill="#d4e5ff" stroke="#86c9ff" strokeWidth="5"/>
      <ellipse cx="129" cy="185" rx="14" ry="30" fill="#1e487e" stroke="#84edff" strokeWidth="3"/>
      <ellipse cx="324" cy="185" rx="24" ry="48" fill="#d4e5ff" stroke="#86c9ff" strokeWidth="5"/>
      <ellipse cx="324" cy="185" rx="14" ry="30" fill="#1e487e" stroke="#84edff" strokeWidth="3"/>
      <path d="M152 134Q190 72 230 81Q268 75 300 136Q270 118 228 120Q188 120 152 134Z"
        fill="#f3fcff" stroke="#83c5ff" strokeWidth="2"/>
      <path d="M190 105L221 65L253 102" stroke="#e7f7ff" strokeWidth="10" strokeLinecap="round"/>
      {/* Eyes and facial glow */}
      <path d="M171 188Q190 177 204 186" stroke="#62f3ff" strokeWidth="8" strokeLinecap="round"
        filter="url(#au-eye-glow)"/>
      <path d="M251 186Q269 174 286 187" stroke="#62f3ff" strokeWidth="8" strokeLinecap="round"
        filter="url(#au-eye-glow)"/>
      <path d="M171 188Q190 177 204 186M251 186Q269 174 286 187"
        stroke="#cbffff" strokeWidth="5" strokeLinecap="round"/>
      <path d="M210 224Q228 240 247 222" stroke="#60dfff" strokeWidth="3.2" strokeLinecap="round"/>
      <circle cx="165" cy="210" r="5" fill="#38adfc" opacity=".75"/>
      <circle cx="291" cy="210" r="5" fill="#38adfc" opacity=".75"/>
      {/* Neck and torso body */}
      <path d="M204 250H256L271 299L231 330L185 300Z" fill="#7498cb" stroke="#d9eeff" strokeWidth="4"/>
      <path d="M170 287L231 307L285 287L330 315L377 487L300 558H158L78 486L114 316Z"
        fill="url(#au-metal)" stroke="#dcefff" strokeWidth="6"/>
      <path d="M163 296L225 337L291 293L314 333L284 438L232 486L172 438L137 334Z"
        fill="#11284c" stroke="#9bd7ff" strokeWidth="4"/>
      <path d="M171 335L232 378L294 335" stroke="#9bc5ed" strokeWidth="4"/>
      <path d="M196 371L234 399L268 371L284 417L233 451L182 417Z"
        fill="#274d82" stroke="#cbe8ff" strokeWidth="3"/>
      <circle cx="234" cy="408" r="25" fill="url(#au-core)" stroke="#d7ffff" strokeWidth="2"/>
      <path d="M227 399L234 389L244 406L234 426L225 408Z" fill="#f3ffff"/>
      <path d="M132 351L159 446L132 504L102 487L85 385Z" fill="#658bbd" stroke="#d4e9ff" strokeWidth="3"/>
      <path d="M327 350L306 445L336 505L362 489L372 394Z" fill="#6389b9" stroke="#d4e9ff" strokeWidth="3"/>
      <path d="M151 478L193 503H270L311 478" stroke="#e8f8ff" strokeWidth="5"/>
      {/* Outstretched arm to project a floating digital textbook */}
      <path d="M328 322L361 340L408 405L378 436L334 392L303 360Z"
        fill="url(#au-metal)" stroke="#d4edff" strokeWidth="4"/>
      <path d="M399 393L423 380L440 399L420 435L389 441L376 426Z"
        fill="#b7d4f6" stroke="#e6f5ff" strokeWidth="3"/>
      <path d="M401 395L426 383M413 413L440 400" stroke="#74c8ff" strokeWidth="3"/>
      {/* Floating holographic book and orbit */}
      <g className="aur-companion__book">
        <ellipse cx="377" cy="338" rx="67" ry="15" stroke="#80f1ff" strokeWidth="2" opacity=".61"/>
        <path d="M327 300Q357 291 378 307Q397 292 428 302L423 351Q394 342 378 357Q353 343 330 348Z"
          fill="#36cfff" fillOpacity=".18" stroke="#7feaff" strokeWidth="3"/>
        <path d="M378 307V357M339 314Q355 308 368 321M387 322Q404 312 417 317"
          stroke="#d9fdff" strokeWidth="2"/>
        <circle cx="377" cy="318" r="5" fill="#d7ffff"/>
      </g>
      <g fill="#e8ffff" opacity=".9"><circle cx="333" cy="277" r="2.5"/><circle cx="420" cy="285" r="3"/>
        <circle cx="354" cy="258" r="1.7"/></g>
    </svg>
  )
}
