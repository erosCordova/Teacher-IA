import { useEffect, useMemo, useState } from "react";
import "./PlanAprendizaje.css";
import MemoriaAcademica from "./MemoriaAcademica";

type Tema = "fracciones" | "ecuaciones";

type Estilo =
  | "adaptativo"
  | "paso_a_paso"
  | "visual"
  | "ejemplos";

type Dificultad =
  | "adaptativa"
  | "basica"
  | "intermedia"
  | "avanzada";

type Perfil = {
  explanation_style: Estilo;
  difficulty: Dificultad;
  learning_goal: string;
};

type Indicadores = {
  attempts: number;
  correct: number;
  distinct_exercises: number;
  verified_level: number;
  level_note: string;
};

type Progreso = {
  topics: Record<Tema, Indicadores>;
};

type MemoriaTema = {
  topic: string;
  mastery: number;
  last_difficulty: string;
  next_goal: string;
  updated_at: string;
};

type Memoria = {
  topics: MemoriaTema[];
};

type Props = {
  revision: number;
  onPracticar: (tema: Tema) => void;
  onMemoryCleared: () => void;
};

const BASE = "/api/conauti/memory";

const INICIAL: Perfil = {
  explanation_style: "adaptativo",
  difficulty: "adaptativa",
  learning_goal: "",
};

const MATERIAS: Tema[] = [
  "fracciones",
  "ecuaciones",
];

async function consultar<T>(
  ruta: string,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("conauti_token");

  if (!token) {
    throw new Error(
      "Inicia sesión para consultar tu plan académico.",
    );
  }

  const respuesta = await fetch(BASE + ruta, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error(
        "Tu sesión ha caducado. Inicia sesión nuevamente.",
      );
    }

    let detalle = "";

    try {
      const contenido = await respuesta.json();

      if (typeof contenido.detail === "string") {
        detalle = contenido.detail;
      }
    } catch {
      // Utilizar el estado HTTP.
    }

    throw new Error(
      detalle ||
      `No se pudo consultar el servicio (HTTP ${respuesta.status}).`,
    );
  }

  return (await respuesta.json()) as T;
}

function nombreTema(tema: Tema) {
  return tema === "fracciones"
    ? "Fracciones"
    : "Ecuaciones";
}

export default function PlanAprendizaje({
  revision,
  onPracticar,
  onMemoryCleared,
}: Props) {
  const [perfil, setPerfil] = useState<Perfil>(INICIAL);
  const [progreso, setProgreso] =
    useState<Progreso | null>(null);
  const [memoria, setMemoria] =
    useState<MemoriaTema[]>([]);
  const [cargando, setCargando] = useState(true);
  const [revisionMemoria, setRevisionMemoria] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    consultar<Perfil>("/profile")
      .then((datos) => {
        if (activo) setPerfil(datos);
      })
      .catch((fallo: unknown) => {
        if (activo) {
          setError(
            fallo instanceof Error
              ? fallo.message
              : "No se pudo recuperar tu perfil.",
          );
        }
      });

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;

    Promise.all([
      consultar<Progreso>("/assessment/progress"),
      consultar<Memoria>("/topics?limit=40"),
    ])
      .then(([datosProgreso, datosMemoria]) => {
        if (!activo) return;

        setProgreso(datosProgreso);
        setMemoria(datosMemoria.topics);
        setError("");
      })
      .catch((fallo: unknown) => {
        if (activo) {
          setError(
            fallo instanceof Error
              ? fallo.message
              : "No se pudo actualizar el progreso.",
          );
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [revision, revisionMemoria]);

  const recomendaciones = useMemo(() => {
    return MATERIAS.map((tema) => {
      const estadisticas = progreso?.topics?.[tema];
      const intentos = estadisticas?.attempts ?? 0;
      const aciertos = estadisticas?.correct ?? 0;
      const distintos =
        estadisticas?.distinct_exercises ?? 0;

      const porcentaje = intentos
        ? Math.round((aciertos / intentos) * 100)
        : 0;

      const dificultades = memoria.filter((item) => {
        const texto = item.topic.toLowerCase();

        return (
          (texto.includes(tema) ||
            texto.includes(
              tema === "fracciones"
                ? "fracción"
                : "ecuación",
            )) &&
          item.last_difficulty.trim() !== ""
        );
      });

      const necesitaApoyo = dificultades.length > 0;

      let objetivo = "Realizar una práctica inicial.";
      let estado = "Sin evaluación todavía";
      let prioridad = 1;

      if (intentos > 0 && porcentaje < 65) {
        objetivo =
          "Reforzar conceptos con ejercicios básicos y pistas.";
        estado = "Necesita refuerzo";
        prioridad = 4;
      } else if (intentos >= 3 && porcentaje >= 85 &&
                 distintos >= 3) {
        objetivo =
          "Continuar con ejercicios de mayor dificultad.";
        estado = "Avance favorable";
        prioridad = 2;
      } else if (intentos > 0) {
        objetivo =
          "Consolidar lo aprendido con más ejercicios.";
        estado = "En práctica";
        prioridad = 3;
      }

      if (necesitaApoyo) {
        prioridad += 2;

        if (intentos === 0) {
          objetivo =
            "Comenzar por el tema en el que solicitaste ayuda.";
          estado = "Apoyo solicitado";
        }
      }

      return {
        tema,
        intentos,
        aciertos,
        porcentaje,
        objetivo,
        estado,
        prioridad,
        necesitaApoyo,
      };
    }).sort((a, b) =>
      b.prioridad - a.prioridad ||
      a.intentos - b.intentos,
    );
  }, [memoria, progreso]);

  const recomendado = recomendaciones[0];

  async function guardarPerfil() {
    if (guardando) return;

    setGuardando(true);
    setMensaje("");
    setError("");

    try {
      const normalizado: Perfil = {
        ...perfil,
        learning_goal: perfil.learning_goal.trim(),
      };

      await consultar<Perfil>("/profile", {
        method: "PUT",
        body: JSON.stringify(normalizado),
      });

      const confirmado =
        await consultar<Perfil>("/profile");

      if (
        confirmado.explanation_style !==
          normalizado.explanation_style ||
        confirmado.difficulty !==
          normalizado.difficulty ||
        confirmado.learning_goal !==
          normalizado.learning_goal
      ) {
        throw new Error(
          "El servidor no confirmó todos los cambios.",
        );
      }

      setPerfil(confirmado);

      setMensaje(
        "Perfil guardado y verificado en tu cuenta.",
      );
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo guardar tu perfil.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section
      className="mt-plan"
      aria-labelledby="mt-plan-title"
    >
      <div className="mt-plan-header">
        <div>
          <span className="mt-plan-eyebrow">
            MEMORIA ACADÉMICA
          </span>

          <h2 id="mt-plan-title">
            Tu plan de aprendizaje
          </h2>

          <p>
            Organiza tus próximos ejercicios de acuerdo
            con tus resultados y necesidades académicas.
          </p>
        </div>

        <span className="mt-plan-tag">
          Personalizado
        </span>
      </div>

      <div className="mt-plan-grid">
        <article className="mt-plan-panel">
          <h3>Mis preferencias para aprender</h3>

          <label htmlFor="mt-estilo">
            ¿Cómo prefieres las explicaciones?
          </label>

          <select
            id="mt-estilo"
            value={perfil.explanation_style}
            onChange={(event) =>
              setPerfil((prev) => ({
                ...prev,
                explanation_style:
                  event.target.value as Estilo,
              }))
            }
          >
            <option value="adaptativo">
              Adaptar según mis necesidades
            </option>
            <option value="paso_a_paso">
              Paso a paso
            </option>
            <option value="visual">
              Con ejemplos visuales
            </option>
            <option value="ejemplos">
              Con ejemplos prácticos
            </option>
          </select>

          <label htmlFor="mt-dificultad">
            Dificultad de las explicaciones
          </label>

          <select
            id="mt-dificultad"
            value={perfil.difficulty}
            onChange={(event) =>
              setPerfil((prev) => ({
                ...prev,
                difficulty:
                  event.target.value as Dificultad,
              }))
            }
          >
            <option value="adaptativa">
              Automática
            </option>
            <option value="basica">Básica</option>
            <option value="intermedia">
              Intermedia
            </option>
            <option value="avanzada">
              Avanzada
            </option>
          </select>

          <label htmlFor="mt-objetivo">
            Mi objetivo académico
          </label>

          <textarea
            id="mt-objetivo"
            rows={3}
            maxLength={160}
            value={perfil.learning_goal}
            placeholder="Ejemplo: quiero mejorar en matemáticas"
            onChange={(event) =>
              setPerfil((prev) => ({
                ...prev,
                learning_goal: event.target.value,
              }))
            }
          />

          <div className="mt-plan-save">
            <small>
              {perfil.learning_goal.length}/160
            </small>

            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardarPerfil()}
            >
              {guardando
                ? "Guardando..."
                : "Guardar mi perfil"}
            </button>
          </div>
        </article>

        <article className="mt-plan-panel">
          <h3>Próxima práctica recomendada</h3>

          {cargando ? (
            <p>Consultando tus resultados...</p>
          ) : recomendado ? (
            <>
              <div className="mt-plan-recomendacion">
                <span>Materia prioritaria</span>

                <strong>
                  {nombreTema(recomendado.tema)}
                </strong>

                <span className="mt-plan-estado">
                  {recomendado.estado}
                </span>
              </div>

              <p>{recomendado.objetivo}</p>

              <div className="mt-plan-datos">
                <span>
                  Ejercicios: {recomendado.intentos}
                </span>

                <span>
                  Aciertos: {recomendado.porcentaje}%
                </span>
              </div>

              {recomendado.necesitaApoyo && (
                <p className="mt-plan-ayuda">
                  Registramos que solicitaste apoyo
                  en esta materia. Esto no significa
                  que hayas desaprobado.
                </p>
              )}

              <button
                type="button"
                className="mt-plan-practicar"
                onClick={() =>
                  onPracticar(recomendado.tema)
                }
              >
                Seleccionar esta materia
              </button>
            </>
          ) : (
            <p>
              Comienza una práctica para obtener
              recomendaciones.
            </p>
          )}

          <div className="mt-plan-pasos">
            <h4>Ruta de práctica sugerida</h4>

            <ol>
              <li>
                Intenta resolver el ejercicio antes
                de consultar una pista.
              </li>
              <li>
                Si tienes dificultades, utiliza
                las ayudas paso a paso.
              </li>
              <li>
                Revisa tus aciertos y continúa
                con una nueva pregunta.
              </li>
            </ol>
          </div>
        </article>
      </div>

      <p className="mt-plan-nota">
        Las recomendaciones utilizan tus respuestas
        verificadas y las dificultades que expresaste.
        No representan una calificación definitiva.
        Tus preferencias se guardan en PostgreSQL
        y pueden utilizarse en las explicaciones
        de My Teacher IA.
      </p>

      {mensaje && (
        <p
          className="mt-plan-success"
          role="status"
        >
          {mensaje}
        </p>
      )}

      {error && (
        <p
          className="mt-plan-error"
          role="alert"
        >
          {error}
        </p>
      )}
      <MemoriaAcademica
        onChanged={() =>
          setRevisionMemoria((actual) => actual + 1)
        }
        onCleared={() => {
          setPerfil(INICIAL);
          setRevisionMemoria((actual) => actual + 1);
          onMemoryCleared();
        }}
      />
    </section>
  );
}
