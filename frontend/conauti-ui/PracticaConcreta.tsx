import { useState } from 'react'
import './PracticaConcreta.css'

type Situacion = {
  historia: string
  objeto: string
  icono: string
  total: number
  elegidas: number
}

const SITUACIONES: Situacion[] = [
  { historia: 'Hay 4 manzanas. Coloca 2 en la cesta.', objeto: 'manzana', icono: '🍎', total: 4, elegidas: 2 },
  { historia: 'Hay 6 libros. Separa 2 para leer.', objeto: 'libro', icono: '📘', total: 6, elegidas: 2 },
  { historia: 'Hay 8 fichas. Escoge 3 para jugar.', objeto: 'ficha', icono: '🔵', total: 8, elegidas: 3 },
  { historia: 'Hay 5 flores. Elige 4 para un ramo.', objeto: 'flor', icono: '🌼', total: 5, elegidas: 4 },
  { historia: 'Hay 10 lápices. Aparta 5 para dibujar.', objeto: 'lápiz', icono: '✏️', total: 10, elegidas: 5 },
]

type Etapa = 'objetos' | 'dibujo' | 'simbolos' | 'terminado'

function cambiarPieza(actuales: number[], indice: number): number[] {
  return actuales.includes(indice)
    ? actuales.filter((valor) => valor !== indice)
    : [...actuales, indice]
}

export default function PracticaConcreta() {
  const [abierta, setAbierta] = useState(false)
  const [indice, setIndice] = useState(0)
  const [etapa, setEtapa] = useState<Etapa>('objetos')
  const [objetos, setObjetos] = useState<number[]>([])
  const [partes, setPartes] = useState<number[]>([])
  const [numerador, setNumerador] = useState('')
  const [denominador, setDenominador] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [intentos, setIntentos] = useState(0)
  const situacion = SITUACIONES[indice]

  function comenzarOtra() {
    setIndice((anterior) => (anterior + 1) % SITUACIONES.length)
    setEtapa('objetos')
    setObjetos([])
    setPartes([])
    setNumerador('')
    setDenominador('')
    setMensaje('')
    setIntentos(0)
  }

  function verificar() {
    setIntentos((anterior) => anterior + 1)
    if (etapa === 'objetos') {
      if (objetos.length !== situacion.elegidas) {
        setMensaje('Vuelve a leer la historia y cuenta las piezas que seleccionaste.')
        return
      }
      setMensaje('Bien. Ahora representa esa misma cantidad con un dibujo.')
      setEtapa('dibujo')
      return
    }
    if (etapa === 'dibujo') {
      if (partes.length !== situacion.elegidas) {
        setMensaje('Cada recuadro representa un objeto. Revisa cuántos elegiste.')
        return
      }
      setMensaje('Bien. El dibujo muestra la misma parte que los objetos.')
      setEtapa('simbolos')
      return
    }
    if (etapa === 'simbolos') {
      const arriba = Number(numerador)
      const abajo = Number(denominador)
      if (!numerador.trim() || !denominador.trim() || !Number.isInteger(arriba) || !Number.isInteger(abajo) || arriba < 0 || abajo < 1 || arriba > abajo || abajo > 100) {
        setMensaje('Escribe números enteros: arriba, las partes elegidas; abajo, el total de partes.')
        return
      }
      if (arriba * situacion.total !== situacion.elegidas * abajo) {
        setMensaje('Revisa el dibujo: ¿cuántas partes elegiste y cuántas hay en total?')
        return
      }
      setMensaje('¡Lo lograste! Los objetos, el dibujo y la fracción representan la misma cantidad.')
      setEtapa('terminado')
    }
  }

  const actual = etapa === 'objetos' ? 0 : etapa === 'dibujo' ? 1 : 2

  return (
    <section className="cpa" aria-labelledby="cpa-titulo">
      <div className="cpa-cabecera">
        <div>
          <span className="cpa-etiqueta">APRENDE A TU RITMO</span>
          <h3 id="cpa-titulo">De los objetos a las fracciones</h3>
          <p>Explora una misma idea con objetos, un dibujo y números.</p>
        </div>
        <button type="button" className="cpa-abrir" aria-expanded={abierta} aria-controls="cpa-actividad" onClick={() => setAbierta((valor) => !valor)}>
          {abierta ? 'Cerrar actividad' : 'Explorar actividad'}
        </button>
      </div>

      {abierta && (
        <div className="cpa-actividad" id="cpa-actividad">
          <ol className="cpa-pasos" aria-label="Etapas de la actividad">
            {['Objetos', 'Dibujo', 'Fracción'].map((nombre, posicion) => (
              <li key={nombre} className={etapa === 'terminado' || posicion < actual ? 'cpa-paso-listo' : posicion === actual ? 'cpa-paso-activo' : ''} aria-current={posicion === actual && etapa !== 'terminado' ? 'step' : undefined}>
                <span>{posicion + 1}</span>{nombre}
              </li>
            ))}
          </ol>

          <div className="cpa-reto">
            <span>Situación {indice + 1} de {SITUACIONES.length}</span>
            <h4>{situacion.historia}</h4>
          </div>

          {etapa === 'objetos' && (
            <div>
              <p>Toca los objetos que quieres separar.</p>
              <div className="cpa-objetos" role="group" aria-label="Seleccionar objetos">
                {Array.from({ length: situacion.total }, (_, i) => (
                  <button key={i} type="button" className={objetos.includes(i) ? 'cpa-objeto elegido' : 'cpa-objeto'} aria-pressed={objetos.includes(i)} aria-label={`${situacion.objeto} ${i + 1}`} onClick={() => { setObjetos((actuales) => cambiarPieza(actuales, i)); setMensaje('') }}>
                    <span aria-hidden="true">{situacion.icono}</span>
                  </button>
                ))}
              </div>
              <small>{objetos.length} de {situacion.total} objetos seleccionados</small>
            </div>
          )}

          {etapa === 'dibujo' && (
            <div>
              <p>Colorea un recuadro por cada objeto que separaste.</p>
              <div className="cpa-dibujo" role="group" aria-label="Representar los objetos en un dibujo">
                {Array.from({ length: situacion.total }, (_, i) => (
                  <button key={i} type="button" className={partes.includes(i) ? 'cpa-parte elegida' : 'cpa-parte'} aria-pressed={partes.includes(i)} aria-label={`Recuadro ${i + 1}`} onClick={() => { setPartes((actuales) => cambiarPieza(actuales, i)); setMensaje('') }} />
                ))}
              </div>
              <small>{partes.length} de {situacion.total} recuadros coloreados</small>
            </div>
          )}

          {(etapa === 'simbolos' || etapa === 'terminado') && (
            <div>
              <p>Escribe una fracción que represente la parte coloreada.</p>
              <div className="cpa-muestra" aria-label={`${partes.length} recuadros coloreados de ${situacion.total}`}>
                {Array.from({ length: situacion.total }, (_, i) => <span key={i} className={partes.includes(i) ? 'elegida' : ''} />)}
              </div>
              <div className="cpa-fraccion">
                <label>Partes elegidas<input type="number" inputMode="numeric" min="0" max="100" value={numerador} disabled={etapa === 'terminado'} onChange={(event) => { setNumerador(event.target.value); setMensaje('') }} /></label>
                <span className="cpa-linea" aria-hidden="true" />
                <label>Partes en total<input type="number" inputMode="numeric" min="1" max="100" value={denominador} disabled={etapa === 'terminado'} onChange={(event) => { setDenominador(event.target.value); setMensaje('') }} /></label>
              </div>
            </div>
          )}

          {mensaje && <p className={etapa === 'terminado' ? 'cpa-mensaje correcto' : 'cpa-mensaje'} role="status">{mensaje}</p>}

          <div className="cpa-acciones">
            {etapa === 'terminado' ? (
              <button type="button" className="cpa-principal" onClick={comenzarOtra}>Probar otra situación</button>
            ) : (
              <button type="button" className="cpa-principal" onClick={verificar}>{etapa === 'simbolos' ? 'Comprobar fracción' : 'Comprobar y continuar'}</button>
            )}
            {intentos > 2 && etapa !== 'terminado' && <small>Hazlo con calma: puedes intentarlo las veces que necesites.</small>}
          </div>
          <p className="cpa-nota">Esta actividad de práctica no se suma todavía a tus evaluaciones guardadas.</p>
        </div>
      )}
    </section>
  )
}
