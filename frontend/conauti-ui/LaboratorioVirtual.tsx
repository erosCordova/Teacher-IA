import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

type Planet = {
  name:string; radius:number;size:number;speed:number;phase:number;
  light:string;shade:string;detail:string;ring?:boolean;
}
const PLANETS:Planet[]=[
  {name:'Mercurio',radius:84,size:8,speed:1.8,phase:0.35,
   light:'#e4c3ad',shade:'#787b8d',detail:'Es un planeta rocoso y el más cercano al Sol.'},
  {name:'Venus',radius:134,size:13,speed:1.3,phase:1.8,
   light:'#f8dfaa',shade:'#bf8c65',detail:'Posee una atmósfera muy densa y temperaturas elevadas.'},
  {name:'Tierra',radius:191,size:15,speed:1,phase:2.4,
   light:'#79c9ff',shade:'#1b63af',detail:'Tiene agua líquida en superficie y alberga vida conocida.'},
  {name:'Marte',radius:247,size:11,speed:.8,phase:3.4,
   light:'#f9b38a',shade:'#a34735',detail:'Es un planeta rocoso reconocido por su color rojizo.'},
  {name:'Júpiter',radius:310,size:31,speed:.48,phase:5.2,
   light:'#efd1a5',shade:'#a66f64',detail:'Es el planeta más grande y pertenece a los gigantes gaseosos.'},
  {name:'Saturno',radius:377,size:26,speed:.34,phase:4.3,
   light:'#f9e0ac',shade:'#c6a06a',ring:true,
   detail:'Es un gigante gaseoso reconocido por sus grandes anillos.'},
]
const MISSIONS=[
  {question:'¿Qué planeta está más cerca del Sol?',answer:'Mercurio',hint:'Observa la primera órbita.'},
  {question:'¿Cuál es el planeta donde vivimos?',answer:'Tierra',hint:'Busca los colores azul y verde.'},
  {question:'¿Qué planeta destaca por sus anillos?',answer:'Saturno',hint:'Tiene una estructura aplanada a su alrededor.'},
  {question:'¿Cuál es el planeta más grande de este modelo?',answer:'Júpiter',hint:'Compara los tamaños de las esferas.'},
]
const STARFIELD=Array.from({length:105},(_,i)=>({
  x:(i*197+53)%1050,y:(i*107+49)%500,
  r:i%7===0?1.6:.65,alpha:(i%6+2)/12,
}))

export default function LaboratorioVirtual({
  onAskTutor,
}:{onAskTutor:(question:string)=>void}){
  const canvas=useRef<HTMLCanvasElement|null>(null)
  const frame=useRef<number|null>(null)
  const elapsed=useRef(0)
  const yaw=useRef(.11)
  const pitch=useRef(.66)
  const dragging=useRef<{x:number;y:number}|null>(null)
  const hitboxes=useRef<{name:string;x:number;y:number;radius:number}[]>([])
  const [selected,setSelected]=useState('Tierra')
  const [running,setRunning]=useState(true)
  const [speed,setSpeed]=useState(1)
  const [zoom,setZoom]=useState(1)
  const [mission,setMission]=useState(0)
  const [feedback,setFeedback]=useState('')
  const [completed,setCompleted]=useState(0)
  const [hint,setHint]=useState(false)
  const chosen=PLANETS.find(p=>p.name===selected)||PLANETS[2]
  const active=MISSIONS[mission]
  useEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      setRunning(false)
    }
  },[])
  useEffect(()=>{
    const surface=canvas.current
    if(!surface)return
    const ctx=surface.getContext('2d')
    if(!ctx)return
    let latest=performance.now()
    const cx=surface.width*.50,cy=surface.height*.52
    function position(radius:number,angle:number){
      const x=radius*Math.cos(angle),z=radius*Math.sin(angle)
      const xr=x*Math.cos(yaw.current)-z*Math.sin(yaw.current)
      const zr=x*Math.sin(yaw.current)+z*Math.cos(yaw.current)
      const depth=1+zr/1300
      return {x:cx+xr*zoom/depth,
              y:cy+zr*Math.sin(pitch.current)*zoom/depth,
              scale:zoom/depth}
    }
    function paint(now:number){
      if(!ctx)return
      const dt=Math.min(50,now-latest);latest=now
      if(running)elapsed.current+=dt*.00024*speed
      const W=surface!.width,H=surface!.height
      const bg=ctx.createLinearGradient(0,0,W,H)
      bg.addColorStop(0,'#081b39');bg.addColorStop(.6,'#152b54');bg.addColorStop(1,'#233665')
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)
      for(const star of STARFIELD){
        ctx.fillStyle='rgba(222,241,255,'+star.alpha+')'
        ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill()
      }
      // Proyección 3D de órbitas: rotación horizontal y elevación ajustables.
      for(const planet of PLANETS){
        ctx.beginPath()
        for(let step=0;step<=128;step++){
          const p=position(planet.radius,step*Math.PI*2/128)
          if(step===0)ctx.moveTo(p.x,p.y)
          else ctx.lineTo(p.x,p.y)
        }
        ctx.strokeStyle='rgba(141,179,242,.23)'
        ctx.lineWidth=1.7;ctx.stroke()
      }
      // Sol: resplandor y superficie.
      const glow=ctx.createRadialGradient(cx,cy,4,cx,cy,77*zoom)
      glow.addColorStop(0,'rgba(255,218,93,.9)')
      glow.addColorStop(.35,'rgba(255,151,42,.4)')
      glow.addColorStop(1,'rgba(255,163,43,0)')
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,77*zoom,0,Math.PI*2);ctx.fill()
      const sun=ctx.createRadialGradient(cx-12*zoom,cy-12*zoom,5,cx,cy,35*zoom)
      sun.addColorStop(0,'#fff8c8');sun.addColorStop(.38,'#ffd35c');sun.addColorStop(1,'#f88b36')
      ctx.fillStyle=sun;ctx.beginPath();ctx.arc(cx,cy,35*zoom,0,Math.PI*2);ctx.fill()
      const positions=PLANETS.map(p=>{
        const place=position(p.radius,p.phase+elapsed.current*p.speed)
        return {planet:p,...place}
      }).sort((a,b)=>a.y-b.y)
      const newHitboxes=[]
      for(const {planet,x,y,scale} of positions){
        const radius=planet.size*scale
        if(planet.ring){
          ctx.save();ctx.translate(x,y);ctx.rotate(-.32)
          ctx.beginPath();ctx.ellipse(0,0,radius*2.0,radius*.73,0,0,2*Math.PI)
          ctx.strokeStyle='#e9c18ca6';ctx.lineWidth=7*scale;ctx.stroke()
          ctx.beginPath();ctx.ellipse(0,0,radius*2.25,radius*.8,0,0,2*Math.PI)
          ctx.strokeStyle='#cfb79791';ctx.lineWidth=2*scale;ctx.stroke()
          ctx.restore()
        }
        const ball=ctx.createRadialGradient(x-radius*.38,y-radius*.47,2,x,y,radius*1.24)
        ball.addColorStop(0,'#fff8e9');ball.addColorStop(.22,planet.light)
        ball.addColorStop(1,planet.shade)
        ctx.fillStyle=ball;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill()
        if(planet.name===selected){
          ctx.beginPath();ctx.arc(x,y,radius+7,0,Math.PI*2)
          ctx.strokeStyle='#67dbff';ctx.lineWidth=2.5;ctx.stroke()
        }
        ctx.fillStyle=planet.name===selected?'#ffffff':'#d1e5fa'
        ctx.font=(planet.name===selected?'bold ':'')+'13px system-ui'
        ctx.textAlign='center'
        ctx.fillText(planet.name,x,y+radius+23)
        newHitboxes.push({name:planet.name,x,y,radius:Math.max(radius+12,22)})
      }
      hitboxes.current=newHitboxes
      frame.current=requestAnimationFrame(paint)
    }
    frame.current=requestAnimationFrame(paint)
    return ()=>{if(frame.current!==null)cancelAnimationFrame(frame.current)}
  },[running,speed,zoom,selected])

  function locate(event:PointerEvent<HTMLCanvasElement>){
    const rect=event.currentTarget.getBoundingClientRect()
    return {x:(event.clientX-rect.left)*1050/rect.width,
            y:(event.clientY-rect.top)*500/rect.height}
  }
  function choose(name:string){
    setSelected(name)
    if(name===active.answer){
      setFeedback('¡Correcto! '+name+' responde a esta misión. Puedes continuar.')
      setCompleted(n=>Math.max(n,mission+1))
    }else{
      setFeedback('Todavía no. Observa las órbitas y vuelve a intentarlo.')
    }
  }
  function pointerDown(e:PointerEvent<HTMLCanvasElement>){
    const p=locate(e)
    const target=hitboxes.current.find(h=>Math.hypot(h.x-p.x,h.y-p.y)<h.radius)
    if(target){choose(target.name);return}
    dragging.current={x:e.clientX,y:e.clientY}
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function pointerMove(e:PointerEvent<HTMLCanvasElement>){
    const drag=dragging.current
    if(!drag)return
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y
    yaw.current+=dx*.006
    pitch.current=Math.max(.18,Math.min(1.4,pitch.current+dy*.004))
    dragging.current={x:e.clientX,y:e.clientY}
  }
  function nextMission(){
    setMission(m=>(m+1)%MISSIONS.length);setFeedback('');setHint(false)
  }
  return <section className="study-lab" aria-label="Laboratorio virtual del sistema solar">
    <header className="study-panel-heading">
      <div><span className="study-eyebrow">LABORATORIO VIRTUAL</span>
        <h2>Explora el sistema solar</h2>
        <p>Gira el modelo, observa las órbitas e identifica los planetas para resolver misiones de aprendizaje.</p>
      </div>
      <span className="study-route-count">Misiones: {completed}/{MISSIONS.length}</span>
    </header>
    <div className="study-lab-stage">
      <canvas ref={canvas} width={1050} height={500}
        onPointerDown={pointerDown} onPointerMove={pointerMove}
        onPointerUp={()=>{dragging.current=null}}
        onPointerCancel={()=>{dragging.current=null}}
        aria-label="Modelo interactivo proyectado en tres dimensiones del sistema solar. Selecciona un planeta en la lista para hacerlo accesible con teclado." />
      <div className="study-lab-stage-caption">
        Modelo educativo · tamaños, distancias y velocidades no están a escala real
      </div>
    </div>
    <div className="study-lab-controls">
      <button type="button" onClick={()=>setRunning(v=>!v)}>
        {running?'Pausar órbitas':'Reanudar órbitas'}
      </button>
      <label>Velocidad
        <input type="range" min=".2" max="3" step=".2" value={speed}
          onChange={e=>setSpeed(Number(e.target.value))}/>
      </label>
      <label>Acercamiento
        <input type="range" min=".6" max="1.45" step=".05" value={zoom}
          onChange={e=>setZoom(Number(e.target.value))}/>
      </label>
      <button type="button" onClick={()=>{yaw.current=.11;pitch.current=.66;setZoom(1)}}>Restablecer vista</button>
    </div>
    <div className="study-lab-bottom">
      <div className="study-lab-selection">
        <span className="study-eyebrow">EXPLORA UN PLANETA</span>
        <div className="study-lab-planets" role="group" aria-label="Planetas">
          {PLANETS.map(p=><button type="button" key={p.name}
            aria-pressed={p.name===selected}
            className={p.name===selected?'selected':''}
            onClick={()=>choose(p.name)}>{p.name}</button>)}
        </div>
        <div className="study-lab-description">
          <strong>{chosen.name}</strong>
          <p>{chosen.detail}</p>
          <button type="button" onClick={()=>onAskTutor(
            'Estoy explorando el planeta '+chosen.name+
            ' en el laboratorio virtual. Explícame su característica principal y hazme una pregunta guiada para comprobar mi comprensión.'
          )}>Aprender con mi tutor</button>
        </div>
      </div>
      <div className="study-lab-mission">
        <span className="study-eyebrow">MISIÓN {mission+1} DE {MISSIONS.length}</span>
        <h3>{active.question}</h3>
        <p>Selecciona el planeta correspondiente en el modelo o en la lista.</p>
        {feedback&&<p className="study-lab-feedback" role="status">{feedback}</p>}
        {hint&&<p className="study-lab-feedback" role="status">Pista: {active.hint}</p>}
        <div className="study-lab-mission-actions">
          <button type="button" onClick={()=>setHint(h=>!h)}>{hint?'Ocultar pista':'Pedir pista'}</button>
          <button type="button" onClick={nextMission} disabled={feedback.indexOf('¡Correcto!')!==0}>Siguiente misión</button>
        </div>
      </div>
    </div>
  </section>
}
