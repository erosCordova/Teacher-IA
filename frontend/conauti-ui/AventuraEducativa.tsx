import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from './apiFetch'
import {
  CURIOSIDADES, JUEGOS, MATERIAS, PREGUNTAS, ROMPECABEZAS,
  type MateriaId, type Pieza, type Pregunta, type Rompecabezas,
} from './AventuraDatos'
import './AventuraEducativa.css'

export type SeccionAventura = 'juegos' | 'sabias' | 'logros'
type JuegoId = typeof JUEGOS[number]['id']
type Progreso = {xp:number; completados:number; aciertos:number; intentos:number; porMateria:Record<string,number>; dias:string[]; insignias:string[]}
type Registro = {id:string; materia:MateriaId; puntos:number; fecha:string}
const VACIO:Progreso = {xp:0,completados:0,aciertos:0,intentos:0,porMateria:{},dias:[],insignias:[]}

function seguroTexto(value:unknown):string {return typeof value==='string'?value:''}
function mezclar<T,>(elements:T[]):T[] {const a=[...elements]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]}return a}
function fechaLocal():string {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const TITULOS:{[id:string]:string} = {juegos:'Aprende jugando',sabias:'¿Sabías que…?',logros:'Mis logros'}
const DESAFIOS=[{objetivo:1,titulo:'¡Primer desafío!',icono:'🌟'},{objetivo:5,titulo:'Explorador del saber',icono:'🧭'},{objetivo:15,titulo:'Mente brillante',icono:'🧠'},{objetivo:30,titulo:'Imparable',icono:'🚀'},{objetivo:60,titulo:'Leyenda del conocimiento',icono:'🏆'}]
const ICONOS:{[id:string]:string}={cuerpo:'🫀',rayos:'⚡',memoria:'🧠',detective:'🔎',orden:'🔢',mision:'🚀',ingles:'💬',mapa:'🌎'}

function AvatarMateria({materia,tamano=52}:{materia:MateriaId;tamano?:number}) {
  const m=MATERIAS.find(item=>item.id===materia)!
  return <span className="av-materia-icon" style={{'--materia-color':m.color,width:tamano,height:tamano,fontSize:tamano*.48} as React.CSSProperties} aria-hidden="true">{m.icono}</span>
}

function ArteJuego({tipo}:{tipo:string}) {
  return <div className={'av-art av-art-'+tipo} aria-hidden="true">
    <span className="av-art-orb av-art-orb-a"/><span className="av-art-orb av-art-orb-b"/>
    {tipo==='cuerpo' ? <svg viewBox="0 0 170 150" className="av-art-svg">
      <path d="M65 21 C61 3 109 3 105 21 L98 36 L117 45 L138 87 L126 98 L112 70 L105 135 L88 135 L86 94 L83 94 L80 135 L63 135 L56 70 L43 98 L31 87 L52 45 L72 36Z" fill="#cef8ed" stroke="#5caeb2" strokeWidth="3"/>
      <path d="M82 60 C67 43 59 75 82 87 C105 75 100 42 82 60" fill="#ff777c" stroke="#f04758" strokeWidth="2"/>
      <circle cx="71" cy="57" r="13" fill="#55b0f6" opacity=".76"/><circle cx="95" cy="57" r="13" fill="#55b0f6" opacity=".76"/>
      <circle cx="125" cy="30" r="13" fill="#ffe37b"/><path d="M120 30h10m-5-5v10" stroke="#b37310" strokeWidth="2"/>
    </svg> : <span className="av-art-emoji">{ICONOS[tipo]||'⭐'}</span>}
    <span className="av-art-spark">✦</span>
  </div>
}

function Titulo({nombre,subtitulo,icono}:{nombre:string;subtitulo:string;icono:string}){
  return <div className="av-heading"><div className="av-heading-icon" aria-hidden="true">{icono}</div><div><h1>{nombre}</h1><p>{subtitulo}</p></div></div>
}

function PanelRompecabezas({tema,onComplete,onHint}:{tema:Rompecabezas;onComplete:(id:string,materia:MateriaId,puntos:number)=>void;onHint:(pregunta:string)=>void}) {
  const [puestos,setPuestos]=useState<Record<string,string>>({})
  const [elegido,setElegido]=useState<string|null>(null)
  const [intentos,setIntentos]=useState(0)
  const [mensaje,setMensaje]=useState('')
  const [mostrarPista,setMostrarPista]=useState(false)
  const [completado,setCompletado]=useState(false)
  const piezas=useMemo(()=>mezclar(tema.piezas),[tema.id])
  useEffect(()=>{setPuestos({});setElegido(null);setIntentos(0);setMensaje('');setMostrarPista(false);setCompletado(false)},[tema.id])
  const restantes=piezas.filter(p=>!puestos[p.id])
  const total=tema.piezas.length, correctos=Object.keys(puestos).length
  const pista=elegido?tema.piezas.find(p=>p.id===elegido):null
  const colocar=(destino:string,origen:string|null)=>{
    if(!origen || completado || puestos[destino])return
    const pieza=tema.piezas.find(p=>p.id===origen);if(!pieza)return
    setIntentos(n=>n+1)
    if(destino!==origen){setMensaje('Ese no es su lugar. Observa las pistas de la silueta e inténtalo otra vez.');return}
    const siguiente={...puestos,[destino]:origen};setPuestos(siguiente);setElegido(null);setMostrarPista(false)
    setMensaje('¡Excelente! '+pieza.descripcion)
    if(Object.keys(siguiente).length===total){
      setCompletado(true);onComplete(tema.id,tema.materia,Math.max(35,90-Math.max(0,intentos+1-total)*5))
    }
  }
  return <div className="av-play-grid">
    <div className="av-board-wrap">
      <div className="av-board-top"><span>🧩 Tablero interactivo</span><span>{correctos} de {total} piezas</span></div>
      <div className={'av-puzzle-board av-board-'+tema.tipo} aria-label={'Tablero: '+tema.nombre}>
        {tema.tipo==='cuerpo'&& <svg className="av-body-shape" viewBox="0 0 260 380" aria-hidden="true">
          <circle cx="130" cy="43" r="35" fill="#bedff4" fillOpacity=".42" stroke="#6dacc9" strokeWidth="3"/>
          <path d="M99 78 L70 94 Q56 105 48 135 L28 214 Q26 228 39 231 Q51 233 56 219 L79 157 L91 212 L93 277 L88 352 Q86 367 101 367 L114 367 Q126 365 126 351 L130 272 L134 351 Q136 365 150 367 L163 367 Q178 364 174 350 L170 276 L169 209 L182 157 L205 219 Q210 233 222 231 Q237 228 231 211 L211 133 Q204 104 191 94 L160 78Z" fill="#bad9ef" fillOpacity=".33" stroke="#7cacc7" strokeWidth="3"/>
          <path d="M130 80V220M89 165H172" stroke="#6facc9" strokeDasharray="4 10" strokeWidth="2"/>
        </svg>}
        {tema.tipo==='celula'&&<svg className="av-body-shape" viewBox="0 0 260 380" aria-hidden="true">
          <ellipse cx="130" cy="195" rx="111" ry="150" fill="#b7f6e4" fillOpacity=".3" stroke="#17b99f" strokeWidth="5"/>
          <ellipse cx="135" cy="190" rx="47" ry="57" fill="#bd8bea" fillOpacity=".23" stroke="#9563dc" strokeWidth="2" strokeDasharray="6 5"/>
          <path d="M55 130Q80 94 105 132M158 290Q188 307 212 277M63 235Q90 269 112 245" fill="none" stroke="#61c5be" strokeWidth="4"/>
        </svg>}
        {tema.tipo==='sistema'&&<svg className="av-diagram-lines" viewBox="0 0 400 180" aria-hidden="true">
          <circle cx="32" cy="90" r="26" fill="#ffc250"/><path d="M77 90H388" stroke="#f9bb57" strokeWidth="3" strokeDasharray="5 10"/>
        </svg>}
        {tema.tipo==='diagrama'&&<svg className="av-diagram-lines" viewBox="0 0 400 180" aria-hidden="true">
          <path d="M23 89H380" stroke="currentColor" strokeOpacity=".15" strokeWidth="4" strokeDasharray="8 10"/>
        </svg>}
        {tema.piezas.map((pieza,indice)=><button key={pieza.id} type="button"
          className={'av-drop '+(puestos[pieza.id]?'av-drop-done':'')+' av-drop-'+tema.tipo}
          style={{left:pieza.x+'%',top:pieza.y+'%'} as React.CSSProperties}
          onClick={()=>colocar(pieza.id,elegido)}
          onDragOver={event=>event.preventDefault()}
          onDrop={event=>{event.preventDefault();colocar(pieza.id,event.dataTransfer.getData('text/plain'))}}
          title={puestos[pieza.id]?pieza.descripcion:'Coloca aquí '+pieza.nombre}
          aria-label={puestos[pieza.id]?'Ubicado: '+pieza.nombre:'Zona '+(indice+1)+': '+pieza.nombre}>
          {puestos[pieza.id]?<><span className="av-done-emoji">{pieza.forma}</span><small>{pieza.nombre}</small></>:<><strong>＋</strong><small>{tema.tipo==='cuerpo'?'Zona '+(indice+1):'Pieza '+(indice+1)}</small></>}
        </button>)}
      </div>
      <div className="av-board-footer"><span>Arrastra una pieza o selecciónala y toca su zona.</span><button type="button" onClick={()=>{setPuestos({});setElegido(null);setMensaje('');setCompletado(false);setIntentos(0)}}>↺ Reiniciar</button></div>
    </div>
    <div className="av-pieces-panel">
      <div className="av-pieces-head"><h3>Tu colección de piezas</h3><span>{restantes.length} pendientes</span></div>
      <div className="av-piece-list">
        {restantes.length?restantes.map(pieza=><button key={pieza.id} type="button" draggable
          onDragStart={event=>{event.dataTransfer.setData('text/plain',pieza.id);setElegido(pieza.id)}}
          onClick={()=>{setElegido(pieza.id);setMostrarPista(false);setMensaje('Ahora elige su posición en el tablero.')}}
          className={'av-piece '+(elegido===pieza.id?'av-piece-picked':'')}>
          <span>{pieza.forma}</span><span>{pieza.nombre}</span><span aria-hidden="true">⠿</span>
        </button>):<div className="av-winner">🏆 ¡Rompecabezas completado!</div>}
      </div>
      <div className="av-puzzle-help">
        <strong>💡 ¿Necesitas ayuda?</strong>
        <p>Observa la posición de cada zona. La IA también puede orientarte sin darte directamente la respuesta.</p>
        <div className="av-help-actions"><button type="button" onClick={()=>setMostrarPista(v=>!v)}>Mostrar pista</button>
          <button type="button" onClick={()=>onHint('Estoy jugando '+tema.nombre+'. Ayúdame con pistas para comprender la función y ubicación de '+(pista?.nombre||'las piezas')+', sin revelar de inmediato la respuesta.')}>Preguntar al tutor ✦</button></div>
        {mostrarPista&&<p className="av-hint">Pista: {pista?pista.descripcion:'Selecciona primero una pieza para descubrir qué función tiene.'}</p>}
      </div>
      {mensaje&&<p className={'av-feedback '+(mensaje.startsWith('¡')?'ok':'')} role="status">{mensaje}</p>}
    </div>
  </div>
}

function PanelPreguntas({materia,nivel,modo,onComplete,onAskTutor}:{materia:MateriaId|'todas';nivel:1|2|3;modo:JuegoId;onComplete:(id:string,materia:MateriaId,puntos:number)=>void;onAskTutor:(s:string)=>void}){
  const pool=useMemo(()=>PREGUNTAS.filter(q=>(materia==='todas'||q.materia===materia)&&(modo==='ingles'?q.materia==='ingles':modo==='mapa'?['peru','geografia','universal','cultura'].includes(q.materia):true)),[materia,modo])
  const seleccion=useMemo(()=>{
    const nivelFiltrado=pool.filter(q=>q.nivel===nivel)
    const candidatos=nivelFiltrado.length?nivelFiltrado:pool
    return mezclar(candidatos).slice(0,modo==='mision'?Math.min(5,candidatos.length):Math.min(5,candidatos.length))
  },[pool,nivel,modo])
  const [indice,setIndice]=useState(0),[elegida,setElegida]=useState<number|null>(null)
  const [correctas,setCorrectas]=useState(0),[terminado,setTerminado]=useState(false)
  const [pistas,setPistas]=useState(0),[registro,setRegistro]=useState<string[]>([])
  const [vozError,setVozError]=useState('')
  useEffect(()=>{setIndice(0);setElegida(null);setCorrectas(0);setTerminado(false);setPistas(0);setRegistro([]);setVozError('')},[materia,nivel,modo])
  const pregunta=seleccion[indice]
  if(!pregunta)return <div className="av-empty"><strong>No hay preguntas para esta combinación.</strong><p>Selecciona otra materia o nivel.</p></div>
  const siguiente=()=>{
    if(indice+1>=seleccion.length){
      setTerminado(true)
      const puntos=Math.max(10,correctas*20+5-pistas*2)
      onComplete('reto-'+modo+'-'+materia+'-'+nivel, pregunta.materia, puntos)
    }else {setIndice(i=>i+1);setElegida(null);setPistas(0)}
  }
  const hablar=()=>{
    if(!('speechSynthesis'in window)){setVozError('Este navegador no admite audio.');return}
    const texto=pregunta.materia==='ingles'?pregunta.titulo.replace(/«|»/g,''):pregunta.titulo
    const utterance=new SpeechSynthesisUtterance(texto)
    utterance.lang=pregunta.materia==='ingles'?'en-US':'es-PE'
    window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);setVozError('')
  }
  if(terminado)return <div className="av-result"><div className="av-result-big">🏆</div><h2>¡Misión completada!</h2><p>Has acertado {correctas} de {seleccion.length} preguntas. Cada intento te ayuda a aprender.</p><div className="av-result-score">+{Math.max(10,correctas*20+5-pistas*2)} XP</div><button type="button" onClick={()=>{setIndice(0);setElegida(null);setCorrectas(0);setTerminado(false);setRegistro([])}}>Volver a jugar ↻</button></div>
  return <div className="av-quiz-panel">
    <div className="av-quiz-head"><span>{modo==='mision'?'🚀 Misión del conocimiento':modo==='ingles'?'🇬🇧 English Challenge':modo==='mapa'?'🗺️ Explorador':modo==='error'?'🔎 Detective del error':'⚡ Reto relámpago'}</span><span>Pregunta {indice+1} de {seleccion.length}</span></div>
    <div className="av-progress-track"><span style={{width:(indice/seleccion.length*100)+'%'}}/></div>
    <span className="av-quiz-topic">{MATERIAS.find(m=>m.id===pregunta.materia)?.titulo} · Nivel {nivel}</span>
    <h2>{pregunta.titulo}</h2>
    {modo==='error'&&<p className="av-quiz-help">🔎 Identifica qué opción es correcta y descubre por qué las demás no encajan.</p>}
    {pregunta.materia==='ingles'&&<button type="button" className="av-audio-btn" onClick={hablar}>🔊 Escuchar en inglés</button>}
    {vozError&&<small role="alert">{vozError}</small>}
    <div className="av-options">
      {pregunta.opciones.map((op,i)=><button type="button" key={i} disabled={elegida!==null}
        className={'av-option '+(elegida!==null&&i===pregunta.respuesta?'av-correct':elegida===i?'av-wrong':'')}
        onClick={()=>{setElegida(i);if(i===pregunta.respuesta)setCorrectas(c=>c+1);setRegistro(r=>r.concat(pregunta.id))}}>
        <span>{'ABCD'[i]}</span>{op}<b>{elegida!==null&&i===pregunta.respuesta?'✓':elegida===i?'×':''}</b>
      </button>)}
    </div>
    {elegida!==null?<div className={'av-explanation '+(elegida===pregunta.respuesta?'success':'')} role="status"><strong>{elegida===pregunta.respuesta?'✨ ¡Correcto!':'🌱 Buen intento. Así se aprende.'}</strong><p>{pregunta.explicacion}</p><button type="button" onClick={siguiente}>{indice+1>=seleccion.length?'Ver mis resultados':'Siguiente pregunta →'}</button></div>
    :<div className="av-quiz-actions"><button type="button" onClick={()=>setPistas(p=>p+1)}>💡 Pista</button><button type="button" onClick={()=>onAskTutor('Estoy practicando '+MATERIAS.find(m=>m.id===pregunta.materia)?.titulo+'. Guíame con una pista para: '+pregunta.titulo+' No reveles la respuesta directamente.')}>✦ Preguntar al tutor</button>{pistas>0&&<small>Piensa en los conceptos clave y descarta opciones que no correspondan.</small>}</div>}
  </div>
}

const PAREJAS=[
  {materia:'biologia',a:'Corazón',b:'Bombea la sangre'}, {materia:'biologia',a:'Pulmones',b:'Intercambian gases'},
  {materia:'matematicas',a:'Numerador',b:'Partes tomadas'}, {materia:'matematicas',a:'Denominador',b:'Partes iguales'},
  {materia:'ingles',a:'Apple',b:'Manzana'}, {materia:'ingles',a:'Book',b:'Libro'},
  {materia:'comunicacion',a:'Sustantivo',b:'Nombra seres u objetos'}, {materia:'comunicacion',a:'Verbo',b:'Expresa acción o estado'},
  {materia:'peru',a:'Cusco',b:'Capital inca'}, {materia:'peru',a:'1821',b:'Proclamación de independencia'},
  {materia:'universal',a:'Egipto',b:'Pirámides de Guiza'}, {materia:'universal',a:'1789',b:'Revolución francesa'},
  {materia:'cultura',a:'Mercurio',b:'Más cercano al Sol'}, {materia:'cultura',a:'Telescopio',b:'Observa cuerpos celestes'},
  {materia:'fisica',a:'Newton',b:'Unidad de fuerza'}, {materia:'fisica',a:'Rapidez',b:'Distancia entre tiempo'},
  {materia:'quimica',a:'Oxígeno',b:'Símbolo O'}, {materia:'quimica',a:'Electrón',b:'Carga negativa'},
  {materia:'geografia',a:'Pacífico',b:'Océano frente al Perú'}, {materia:'geografia',a:'Andes',b:'Cordillera del Perú'},
  {materia:'tecnologia',a:'CPU',b:'Ejecuta instrucciones'}, {materia:'tecnologia',a:'Bucle',b:'Repite instrucciones'},
  {materia:'ciudadania',a:'Diálogo',b:'Intercambio respetuoso'}, {materia:'ciudadania',a:'Derechos',b:'Garantías fundamentales'},
  {materia:'arte',a:'Danza',b:'Expresión con movimiento'}, {materia:'arte',a:'Perspectiva',b:'Sensación de profundidad'},
  {materia:'ambiente',a:'Reutilizar',b:'Reducir residuos'}, {materia:'ambiente',a:'Fotosíntesis',b:'Usa energía luminosa'},
] as const

function PanelMemoria({materia,onComplete}:{materia:MateriaId|'todas';onComplete:(id:string,materia:MateriaId,puntos:number)=>void}){
  const pairs=useMemo(()=>{const matched=PAREJAS.filter(p=>materia==='todas'||p.materia===materia);return mezclar(matched.length>=2?matched:PAREJAS).slice(0,6)},[materia])
  const cards=useMemo(()=>mezclar(pairs.flatMap((p,i)=>[{id:i+'a',pareja:i,text:p.a},{id:i+'b',pareja:i,text:p.b}])),[pairs])
  const [abiertos,setAbiertos]=useState<string[]>([]),[resueltos,setResueltos]=useState<number[]>([])
  const [intentos,setIntentos]=useState(0),[bloqueado,setBloqueado]=useState(false)
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null)
  useEffect(()=>{setAbiertos([]);setResueltos([]);setIntentos(0);setBloqueado(false);return()=>{if(timer.current)clearTimeout(timer.current)}},[materia])
  const girar=(id:string)=>{
    if(bloqueado||abiertos.includes(id)||resueltos.includes(cards.find(c=>c.id===id)!.pareja)||abiertos.length>=2)return
    const open=[...abiertos,id];setAbiertos(open)
    if(open.length===2){
      setIntentos(n=>n+1)
      const uno=cards.find(c=>c.id===open[0])!,dos=cards.find(c=>c.id===open[1])!
      if(uno.pareja===dos.pareja){
        const next=[...resueltos,uno.pareja];setResueltos(next);setAbiertos([])
        if(next.length===pairs.length)onComplete('memoria-'+materia, (materia==='todas'?pairs[0].materia:materia) as MateriaId, Math.max(30,120-intentos*4))
      } else{
        setBloqueado(true);timer.current=setTimeout(()=>{setAbiertos([]);setBloqueado(false)},1000)
      }
    }
  }
  return <div className="av-memory-layout">
    <div className="av-memory-top"><span>🧠 Encuentra las parejas</span><span>✅ {resueltos.length}/{pairs.length} · 🔄 {intentos} intentos</span></div>
    <div className="av-memory-board">
      {cards.map(card=><button type="button" key={card.id} onClick={()=>girar(card.id)} disabled={resueltos.includes(card.pareja)}
        className={'av-memory-card '+(resueltos.includes(card.pareja)?'matched':abiertos.includes(card.id)?'flipped':'')}>
        {resueltos.includes(card.pareja)||abiertos.includes(card.id)?<span>{card.text}</span>:<span className="av-memory-back">✦</span>}
      </button>)}
    </div>
    {resueltos.length===pairs.length&&<div className="av-winner">🏆 ¡Todas las parejas encontradas! Has ganado puntos XP.</div>}
    <p className="av-muted">Descubre conceptos relacionados. Si no coinciden, las tarjetas volverán a voltearse.</p>
  </div>
}

function PanelOrden({materia,onComplete}:{materia:MateriaId|'todas';onComplete:(id:string,materia:MateriaId,puntos:number)=>void}){
  const puzzle=useMemo(()=>ROMPECABEZAS.find(p=>p.materia===materia&&p.tipo==='diagrama')||ROMPECABEZAS.find(p=>p.id==='cronoperu')!,[materia])
  const [actual,setActual]=useState<string[]>([]),[verificado,setVerificado]=useState(false),[fallos,setFallos]=useState(0)
  const piezas=useMemo(()=>mezclar(puzzle.piezas),[puzzle.id])
  useEffect(()=>{setActual([]);setVerificado(false);setFallos(0)},[puzzle.id])
  const isCorrect=actual.length===puzzle.piezas.length&&actual.every((id,i)=>id===puzzle.piezas[i].id)
  const revisar=()=>{setVerificado(true);if(isCorrect)onComplete('orden-'+puzzle.id,puzzle.materia,Math.max(25,70-fallos*5));else setFallos(n=>n+1)}
  return <div className="av-order"><h2>🔢 {puzzle.nombre}</h2><p>{puzzle.subtitulo} Pulsa las tarjetas en el orden correcto.</p>
    <div className="av-order-steps">{puzzle.piezas.map((p,i)=><button key={i} type="button" className={'av-order-slot '+(actual[i]?'filled':'')} onClick={()=>{setActual(v=>v.filter((_,j)=>j!==i));setVerificado(false)}}>{actual[i]?piezas.find(x=>x.id===actual[i])?.nombre:'Paso '+(i+1)+' · +'}</button>)}</div>
    <div className="av-order-candidates">{piezas.filter(p=>!actual.includes(p.id)).map(p=><button type="button" key={p.id} onClick={()=>{setActual(v=>v.concat(p.id));setVerificado(false)}}>{p.forma} {p.nombre}</button>)}</div>
    <div className="av-order-actions"><button type="button" onClick={()=>{setActual([]);setVerificado(false)}}>↺ Reiniciar</button><button type="button" disabled={actual.length!==puzzle.piezas.length||verificado&&isCorrect} onClick={revisar}>Comprobar orden →</button></div>
    {verificado&&<p role="status" className={'av-feedback '+(isCorrect?'ok':'')}>{isCorrect?'¡Muy bien! Secuencia completada.':'Todavía hay algún paso fuera de lugar. Puedes tocar una tarjeta para corregirlo.'}</p>}
    {isCorrect&&verificado&&<div className="av-order-facts">{puzzle.piezas.map(p=><p key={p.id}><strong>{p.nombre}:</strong> {p.descripcion}</p>)}</div>}
  </div>
}

export default function AventuraEducativa({seccion,usuarioId,onAskTutor}:{seccion:SeccionAventura;usuarioId:string;onAskTutor:(texto:string)=>void}){
  const key='myteacher.aventura.v1.'+usuarioId
  const [progreso,setProgreso]=useState<Progreso>(VACIO)
  const [cargando,setCargando]=useState(true)
  const [registros,setRegistros]=useState<Registro[]>([])
  const [tab,setTab]=useState<SeccionAventura>(seccion)
  const [materia,setMateria]=useState<MateriaId|'todas'>('todas')
  const [grado,setGrado]=useState<1|2|3>(1)
  const [juego,setJuego]=useState<JuegoId|null>(null)
  const [rompecabezas,setRompecabezas]=useState(ROMPECABEZAS[0].id)
  const [curiosidad,setCuriosidad]=useState(0)
  const [revelar,setRevelar]=useState(false)
  const [mensaje,setMensaje]=useState('')
  const ultimaCarga=useRef('')
  useEffect(()=>setTab(seccion),[seccion])
  useEffect(()=>{
    let alive=true
    setCargando(true)
    const saved=localStorage.getItem(key)
    let next=VACIO
    try {if(saved){const obj=JSON.parse(saved) as Partial<Progreso>;next={...VACIO,...obj,porMateria:obj.porMateria||{},dias:obj.dias||[],insignias:obj.insignias||[]}}} catch { /* Se inicia historial vacío */ }
    setProgreso(next);setCargando(false);setMensaje('')
    const token=sessionStorage.getItem('conauti_token')
    if(token){
      void apiFetch('/api/conauti/games/progress',{headers:{Authorization:'Bearer '+token}})
        .then(async response=>{
          if(!response.ok)return null
          return response.json() as Promise<{progress?:Progreso}>
        }).then(body=>{if(!alive||!body?.progress)return;setProgreso(body.progress);try{localStorage.setItem(key,JSON.stringify(body.progress))}catch{}})
        .catch(()=>{}) // Si Render no está disponible, queda el progreso local.
    }
    return()=>{alive=false}
  },[key])
  const guardar=(next:Progreso)=>{
    setProgreso(next)
    try{localStorage.setItem(key,JSON.stringify(next))}catch{}
    const token=sessionStorage.getItem('conauti_token')
    if(token)void apiFetch('/api/conauti/games/progress',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({progress:next})}).catch(()=>{})
  }
  const completar=(id:string,materiaId:MateriaId,puntos:number)=>{
    // No conceder XP dos veces al mismo cierre de un tablero; puede volver a ganar al rejugar.
    if(ultimaCarga.current===id)return
    ultimaCarga.current=id
    window.setTimeout(()=>{ultimaCarga.current=''},800)
    const dia=fechaLocal()
    const total=progreso.completados+1
    const insignias=DESAFIOS.filter(b=>total>=b.objetivo).map(b=>b.titulo)
    const next:Progreso={...progreso,
      xp:progreso.xp+puntos,completados:total,aciertos:progreso.aciertos+1,intentos:progreso.intentos+1,
      porMateria:{...progreso.porMateria,[materiaId]:(progreso.porMateria[materiaId]||0)+1},
      dias:Array.from(new Set([...progreso.dias,dia])).slice(-180),insignias}
    guardar(next);setRegistros(previous=>[{id,materia:materiaId,puntos,fecha:dia},...previous].slice(0,8))
    setMensaje('¡+ '+puntos+' XP! Tu esfuerzo cuenta. Sigue explorando.')
  }
  const actual=MATERIAS.find(m=>m.id===materia)
  const rompes=ROMPECABEZAS.filter(p=>materia==='todas'||p.materia===materia)
  const elegido=rompes.find(p=>p.id===rompecabezas)||rompes[0]
  const dato=CURIOSIDADES[curiosidad%CURIOSIDADES.length]
  const preguntar=(texto:string)=>{onAskTutor(texto);setMensaje('Tu consulta está lista en el chat principal.')}
  return <main className="av-root" aria-label="Academia interactiva My Teacher IA">
    <div className="av-shell">
      <div className="av-header">
        <div className="av-header-copy"><span className="av-eyebrow">✦ TU AVENTURA DE APRENDIZAJE</span>
          <h1>¡Aprender puede ser <em>una aventura!</em></h1>
          <p>Descubre, experimenta y pon a prueba tus conocimientos. Cada pequeño avance merece celebrarse.</p>
          <div className="av-header-actions">
            <button type="button" onClick={()=>{setTab('juegos');setJuego('rompecabezas')}}>🎮 ¡Empezar a jugar! <span>→</span></button>
            <button type="button" className="av-header-secondary" onClick={()=>setTab('sabias')}>✨ Sorpréndeme</button>
          </div>
        </div>
        <div className="av-hero-decoration" aria-hidden="true">
          <span className="av-float av-float-one">📚</span><span className="av-float av-float-two">🧠</span>
          <span className="av-float av-float-three">🪐</span><span className="av-float av-float-four">✦</span>
          <div className="av-hero-ball">🎮</div>
        </div>
      </div>
      <div className="av-stats">
        <div><span className="av-stat-icon">⭐</span><span><strong>{progreso.xp}</strong><small>Puntos XP</small></span></div>
        <div><span className="av-stat-icon">🏆</span><span><strong>{progreso.insignias.length}</strong><small>Insignias</small></span></div>
        <div><span className="av-stat-icon">🎯</span><span><strong>{progreso.completados}</strong><small>Retos completos</small></span></div>
        <div><span className="av-stat-icon">🔥</span><span><strong>{progreso.dias.length}</strong><small>Días de práctica</small></span></div>
      </div>
      <div className="av-tabs" role="tablist" aria-label="Explorar aprendizaje">
        {(['juegos','sabias','logros'] as const).map(s=><button type="button" role="tab" aria-selected={tab===s} className={tab===s?'active':''} key={s} onClick={()=>{setTab(s);setJuego(null);setMensaje('')}}>{s==='juegos'?'🎮':s==='sabias'?'💡':'🏆'} {TITULOS[s]}</button>)}
      </div>
      {mensaje&&<div role="status" className="av-announcement">{mensaje}<button type="button" onClick={()=>setMensaje('')} aria-label="Cerrar mensaje">×</button></div>}
      {cargando&&<p aria-live="polite">Cargando tus logros…</p>}
      {tab==='juegos'&&<>
        {juego===null ? <>
          <Titulo nombre="Elige tu próxima aventura" subtitulo="Ocho maneras diferentes de aprender. Escoge la que más te divierta." icono="🚀"/>
          <div className="av-game-grid">
            {JUEGOS.map(g=><button type="button" key={g.id} className="av-game-card" style={{'--av-color':g.color} as React.CSSProperties} onClick={()=>{setJuego(g.id);setMensaje('')}}>
              <ArteJuego tipo={g.imagen}/><div className="av-game-content"><span className="av-card-kicker">{g.id==='rompecabezas'?'✨ FAVORITO':g.id==='mision'?'🚀 AVENTURA':'APRENDE JUGANDO'}</span>
                <h3>{g.nombre}</h3><p>{g.subtitulo}</p><span className="av-card-play">¡Jugar ahora! <b>↗</b></span></div>
            </button>)}
          </div>
        </> : <>
          <div className="av-back-row"><button type="button" onClick={()=>{setJuego(null);setMensaje('')}}>← Todos los juegos</button><span>🎮 {JUEGOS.find(g=>g.id===juego)?.nombre}</span></div>
          <div className="av-filter-row">
            <label>Materia<select value={materia} onChange={e=>{setMateria(e.target.value as MateriaId|'todas');setMensaje('')}}>
              <option value="todas">Todas las materias</option>{MATERIAS.map(m=><option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select></label>
            {juego!=='memoria'&&juego!=='rompecabezas'&&juego!=='orden'&&<label>Dificultad<select value={grado} onChange={e=>setGrado(Number(e.target.value) as 1|2|3)}>
              <option value={1}>Inicial · 1.º y 2.º</option><option value={2}>Intermedia · 3.º y 4.º</option><option value={3}>Avanzada · 5.º</option>
            </select></label>}
          </div>
          {juego==='rompecabezas'&& <>
            <div className="av-puzzle-choice">{rompes.map(p=><button type="button" className={elegido?.id===p.id?'active':''} key={p.id} onClick={()=>{setRompecabezas(p.id);setMensaje('')}}>🧩 {p.nombre}</button>)}</div>
            {elegido?<><Titulo nombre={elegido.nombre} subtitulo={elegido.subtitulo} icono="🧬"/>
              <PanelRompecabezas key={elegido.id} tema={elegido} onComplete={completar} onHint={preguntar}/></>:<div className="av-empty">No hay rompecabezas de esta materia por ahora. Prueba otra categoría.</div>}
          </>}
          {juego==='memoria'&&<PanelMemoria key={materia} materia={materia} onComplete={completar}/>}
          {juego==='orden'&&<PanelOrden key={materia} materia={materia} onComplete={completar}/>}
          {['quiz','error','mision','ingles','mapa'].includes(juego)&&<PanelPreguntas key={juego+materia+grado} materia={materia} nivel={grado} modo={juego} onComplete={completar} onAskTutor={preguntar}/>}
        </>}
      </>}
      {tab==='sabias'&&<>
        <Titulo nombre="¿Sabías que…?" subtitulo="Pequeños descubrimientos, grandes preguntas. ¡Nunca dejes de sentir curiosidad!" icono="💡"/>
        <div className="av-curiosity-panel">
          <div className="av-curiosity-art" style={{'--av-color':MATERIAS.find(m=>m.id===dato.materia)?.color} as React.CSSProperties}><span>{dato.ilustracion}</span><small>DESCUBRIMIENTO #{String(curiosidad+1).padStart(2,'0')}</small></div>
          <div className="av-curiosity-copy"><span className="av-curiosity-badge">{MATERIAS.find(m=>m.id===dato.materia)?.icono} {MATERIAS.find(m=>m.id===dato.materia)?.titulo}</span>
            <h2>{dato.titulo}</h2><p>{dato.dato}</p>
            <div className="av-curiosity-question"><strong>🤔 Piensa un momento…</strong><p>{dato.pregunta}</p>
              {revelar?<div className="av-answer">✓ {dato.respuesta}</div>:<button type="button" onClick={()=>setRevelar(true)}>Revelar respuesta</button>}
            </div>
            <div className="av-curiosity-buttons"><button type="button" onClick={()=>{setCuriosidad(i=>(i+1)%CURIOSIDADES.length);setRevelar(false)}}>✨ Otra curiosidad</button>
              <button type="button" onClick={()=>preguntar('Quiero aprender más sobre esto: '+dato.titulo+'. '+dato.dato+' Hazme una pregunta para practicar.')}>✦ Preguntar a la IA</button></div>
          </div>
        </div>
        <h2 className="av-small-title">Descubre por materia</h2>
        <div className="av-subject-grid">{MATERIAS.map(m=><button key={m.id} type="button" style={{'--av-color':m.color} as React.CSSProperties} onClick={()=>{const index=CURIOSIDADES.findIndex(c=>c.materia===m.id);if(index>=0){setCuriosidad(index);setRevelar(false)}else setMensaje('Próximamente más curiosidades de '+m.titulo)}}><AvatarMateria materia={m.id} tamano={44}/><span>{m.titulo}</span><b>→</b></button>)}</div>
      </>}
      {tab==='logros'&&<>
        <Titulo nombre="Tus logros, tu aventura" subtitulo="Cada intento es una oportunidad para crecer y descubrir algo nuevo." icono="🏆"/>
        <div className="av-achievement-card"><span>🏅</span><div><h2>{progreso.xp} XP acumulados</h2><p>¡Sigue practicando! Tus logros se construyen paso a paso.</p></div></div>
        <h2 className="av-small-title">Colección de insignias</h2>
        <div className="av-medals">{DESAFIOS.map(b=><div key={b.titulo} className={'av-medal '+(progreso.completados>=b.objetivo?'unlocked':'locked')}><span>{b.icono}</span><strong>{b.titulo}</strong><small>{progreso.completados>=b.objetivo?'Desbloqueada':progreso.completados+'/'+b.objetivo+' retos'}</small></div>)}</div>
        <h2 className="av-small-title">Avance por materia</h2>
        <div className="av-subject-progress">{MATERIAS.map(m=><div key={m.id} className="av-progress-row"><AvatarMateria materia={m.id} tamano={40}/><div><strong>{m.titulo}</strong><div className="av-progress-track"><span style={{width:Math.min(100,(progreso.porMateria[m.id]||0)*10)+'%',background:m.color}}/></div></div><b>{progreso.porMateria[m.id]||0} retos</b></div>)}</div>
      </>}
      <footer className="av-footer">✦ My Teacher IA · Aprende con curiosidad, confianza y respeto. Los juegos refuerzan el aprendizaje y no sustituyen al tutor.</footer>
    </div>
  </main>
}
