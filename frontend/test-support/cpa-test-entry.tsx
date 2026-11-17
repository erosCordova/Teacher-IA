import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import PracticaConcreta from '../conauti-ui/PracticaConcreta'
import ResumenFamilia from '../conauti-ui/ResumenFamilia'
import '../conauti-ui/AnaliticaAcademica.css'

function Demo() {
  const [seleccion, setSeleccion] = useState('')
  return <main className="ma-academica">
    <PracticaConcreta />
    <ResumenFamilia
      resumen={{ topics: {
        fracciones: { attempts: 4, correct: 1, distinct_exercises: 3, verified_level: 0, level_note: '' },
        ecuaciones: { attempts: 4, correct: 4, distinct_exercises: 3, verified_level: 1, level_note: '' },
      } }}
      materias={[
        { tema: 'fracciones', intentos: 4, correctos: 1, porcentaje: 25 },
        { tema: 'ecuaciones', intentos: 4, correctos: 4, porcentaje: 100 },
      ]}
      diasActivos={2}
      onPracticar={setSeleccion}
    />
    <output aria-label="Materia elegida">{seleccion}</output>
    <div data-testid="evidencia-limitada">
      <ResumenFamilia
        resumen={{ topics: { fracciones: { attempts: 2, correct: 0, distinct_exercises: 2, verified_level: 0, level_note: '' } } }}
        materias={[{ tema: 'fracciones', intentos: 2, correctos: 0, porcentaje: 0 }]}
        diasActivos={1}
        onPracticar={setSeleccion}
      />
    </div>
  </main>
}

createRoot(document.getElementById('root')!).render(<Demo />)
