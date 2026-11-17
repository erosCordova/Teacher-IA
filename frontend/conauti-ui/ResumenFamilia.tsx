import type { ResumenGeneral } from './MetricasAcademicas'
import './ResumenFamilia.css'

type Tema = 'fracciones' | 'ecuaciones'
type Indicador = { tema: string; intentos: number; porcentaje: number; correctos: number }
type Props = {
  resumen: ResumenGeneral
  materias: Indicador[]
  diasActivos: number
  onPracticar: (tema: Tema) => void
}

export default function ResumenFamilia({ resumen, materias, diasActivos, onPracticar }: Props) {
  const conEvidencia = materias.filter((materia) => (resumen.topics?.[materia.tema]?.distinct_exercises ?? 0) >= 3)
  const porReforzar = conEvidencia.filter((materia) => materia.porcentaje < 65).sort((a, b) => a.porcentaje - b.porcentaje)[0]
  const fortaleza = conEvidencia.filter((materia) => materia.porcentaje >= 85).sort((a, b) => b.porcentaje - a.porcentaje)[0]
  const nombre = (tema: string) => tema === 'fracciones' ? 'fracciones' : 'ecuaciones'
  const intentos = materias.reduce((total, materia) => total + materia.intentos, 0)

  return (
    <details className="familia-resumen">
      <summary>Resumen para conversar en familia <span>Ver resumen</span></summary>
      <div className="familia-contenido">
        <p>Una forma sencilla de acompañar el aprendizaje, a partir de las prácticas registradas en esta cuenta.</p>
        {intentos === 0 ? (
          <div className="familia-tarjeta">
            <strong>Aún no hay resultados para resumir.</strong>
            <p>Invita al estudiante a realizar su primera práctica y conversar sobre lo que aprendió.</p>
            <button type="button" onClick={() => onPracticar('fracciones')}>Empezar a practicar</button>
          </div>
        ) : (
          <>
            <p className="familia-cifras">{intentos} {intentos === 1 ? 'ejercicio registrado' : 'ejercicios registrados'} · Actividad en {diasActivos} de los últimos 7 días*</p>
            <div className="familia-lista">
              <div className="familia-tarjeta">
                <strong>Para acompañar</strong>
                <p>{porReforzar ? `Conviene seguir practicando ${nombre(porReforzar.tema)}. Puedes pedirle que explique cómo piensa y celebrar sus avances.` : conEvidencia.length ? 'Mantengan espacios breves de práctica y conversen sobre las estrategias que le resultan útiles.' : 'Todavía se necesitan más ejercicios diferentes para orientar la práctica.'}</p>
                {porReforzar && <button type="button" onClick={() => onPracticar(porReforzar.tema as Tema)}>Practicar {nombre(porReforzar.tema)}</button>}
              </div>
              <div className="familia-tarjeta">
                <strong>Lo que va bien</strong>
                <p>{fortaleza ? `En ${nombre(fortaleza.tema)} se observan ${fortaleza.correctos} respuestas correctas de ${fortaleza.intentos}. Puede explicar su razonamiento o intentar nuevos desafíos.` : 'Cada intento ayuda a conocer mejor el progreso. Las fortalezas aparecerán cuando haya más evidencia.'}</p>
              </div>
            </div>
          </>
        )}
        <p className="familia-nota">Los resultados son orientativos: no son un diagnóstico ni una calificación PISA. El resumen se muestra en esta cuenta y no se envía automáticamente a nadie. *La actividad reciente considera hasta los últimos 100 ejercicios.</p>
      </div>
    </details>
  )
}
