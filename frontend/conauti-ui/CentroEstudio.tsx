import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from './apiFetch'
import PizarraEducativa from './PizarraEducativa'
import LaboratorioVirtual from './LaboratorioVirtual'
import EvaluacionDinamica from './EvaluacionDinamica'
import MarcaMyTeacher from './MarcaMyTeacher'
import type { FormEvent } from 'react'
import './CentroEstudio.css'
import { NatureCompanion } from './NatureWorld'

type Section = 'ruta'|'tarjetas'|'evaluaciones'|'pizarra'|'laboratorio'
type Recommendation = {
  topic:string;mastery:number|null;priority:number;status:string;
  reason:string;next_step:string;evidence:string;
}
type Card = {
  id:string;topic:string;question:string;answer:string;due:boolean;
  due_at:string;source_name:string;source_page:number|null;
  repetitions:number;reviews:number;
}
type Overview = {
  recommendations:Recommendation[];
  cards:{total:number;due:number;reviewed:number};
  note:string;
}
type DocumentRef = {id:string;filename:string}
type Props = {
  token:string;
  onAskTutor:(question:string)=>void;
  onOpenPractice:()=>void;
  onOpenLibrary:()=>void;
  onAttachDrawing:(file:File)=>void;
}

const ROOT='/api/conauti/study'
const INITIAL:Overview={
  recommendations:[],cards:{total:0,due:0,reviewed:0},
  note:'Indicadores orientativos, no certificaciones.'
}
const fallbackMessage='No se pudo completar la operación.'

export default function CentroEstudio({
  token,onAskTutor,onOpenPractice,onOpenLibrary,onAttachDrawing,
}:Props){
  const [section,setSection]=useState<Section>('ruta')
  const [overview,setOverview]=useState<Overview>(INITIAL)
  const [cards,setCards]=useState<Card[]>([])
  const [documents,setDocuments]=useState<DocumentRef[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [selected,setSelected]=useState<string|null>(null)
  const [showAnswer,setShowAnswer]=useState(false)
  const [allCards,setAllCards]=useState(false)
  const [newTopic,setNewTopic]=useState('')
  const [newQuestion,setNewQuestion]=useState('')
  const [newAnswer,setNewAnswer]=useState('')
  const [materialId,setMaterialId]=useState('')
  const [materialTopic,setMaterialTopic]=useState('')

  const request=useCallback(async <T,>(route:string,method='GET',payload?:object):Promise<T>=>{
    const res=await apiFetch(ROOT+route,{
      method,cache:'no-store',
      headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{}),
    })
    if(!res.ok){
      const detail:{detail?:string}=await res.json().catch(()=>({}))
      throw new Error(detail.detail||fallbackMessage)
    }
    return res.json() as Promise<T>
  },[token])
  const reload=useCallback(async()=>{
    const [progress,saved]=await Promise.all([
      request<Overview>('/overview'),
      request<{cards:Card[]}>('/cards?limit=80'),
    ])
    setOverview(progress)
    setCards(saved.cards)
  },[request])
  useEffect(()=>{
    let active=true
    Promise.all([
      request<Overview>('/overview'),
      request<{cards:Card[]}>('/cards?limit=80'),
      apiFetch('/api/conauti/rag/documents',{
        cache:'no-store',headers:{Authorization:'Bearer '+token}
      }).then(async r=>r.ok?(await r.json()) as {documents:DocumentRef[]}:{documents:[]}),
    ]).then(([progress,saved,library])=>{
      if(!active)return
      setOverview(progress);setCards(saved.cards);setDocuments(library.documents)
      if(!materialId && library.documents[0])setMaterialId(library.documents[0].id)
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:fallbackMessage)})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[request,token])

  const dueCards=useMemo(()=>cards.filter(c=>c.due),[cards])
  const activeCards=allCards?cards:dueCards
  const current=activeCards.find(c=>c.id===selected)||activeCards[0]||null
  async function action<T>(func:()=>Promise<T>,message:(result:T)=>string){
    setBusy(true);setError('');setNotice('')
    try{
      const result=await func()
      setNotice(message(result))
      await reload()
      return true
    }catch(e){
      setError(e instanceof Error?e.message:fallbackMessage)
      return false
    }finally{setBusy(false)}
  }
  async function addStarter(){
    await action(()=>request<{created:number}>('/cards/starter','POST'),
      r=>r.created?'Se añadieron '+r.created+' tarjetas para comenzar.':'Las tarjetas iniciales ya están guardadas.')
  }
  async function addManual(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const ok=await action(()=>request('/cards','POST',{
      topic:newTopic.trim(),question:newQuestion.trim(),answer:newAnswer.trim(),
    }),()=> 'Tarjeta de estudio guardada.')
    if(ok){setNewTopic('');setNewQuestion('');setNewAnswer('')}
  }
  async function makeFromDocument(){
    if(!materialId){setError('Primero guarda un documento en Mis materiales.');return}
    const ok=await action(()=>request<{created:number}>('/cards/from-document','POST',{
      document_id:materialId,topic:materialTopic.trim(),
    }),r=>r.created?'Se crearon '+r.created+' tarjetas a partir del documento. Revisa sus respuestas.':
      'No se pudieron crear tarjetas nuevas: podrían estar repetidas.')
    if(ok)setSection('tarjetas')
  }
  async function grade(rating:string){
    if(!current)return
    const card=current
    const ok=await action(()=>request('/cards/'+card.id+'/review','POST',{rating}),
      ()=> 'Repaso registrado. Tu próxima fecha de revisión se ha actualizado.')
    if(ok){setSelected(null);setShowAnswer(false)}
  }
  async function removeCard(card:Card){
    if(!window.confirm('¿Eliminar definitivamente esta tarjeta de estudio?'))return
    const ok=await action(()=>request('/cards/'+card.id,'DELETE'),
      ()=> 'Tarjeta eliminada.')
    if(ok){setSelected(null);setShowAnswer(false)}
  }
  function ask(topic:string){
    onAskTutor('Estoy estudiando '+topic+'. Quiero comprender el tema paso a paso. Primero comprueba qué sé y después guíame con una pregunta o actividad. No me des directamente la respuesta.')
  }
  function startPractice(topic:string){
    if(['fracciones','ecuaciones'].includes(topic.toLowerCase()))onOpenPractice()
    else ask(topic)
  }
  const tested=overview.recommendations.filter(r=>r.evidence!=='sin evaluación').length
  return <main className="study-center" aria-label="Centro de estudio inteligente">
    <div className="study-wrap">
      <header className="study-hero">
        <span className="aur-section-companion" aria-hidden="true"><NatureCompanion /></span>
        <div className="study-hero-copy">
          <span className="study-eyebrow">TU ESPACIO DE APRENDIZAJE</span>
          <h1>Aprende de forma más inteligente</h1>
          <p>Organiza tus temas, repasa lo aprendido y trabaja con tu tutor. Tu ruta se adapta a tus avances reales.</p>
          <div className="study-hero-actions">
            <button type="button" onClick={()=>setSection('tarjetas')}>Empezar a repasar</button>
            <button type="button" onClick={()=>setSection('pizarra')}>Abrir mi pizarra</button>
          </div>
        </div>
        <div className="study-hero-decoration" aria-hidden="true">
          <div className="study-ring ring-one"/><div className="study-ring ring-two"/>
          <div className="study-hero-glyph"><MarcaMyTeacher /></div>
          <div className="study-float-dot first"/><div className="study-float-dot second"/>
        </div>
      </header>
      <div className="study-metrics" aria-label="Resumen de aprendizaje">
        <div><span className="study-metric-symbol">◎</span><strong>{tested}</strong><small>Temas con evidencias</small></div>
        <div><span className="study-metric-symbol">▦</span><strong>{overview.cards.total}</strong><small>Tarjetas guardadas</small></div>
        <div><span className="study-metric-symbol">↻</span><strong>{overview.cards.due}</strong><small>Repasos pendientes</small></div>
      </div>
      <nav className="study-tabs" aria-label="Opciones del centro de estudio">
        <button type="button" className={section==='ruta'?'active':''}
          aria-current={section==='ruta'?'page':undefined} onClick={()=>setSection('ruta')}>◈ Mi ruta</button>
        <button type="button" className={section==='tarjetas'?'active':''}
          aria-current={section==='tarjetas'?'page':undefined} onClick={()=>setSection('tarjetas')}>▤ Tarjetas inteligentes</button>
        <button type="button" className={section==='evaluaciones'?'active':''}
          aria-current={section==='evaluaciones'?'page':undefined} onClick={()=>setSection('evaluaciones')}>✓ Evaluaciones</button>
        <button type="button" className={section==='pizarra'?'active':''}
          aria-current={section==='pizarra'?'page':undefined} onClick={()=>setSection('pizarra')}>✎ Pizarra interactiva</button>
        <button type="button" className={section==='laboratorio'?'active':''}
          aria-current={section==='laboratorio'?'page':undefined} onClick={()=>setSection('laboratorio')}>◉ Laboratorio virtual</button>
      </nav>
      {error&&<div className="study-feedback is-error" role="alert">{error}<button type="button" onClick={()=>setError('')}>Cerrar</button></div>}
      {notice&&<div className="study-feedback is-success" role="status">{notice}<button type="button" onClick={()=>setNotice('')}>Cerrar</button></div>}
      {loading?<div className="study-loading" role="status">Preparando tu centro de estudio...</div>:(
        <>
          {section==='ruta'&&<section className="study-route-panel">
            <div className="study-panel-heading">
              <div><span className="study-eyebrow">APRENDIZAJE ADAPTATIVO</span>
                <h2>Tu ruta de conocimientos</h2>
                <p>Seleccionamos recomendaciones a partir de tus evaluaciones y tu memoria académica. No son diagnósticos definitivos.</p>
              </div>
              <span className="study-route-count">{overview.recommendations.length} temas</span>
            </div>
            <div className="study-route-grid">
              {overview.recommendations.map((item,index)=><article className="study-route-card" key={item.topic}>
                <div className="study-route-head">
                  <span className={'study-priority priority-'+item.priority}>{index+1}</span>
                  <span className="study-route-evidence">{item.evidence==='sin evaluación'?'Sin evaluar':'Basado en '+item.evidence}</span>
                </div>
                <h3>{item.topic.charAt(0).toUpperCase()+item.topic.slice(1)}</h3>
                <span className={'study-route-status priority-'+item.priority}>{item.status}</span>
                <p>{item.reason}</p>
                <div className="study-route-next"><strong>Próximo paso</strong><small>{item.next_step}</small></div>
                <div className="study-card-actions">
                  <button type="button" className="study-primary-button" onClick={()=>startPractice(item.topic)}>
                    {['fracciones','ecuaciones'].includes(item.topic.toLowerCase())?'Practicar ahora':'Aprender con mi tutor'}
                  </button>
                  <button type="button" onClick={()=>ask(item.topic)}>Pedir una pista</button>
                </div>
              </article>)}
            </div>
            <div className="study-route-note">
              <span aria-hidden="true">✦</span>
              <p>Cuanto más practiques y revises tus respuestas, mejores recomendaciones tendrás. También puedes estudiar cualquier tema libremente desde el chat.</p>
            </div>
          </section>}
          {section==='tarjetas'&&<section className="study-flashcards">
            <header className="study-panel-heading">
              <div><span className="study-eyebrow">REPASO ESPACIADO</span>
                <h2>Recuerda lo importante</h2>
                <p>Intenta responder antes de revelar la tarjeta. El sistema programa un próximo repaso según tu resultado.</p>
              </div>
              <span className="study-route-count">{overview.cards.due} pendientes</span>
            </header>
            {cards.length===0&&<div className="study-empty-cards">
              <span className="study-empty-symbol">✧</span>
              <h3>Tu colección empieza aquí</h3>
              <p>Agrega seis tarjetas iniciales o crea tarjetas a partir de tus propios materiales.</p>
              <button type="button" className="study-primary-button" disabled={busy} onClick={()=>void addStarter()}>Añadir tarjetas iniciales</button>
            </div>}
            {cards.length>0&&<>
              <div className="study-review-controls">
                <label><input type="checkbox" checked={allCards} onChange={e=>{setAllCards(e.target.checked);setSelected(null);setShowAnswer(false)}}/> Repasar también tarjetas programadas para después</label>
                <span>{activeCards.length} tarjetas disponibles</span>
              </div>
              {current?<article className="study-flashcard" aria-live="polite">
                <div className="study-flashcard-top">
                  <span>{current.topic}</span><span>{current.source_name?'Basada en material':'Tarjeta de repaso'}</span>
                </div>
                <h3>{current.question}</h3>
                {showAnswer?<div className="study-flashcard-answer">
                  <small>RESPUESTA PARA COMPROBAR</small><p>{current.answer}</p>
                  {current.source_name&&<small>Referencia: {current.source_name}{current.source_page?' · Página '+current.source_page:''}</small>}
                </div>:<p className="study-flashcard-hint">Intenta explicarlo con tus palabras antes de ver la respuesta.</p>}
                {showAnswer?<div className="study-rating" role="group" aria-label="¿Cómo recordaste la respuesta?">
                  <button type="button" disabled={busy} onClick={()=>void grade('olvidé')}>No lo recordé</button>
                  <button type="button" disabled={busy} onClick={()=>void grade('difícil')}>Me costó</button>
                  <button type="button" disabled={busy} onClick={()=>void grade('bien')}>Lo recordé</button>
                  <button type="button" disabled={busy} onClick={()=>void grade('fácil')}>Muy fácil</button>
                </div>:<button type="button" className="study-primary-button" onClick={()=>setShowAnswer(true)}>Revelar respuesta</button>}
                <div className="study-card-footer">
                  <span>{current.reviews?current.reviews+' repasos anteriores':'Nueva tarjeta'}</span>
                  <button type="button" disabled={busy} onClick={()=>void removeCard(current)}>Eliminar tarjeta</button>
                </div>
              </article>:<div className="study-empty-cards"><h3>¡Repasos al día!</h3><p>Has terminado tus tarjetas pendientes. Podrás volver a repasarlas cuando llegue su fecha programada.</p></div>}
            </>}
            <div className="study-card-create-grid">
              <form className="study-create-box" onSubmit={e=>void addManual(e)}>
                <h3>Crear una tarjeta</h3>
                <label>Tema<input value={newTopic} maxLength={110} required minLength={2} placeholder="Ej. Sistema nervioso" onChange={e=>setNewTopic(e.target.value)}/></label>
                <label>Pregunta<input value={newQuestion} maxLength={300} required minLength={8} placeholder="¿Qué función tiene...?" onChange={e=>setNewQuestion(e.target.value)}/></label>
                <label>Respuesta<textarea value={newAnswer} maxLength={750} required minLength={5} rows={3} placeholder="Explica aquí lo que debes recordar" onChange={e=>setNewAnswer(e.target.value)}/></label>
                <button type="submit" className="study-primary-button" disabled={busy}>Guardar tarjeta</button>
              </form>
              <div className="study-create-box">
                <h3>Crear desde tus materiales</h3>
                <p>La IA puede proponer tarjetas a partir de fragmentos de un documento guardado. Se envían fragmentos a Gemini únicamente cuando eliges generar.</p>
                {documents.length?<><label>Documento
                  <select value={materialId} onChange={e=>setMaterialId(e.target.value)}>
                    {documents.map(doc=><option key={doc.id} value={doc.id}>{doc.filename}</option>)}
                  </select>
                </label>
                <label>Enfoque opcional<input value={materialTopic} onChange={e=>setMaterialTopic(e.target.value)} maxLength={110} placeholder="Ej. Anatomía, funciones..." /></label>
                <button type="button" disabled={busy} className="study-primary-button" onClick={()=>void makeFromDocument()}>
                  Generar tarjetas con IA
                </button>
                <small>Máximo 2 generaciones por día. Las respuestas generadas deben comprobarse con la fuente.</small>
                </>:<><p>Aún no has guardado documentos en tu biblioteca.</p>
                  <button type="button" onClick={onOpenLibrary}>Ir a Mis materiales</button></>}
              </div>
            </div>
          </section>}
          {section==='evaluaciones'&&<EvaluacionDinamica
            token={token} cards={cards} onAskTutor={onAskTutor}
            onExamCompleted={reload}
          />}
          {section==='pizarra'&&<PizarraEducativa
            onSend={file=>onAttachDrawing(file)}
            onError={message=>{setError(message);setNotice('')}} />}
          {section==='laboratorio'&&<LaboratorioVirtual onAskTutor={onAskTutor} />}
        </>
      )}
    </div>
  </main>
}
