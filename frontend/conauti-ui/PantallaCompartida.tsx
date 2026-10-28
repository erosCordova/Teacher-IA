import { useEffect, useRef, useState } from "react";
import "./PantallaCompartida.css";
import { validarImagen, dimensionesImagen, LIMITE_ENVIO } from "./ImagenEducativa";

type Resultado = {
  analysis: string;
  provider: string;
  image_stored: boolean;
  automatic_capture: boolean;
};

export default function PantallaCompartida() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [compartiendo, setCompartiendo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [respuesta, setRespuesta] = useState("");
  const [pregunta, setPregunta] = useState("");
  // MYTEACHER_IMAGE_UPLOAD_V1
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaArchivo, setVistaArchivo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!archivo) {
      setVistaArchivo("");
      return;
    }

    const url = URL.createObjectURL(archivo);
    setVistaArchivo(url);

    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  function seleccionarArchivo(nuevo?: File) {
    if (!nuevo || analizando) return;

    try {
      validarImagen(nuevo);

      if (streamRef.current) detener();

      setArchivo(nuevo);
      setRespuesta("");
      setError("");
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo seleccionar la imagen.",
      );
    }
  }

  function detener() {
    const stream = streamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCompartiendo(false);
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(
        (track) => track.stop(),
      );

      streamRef.current = null;
    };
  }, []);

  async function comenzar() {
    setError("");
    setRespuesta("");

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia
        !== "function"
    ) {
      setError(
        "Tu navegador no permite compartir pantalla.",
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: 2,
          },
          audio: false,
        });

      streamRef.current = stream;
      setArchivo(null);

      const track = stream.getVideoTracks()[0];

      if (!track) {
        detener();
        throw new Error(
          "No se recibió una fuente de video.",
        );
      }

      track.addEventListener(
        "ended",
        () => {
          streamRef.current = null;
          setCompartiendo(false);
        },
        { once: true },
      );

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await videoRef.current.play();
      }

      setCompartiendo(true);
    } catch (fallo: unknown) {
      detener();

      if (
        fallo instanceof DOMException &&
        fallo.name === "NotAllowedError"
      ) {
        setError(
          "Se canceló o rechazó el permiso de pantalla.",
        );
      } else {
        setError(
          fallo instanceof Error
            ? fallo.message
            : "No se pudo compartir la pantalla.",
        );
      }
    }
  }

  async function analizar() {
    if (
      (!compartiendo && !archivo) ||
      analizando
    ) {
      return;
    }

    setAnalizando(true);
    setError("");
    setRespuesta("");

    try {
      const token = sessionStorage.getItem(
        "conauti_token",
      );

      if (!token) {
        throw new Error(
          "Inicia sesión para analizar la pantalla.",
        );
      }

      let fuente: CanvasImageSource;
      let ancho: number;
      let alto: number;
      let bitmap: ImageBitmap | null = null;

      if (archivo) {
        validarImagen(archivo);

        if (typeof createImageBitmap !== "function") {
          throw new Error(
            "Tu navegador no permite procesar esta imagen.",
          );
        }

        bitmap = await createImageBitmap(archivo);

        if (
          !bitmap.width ||
          !bitmap.height ||
          bitmap.width * bitmap.height > 40_000_000
        ) {
          bitmap.close();
          throw new Error(
            "La resolución de la imagen es demasiado grande.",
          );
        }

        fuente = bitmap;
        ancho = bitmap.width;
        alto = bitmap.height;
      } else {
        const video = videoRef.current;

        if (
          !video ||
          !streamRef.current ||
          !video.videoWidth ||
          !video.videoHeight
        ) {
          throw new Error(
            "La pantalla todavía no está preparada.",
          );
        }

        fuente = video;
        ancho = video.videoWidth;
        alto = video.videoHeight;
      }

      let canvas: HTMLCanvasElement;

      try {
        const medidas = dimensionesImagen(ancho, alto);

        canvas = document.createElement("canvas");
        canvas.width = medidas.ancho;
        canvas.height = medidas.alto;

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error(
            "No se pudo preparar la imagen.",
          );
        }

        context.fillStyle = "#ffffff";
        context.fillRect(
          0, 0, canvas.width, canvas.height,
        );

        context.drawImage(
          fuente,
          0, 0,
          canvas.width, canvas.height,
        );
      } finally {
        bitmap?.close();
      }

      const image = await new Promise<Blob | null>(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.72,
          );
        },
      );

      if (!image) {
        throw new Error(
          "No se pudo crear la imagen.",
        );
      }

      if (image.size > LIMITE_ENVIO) {
        throw new Error(
          "La captura es demasiado grande.",
        );
      }

      const parametros = new URLSearchParams();

      if (pregunta.trim()) {
        parametros.set("question", pregunta.trim());
      }

      const url =
        "/api/conauti/screen/analyze" +
        (parametros.toString()
          ? "?" + parametros.toString()
          : "");

      const response = await fetch(
        url,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "image/jpeg",
          },
          body: image,
        },
      );

      if (!response.ok) {
        let detail = "";

        try {
          const body = await response.json();

          if (typeof body.detail === "string") {
            detail = body.detail;
          }
        } catch {
          // Utilizar un mensaje de error general.
        }

        throw new Error(
          detail ||
          `No se pudo analizar la pantalla (${response.status}).`,
        );
      }

      const result =
        (await response.json()) as Resultado;

      if (!result.analysis?.trim()) {
        throw new Error(
          "Gemini no devolvió una explicación.",
        );
      }

      setRespuesta(result.analysis);
    } catch (fallo: unknown) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "Ocurrió un error analizando la pantalla.",
      );
    } finally {
      setAnalizando(false);
    }
  }

  return (
    <section
      className="mt-pantalla"
      aria-labelledby="mt-pantalla-title"
    >
      <div className="mt-pantalla-header">
        <div>
          <span className="mt-pantalla-etiqueta">
            ASISTENCIA VISUAL
          </span>

          <h3 id="mt-pantalla-title">
            Compartir mi pantalla
          </h3>

          <p>
            Muéstrale a My Teacher IA lo que estás
            estudiando para recibir orientación.
          </p>
        </div>

        <span className="mt-pantalla-indicador">
          {compartiendo
            ? "Pantalla compartida"
            : "Compartir desactivado"}
        </span>
      </div>

      <p className="mt-pantalla-privacidad">
        Tú decides cuándo compartir y cuándo analizar.
        Solo se envía a Gemini una captura al pulsar
        «Analizar pantalla». No se envía audio ni se
        guarda la imagen en nuestra base de datos.
        Evita mostrar contraseñas o datos personales.
      </p>

      <div className="mt-pantalla-pregunta">
        <label htmlFor="mt-pregunta-visual">
          ¿Qué te gustaría entender de tu pantalla?
        </label>

        <textarea
          id="mt-pregunta-visual"
          rows={3}
          maxLength={240}
          value={pregunta}
          placeholder="Ejemplo: ¿cómo puedo empezar este ejercicio?"
          onChange={(event) =>
            setPregunta(event.target.value)
          }
        />

        <small>
          {pregunta.length}/240 caracteres.
          Puedes dejarla vacía para recibir una orientación general.
        </small>
      </div>

      <div
        className="mt-pantalla-subida"
        tabIndex={0}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          seleccionarArchivo(
            event.dataTransfer.files[0],
          );
        }}
        onPaste={(event) => {
          const imagen = Array.from(
            event.clipboardData.files,
          ).find((item) =>
            item.type === "image/jpeg" ||
            item.type === "image/png"
          );

          if (imagen) {
            event.preventDefault();
            seleccionarArchivo(imagen);
          }
        }}
      >
        <label htmlFor="mt-imagen-educativa">
          Subir o pegar una imagen de mi ejercicio
        </label>

        <input
          id="mt-imagen-educativa"
          type="file"
          accept="image/jpeg,image/png"
          disabled={analizando}
          onChange={(event) => {
            seleccionarArchivo(
              event.target.files?.[0],
            );
            event.target.value = "";
          }}
        />

        <small>
          JPG o PNG, hasta 10 MB. También puedes
          arrastrar una imagen o pegarla aquí.
        </small>

        {archivo && vistaArchivo && (
          <div className="mt-pantalla-imagen-seleccionada">
            <img
              src={vistaArchivo}
              alt="Vista previa de la imagen seleccionada"
            />

            <div className="mt-pantalla-archivo-acciones">
              <span>
                {archivo.name || "Imagen pegada"}
              </span>

              <button
                type="button"
                disabled={analizando}
                onClick={() => {
                  setArchivo(null);
                  setRespuesta("");
                }}
              >
                Quitar imagen
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-pantalla-acciones">
        {!compartiendo ? (
          <button
            type="button"
            className="mt-pantalla-primario"
            onClick={() => void comenzar()}
          >
            Compartir pantalla
          </button>
        ) : (
          <>
            <button
              type="button"
              className="mt-pantalla-primario"
              disabled={analizando}
              onClick={() => void analizar()}
            >
              {analizando
                ? "Analizando con Gemini..."
                : "Analizar pantalla"}
            </button>

            <button
              type="button"
              className="mt-pantalla-detener"
              onClick={detener}
            >
              Detener
            </button>
          </>
        )}
      </div>

      {archivo && !compartiendo && (
        <button
          type="button"
          className="mt-pantalla-primario mt-pantalla-analizar-archivo"
          disabled={analizando}
          onClick={() => void analizar()}
        >
          {analizando
            ? "Analizando imagen..."
            : "Analizar imagen con Gemini"}
        </button>
      )}

      <video
        ref={videoRef}
        className={
          "mt-pantalla-preview " +
          (compartiendo ? "visible" : "")
        }
        autoPlay
        muted
        playsInline
        aria-label="Vista previa de la pantalla compartida"
      />

      {respuesta && (
        <div
          className="mt-pantalla-respuesta"
          role="status"
        >
          <strong>
            Orientación de My Teacher IA
          </strong>

          <p>{respuesta}</p>
        </div>
      )}

      {error && (
        <div
          className="mt-pantalla-error"
          role="alert"
        >
          {error}
        </div>
      )}
    </section>
  );
}
