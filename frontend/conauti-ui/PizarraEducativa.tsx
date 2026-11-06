import { useEffect, useRef, useState } from 'react'

type Brush = 'escribir' | 'borrar'

export default function PizarraEducativa({
  onSend, onError,
}: {
  onSend: (image: File) => void
  onError: (error: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{x:number;y:number}|null>(null)
  const [brush, setBrush] = useState<Brush>('escribir')
  const [color, setColor] = useState('#163E6C')
  const [thickness, setThickness] = useState(5)
  const [hasMarks, setHasMarks] = useState(false)

  function background(canvas:HTMLCanvasElement) {
    const context = canvas.getContext('2d')
    if (!context) return
    context.fillStyle = '#ffffff'
    context.fillRect(0,0,canvas.width,canvas.height)
    // Cuadrícula de referencia muy suave; forma parte de la imagen enviada.
    context.strokeStyle = '#eaf1fa'
    context.lineWidth = 1
    for(let x=0;x<canvas.width;x+=35) {
      context.beginPath();context.moveTo(x,0);context.lineTo(x,canvas.height);context.stroke()
    }
    for(let y=0;y<canvas.height;y+=35) {
      context.beginPath();context.moveTo(0,y);context.lineTo(canvas.width,y);context.stroke()
    }
  }
  useEffect(()=>{
    const canvas=canvasRef.current
    if (canvas) background(canvas)
  },[])

  function point(event:React.PointerEvent<HTMLCanvasElement>) {
    const c=event.currentTarget
    const rect=c.getBoundingClientRect()
    return {x:(event.clientX-rect.left)*c.width/rect.width,
            y:(event.clientY-rect.top)*c.height/rect.height}
  }
  function draw(event:React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !lastPoint.current) return
    const ctx=event.currentTarget.getContext('2d')
    if (!ctx) return
    const next=point(event)
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x,lastPoint.current.y)
    ctx.lineTo(next.x,next.y)
    ctx.strokeStyle=brush==='borrar'?'#ffffff':color
    ctx.lineWidth=brush==='borrar'?30:thickness
    ctx.lineCap='round'
    ctx.lineJoin='round'
    ctx.stroke()
    lastPoint.current=next
    setHasMarks(true)
  }
  function start(event:React.PointerEvent<HTMLCanvasElement>) {
    if (event.button!==0 && event.pointerType==='mouse') return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current=true
    lastPoint.current=point(event)
    const ctx=event.currentTarget.getContext('2d')
    if(ctx){
      const p=lastPoint.current
      ctx.fillStyle=brush==='borrar'?'#fff':color
      ctx.beginPath();ctx.arc(p.x,p.y,brush==='borrar'?15:thickness/2,0,Math.PI*2);ctx.fill()
      setHasMarks(true)
    }
  }
  function stop(){
    drawing.current=false
    lastPoint.current=null
  }
  function clearBoard(){
    const canvas=canvasRef.current
    if(!canvas)return
    background(canvas);setHasMarks(false)
  }
  function toBlob():Promise<Blob>{
    const canvas=canvasRef.current
    if(!canvas) return Promise.reject(new Error('Pizarra no disponible.'))
    return new Promise((resolve,reject)=>canvas.toBlob(
      blob=>blob?resolve(blob):reject(new Error('No se pudo procesar el dibujo.')),
      'image/png',
    ))
  }
  async function share(){
    try{
      if(!hasMarks){onError('Escribe o dibuja algo antes de enviar la pizarra.');return}
      const blob=await toBlob()
      onSend(new File([blob],'mi-pizarra.png',{type:'image/png'}))
    }catch(e){onError(e instanceof Error?e.message:'No se pudo enviar el dibujo.')}
  }
  async function download(){
    try{
      const blob=await toBlob(),url=URL.createObjectURL(blob)
      const a=document.createElement('a')
      a.href=url;a.download='mi-pizarra.png';document.body.append(a);a.click();a.remove()
      window.setTimeout(()=>URL.revokeObjectURL(url),12000)
    }catch(e){onError(e instanceof Error?e.message:'No se pudo guardar el dibujo.')}
  }

  return <section className="study-board" aria-label="Pizarra interactiva de aprendizaje">
    <header className="study-panel-heading">
      <div><span className="study-eyebrow">PIZARRA INTERACTIVA</span>
        <h2>Piensa, escribe y explícalo</h2>
        <p>Resuelve ejercicios o dibuja un esquema. Después envíalo al chat para recibir pistas sobre tu trabajo.</p>
      </div>
      <span className="study-board-indicator">{hasMarks?'Dibujo en curso':'Lista para empezar'}</span>
    </header>
    <div className="study-board-tools">
      <div role="group" aria-label="Herramientas de dibujo" className="study-toolbar-group">
        <button type="button" aria-pressed={brush==='escribir'} className={brush==='escribir'?'selected':''}
          onClick={()=>setBrush('escribir')}>✎ Lápiz</button>
        <button type="button" aria-pressed={brush==='borrar'} className={brush==='borrar'?'selected':''}
          onClick={()=>setBrush('borrar')}>◻ Borrador</button>
      </div>
      <div role="group" aria-label="Color del lápiz" className="study-toolbar-group">
        {['#163E6C','#2563eb','#e14962','#169981'].map(hex=><button type="button" key={hex}
          className={'study-color-swatch'+(color===hex?' selected':'')}
          onClick={()=>{setColor(hex);setBrush('escribir')}}
          style={{background:hex}} aria-label={'Usar color '+hex} aria-pressed={color===hex}/>)}
      </div>
      <label className="study-size-label">Grosor
        <input type="range" min="2" max="14" value={thickness} onChange={e=>setThickness(Number(e.target.value))} />
      </label>
      <button type="button" className="study-clear" onClick={clearBoard}>Limpiar</button>
    </div>
    <div className="study-canvas-wrap">
      <canvas ref={canvasRef} width={1050} height={560}
        onPointerDown={start} onPointerMove={draw} onPointerUp={stop}
        onPointerCancel={stop} onLostPointerCapture={stop}
        aria-label="Superficie de dibujo. Utiliza el ratón, el lápiz táctil o el dedo."
      />
    </div>
    <footer className="study-board-footer">
      <span>Los dibujos se procesan solo cuando decides enviarlos al tutor.</span>
      <div>
        <button type="button" onClick={()=>void download()}>Guardar imagen</button>
        <button type="button" className="study-primary-button" onClick={()=>void share()}>Consultar dibujo con mi tutor</button>
      </div>
    </footer>
  </section>
}
