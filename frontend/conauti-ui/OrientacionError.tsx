import { apiFetch } from './apiFetch'
import { useState } from "react";
import "./OrientacionError.css";

type Intento = {
  id: string;
  topic: string;
  question: string;
  correct: boolean;
};

type Respuesta = {
  orientation: string;
};

export default function OrientacionError({
  intento,
}: {
  intento: Intento;
}) {
  const [orientacion, setOrientacion] =
    useState("");

  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  if (intento.correct) return null;

  async function consultar() {
    if (ocupado) return;

    setOcupado(true);
    setError("");

    try {
      const token = sessionStorage.getItem(
        "conauti_token",
      );

      if (!token) {
        throw new Error(
          "Inicia sesión para continuar.",
        );
      }

      const response = await apiFetch(
        "/api/conauti/memory/assessment/review/" +
          encodeURIComponent(intento.id),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        let detalle = "";

        try {
          const data = await response.json();

          if (typeof data.detail === "string") {
            detalle = data.detail;
          }
        } catch {
          // Conservar el estado HTTP.
        }

        throw new Error(
          detalle ||
            `Error al consultar (${response.status}).`,
        );
      }

      const data = (
        await response.json()
      ) as Respuesta;

      if (!data.orientation?.trim()) {
        throw new Error(
          "Gemini no devolvió una orientación válida.",
        );
      }

      setOrientacion(data.orientation);

    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No fue posible consultar al tutor.",
      );

    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-error-coach">
      <button
        type="button"
        disabled={ocupado}
        onClick={() => void consultar()}
      >
        {ocupado
          ? "Consultando a Gemini..."
          : orientacion
            ? "Solicitar otra orientación"
            : "Ayúdame a entender este error"}
      </button>

      {orientacion && (
        <div
          className="mt-error-coach-respuesta"
          role="status"
        >
          <strong>
            Orientación de My Teacher IA
          </strong>

          <p>{orientacion}</p>

          <small>
            Usa esta pista para razonar.
            La inteligencia artificial puede equivocarse.
          </small>
        </div>
      )}

      {error && (
        <p
          className="mt-error-coach-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
