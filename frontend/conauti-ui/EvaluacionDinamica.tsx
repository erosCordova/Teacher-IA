import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from './apiFetch'

type CardSummary={topic:string;answer:string}
type ExamQuestion={id:string;topic:string;question:string;options:Record<string,string>}
type Exam={id:string;topic:string;total:number;questions:ExamQuestion[]}
type Feedback={
  id:string;question:string;selected:string;correct:boolean;correct_option:string;
  explanation:string;source:string;page:number|null
}
type Result={score:number;total:number;percentage:number;feedback:Feedback[];recommendation:string}
type Historical={id:string;topic:string;score:number;total:number;percentage:number;date:string}
type Props={
  token:string;cards:CardSummary[];
  onAskTutor:(question:string)=>void;
  onExamCompleted:()=>Promise<void>;
}

export default function EvaluacionDinamica({token,cards,onAskTutor,onExamCompleted}:Props){
  const [topic,setTopic]=useState('')
  const [exam,setExam]=useState<Exam|null>(null)
  const [answers,setAnswers]=useState<Record<string,string>>({})
  const [result,setResult]=useState<Result|null>(null)
  const [history,setHistory]=useState<Historical[]>([])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const possible=Array.from(new Set(cards.map(x=>x.topic))).filter(t=>{
    const distinct=new Set(cards.filter(c=>c.topic===t).map(c=>c.answer.toLowerCase().trim()))
    return distinct.size>=4
  })
  const request=useCallback(async <T,>(path:string,method='GET',body?:object):Promise<T>=>{
    const r=await apiFetch('/api/conauti/study/exams'+path,{
      method,cache:'no-store',
      headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),
    })
    if(!r.ok){
      const data:{detail?:string}=await r.json().catch(()=>({}))
      throw new Error(data.detail||'La evaluación no está disponible.')
    }
    return r.json() as Promise<T>
  },[token])
  const loadHistory=useCallback(async()=>{
    const r=await request<{exams:Historical[]}>('/history')
    setHistory(r.exams)
  },[request])
  useEffect(()=>{
    let mounted=true
    request<{exams:Historical[]}>('/history').then(r=>{if(mounted)setHistory(r.exams)})
      .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'No se pudo consultar el historial.')})
    return ()=>{mounted=false}
  },[request])
  async function start(){
    setError('');setNotice('');setBusy(true)
    try{
      const data=await request<Exam>('/start','POST',{topic,count:5})
      setExam(data);setAnswers({});setResult(null)
      setNotice('Responde con calma; puedes revisar tus tarjetas después de terminar.')
    }catch(e){setError(e instanceof Error?e.message:'No se pudo comenzar la evaluación.')}
    finally{setBusy(false)}
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!exam)return
    if(Object.keys(answers).length!==exam.questions.length){
      setError('Debes responder todas las preguntas antes de finalizar.');return
    }
    setError('');setNotice('');setBusy(true)
    try{
      const data=await request<Result>('/'+exam.id+'/submit','POST',{answers})
      setResult(data)
      await loadHistory()
      await onExamCompleted()
    }catch(e){setError(e instanceof Error?e.message:'No se pudo registrar la evaluación.')}
    finally{setBusy(false)}
  }
  function finish(){
    setExam(null);setResult(null);setAnswers({});setError('');setNotice('')
  }
  return <section className="study-exam">
    <header className="study-panel-heading">
      <div><span className="study-eyebrow">EVALUACIÓN DINÁMICA</span>
        <h2>Comprueba lo que aprendiste</h2>
        <p>Las preguntas se construyen con tus tarjetas y se corrigen en el servidor. Tu progreso se registra para que puedas comparar resultados.</p>
      </div>
      <span className="study-route-count">{history.length} evaluaciones guardadas</span>
    </header>
    {error&&<div className="study-feedback is-error" role="alert">{error}<button type="button" onClick={()=>setError('')}>Cerrar</button></div>}
    {notice&&<p className="study-exam-notice" role="status">{notice}</p>}
    {!exam&&<div className="study-exam-start">
      <div className="study-exam-visual" aria-hidden="true"><span>✓</span><span>?</span><span>◎</span></div>
      <h3>Una evaluación diferente cada vez</h3>
      <p>Seleccionaremos hasta cinco preguntas de tus materiales de estudio. Antes de empezar, asegúrate de tener al menos cuatro tarjetas con respuestas diferentes.</p>
      <label>Contenido de la evaluación
        <select value={topic} onChange={e=>setTopic(e.target.value)}>
          <option value="">Repaso de todas mis materias</option>
          {possible.map(t=><option value={t} key={t}>{t}</option>)}
        </select>
      </label>
      <button type="button" className="study-primary-button" onClick={()=>void start()}
        disabled={busy||cards.length<4}>Comenzar evaluación</button>
      {cards.length<4&&<small>Primero agrega tarjetas desde «Tarjetas inteligentes» para desbloquear esta actividad.</small>}
      <small>Máximo cinco evaluaciones al día. No se consume cuota adicional de IA al responder.</small>
    </div>}
    {exam&&!result&&<form className="study-exam-form" onSubmit={e=>void submit(e)}>
      <div className="study-exam-progress">
        <strong>{Object.keys(answers).length} de {exam.total} preguntas respondidas</strong>
        <div role="progressbar" aria-label="Avance de la evaluación" aria-valuenow={Object.keys(answers).length}
          aria-valuemin={0} aria-valuemax={exam.total}>
          <span style={{width:Math.round(100*Object.keys(answers).length/exam.total)+'%'}} />
        </div>
      </div>
      {exam.questions.map((q,i)=><fieldset key={q.id} className="study-exam-question">
        <legend><span>Pregunta {i+1}</span>{q.question}</legend>
        <div className="study-exam-options">
          {Object.entries(q.options).map(([key,text])=><label key={key}
            className={answers[q.id]===key?'selected':''}>
            <input type="radio" name={q.id} value={key} checked={answers[q.id]===key}
              onChange={()=>setAnswers(prev=>({...prev,[q.id]:key}))}/>
            <span className="study-exam-letter">{key}</span><span>{text}</span>
          </label>)}
        </div>
      </fieldset>)}
      <button type="submit" className="study-primary-button" disabled={busy||Object.keys(answers).length!==exam.total}>
        Finalizar y comprobar respuestas
      </button>
    </form>}
    {exam&&result&&<div className="study-exam-result">
      <div className="study-exam-score"><strong>{result.percentage}%</strong>
        <span>{result.score} respuestas correctas de {result.total}</span>
        <p>{result.recommendation}</p>
      </div>
      {result.feedback.map((item,i)=><article key={item.id} className={'study-exam-feedback'+(item.correct?' correct':' incorrect')}>
        <div><span>{item.correct?'✓':'×'}</span><strong>{i+1}. {item.question}</strong></div>
        <p>{item.correct?'Respuesta correcta.':'Respuesta para revisar:'} {item.explanation}</p>
        {item.source&&<small>Referencia: {item.source}{item.page?' · página '+item.page:''}</small>}
        {!item.correct&&<button type="button" onClick={()=>onAskTutor(
          'En una evaluación tuve dificultades con esta pregunta: '+item.question+
          '. Guíame para entender el concepto y practica conmigo sin decirme simplemente la respuesta.'
        )}>Repasar con el tutor</button>}
      </article>)}
      <button type="button" className="study-primary-button" onClick={finish}>Volver a las actividades</button>
    </div>}
    {history.length>0&&<div className="study-exam-history">
      <h3>Mis evaluaciones anteriores</h3>
      <div>{history.map(h=><div key={h.id}>
        <span>{h.topic}</span><strong>{h.score}/{h.total} · {h.percentage}%</strong>
        <small>{new Date(h.date).toLocaleDateString('es-PE')}</small>
      </div>)}</div>
    </div>}
  </section>
}
