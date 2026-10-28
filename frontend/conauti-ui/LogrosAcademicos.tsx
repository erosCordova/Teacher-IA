import {
  calcularRetos,
  type DatosAcademicos,
  type TemaAcademico,
} from "./RetosAcademicos";

import "./LogrosAcademicos.css";

type Props = {
  datos: DatosAcademicos;
  onPracticar: (tema: TemaAcademico) => void;
};

export default function LogrosAcademicos({
  datos,
  onPracticar,
}: Props) {
  const resultados = calcularRetos(datos);

  return (
    <section
      className="mt-logros"
      aria-labelledby="mt-logros-titulo"
    >
      <div className="mt-logros-cabecera">
        <div>
          <span className="mt-logros-etiqueta">
            MOTIVACIÓN PARA APRENDER
          </span>

          <h3 id="mt-logros-titulo">
            Mis logros y retos
          </h3>

          <p>
            Cada pequeño avance cuenta. Tus logros se
            desbloquean con ejercicios que realmente
            has completado.
          </p>
        </div>

        <div className="mt-logros-contador">
          <strong>
            {resultados.completados}/
            {resultados.total}
          </strong>

          <span>logros alcanzados</span>
        </div>
      </div>

      <div className="mt-logros-lista">
        {resultados.logros.map((logro) => (
          <article
            key={logro.id}
            className={
              "mt-logro " +
              (logro.desbloqueado
                ? "mt-logro-desbloqueado"
                : "mt-logro-pendiente")
            }
          >
            <div
              className="mt-logro-icono"
              aria-hidden="true"
            >
              {logro.desbloqueado
                ? "★"
                : logro.indicador}
            </div>

            <div className="mt-logro-contenido">
              <div className="mt-logro-titulo">
                <strong>{logro.nombre}</strong>

                <span>
                  {logro.desbloqueado
                    ? "Desbloqueado"
                    : "En progreso"}
                </span>
              </div>

              <p>{logro.descripcion}</p>

              <div
                className="mt-logro-barra"
                role="progressbar"
                aria-label={
                  "Progreso del logro " + logro.nombre
                }
                aria-valuemin={0}
                aria-valuemax={logro.objetivo}
                aria-valuenow={logro.progreso}
              >
                <div
                  style={{
                    width: `${
                      (logro.progreso / logro.objetivo) * 100
                    }%`,
                  }}
                />
              </div>

              <small>
                {logro.progreso} de {logro.objetivo}
              </small>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-logros-mision">
        <div>
          <span className="mt-logros-etiqueta">
            TU PRÓXIMA MISIÓN
          </span>

          <h4>{resultados.mision.titulo}</h4>

          <p>{resultados.mision.descripcion}</p>
        </div>

        <button
          type="button"
          onClick={() =>
            onPracticar(resultados.mision.tema)
          }
        >
          {resultados.mision.titulo}
        </button>
      </div>

      <p className="mt-logros-nota">
        Los logros son motivacionales: no representan
        calificaciones ni certificados. La constancia
        semanal se calcula con los últimos 100 ejercicios
        disponibles, por lo que puede estar incompleta
        cuando hay más actividad registrada.
      </p>
    </section>
  );
}
