import { useEffect, useMemo, useState } from "react";

import {
  calcularAnalitica,
  type IntentoAcademico,
  type ResumenGeneral,
} from "./MetricasAcademicas";

import "./AnaliticaAcademica.css";
import LogrosAcademicos from "./LogrosAcademicos";

type Props = {
  revision: number;
  onPracticar: (
    tema: "fracciones" | "ecuaciones"
  ) => void;
};

type HistorialRespuesta = {
  items: IntentoAcademico[];
  count: number;
  limit: number;
};

async function obtener<T>(
  ruta: string,
  signal: AbortSignal,
): Promise<T> {
  const token = sessionStorage.getItem(
    "conauti_token",
  );

  if (!token) {
    throw new Error(
      "Inicia sesión para consultar tus estadísticas.",
    );
  }

  const respuesta = await fetch(ruta, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error(
        "La sesión ha caducado. Vuelve a iniciar sesión.",
      );
    }

    throw new Error(
      `No se pudieron cargar los datos (HTTP ${respuesta.status}).`,
    );
  }

  return (await respuesta.json()) as T;
}

export default function AnaliticaAcademica({
  revision,
  onPracticar,
}: Props) {
  const [historial, setHistorial] =
    useState<IntentoAcademico[]>([]);

  const [resumen, setResumen] =
    useState<ResumenGeneral | null>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    const controlador = new AbortController();

    async function cargar() {
      setCargando(true);
      setError("");

      try {
        const [datosHistorial, datosProgreso] =
          await Promise.all([
            obtener<HistorialRespuesta>(
              "/api/conauti/memory/assessment/history?limit=100",
              controlador.signal,
            ),
            obtener<ResumenGeneral>(
              "/api/conauti/memory/assessment/progress",
              controlador.signal,
            ),
          ]);

        if (!activo) return;

        setHistorial(
          datosHistorial.items,
        );

        setResumen(datosProgreso);
      } catch (fallo: unknown) {
        if (
          !activo ||
          controlador.signal.aborted
        ) {
          return;
        }

        setError(
          fallo instanceof Error
            ? fallo.message
            : "No fue posible recuperar las estadísticas.",
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargar();

    return () => {
      activo = false;
      controlador.abort();
    };
  }, [revision]);

  const analitica = useMemo(
    () =>
      resumen
        ? calcularAnalitica(
            historial,
            resumen,
          )
        : null,
    [historial, resumen],
  );

  const nombreMateria = (
    valor: string,
  ) => (
    valor === "fracciones"
      ? "Fracciones"
      : "Ecuaciones"
  );

  return (
    <section
      className="ma-academica"
      aria-labelledby="ma-titulo"
    >
      <header className="ma-cabecera">
        <div>
          <span className="ma-etiqueta">
            TU EVOLUCIÓN ACADÉMICA
          </span>

          <h2 id="ma-titulo">
            Así estás aprendiendo
          </h2>

          <p>
            Visualiza tu actividad y tus resultados
            reales en los ejercicios.
          </p>
        </div>

        <span className="ma-distintivo">
          Actualizado desde tu cuenta
        </span>
      </header>

      {cargando ? (
        <p role="status">
          Preparando tus estadísticas académicas...
        </p>
      ) : error ? (
        <p className="ma-error" role="alert">
          {error}
        </p>
      ) : analitica ? (
        <>
          <div className="ma-indicadores">
            <article className="ma-indicador">
              <span>Ejercicios realizados</span>
              <strong>
                {analitica.totalIntentos}
              </strong>
              <small>
                Total acumulado
              </small>
            </article>

            <article className="ma-indicador">
              <span>Porcentaje de aciertos</span>
              <strong>
                {analitica.totalIntentos > 0
                  ? `${analitica.porcentajeGeneral}%`
                  : "—"}
              </strong>
              <small>
                Todas tus evaluaciones
              </small>
            </article>

            <article className="ma-indicador">
              <span>Días activos</span>
              <strong>
                {analitica.diasActivos}/7
              </strong>
              <small>
                Últimos siete días
              </small>
            </article>

            <article className="ma-indicador">
              <span>Constancia observada</span>
              <strong>
                {analitica.constancia}
              </strong>
              <small>
                Días consecutivos*
              </small>
            </article>
          </div>

          <div className="ma-paneles">
            <article className="ma-panel">
              <div className="ma-panel-cabecera">
                <h3>Actividad de la semana</h3>
                <span>
                  Ejercicios diarios
                </span>
              </div>

              <div
                className="ma-grafico"
                role="img"
                aria-label={
                  "Ejercicios de los últimos siete días: " +
                  analitica.semana.map(
                    (dia) =>
                      `${dia.fecha}: ${dia.ejercicios}`,
                  ).join("; ")
                }
              >
                {analitica.semana.map(
                  (dia) => {
                    const altura =
                      dia.ejercicios === 0
                        ? 0
                        : Math.max(
                            7,
                            Math.round(
                              (
                                dia.ejercicios /
                                analitica.maximoDia
                              ) * 100,
                            ),
                          );

                    return (
                      <div
                        className="ma-dia"
                        key={dia.fecha}
                      >
                        <strong>
                          {dia.ejercicios}
                        </strong>

                        <div className="ma-columna">
                          <div
                            className="ma-barra-dia"
                            style={{
                              height: `${altura}%`,
                            }}
                          />
                        </div>

                        <span>
                          {dia.etiqueta}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>

              <div className="ma-meta">
                <div className="ma-meta-titulos">
                  <strong>
                    Meta semanal sugerida
                  </strong>
                  <span>
                    {analitica.diasActivos}/
                    {analitica.metaSemanal} días
                  </span>
                </div>

                <div
                  className="ma-progreso-meta"
                  role="progressbar"
                  aria-label="Cumplimiento de la meta semanal"
                  aria-valuemin={0}
                  aria-valuemax={
                    analitica.metaSemanal
                  }
                  aria-valuenow={Math.min(
                    analitica.diasActivos,
                    analitica.metaSemanal,
                  )}
                >
                  <div
                    style={{
                      width: `${
                        Math.min(
                          100,
                          (
                            analitica.diasActivos /
                            analitica.metaSemanal
                          ) * 100,
                        )
                      }%`,
                    }}
                  />
                </div>

                <p>
                  {analitica.metaAlcanzada
                    ? "¡Cumpliste la meta de práctica!"
                    : "Practica cuando puedas: lo importante es comprender."}
                </p>
              </div>
            </article>

            <article className="ma-panel">
              <div className="ma-panel-cabecera">
                <h3>Resultados por materia</h3>
                <span>
                  Aciertos acumulados
                </span>
              </div>

              <div className="ma-materias">
                {analitica.materias.map(
                  (materia) => (
                    <div
                      className="ma-materia"
                      key={materia.tema}
                    >
                      <div className="ma-materia-info">
                        <strong>
                          {nombreMateria(
                            materia.tema,
                          )}
                        </strong>

                        <span>
                          {materia.intentos > 0
                            ? `${materia.porcentaje}%`
                            : "Sin evaluar"}
                        </span>
                      </div>

                      <div
                        className="ma-barra-materia"
                        role="progressbar"
                        aria-label={
                          "Aciertos en " +
                          nombreMateria(materia.tema)
                        }
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={
                          materia.porcentaje
                        }
                      >
                        <div
                          style={{
                            width: `${
                              materia.porcentaje
                            }%`,
                          }}
                        />
                      </div>

                      <small>
                        {materia.correctos} correctas de{" "}
                        {materia.intentos} intentos
                      </small>
                    </div>
                  ),
                )}
              </div>

              <div className="ma-consejo">
                <strong>
                  Aprende a tu ritmo
                </strong>
                <p>
                  Los errores ayudan a identificar
                  qué conviene practicar. Utiliza las
                  pistas cuando necesites orientación.
                </p>
              </div>
            </article>
          </div>

          {analitica.totalIntentos === 0 && (
            <p className="ma-sin-datos">
              Resuelve tu primer ejercicio para comenzar
              a visualizar tu evolución.
            </p>
          )}

          <LogrosAcademicos
            datos={analitica}
            onPracticar={onPracticar}
          />

          <p className="ma-aclaracion">
            *Los días activos, la constancia y el gráfico
            se calculan a partir de los últimos 100
            ejercicios recuperados. Los totales por
            materia provienen de todas las evaluaciones
            registradas. La meta semanal es orientativa
            y no representa una obligación.
          </p>
        </>
      ) : null}
    </section>
  );
}
