import { useEffect, useMemo, useState } from "react";
import "./HistorialEvaluaciones.css";
import OrientacionError from "./OrientacionError";

// MYTEACHER_REVIEW_V1

type Tema = "fracciones" | "ecuaciones";
type FiltroTema = Tema | "todos";
type FiltroResultado = "todos" | "correctos" | "errores";

type Intento = {
  id: string;
  topic: string;
  question: string;
  correct: boolean;
  answered_at: string;
};

type Respuesta = {
  items: Intento[];
  count: number;
  limit: number;
};

type Props = {
  revision: number;
  onPracticar: (tema: Tema) => void;
};

function nombreTema(tema: string): string {
  if (tema === "fracciones") return "Fracciones";
  if (tema === "ecuaciones") return "Ecuaciones";
  return tema;
}

export default function HistorialEvaluaciones({
  revision,
  onPracticar,
}: Props) {
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [filtroTema, setFiltroTema] =
    useState<FiltroTema>("todos");
  const [filtroResultado, setFiltroResultado] =
    useState<FiltroResultado>("todos");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    const controlador = new AbortController();

    async function cargar() {
      setCargando(true);
      setError("");

      try {
        const token = sessionStorage.getItem(
          "conauti_token",
        );

        if (!token) {
          throw new Error(
            "Inicia sesión para consultar tu historial.",
          );
        }

        const response = await fetch(
          "/api/conauti/memory/assessment/history?limit=100",
          {
            signal: controlador.signal,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Tu sesión ha caducado."
              : `Error consultando el historial (${response.status}).`,
          );
        }

        const data = (await response.json()) as Respuesta;

        if (!Array.isArray(data.items)) {
          throw new Error(
            "El servidor devolvió un historial inválido.",
          );
        }

        if (activo) {
          setIntentos(data.items);
        }
      } catch (fallo: unknown) {
        if (!activo || controlador.signal.aborted) {
          return;
        }

        setError(
          fallo instanceof Error
            ? fallo.message
            : "No se pudo recuperar el historial.",
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

  const correctos = intentos.filter(
    (item) => item.correct,
  ).length;

  const errores = intentos.filter(
    (item) => !item.correct,
  ).length;

  const filtrados = useMemo(
    () =>
      intentos.filter((item) => {
        const temaCorrecto =
          filtroTema === "todos" ||
          item.topic === filtroTema;

        const resultadoCorrecto =
          filtroResultado === "todos" ||
          (filtroResultado === "correctos" &&
            item.correct) ||
          (filtroResultado === "errores" &&
            !item.correct);

        return temaCorrecto && resultadoCorrecto;
      }),
    [intentos, filtroTema, filtroResultado],
  );

  const recomendaciones = useMemo(() => {
    return (["fracciones", "ecuaciones"] as Tema[])
      .map((tema) => ({
        tema,
        errores: intentos.filter(
          (item) => item.topic === tema && !item.correct,
        ).length,
      }))
      .filter((item) => item.errores > 0)
      .sort(
        (a, b) =>
          b.errores - a.errores ||
          a.tema.localeCompare(b.tema),
      );
  }, [intentos]);

  return (
    <section
      className="mt-historial"
      aria-labelledby="mt-historial-titulo"
    >
      <div className="mt-historial-cabecera">
        <div>
          <span className="mt-historial-etiqueta">
            SEGUIMIENTO Y REFUERZO ACADÉMICO
          </span>

          <h2 id="mt-historial-titulo">
            Historial de ejercicios
          </h2>

          <p>
            Revisa tus respuestas y practica los temas
            que necesitan mayor refuerzo.
          </p>
        </div>

        <div className="mt-historial-total">
          {intentos.length} ejercicios recientes
        </div>
      </div>

      {cargando ? (
        <p role="status">
          Cargando tu historial...
        </p>
      ) : error ? (
        <p className="mt-historial-error" role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className="mt-historial-resumen">
            <div>
              <span>Respuestas correctas</span>
              <strong>{correctos}</strong>
            </div>

            <div>
              <span>Respuestas para repasar</span>
              <strong>{errores}</strong>
            </div>
          </div>

          <div className="mt-historial-repaso">
            <div>
              <span className="mt-historial-etiqueta">
                REPASO PERSONALIZADO
              </span>

              <h3>¿Qué deberías practicar ahora?</h3>

              <p>
                Priorizamos las materias con más errores
                entre tus ejercicios recientes.
              </p>
            </div>

            {recomendaciones.length > 0 ? (
              <div className="mt-historial-recomendaciones">
                {recomendaciones.map((item) => (
                  <div
                    className="mt-historial-recomendacion"
                    key={item.tema}
                  >
                    <div>
                      <strong>{nombreTema(item.tema)}</strong>
                      <small>
                        {item.errores}{" "}
                        {item.errores === 1
                          ? "respuesta para repasar"
                          : "respuestas para repasar"}
                      </small>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onPracticar(item.tema)
                      }
                    >
                      Repasar {nombreTema(item.tema)}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-historial-sugerencia">
                {intentos.length === 0
                  ? "Completa una evaluación para recibir recomendaciones de repaso."
                  : "No aparecen errores en estos ejercicios recientes. Puedes seguir practicando para consolidar tus conocimientos."}
              </p>
            )}
          </div>

          <div className="mt-historial-filtros">
            <div>
              <label htmlFor="mt-filtro-tema">
                Materia
              </label>

              <select
                id="mt-filtro-tema"
                value={filtroTema}
                onChange={(event) =>
                  setFiltroTema(
                    event.target.value as FiltroTema,
                  )
                }
              >
                <option value="todos">Todas</option>
                <option value="fracciones">
                  Fracciones
                </option>
                <option value="ecuaciones">
                  Ecuaciones
                </option>
              </select>
            </div>

            <div>
              <label htmlFor="mt-filtro-resultado">
                Resultado
              </label>

              <select
                id="mt-filtro-resultado"
                value={filtroResultado}
                onChange={(event) =>
                  setFiltroResultado(
                    event.target.value as FiltroResultado,
                  )
                }
              >
                <option value="todos">
                  Todos los resultados
                </option>
                <option value="correctos">
                  Correctos
                </option>
                <option value="errores">
                  Para repasar
                </option>
              </select>
            </div>
          </div>

          <p className="mt-historial-contador" role="status">
            Mostrando {filtrados.length} de{" "}
            {intentos.length} ejercicios
          </p>

          {filtrados.length === 0 ? (
            <p className="mt-historial-vacio">
              No hay ejercicios que coincidan
              con los filtros seleccionados.
            </p>
          ) : (
            <div className="mt-historial-lista">
              {filtrados.map((item) => (
                <article
                  className="mt-historial-item"
                  key={item.id}
                >
                  <div>
                    <span className="mt-historial-materia">
                      {nombreTema(item.topic)}
                    </span>

                    <h3>{item.question}</h3>

                    <small>
                      {new Date(
                        item.answered_at,
                      ).toLocaleString("es-PE")}
                    </small>
                  </div>

                  <span
                    className={
                      "mt-historial-estado " +
                      (item.correct
                        ? "mt-historial-correcto"
                        : "mt-historial-revisar")
                    }
                  >
                    {item.correct
                      ? "Correcto"
                      : "Necesita repaso"}
                  </span>
                  <OrientacionError intento={item} />
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-historial-nota">
        Los filtros y las recomendaciones utilizan
        hasta 100 ejercicios respondidos recientemente.
        La práctica adaptativa selecciona ejercicios
        según las evidencias académicas disponibles.
        Los resultados no constituyen una calificación
        definitiva.
      </p>
    </section>
  );
}
