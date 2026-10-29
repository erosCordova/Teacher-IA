import { useId } from 'react'

/** Ilustraciones originales para los rompecabezas. No dependen de emojis del sistema operativo. */
export function PiezaIlustrada({id, tema, forma, grande=false}:{id:string;tema:string;forma:string;grande?:boolean}) {
  const seed = useId().replace(/:/g,'')
  const grad = 'org-'+seed
  const tono = tema==='anatomia'
  const organos = ['cerebro','pulmones','corazon','higado','estomago','intestinos']
  if (tono && organos.includes(id)) return (
    <svg className={'av-organ-svg'+(grande?' av-organ-large':'')} viewBox="0 0 140 140" role="img" aria-label={id} focusable="false">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={id==='higado'?'#fcb28f':id==='cerebro'?'#ffd5df':id==='pulmones'?'#ffc1cb':'#ffb6a8'} />
          <stop offset=".55" stopColor={id==='higado'?'#ce5c49':id==='cerebro'?'#fc7b9e':id==='pulmones'?'#f48094':'#f95d68'}/>
          <stop offset="1" stopColor={id==='higado'?'#893950':id==='cerebro'?'#ce4e8c':id==='pulmones'?'#cb496c':'#b9354f'} />
        </linearGradient>
        <filter id={'shine-'+seed} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#8b334b" floodOpacity=".23" />
        </filter>
      </defs>
      {id==='corazon'&&<g filter={'url(#shine-'+seed+')'}>
        <path d="M71 27C61 19 49 22 46 37c-3 11 4 20 11 29l-5 13c-2 8 7 26 17 37 17-13 37-35 40-56 4-21-9-38-26-38-5 0-9 2-12 5Z" fill={'url(#'+grad+')'} stroke="#b9394b" strokeWidth="2.2"/>
        <path d="M65 42C50 22 39 15 40 7M79 36C78 21 86 16 91 7M83 44c10-14 20-15 28-19" stroke="#eb5066" strokeWidth="12" fill="none" strokeLinecap="round"/>
        <path d="M65 42C50 22 39 15 40 7" stroke="#4c8fe2" strokeWidth="6" fill="none" strokeLinecap="round"/>
        <path d="M79 36C78 21 86 16 91 7" stroke="#f69a92" strokeWidth="6" fill="none" strokeLinecap="round"/>
        <path d="M57 53c-13 26 4 49 12 62M86 49c2 29-4 41-17 66" stroke="#ba4057" strokeWidth="2" fill="none" opacity=".7"/>
        <path d="M52 69c11-7 21-8 27-5m-9 18c14-12 26-6 36 0" stroke="#a92747" strokeWidth="2.2" fill="none"/>
        <path d="M94 54c-8-6-15-7-21-5" stroke="#ffd8c8" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".7"/>
      </g>}
      {id==='cerebro'&&<g filter={'url(#shine-'+seed+')'}>
        <path d="M71 107C54 121 38 111 38 97c-19-4-22-26-10-38-9-17 5-34 20-34 6-16 26-19 37-9 18-4 28 9 27 23 19 11 16 28 8 37 4 23-16 36-34 26-5 5-9 7-15 5Z" fill={'url(#'+grad+')'} stroke="#cb5a82" strokeWidth="2.4"/>
        <path d="M74 20c-12 10-5 21-13 27m-8-22c-4 15 8 17 7 31m33-32c-10 9-14 24-6 33m22-13c-18-1-19 17-10 27m-62-13c18-4 27 16 16 29m43-27c-11-6-23 1-17 17m-36 8c10-13 17-4 23 1m35-1c-9-13-20-8-24-1M72 50c-10 13-6 27 4 31" fill="none" stroke="#ce4e7d" strokeWidth="3.4" strokeLinecap="round"/>
        <path d="M74 27v73" stroke="#a83d70" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="5 5" opacity=".8"/>
        <path d="M65 107l5 19 12-5 3-19" fill="#f4a6bd" stroke="#cb5a82" strokeWidth="2"/>
      </g>}
      {id==='pulmones'&&<g filter={'url(#shine-'+seed+')'}>
        <path d="M64 11v39M75 11v39" stroke="#e88e77" strokeWidth="11" strokeLinecap="round"/>
        <path d="M69 47v26m0-7-22-16m22 16 21-18" fill="none" stroke="#df8a76" strokeWidth="7" strokeLinecap="round"/>
        <path d="M59 42c-12-2-19 5-25 22C21 98 27 119 51 120c19 1 17-31 17-49L64 52Z" fill={'url(#'+grad+')'} stroke="#dc657d" strokeWidth="2.4"/>
        <path d="M81 42c12-2 19 5 25 22 13 34 7 55-17 56-19 1-17-31-17-49l4-19Z" fill={'url(#'+grad+')'} stroke="#dc657d" strokeWidth="2.4"/>
        <path d="M55 49 45 78m10-10-15 27m14-17-6 29m34-58 13 29m-11-9 17 27m-17-15 5 29" stroke="#e5a1a7" strokeWidth="2.5" fill="none"/>
        <path d="M60 54c-11-2-17 23-17 37m42-36c11-1 17 24 17 37" stroke="#fff1ea" strokeWidth="5" opacity=".55" fill="none"/>
      </g>}
      {id==='higado'&&<g filter={'url(#shine-'+seed+')'}>
        <path d="M13 55C26 31 53 26 97 33c22 4 31 19 27 36-8 17-25 19-42 14-15 26-37 28-51 17C18 90 11 71 13 55Z" fill={'url(#'+grad+')'} stroke="#a54c48" strokeWidth="2.5"/>
        <path d="M28 50c23-15 59-12 80-3" stroke="#ffc5a4" strokeWidth="8" opacity=".58" fill="none" strokeLinecap="round"/>
        <path d="M84 86c6 16 16 26 20 20 7-11 0-23-10-28" fill="#7bb95c" stroke="#3b9149" strokeWidth="2"/>
        <path d="M79 37c-5 24-3 40 3 46" stroke="#a84852" strokeWidth="2.5" opacity=".7" fill="none"/>
      </g>}
      {id==='estomago'&&<g filter={'url(#shine-'+seed+')'}>
        <path d="M57 13v31c-1 9-11 17-20 26-18 17-17 42 2 49 18 6 32-8 43-8 22-1 33-13 33-35 0-19-12-30-25-33-12-2-10-17-11-30" fill="none" stroke="#c95e67" strokeWidth="19" strokeLinecap="round"/>
        <path d="M57 13v31c-1 9-11 17-20 26-18 17-17 42 2 49 18 6 32-8 43-8 22-1 33-13 33-35 0-19-12-30-25-33-12-2-10-17-11-30" fill="none" stroke={'url(#'+grad+')'} strokeWidth="15" strokeLinecap="round"/>
        <path d="M38 87c-6 22 15 27 32 14" stroke="#fff0dd" strokeWidth="5" opacity=".7" fill="none" strokeLinecap="round"/>
        <path d="M97 55c16 17 8 33-3 40" stroke="#e24866" strokeWidth="3" fill="none"/>
      </g>}
      {id==='intestinos'&&<g filter={'url(#shine-'+seed+')'}>
        <path d="M31 30c-10 8-12 19-10 33l5 30c2 20 16 28 32 28h26c21 0 29-13 30-29l4-34c1-19-10-30-28-30H47c-7 0-12 1-16 2Z" fill="#f2918b" stroke="#cb6469" strokeWidth="10" strokeLinejoin="round"/>
        <path d="M44 46c19-18 42 5 22 18C44 77 30 51 45 79c10 17 37-4 49 4 16 13-3 18-24 15-25-3-35 3-27 12m51-65c-18 4-16 21-1 27" stroke={'url(#'+grad+')'} strokeWidth="13" strokeLinecap="round" fill="none"/>
        <path d="M44 46c19-18 42 5 22 18C44 77 30 51 45 79c10 17 37-4 49 4 16 13-3 18-24 15-25-3-35 3-27 12m51-65c-18 4-16 21-1 27" stroke="#ffd2bf" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity=".75"/>
      </g>}
    </svg>
  )
  if (tema==='celula' || tema==='atomo') {
    return <svg className="av-organ-svg av-science-piece" viewBox="0 0 140 140" role="img" aria-label={id}>
      <defs><radialGradient id={grad}><stop stopColor="#fff"/><stop offset="1" stopColor={id==='nucleo'?'#9461df':id==='mitocondria'?'#f8a34c':'#38add8'}/></radialGradient></defs>
      {id==='membrana'&&<><circle cx="70" cy="70" r="51" fill="#c8f9df" stroke="#21bd95" strokeWidth="9"/><circle cx="70" cy="70" r="43" fill="none" stroke="#8de3c2" strokeWidth="5" strokeDasharray="5 7"/></>}
      {id==='nucleo'&&<><circle cx="70" cy="70" r="47" fill={'url(#'+grad+')'} stroke="#7545bd" strokeWidth="5"/><ellipse cx="80" cy="74" rx="15" ry="17" fill="#6e3ba3"/><path d="M47 62q18-34 40-18" fill="none" stroke="#e7cafa" strokeWidth="6" strokeLinecap="round"/></>}
      {id==='mitocondria'&&<><ellipse cx="70" cy="70" rx="53" ry="33" fill="#ffb257" stroke="#e27a39" strokeWidth="5" transform="rotate(-28 70 70)"/><path d="M36 82q14-40 28-15t27-9 20-3" fill="none" stroke="#c95d45" strokeWidth="8" strokeLinecap="round"/></>}
      {id==='ribosoma'&&<><ellipse cx="71" cy="72" rx="39" ry="24" fill="#52c1ec" stroke="#218ab8" strokeWidth="4"/><ellipse cx="71" cy="54" rx="31" ry="17" fill="#8de5fa" stroke="#218ab8" strokeWidth="4"/><path d="M51 60q18 12 40 1" stroke="#fff" strokeWidth="4" fill="none"/></>}
      {['proton','neutron','electron'].includes(id)&&<><circle cx="70" cy="70" r="38" fill={id==='proton'?'#fd606a':id==='neutron'?'#a5adbf':'#5299fa'} stroke="#fff" strokeWidth="5"/><text x="70" y="84" textAnchor="middle" fontSize="42" fontWeight="800" fill="#fff">{id==='proton'?'+':id==='neutron'?'0':'−'}</text></>}
    </svg>
  }
  if (tema==='solar') return <svg className="av-organ-svg" viewBox="0 0 140 140" role="img" aria-label={id}>
    <defs><radialGradient id={grad} cx=".3" cy=".25" r=".8"><stop stopColor="#fff1bc"/><stop offset=".45" stopColor={id==='tierra'?'#5ccff4':id==='marte'?'#e79b71':id==='venus'?'#f8c98b':'#d2d2d3'}/><stop offset="1" stopColor={id==='tierra'?'#2369bb':id==='marte'?'#9b422d':id==='venus'?'#bc895f':'#6a7682'}/></radialGradient></defs>
    <circle cx="70" cy="70" r={id==='tierra'?42:id==='venus'?38:id==='marte'?34:30} fill={'url(#'+grad+')'} stroke="#ffffff55" strokeWidth="2"/>
    {id==='tierra'&&<path d="M53 33 69 39l-3 16-14 1-8 15 15 15 3 14 13 5 8-18 13-9-4-13-12-8 6-16-16-10Z" fill="#42b78d" opacity=".9"/>}
    {id==='marte'&&<path d="M46 57q28-19 47-1m-44 27q26 14 45-1" stroke="#b75f4e" strokeWidth="7" fill="none" opacity=".65"/>}
    {id==='venus'&&<path d="M43 60q28-16 55 2M49 88q21-9 42 2" fill="none" stroke="#fff2d4" strokeWidth="8" opacity=".42"/>}
    {id==='mercurio'&&<><circle cx="60" cy="55" r="8" fill="#7c858e" opacity=".5"/><circle cx="83" cy="83" r="6" fill="#858e98" opacity=".65"/></>}
  </svg>
  return <span className="av-piece-emoji" aria-hidden="true">{forma}</span>
}

export function EscenarioRompecabezas({tipo,identificador}:{tipo:string;identificador:string}) {
  if(tipo==='cuerpo')return <svg className="av-scene av-scene-body" viewBox="0 0 600 680" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient id="av-kid-skin" x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#ffd9bf"/><stop offset=".6" stopColor="#ffc19f"/><stop offset="1" stopColor="#efa079"/></linearGradient>
      <linearGradient id="av-kid-hair" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8a513f"/><stop offset="1" stopColor="#452d31"/></linearGradient>
      <linearGradient id="av-kid-shirt" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff8e8"/><stop offset="1" stopColor="#a5d9f5"/></linearGradient>
    </defs>
    <g opacity=".28" stroke="#65b8e4" strokeWidth="5" fill="none">
      <path d="M52 152l20-27 23 43 22-71 23 55h45" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M436 195c0-53 93-53 93 0s-93 53-93 0Zm47-54v108m-43-65h89" strokeWidth="3"/>
      <path d="M72 485c37-29 60-22 85 12m-70-42 17 56"/>
    </g>
    <circle cx="82" cy="116" r="10" fill="#a3d8fb"/><circle cx="518" cy="454" r="7" fill="#91d5e8"/>
    <ellipse cx="300" cy="664" rx="155" ry="13" fill="#528bc5" opacity=".13"/>
    <g stroke="#e69b7d" strokeWidth="3" strokeLinejoin="round">
      <path d="M257 488q-15 70-13 147 10 14 29 10l25-150" fill="url(#av-kid-skin)"/>
      <path d="M304 495 325 646q25 10 32-9 4-78-11-149" fill="url(#av-kid-skin)"/>
      <path d="M226 247q-32-9-51 31l-43 119-33 42q-17 15-9 35 8 10 15-1-1 27 15 17l11-23c7 12 18-2 17-11l-6-12 78-118" fill="url(#av-kid-skin)"/>
      <path d="M374 247q32-9 51 31l43 119 33 42q17 15 9 35-8 10-15-1 1 27-15 17l-11-23c-7 12-18-2-17-11l6-12-78-118" fill="url(#av-kid-skin)"/>
      <path d="M258 213v43l42 28 42-28v-43" fill="url(#av-kid-skin)"/>
      <path d="M229 250q-21 16-22 67l-2 166q89 45 190 0l-2-166q-1-48-22-67l-37-13q-34 46-69 0Z" fill="url(#av-kid-shirt)" stroke="#8cc0dc"/>
      <path d="M207 481q-12 28-6 51 52 16 99 6 47 10 99-6 7-23-6-51-90 31-186 0Z" fill="#5d75ac" stroke="#506b99"/>
      <path d="M267 238q33 40 66 0" fill="none" stroke="#fff" strokeWidth="8" opacity=".76"/>
      <ellipse cx="302" cy="145" rx="75" ry="91" fill="url(#av-kid-skin)"/>
      <ellipse cx="232" cy="154" rx="15" ry="25" fill="url(#av-kid-skin)"/>
      <ellipse cx="372" cy="154" rx="15" ry="25" fill="url(#av-kid-skin)"/>
    </g>
    <path d="M225 112q-16-81 55-93 33-33 57-7 70-5 52 75l-13 39q-7-40-25-53-17 25-37 17l-21-12q-27 32-65 34Z" fill="url(#av-kid-hair)"/>
    <path d="M232 91q22-47 66-43m19-19q39-7 61 28" stroke="#b57959" strokeWidth="10" fill="none" strokeLinecap="round" opacity=".65"/>
    <path d="M255 150q11-11 25 0m41 0q11-11 25 0" stroke="#5d3940" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <path d="M279 184q22 17 43 0" stroke="#cb765a" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <ellipse cx="253" cy="171" rx="14" ry="8" fill="#fa9a8d" opacity=".32"/><ellipse cx="349" cy="171" rx="14" ry="8" fill="#fa9a8d" opacity=".32"/>
  </svg>
  if(tipo==='celula'&&identificador==='atomo')return <svg className="av-scene av-scene-atom" viewBox="0 0 600 540" aria-hidden="true">
    <defs><radialGradient id="av-atom-core"><stop stopColor="#fff3c9"/><stop offset="1" stopColor="#986fee"/></radialGradient></defs>
    <g fill="none" strokeWidth="12" stroke="#71c7ec" opacity=".32">
      <ellipse cx="300" cy="265" rx="210" ry="77" transform="rotate(30 300 265)"/>
      <ellipse cx="300" cy="265" rx="210" ry="77" transform="rotate(-30 300 265)"/>
      <ellipse cx="300" cy="265" rx="210" ry="77" transform="rotate(90 300 265)"/>
    </g>
    <circle cx="300" cy="265" r="83" fill="url(#av-atom-core)"/><circle cx="279" cy="243" r="39" fill="#f56e86" opacity=".65"/>
    <circle cx="415" cy="143" r="17" fill="#489df5"/><circle cx="158" cy="251" r="17" fill="#489df5"/>
  </svg>
  if(tipo==='celula')return <svg className="av-scene av-scene-cell" viewBox="0 0 600 560" aria-hidden="true">
    <defs><radialGradient id="av-cell-bg"><stop stopColor="#d3fff3"/><stop offset="1" stopColor="#81d9c8"/></radialGradient></defs>
    <path d="M297 47C424 20 540 98 555 218c23 161-69 270-239 291C155 528 48 450 40 302 30 180 124 74 297 47Z" fill="url(#av-cell-bg)" stroke="#20aeb0" strokeWidth="10"/>
    <path d="M296 72C424 52 519 112 532 221c13 134-57 247-218 267C151 501 77 430 65 300 55 184 153 88 296 72Z" fill="none" stroke="#edfffb" strokeWidth="6" opacity=".7"/>
    <circle cx="288" cy="275" r="88" fill="#9b86e9" opacity=".27" stroke="#7855bc" strokeWidth="5"/>
    <ellipse cx="182" cy="174" rx="50" ry="29" fill="#f7b567" opacity=".35" transform="rotate(-32 182 174)"/>
    <ellipse cx="432" cy="368" rx="51" ry="31" fill="#f7b567" opacity=".35" transform="rotate(28 432 368)"/>
    <g fill="#20b4d1" opacity=".45"><circle cx="398" cy="169" r="9"/><circle cx="423" cy="185" r="7"/><circle cx="164" cy="364" r="8"/></g>
  </svg>
  if(tipo==='sistema')return <svg className="av-scene av-scene-solar" viewBox="0 0 1100 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id="av-space-sun"><stop stopColor="#fff5a0"/><stop offset=".65" stopColor="#ffc34f"/><stop offset="1" stopColor="#ff854f"/></radialGradient></defs>
    <g fill="#fff" opacity=".65">{Array.from({length:17},(_,i)=><circle key={i} cx={(i*193+48)%1080} cy={(i*67+23)%335} r={i%4===0?2.5:1.5}/>)}</g>
    <circle cx="64" cy="184" r="90" fill="url(#av-space-sun)"/>
    <path d="M168 184h930" stroke="#dae4ff" strokeWidth="4" strokeDasharray="9 16" opacity=".54"/>
    <g stroke="#8393f4" fill="none" strokeWidth="2" opacity=".32"><ellipse cx="310" cy="182" rx="142" ry="92"/><ellipse cx="540" cy="182" rx="359" ry="140"/><ellipse cx="720" cy="182" rx="545" ry="160"/></g>
  </svg>
  return <svg className="av-scene av-scene-timeline" viewBox="0 0 1000 380" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs><linearGradient id="av-puzzle-line" x1="0" x2="1"><stop stopColor="#9cc9ff"/><stop offset="1" stopColor="#a99cfb"/></linearGradient></defs>
    <path d="M65 203H935" stroke="url(#av-puzzle-line)" strokeWidth="13" strokeLinecap="round" opacity=".35"/>
    <path d="M915 180l25 23-25 23" stroke="#888cdd" strokeWidth="10" fill="none" strokeLinecap="round"/>
    <g fill="#d2e5ff" opacity=".55"><circle cx="105" cy="71" r="44"/><circle cx="860" cy="313" r="62"/></g>
    <path d="M110 111c38-28 79-30 112-1m581 137q50 35 103-5" stroke="#7ecbe0" strokeWidth="7" fill="none" strokeLinecap="round" opacity=".35"/>
  </svg>
}
