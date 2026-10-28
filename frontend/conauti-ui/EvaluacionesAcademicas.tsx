import { apiFetch } from './apiFetch'
import SimulacroAcademico from "./SimulacroAcademico";
import { useEffect, useState } from "react";
import "./EvaluacionesAcademicas.css";
import HistorialEvaluaciones from "./HistorialEvaluaciones";
import AnaliticaAcademica from "./AnaliticaAcademica";
import PlanAprendizaje from "./PlanAprendizaje";

type Tema = "fracciones" | "ecuaciones";
type Opcion = "A" | "B" | "C" | "D";

type Estadisticas = {
  attempts: number;
  correct: number;
  distinct_exercises: number;
  verified_level: number;
  level_note: string;
};

type Ejercicio = {
  attempt_id: string;
  topic: Tema;
  question: string;
  difficulty?: string;
  options: Record<Opcion, string>;
  progress: Estadisticas;
};

type Resultado = {
  correct: boolean;
  feedback: string;
  progress: Estadisticas;
};

type Progreso = {
  topics: Record<Tema, Estadisticas>;
};

const API = "/api/conauti/memory/assessment";
const OPCIONES: Opcion[] = ["A", "B", "C", "D"];

async function api<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("conauti_token");

  if (!token) {
    throw new Error(
      "Inicia sesión para acceder a tus evaluaciones.",
    );
  }

  const respuesta = await apiFetch(API + ruta, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opciones.headers,
    },
  });

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error(
        "La sesión ha caducado. Vuelve a iniciar sesión.",
      );
    }

    let detalle = "";

    try {
      const contenido = await respuesta.json();
      if (typeof contenido.detail === "string") {
        detalle = contenido.detail;
      }
    } catch {
      // Utilizar el mensaje HTTP genérico.
    }

    throw new Error(
      detalle || `Error de servidor: ${respuesta.status}`,
    );
  }

  return (await respuesta.json()) as T;
}

function etiquetaNivel(nivel: number): string {
  if (nivel >= 2) return "Evidencias favorables";
  if (nivel === 1) return "En desarrollo";
  return "Evaluación inicial";
}

export default function EvaluacionesAcademicas() {
  const [tema, setTema] = useState<Tema>("fracciones");
  const [progreso, setProgreso] = useState<Progreso | null>(
    null,
  );
  const [ejercicio, setEjercicio] =
    useState<Ejercicio | null>(null);
  const [opcion, setOpcion] = useState<Opcion | null>(null);
  const [resultado, setResultado] =
    useState<Resultado | null>(null);
  // MYTEACHER_ADAPTIVE_V1
  const [pista, setPista] = useState("");
  const [nivelPista, setNivelPista] = useState(0);

  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [revisionPlan, setRevisionPlan] = useState(0);

  // MYTEACHER_PROGRESS_TABS_V1
  type SeccionProgreso =
    | "practica"
    | "analitica"
    | "historial"
    | "plan";

  const [seccion, setSeccion] =
    useState<SeccionProgreso>("practica");

  useEffect(() => {
    let activo = true;

    api<Progreso>("/progress")
      .then((datos) => {
        if (activo) setProgreso(datos);
      })
      .catch((fallo: unknown) => {
        if (activo) {
          setError(
            fallo instanceof Error
              ? fallo.message
              : "No se pudo cargar el progreso.",
          );
        }
      });

    return () => {
      activo = false;
    };
  }, []);

  async function refrescar() {
    const datos = await api<Progreso>("/progress");
    setProgreso(datos);
  }

  function seleccionarTema(valor: Tema) {
    if (procesando) return;

    setTema(valor);
    setEjercicio(null);
    setOpcion(null);
    setResultado(null);
    setPista("");
    setNivelPista(0);
    setError("");
  }

  async function comenzar() {
    if (procesando) return;

    setProcesando(true);
    setError("");
    setResultado(null);
    setPista("");
    setNivelPista(0);
    setOpcion(null);

    try {
      const datos = await api<Ejercicio>(
        `/adaptive/start?topic=${encodeURIComponent(tema)}`,
      );

      setEjercicio(datos);
      await refrescar();
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo iniciar la práctica.",
      );
    } finally {
      setProcesando(false);
    }
  }

  async function pedirPista() {
    if (
      !ejercicio ||
      resultado ||
      procesando ||
      nivelPista >= 2
    ) {
      return;
    }

    setProcesando(true);
    setError("");

    try {
      const datos = await api<{
        level: number;
        hint: string;
        remaining: number;
      }>(
        `/adaptive/${encodeURIComponent(
          ejercicio.attempt_id,
        )}/hint?level=${nivelPista + 1}`,
      );

      setPista(datos.hint);
      setNivelPista(datos.level);
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo recuperar la pista.",
      );
    } finally {
      setProcesando(false);
    }
  }

  async function comprobar() {
    if (!ejercicio || !opcion || resultado || procesando) {
      return;
    }

    setProcesando(true);
    setError("");

    try {
      const datos = await api<Resultado>(
        `/${encodeURIComponent(
          ejercicio.attempt_id,
        )}/answer`,
        {
          method: "POST",
          body: JSON.stringify({ option: opcion }),
        },
      );

      setResultado(datos);
      await refrescar();
      setRevisionPlan((valor) => valor + 1);
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo verificar la respuesta.",
      );
    } finally {
      setProcesando(false);
    }
  }

  const datos = progreso?.topics?.[tema];
  const intentos = datos?.attempts ?? 0;
  const aciertos = datos?.correct ?? 0;

  const porcentaje =
    intentos > 0
      ? Math.round((aciertos / intentos) * 100)
      : 0;

  return (
    <section
      className="myt-evaluaciones"
      aria-labelledby="myt-titulo-evaluacion"
    >
      <div className="myt-evaluaciones-header">
        <div>
          <span className="myt-etiqueta">
            APRENDIZAJE PERSONALIZADO
          </span>

          <h2 id="myt-titulo-evaluacion">
            Practica y demuestra lo aprendido
          </h2>

          <p>
            Resuelve ejercicios y observa tu progreso
            académico basado en evidencias.
          </p>
        </div>

        <span className="myt-distintivo">
          Evaluación guiada
        </span>
      </div>

      
      <div
        className="myt-pestanas"
        role="tablist"
        aria-label="Secciones de mi progreso"
      >
        {([
          ["practica", "Practicar"],
          ["analitica", "Estadísticas"],
          ["historial", "Historial"],
          ["plan", "Mi plan"],
        ] as const).map(([id, nombre]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`mt-tab-${id}`}
            aria-controls={`mt-contenido-${id}`}
            aria-selected={seccion === id}
            className={
              "myt-pestana " +
              (seccion === id
                ? "myt-pestana-activa"
                : "")
            }
            onClick={() => setSeccion(id)}
          >
            {nombre}
          </button>
        ))}
      </div>

      {seccion === "practica" && (
        <div
          className="myt-tabpanel"
          role="tabpanel"
          id="mt-contenido-practica"
          aria-labelledby="mt-tab-practica"
        >
<div
        className="myt-temas"
        role="group"
        aria-label="Seleccionar materia"
      >
        {(["fracciones", "ecuaciones"] as Tema[]).map(
          (valor) => (
            <button
              key={valor}
              type="button"
              disabled={procesando}
              aria-pressed={tema === valor}
              className={
                "myt-tema " +
                (tema === valor ? "myt-activo" : "")
              }
              onClick={() => seleccionarTema(valor)}
            >
              {valor === "fracciones"
                ? "Fracciones"
                : "Ecuaciones"}
            </button>
          ),
        )}
      </div>

      <div className="myt-estadisticas">
        <div className="myt-estadistica">
          <span>Ejercicios realizados</span>
          <strong>{intentos}</strong>
        </div>

        <div className="myt-estadistica">
          <span>Respuestas correctas</span>
          <strong>{aciertos}</strong>
        </div>

        <div className="myt-estadistica">
          <span>Porcentaje de aciertos</span>
          <strong>{porcentaje}%</strong>
        </div>
      </div>

      <div className="myt-progreso-evidencias">
        <div className="myt-progreso-titulos">
          <span>Indicador de aprendizaje</span>

          <strong>
            {etiquetaNivel(datos?.verified_level ?? 0)}
          </strong>
        </div>

        <div
          className="myt-barra"
          role="progressbar"
          aria-label="Porcentaje de respuestas correctas"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentaje}
        >
          <span style={{ width: `${porcentaje}%` }} />
        </div>

        <small>
          Este indicador no certifica el dominio completo
          de una materia.
        </small>
      </div>

      <div className="myt-area-practica">
        {!ejercicio ? (
          <div className="myt-bienvenida">
            <div className="myt-estrella" aria-hidden="true">
              ✦
            </div>

            <h3>¿Listo para practicar?</h3>

            <p>
              Selecciona un tema y responde a tu ritmo.
            </p>

            <button
              type="button"
              className="myt-boton-primario"
              disabled={procesando}
              onClick={() => void comenzar()}
            >
              {procesando
                ? "Preparando..."
                : "Comenzar práctica"}
            </button>
          </div>
        ) : (
          <div className="myt-pregunta">
            <div className="myt-pregunta-cabecera">
              <span>
                Ejercicio de nivel {ejercicio.difficulty ?? "básico"}
              </span>

              <span>
                {tema === "fracciones"
                  ? "Fracciones"
                  : "Ecuaciones"}
              </span>
            </div>

            <h3>{ejercicio.question}</h3>

            <div
              className="myt-opciones"
              role="group"
              aria-label="Opciones de respuesta"
            >
              {OPCIONES.map((letra) => (
                <button
                  key={letra}
                  type="button"
                  disabled={procesando || !!resultado}
                  aria-pressed={opcion === letra}
                  className={
                    "myt-opcion " +
                    (opcion === letra
                      ? "myt-opcion-activa"
                      : "")
                  }
                  onClick={() => setOpcion(letra)}
                >
                  <span className="myt-letra">
                    {letra}
                  </span>

                  {ejercicio.options[letra]}
                </button>
              ))}
            </div>

            {resultado && (
              <div
                role="status"
                className={
                  "myt-resultado " +
                  (resultado.correct
                    ? "myt-correcto"
                    : "myt-revisar")
                }
              >
                <strong>
                  {resultado.correct
                    ? "¡Buen trabajo!"
                    : "Sigamos practicando"}
                </strong>

                <p>{resultado.feedback}</p>
              </div>
            )}

            {!resultado && (
              <div className="myt-ayudas">
                <div className="myt-ayudas-titulo">
                  <strong>¿Necesitas orientación?</strong>
                  <span>Hasta dos pistas por ejercicio</span>
                </div>

                {pista && (
                  <div
                    className="myt-pista"
                    role="status"
                  >
                    <strong>Pista {nivelPista}</strong>
                    <p>{pista}</p>
                  </div>
                )}

                <button
                  type="button"
                  className="myt-boton-pista"
                  disabled={procesando || nivelPista >= 2}
                  onClick={() => void pedirPista()}
                >
                  {nivelPista === 0
                    ? "Dame una pista"
                    : nivelPista === 1
                      ? "Necesito otra pista"
                      : "Ya utilizaste las dos pistas"}
                </button>
              </div>
            )}

            <div className="myt-acciones">
              {resultado ? (
                <button
                  type="button"
                  className="myt-boton-primario"
                  disabled={procesando}
                  onClick={() => void comenzar()}
                >
                  Siguiente ejercicio
                </button>
              ) : (
                <button
                  type="button"
                  className="myt-boton-primario"
                  disabled={!opcion || procesando}
                  onClick={() => void comprobar()}
                >
                  {procesando
                    ? "Verificando..."
                    : "Comprobar respuesta"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="myt-error" role="alert">
          {error}
        </div>
      )}
      
        
  <SimulacroAcademico
    onProgress={() => {
      setRevisionPlan((actual) => actual + 1);
      void refrescar().catch(() => undefined);
    }}
  />
</div>
      )}

      {seccion === "analitica" && (
        <div
          className="myt-tabpanel"
          role="tabpanel"
          id="mt-contenido-analitica"
          aria-labelledby="mt-tab-analitica"
        >
<AnaliticaAcademica
  revision={revisionPlan}
  onPracticar={(tema) => {
    seleccionarTema(tema);
    setSeccion("practica");
  }}
/>
        </div>
      )}

      
      {seccion === "historial" && (
        <div
          className="myt-tabpanel"
          role="tabpanel"
          id="mt-contenido-historial"
          aria-labelledby="mt-tab-historial"
        >

<HistorialEvaluaciones
  revision={revisionPlan}
  onPracticar={(tema) => {
    seleccionarTema(tema);
    setSeccion("practica");
  }}
/>
        </div>
      )}

      
      {seccion === "plan" && (
        <div
          className="myt-tabpanel"
          role="tabpanel"
          id="mt-contenido-plan"
          aria-labelledby="mt-tab-plan"
        >
<PlanAprendizaje
        revision={revisionPlan}
        onPracticar={(nuevoTema) => {
          seleccionarTema(nuevoTema);
          setSeccion("practica");
        }}
        onMemoryCleared={() => {
          setEjercicio(null);
          setOpcion(null);
          setResultado(null);
          setPista("");
          setNivelPista(0);
          setRevisionPlan((actual) => actual + 1);
          void refrescar().catch((fallo: unknown) => {
            setError(
              fallo instanceof Error
                ? fallo.message
                : "No se pudo actualizar el progreso.",
            );
          });
        }}
      />
        </div>
      )}

    </section>
  );
}
