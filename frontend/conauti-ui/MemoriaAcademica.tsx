import { useEffect, useState } from "react";
import "./MemoriaAcademica.css";

type Recuerdo = {
  topic: string;
  mastery: number;
  last_difficulty: string;
  next_goal: string;
  updated_at: string;
};

type Perfil = {
  explanation_style: string;
  difficulty: string;
  learning_goal: string;
};

type Estadistica = {
  attempts: number;
  correct: number;
};

type Props = {
  onChanged: () => void;
  onCleared: () => void;
};

const BASE = "/api/conauti/memory";

async function solicitar<T>(
  ruta: string,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("conauti_token");

  if (!token) {
    throw new Error(
      "Debes iniciar sesión para administrar tu memoria.",
    );
  }

  const response = await fetch(BASE + ruta, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Tu sesión ha caducado. Inicia sesión nuevamente.",
      );
    }

    let detalle = "";

    try {
      const body = await response.json();

      if (typeof body.detail === "string") {
        detalle = body.detail;
      }
    } catch {
      // Mantener el error HTTP.
    }

    throw new Error(
      detalle || `Error HTTP ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export default function MemoriaAcademica({
  onChanged,
  onCleared,
}: Props) {
  const [recuerdos, setRecuerdos] = useState<Recuerdo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [exportando, setExportando] = useState(false);

  const [confirmarTema, setConfirmarTema] = useState("");
  const [confirmarTodo, setConfirmarTodo] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] =
    useState("");

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;

    solicitar<{ topics: Recuerdo[] }>("/topics?limit=100")
      .then((data) => {
        if (vigente) setRecuerdos(data.topics);
      })
      .catch((fallo: unknown) => {
        if (vigente) {
          setError(
            fallo instanceof Error
              ? fallo.message
              : "No se pudo consultar la memoria.",
          );
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  async function eliminarTema(tema: string) {
    if (ocupado) return;

    setOcupado(true);
    setError("");
    setMensaje("");

    try {
      await solicitar<{ deleted: number }>(
        `/topics/${encodeURIComponent(tema)}`,
        { method: "DELETE" },
      );

      const actualizado = await solicitar<{
        topics: Recuerdo[];
      }>("/topics?limit=100");

      if (
        actualizado.topics.some(
          (item) =>
            item.topic.toLocaleLowerCase() ===
            tema.toLocaleLowerCase(),
        )
      ) {
        throw new Error(
          "El servidor no confirmó la eliminación del tema.",
        );
      }

      setRecuerdos(actualizado.topics);
      setConfirmarTema("");
      setMensaje("Recuerdo académico eliminado.");
      onChanged();
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo eliminar el recuerdo.",
      );
    } finally {
      setOcupado(false);
    }
  }


  async function exportarDatos() {
    if (ocupado || exportando) return;

    setExportando(true);
    setError("");
    setMensaje("");

    try {
      const [perfil, temas, progreso, historial] =
        await Promise.all([
          solicitar<Perfil>("/profile"),
          solicitar<{ topics: Recuerdo[] }>(
            "/topics?limit=100",
          ),
          solicitar<{
            topics: Record<string, Estadistica>;
          }>("/assessment/progress"),
          solicitar<{
            items: {
              id: string;
              topic: string;
              question: string;
              correct: boolean;
              answered_at: string;
            }[];
          }>("/assessment/history?limit=100"),
        ]);

      const exportacion = {
        application: "My Teacher IA",
        export_version: 1,
        exported_at: new Date().toISOString(),
        learning_profile: perfil,
        academic_memory: temas.topics,
        evaluation_summary: progreso.topics,
        recent_assessment_history: historial.items,
        history_limit: 100,
        notice:
          "Historial limitado a los últimos 100 intentos. " +
          "No incluye conversaciones ni credenciales.",
      };

      const contenido = new Blob(
        [JSON.stringify(exportacion, null, 2)],
        {
          type: "application/json;charset=utf-8",
        },
      );

      const url = URL.createObjectURL(contenido);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download =
        "my-teacher-datos-academicos-" +
        new Date().toISOString().slice(0, 10) +
        ".json";

      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      window.setTimeout(
        () => URL.revokeObjectURL(url),
        1500,
      );

      setMensaje(
        "Se ha preparado la exportación de tus datos académicos.",
      );
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No fue posible exportar tus datos.",
      );
    } finally {
      setExportando(false);
    }
  }

  async function eliminarTodo() {
    if (ocupado || textoConfirmacion !== "BORRAR") {
      return;
    }

    setOcupado(true);
    setError("");
    setMensaje("");

    try {
      const resultado = await solicitar<{
        memory_deleted: boolean;
        conversations_deleted: boolean;
      }>("/all", { method: "DELETE" });

      if (
        !resultado.memory_deleted ||
        resultado.conversations_deleted !== false
      ) {
        throw new Error(
          "La operación no confirmó la conservación " +
          "de las conversaciones.",
        );
      }

      const [temas, perfil, progreso] = await Promise.all([
        solicitar<{ topics: Recuerdo[] }>("/topics?limit=100"),
        solicitar<Perfil>("/profile"),
        solicitar<{
          topics: Record<string, Estadistica>;
        }>("/assessment/progress"),
      ]);

      const sinEvaluaciones = Object.values(
        progreso.topics,
      ).every((item) => item.attempts === 0);

      if (
        temas.topics.length !== 0 ||
        perfil.learning_goal !== "" ||
        !sinEvaluaciones
      ) {
        throw new Error(
          "La eliminación se ejecutó, pero la verificación " +
          "de todos los datos no fue satisfactoria.",
        );
      }

      setRecuerdos([]);
      setConfirmarTodo(false);
      setTextoConfirmacion("");
      setConfirmarTema("");

      onCleared();

      setMensaje(
        "Memoria académica eliminada y verificada. " +
        "Tus conversaciones se han conservado.",
      );
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo completar la eliminación.",
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section
      className="mt-memoria"
      aria-labelledby="mt-memoria-titulo"
    >
      <div className="mt-memoria-header">
        <div>
          <span className="mt-memoria-etiqueta">
            PRIVACIDAD Y MEMORIA
          </span>

          <h3 id="mt-memoria-titulo">
            Lo que My Teacher IA recuerda de mí
          </h3>

          <p>
            Puedes revisar y eliminar tus recuerdos
            académicos cuando lo necesites.
          </p>
        </div>

        <span className="mt-memoria-cantidad">
          {recuerdos.length} temas
        </span>
      </div>

      {cargando ? (
        <p>Consultando tus recuerdos académicos...</p>
      ) : recuerdos.length === 0 ? (
        <p className="mt-memoria-vacio">
          Todavía no hay dificultades o temas registrados
          en tu memoria académica.
        </p>
      ) : (
        <div className="mt-memoria-lista">
          {recuerdos.map((item) => (
            <article
              key={item.topic}
              className="mt-memoria-tema"
            >
              <div className="mt-memoria-contenido">
                <strong>{item.topic}</strong>

                {item.last_difficulty && (
                  <p>
                    <b>Necesita apoyo:</b>{" "}
                    {item.last_difficulty}
                  </p>
                )}

                {item.next_goal && (
                  <p>
                    <b>Próximo objetivo:</b>{" "}
                    {item.next_goal}
                  </p>
                )}

                <small>
                  El nivel registrado es orientativo;
                  no certifica dominio académico.
                </small>
              </div>

              <div className="mt-memoria-acciones">
                {confirmarTema === item.topic ? (
                  <>
                    <button
                      type="button"
                      className="mt-memoria-eliminar"
                      disabled={ocupado}
                      onClick={() =>
                        void eliminarTema(item.topic)
                      }
                    >
                      Confirmar eliminación
                    </button>

                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => setConfirmarTema("")}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() =>
                      setConfirmarTema(item.topic)
                    }
                  >
                    Eliminar recuerdo
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-memoria-exportacion">
        <div>
          <h4>Exportar mis datos académicos</h4>
          <p>
            Obtén una copia JSON de tu perfil, recuerdos,
            estadísticas y hasta 100 ejercicios recientes.
            No incluye contraseñas ni conversaciones.
          </p>
        </div>

        <button
          type="button"
          disabled={ocupado || exportando}
          onClick={() => void exportarDatos()}
        >
          {exportando
            ? "Preparando..."
            : "Exportar mis datos"}
        </button>
      </div>

      <div className="mt-memoria-privacidad">
        <h4>Borrar toda mi memoria académica</h4>

        <p>
          Se eliminarán tus preferencias de aprendizaje,
          objetivos, dificultades y evaluaciones guardadas.
          El historial de conversaciones se conservará.
        </p>

        {!confirmarTodo ? (
          <button
            type="button"
            className="mt-memoria-eliminar"
            disabled={ocupado}
            onClick={() => {
              setConfirmarTodo(true);
              setMensaje("");
              setError("");
            }}
          >
            Solicitar eliminación completa
          </button>
        ) : (
          <div className="mt-memoria-confirmacion">
            <label htmlFor="mt-confirmacion-borrado">
              Escribe <strong>BORRAR</strong> para confirmar:
            </label>

            <input
              id="mt-confirmacion-borrado"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={textoConfirmacion}
              onChange={(event) =>
                setTextoConfirmacion(event.target.value)
              }
            />

            <div className="mt-memoria-botones">
              <button
                type="button"
                className="mt-memoria-eliminar"
                disabled={
                  ocupado || textoConfirmacion !== "BORRAR"
                }
                onClick={() => void eliminarTodo()}
              >
                {ocupado
                  ? "Eliminando..."
                  : "Eliminar definitivamente"}
              </button>

              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  setConfirmarTodo(false);
                  setTextoConfirmacion("");
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {mensaje && (
        <p className="mt-memoria-exito" role="status">
          {mensaje}
        </p>
      )}

      {error && (
        <p className="mt-memoria-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
