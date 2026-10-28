import { apiFetch } from './apiFetch'
import { useMemo, useRef, useState } from "react";
import "./SimulacroAcademico.css";

type Tema = "fracciones" | "ecuaciones";

type Ejercicio = {
  attempt_id: string;
  topic?: string;
  question: string;
  difficulty?: string;
  options: Record<string, string> | string[];
};

type Correccion = {
  correct: boolean;
  feedback?: string;
};

type Pista = {
  hint: string;
  level?: number;
};

// MYTEACHER_SIMULACRO_REVIEW_V1
type Revision = {
  numero: number;
  pregunta: string;
  claveSeleccionada: string;
  opcionSeleccionada: string;
  correcta: boolean;
  feedback: string;
  pistasUtilizadas: number;
};

type Etapa =
  | "inicio"
  | "pregunta"
  | "respondida"
  | "resumen";

type Props = {
  onProgress?: () => void;
  onFinished?: () => void;
};

const TOTAL = 5;
const BASE = "/api/conauti/memory/assessment";

async function solicitar<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("conauti_token");

  if (!token) {
    throw new Error(
      "Inicia sesión para comenzar el simulacro.",
    );
  }

  const respuesta = await apiFetch(BASE + ruta, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token}`,
      ...opciones.headers,
    },
  });

  if (!respuesta.ok) {
    let detalle = "";

    try {
      const cuerpo = await respuesta.json();

      if (typeof cuerpo.detail === "string") {
        detalle = cuerpo.detail;
      }
    } catch {
      // Mantener el error HTTP.
    }

    throw new Error(
      detalle ||
        (
          respuesta.status === 401
            ? "Tu sesión ha caducado."
            : `Error del servidor (${respuesta.status}).`
        ),
    );
  }

  return (await respuesta.json()) as T;
}

export default function SimulacroAcademico({
  onProgress,
  onFinished,
}: Props) {
  const [tema, setTema] = useState<Tema>("fracciones");
  const [etapa, setEtapa] = useState<Etapa>("inicio");

  const [ejercicio, setEjercicio] =
    useState<Ejercicio | null>(null);

  const [opcion, setOpcion] = useState("");

  const [completados, setCompletados] = useState(0);
  const [aciertos, setAciertos] = useState(0);

  const [correccion, setCorreccion] =
    useState<Correccion | null>(null);

  const [nivelPista, setNivelPista] = useState(0);
  const [pistas, setPistas] = useState<string[]>([]);
  const [revisiones, setRevisiones] =
    useState<Revision[]>([]);

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  const bloqueado = useRef(false);

  const opciones = useMemo(() => {
    if (!ejercicio) return [];

    if (Array.isArray(ejercicio.options)) {
      return ejercicio.options.map((texto, indice) => ({
        clave: String.fromCharCode(65 + indice),
        texto: String(texto),
      }));
    }

    if (
      ejercicio.options &&
      typeof ejercicio.options === "object"
    ) {
      return Object.entries(ejercicio.options).map(
        ([clave, texto]) => ({
          clave,
          texto: String(texto),
        }),
      );
    }

    return [];
  }, [ejercicio]);

  async function cargarEjercicio(nuevoTema: Tema) {
    if (bloqueado.current) return;

    bloqueado.current = true;
    setOcupado(true);
    setError("");

    try {
      const datos = await solicitar<Ejercicio>(
        `/adaptive/start?topic=${encodeURIComponent(nuevoTema)}`,
      );

      if (
        !datos.attempt_id ||
        !datos.question ||
        !datos.options ||
        typeof datos.options !== "object"
      ) {
        throw new Error(
          "El servidor devolvió un ejercicio incompleto.",
        );
      }

      const cantidad = Array.isArray(datos.options)
        ? datos.options.length
        : Object.keys(datos.options).length;

      if (cantidad < 2 || cantidad > 8) {
        throw new Error(
          "Las opciones del ejercicio son inválidas.",
        );
      }

      setEjercicio(datos);
      setOpcion("");
      setCorreccion(null);
      setPistas([]);
      setNivelPista(0);
      setEtapa("pregunta");
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo cargar el ejercicio.",
      );
    } finally {
      bloqueado.current = false;
      setOcupado(false);
    }
  }

  function comenzar() {
    if (bloqueado.current) return;

    setCompletados(0);
    setAciertos(0);
    setRevisiones([]);
    setEjercicio(null);
    setCorreccion(null);
    setError("");

    void cargarEjercicio(tema);
  }

  async function pedirPista() {
    if (
      bloqueado.current ||
      !ejercicio ||
      etapa !== "pregunta" ||
      nivelPista >= 2
    ) {
      return;
    }

    bloqueado.current = true;
    setOcupado(true);
    setError("");

    const siguienteNivel = nivelPista + 1;

    try {
      const datos = await solicitar<Pista>(
        `/adaptive/${encodeURIComponent(
          ejercicio.attempt_id,
        )}/hint?level=${siguienteNivel}`,
      );

      if (!datos.hint?.trim()) {
        throw new Error(
          "No se recibió una pista válida.",
        );
      }

      setPistas((actual) => [
        ...actual,
        datos.hint,
      ]);

      setNivelPista(siguienteNivel);
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo obtener la pista.",
      );
    } finally {
      bloqueado.current = false;
      setOcupado(false);
    }
  }

  async function comprobar() {
    if (
      bloqueado.current ||
      !ejercicio ||
      !opcion ||
      etapa !== "pregunta"
    ) {
      return;
    }

    bloqueado.current = true;
    setOcupado(true);
    setError("");

    try {
      const datos = await solicitar<Correccion>(
        `/${encodeURIComponent(
          ejercicio.attempt_id,
        )}/answer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            option: opcion,
          }),
        },
      );

      if (typeof datos.correct !== "boolean") {
        throw new Error(
          "El servidor no confirmó la corrección.",
        );
      }

      const siguienteCantidad = completados + 1;

      setCompletados(siguienteCantidad);

      if (datos.correct) {
        setAciertos((actual) => actual + 1);
      }

      const seleccionada = opciones.find(
        (item) => item.clave === opcion,
      );

      setRevisiones((actual) => [
        ...actual,
        {
          numero: siguienteCantidad,
          pregunta: ejercicio.question,
          claveSeleccionada: opcion,
          opcionSeleccionada:
            seleccionada?.texto ?? opcion,
          correcta: datos.correct,
          feedback:
            typeof datos.feedback === "string" &&
            datos.feedback.trim()
              ? datos.feedback
              : datos.correct
                ? "Respuesta registrada correctamente."
                : "Repasa el procedimiento con nuevas pistas.",
          pistasUtilizadas: nivelPista,
        },
      ]);

      setCorreccion(datos);
      setEtapa("respondida");

      // La respuesta ya quedó registrada en el servidor.
      // Refrescar las estadísticas aunque el estudiante
      // abandone el simulacro antes de la quinta pregunta.
      onProgress?.();

      if (siguienteCantidad === TOTAL) {
        onFinished?.();
      }
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo comprobar la respuesta.",
      );
    } finally {
      bloqueado.current = false;
      setOcupado(false);
    }
  }

  function continuar() {
    if (completados >= TOTAL) {
      setEtapa("resumen");
      return;
    }

    void cargarEjercicio(tema);
  }

  function cancelar() {
    if (bloqueado.current) return;

    setEtapa("inicio");
    setEjercicio(null);
    setOpcion("");
    setCorreccion(null);
    setPistas([]);
    setNivelPista(0);
    setCompletados(0);
    setAciertos(0);
    setRevisiones([]);
    setError("");
  }

  return (
    <section
      className="mt-simulacro"
      aria-labelledby="mt-simulacro-titulo"
    >
      <header className="mt-simulacro-cabecera">
        <div>
          <span className="mt-simulacro-etiqueta">
            PRÁCTICA GUIADA
          </span>

          <h3 id="mt-simulacro-titulo">
            Simulacro adaptativo
          </h3>

          <p>
            Cinco ejercicios consecutivos con dificultad
            adaptada por My Teacher IA.
          </p>
        </div>

        <span className="mt-simulacro-meta">
          5 ejercicios
        </span>
      </header>

      {etapa === "inicio" && (
        <div className="mt-simulacro-inicio">
          <label htmlFor="mt-simulacro-tema">
            Elige una materia
          </label>

          <select
            id="mt-simulacro-tema"
            value={tema}
            disabled={ocupado}
            onChange={(evento) =>
              setTema(evento.target.value as Tema)
            }
          >
            <option value="fracciones">
              Fracciones
            </option>
            <option value="ecuaciones">
              Ecuaciones
            </option>
          </select>

          <p>
            Puedes solicitar hasta dos pistas por
            ejercicio. Las respuestas se registran
            cuando las compruebas; si interrumpes
            el simulacro, los ejercicios ya respondidos
            permanecerán en tu historial.
          </p>

          <button
            type="button"
            className="mt-simulacro-principal"
            data-testid="mt-simulacro-start"
            disabled={ocupado}
            onClick={comenzar}
          >
            {ocupado
              ? "Preparando simulacro..."
              : "Iniciar simulacro"}
          </button>
        </div>
      )}

      {(etapa === "pregunta" ||
        etapa === "respondida") &&
        ejercicio && (
          <div className="mt-simulacro-ejercicio">
            <div className="mt-simulacro-estado">
              <strong>
                Ejercicio {completados +
                  (etapa === "pregunta" ? 1 : 0)}
                {" "}de {TOTAL}
              </strong>

              <span>
                {ejercicio.difficulty || "Adaptativo"}
              </span>
            </div>

            <div
              className="mt-simulacro-progreso"
              role="progressbar"
              aria-label="Ejercicios completados"
              aria-valuemin={0}
              aria-valuemax={TOTAL}
              aria-valuenow={completados}
            >
              <div
                style={{
                  width: `${
                    (completados / TOTAL) * 100
                  }%`,
                }}
              />
            </div>

            <h4>{ejercicio.question}</h4>

            <div className="mt-simulacro-opciones">
              {opciones.map((item) => (
                <button
                  key={item.clave}
                  type="button"
                  data-testid={
                    `mt-simulacro-answer-${item.clave.toLowerCase()}`
                  }
                  aria-pressed={opcion === item.clave}
                  disabled={
                    ocupado ||
                    etapa === "respondida"
                  }
                  className={
                    opcion === item.clave
                      ? "mt-simulacro-elegida"
                      : ""
                  }
                  onClick={() =>
                    setOpcion(item.clave)
                  }
                >
                  <strong>{item.clave}.</strong>{" "}
                  {item.texto}
                </button>
              ))}
            </div>

            {etapa === "pregunta" && (
              <>
                <div className="mt-simulacro-pistas">
                  <button
                    type="button"
                    data-testid="mt-simulacro-hint"
                    disabled={
                      ocupado || nivelPista >= 2
                    }
                    onClick={() => void pedirPista()}
                  >
                    {nivelPista < 2
                      ? `Solicitar pista ${nivelPista + 1}`
                      : "Pistas utilizadas"}
                  </button>

                  <span>
                    {nivelPista}/2 pistas
                  </span>
                </div>

                {pistas.map((pista, indice) => (
                  <p
                    className="mt-simulacro-pista"
                    key={indice}
                  >
                    <strong>
                      Pista {indice + 1}:
                    </strong>{" "}
                    {pista}
                  </p>
                ))}

                <button
                  type="button"
                  className="mt-simulacro-principal"
                  data-testid="mt-simulacro-confirm"
                  disabled={ocupado || !opcion}
                  onClick={() => void comprobar()}
                >
                  {ocupado
                    ? "Comprobando..."
                    : "Comprobar respuesta"}
                </button>
              </>
            )}

            {etapa === "respondida" && correccion && (
              <div
                className="mt-simulacro-correccion"
                role="status"
              >
                <strong>
                  {correccion.correct
                    ? "¡Respuesta correcta!"
                    : "Esta respuesta necesita repaso"}
                </strong>

                {correccion.feedback && (
                  <p>{correccion.feedback}</p>
                )}

                <button
                  type="button"
                  className="mt-simulacro-principal"
                  data-testid="mt-simulacro-next"
                  onClick={continuar}
                  disabled={ocupado}
                >
                  {completados >= TOTAL
                    ? "Ver resumen"
                    : "Siguiente ejercicio"}
                </button>
              </div>
            )}
          </div>
        )}

      {etapa === "resumen" && (
        <div
          className="mt-simulacro-resumen"
          data-testid="mt-simulacro-summary"
        >
          <h4>Simulacro completado</h4>

          <strong className="mt-simulacro-puntuacion">
            {aciertos}/{TOTAL}
          </strong>

          <p>
            Respuestas correctas: {aciertos}.
            Respuestas para repasar: {TOTAL - aciertos}.
          </p>

          <p>
            Los resultados ya se han registrado en tu
            historial académico. Puedes revisar tus
            estadísticas y volver a practicar.
          </p>

          <div className="mt-simulacro-revision">
            <h5>Revisión de tus cinco respuestas</h5>

            <p>
              Observa qué razonamientos conviene
              reforzar. Puedes volver a practicar
              sin recibir anticipadamente las
              soluciones de nuevos ejercicios.
            </p>

            <ol
              className="mt-simulacro-revision-lista"
              data-testid="mt-simulacro-review"
            >
              {revisiones.map((item) => (
                <li
                  key={item.numero}
                  className="mt-simulacro-revision-item"
                >
                  <div className="mt-simulacro-revision-cabecera">
                    <strong>
                      Ejercicio {item.numero}
                    </strong>

                    <span
                      className={
                        item.correcta
                          ? "mt-simulacro-revision-correcta"
                          : "mt-simulacro-revision-repaso"
                      }
                    >
                      {item.correcta
                        ? "Correcto"
                        : "Necesita repaso"}
                    </span>
                  </div>

                  <p>{item.pregunta}</p>

                  <p>
                    <strong>Tu respuesta:</strong>{" "}
                    {item.claveSeleccionada}.{" "}
                    {item.opcionSeleccionada}
                  </p>

                  <p>
                    <strong>Orientación:</strong>{" "}
                    {item.feedback}
                  </p>

                  <small>
                    Pistas utilizadas:{" "}
                    {item.pistasUtilizadas}
                  </small>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            className="mt-simulacro-principal"
            onClick={cancelar}
          >
            Preparar otro simulacro
          </button>
        </div>
      )}

      {(etapa === "pregunta" ||
        etapa === "respondida") && (
        <button
          type="button"
          className="mt-simulacro-cancelar"
          disabled={ocupado}
          onClick={cancelar}
        >
          Terminar sesión
        </button>
      )}

      {error && (
        <p className="mt-simulacro-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
