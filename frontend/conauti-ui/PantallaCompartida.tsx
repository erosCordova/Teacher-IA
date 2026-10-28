import { apiFetch } from './apiFetch'
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { validarImagen, dimensionesImagen, LIMITE_ENVIO } from "./ImagenEducativa";
import "./PantallaCompartida.css";

type Resultado = { analysis: string; provider: string; image_stored: boolean };
type Mensaje = { id: number; role: "alumno" | "tutor"; text: string };
type Entrada = { archivoInicial?: File | null; onClose: () => void };
type DocumentPiP = { requestWindow: (options: { width: number; height: number }) => Promise<Window> };

const MAX_AUDIO_SECONDS = 30;
const MAX_QUESTION = 240;

function mensajeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function elegirAudio(): string | undefined {
  if (typeof MediaRecorder === "undefined") return;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
    type => MediaRecorder.isTypeSupported(type),
  );
}

export default function PantallaCompartida({ archivoInicial = null, onClose }: Entrada) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRequestRef = useRef<AbortController | null>(null);
  const imageRequestRef = useRef<AbortController | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const speechEnabledRef = useRef(false);
  const dialogIdRef = useRef(0);
  const lastAnswerRef = useRef("");
  const lastQuestionRef = useRef("");
  const popoutRef = useRef<Window | null>(null);
  const [popout, setPopout] = useState<Window | null>(null);
  const [minimizado, setMinimizado] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [estadoVoz, setEstadoVoz] = useState<"listo" | "permiso" | "grabando" | "transcribiendo">("listo");
  const [leerRespuestas, setLeerRespuestas] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(archivoInicial);
  const [vistaArchivo, setVistaArchivo] = useState("");
  const [pregunta, setPregunta] = useState("");
  const [historial, setHistorial] = useState<Mensaje[]>([]);
  const [error, setError] = useState("");
  const [estado, setEstado] = useState("Selecciona una vista para empezar.");

  useEffect(() => {
    if (archivoInicial) setArchivo(archivoInicial);
  }, [archivoInicial]);

  useEffect(() => {
    if (!archivo) { setVistaArchivo(""); return; }
    const url = URL.createObjectURL(archivo);
    setVistaArchivo(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  useEffect(() => {
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" });
  }, [historial, minimizado]);

  // La vista de vídeo cambia de nodo al abrir/cerrar Picture-in-Picture.
  // Se conecta de nuevo al mismo MediaStream, sin solicitar otro permiso.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !compartiendo || !streamRef.current) return;
    video.srcObject = streamRef.current;
    void video.play().catch(() => {});
  }, [compartiendo, minimizado, popout]);

  const detenerVoz = useCallback(() => {
    if (audioTimerRef.current !== null) clearTimeout(audioTimerRef.current);
    audioTimerRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    audioStreamRef.current?.getTracks().forEach(track => track.stop());
    audioStreamRef.current = null;
    audioChunksRef.current = [];
    transcriptRequestRef.current?.abort();
    transcriptRequestRef.current = null;
    if (mountedRef.current) setEstadoVoz("listo");
  }, []);

  const detener = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountedRef.current) {
      setCompartiendo(false);
      setEstado("Vista compartida detenida.");
    }
  }, []);

  const cerrar = useCallback(() => {
    detenerVoz();
    detener();
    imageRequestRef.current?.abort();
    window.speechSynthesis?.cancel();
    if (popoutRef.current && !popoutRef.current.closed) popoutRef.current.close();
    popoutRef.current = null;
    onClose();
  }, [detener, detenerVoz, onClose]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
      audioStreamRef.current?.getTracks().forEach(track => track.stop());
      if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
      recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
      imageRequestRef.current?.abort();
      transcriptRequestRef.current?.abort();
      window.speechSynthesis?.cancel();
      if (popoutRef.current && !popoutRef.current.closed) popoutRef.current.close();
    };
  }, []);

  async function comenzar() {
    setError("");
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Este navegador no admite compartir la vista. Prueba Chrome o Edge actualizado.");
      return;
    }
    // getDisplayMedia se solicita directamente como consecuencia del clic.
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 2 }, audio: false,
      });
      if (!mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      detener();
      streamRef.current = stream;
      setArchivo(null);
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("No se recibió ninguna vista compartida.");
      track.addEventListener("ended", () => {
        if (streamRef.current === stream) {
          streamRef.current = null;
          setCompartiendo(false);
          setEstado("Has dejado de compartir. Puedes volver a elegir una vista.");
        }
      }, { once: true });
      setCompartiendo(true);
      setEstado("Vista conectada. Escribe o dicta una pregunta.");
    } catch (fallo) {
      if (fallo instanceof DOMException && (fallo.name === "NotAllowedError" || fallo.name === "AbortError")) {
        setEstado("No se compartió ninguna vista.");
      } else setError(mensajeError(fallo, "No se pudo compartir la vista de pantalla."));
    }
  }

  function seleccionarArchivo(nuevo?: File) {
    if (!nuevo || analizando) return;
    try {
      validarImagen(nuevo);
      detener();
      setArchivo(nuevo);
      setError("");
      setEstado("Imagen lista para consultas.");
    } catch (fallo) { setError(mensajeError(fallo, "No se pudo cargar la imagen.")); }
  }

  async function capturar(): Promise<Blob> {
    let fuente: CanvasImageSource;
    let ancho = 0, alto = 0;
    let bitmap: ImageBitmap | null = null;
    if (archivo) {
      validarImagen(archivo);
      bitmap = await createImageBitmap(archivo);
      fuente = bitmap;
      ancho = bitmap.width;
      alto = bitmap.height;
    } else {
      const video = videoRef.current;
      if (!streamRef.current?.active || !video?.videoWidth || !video.videoHeight) {
        throw new Error("La vista aún no está preparada. Comprueba que sigue compartida.");
      }
      fuente = video; ancho = video.videoWidth; alto = video.videoHeight;
    }
    try {
      if (ancho * alto > 40_000_000) throw new Error("La resolución de la imagen es demasiado grande.");
      const medidas = dimensionesImagen(ancho, alto);
      const canvas = document.createElement("canvas");
      canvas.width = medidas.ancho; canvas.height = medidas.alto;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo obtener la captura.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(fuente, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.72));
      if (!blob) throw new Error("No se pudo generar una captura.");
      if (blob.size > LIMITE_ENVIO) throw new Error("La captura supera el tamaño permitido.");
      return blob;
    } finally { bitmap?.close(); }
  }

  function hablar(texto: string) {
    if (!speechEnabledRef.current || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto.slice(0, 1400));
    utterance.lang = "es-PE";
    utterance.rate = 1;
    const voces = window.speechSynthesis.getVoices();
    utterance.voice = voces.find(v => v.lang.toLowerCase() === "es-pe")
      || voces.find(v => v.lang.toLowerCase().startsWith("es")) || null;
    window.speechSynthesis.speak(utterance);
  }

  async function consultar(texto?: string) {
    const consulta = (texto ?? pregunta).trim().slice(0, MAX_QUESTION);
    if (analizando || (!compartiendo && !archivo)) {
      setError("Comparte una vista o selecciona una imagen antes de preguntar.");
      return;
    }
    if (!consulta) {
      setError("Escribe una pregunta o utiliza el micrófono.");
      return;
    }
    const token = sessionStorage.getItem("conauti_token");
    if (!token) { setError("Inicia sesión para consultar la vista."); return; }
    setAnalizando(true);
    setError("");
    setPregunta("");
    setEstado("Analizando la vista actual...");
    const id = ++dialogIdRef.current;
    setHistorial(previous => [...previous, { id, role: "alumno" as const, text: consulta }].slice(-16));
    const request = new AbortController();
    imageRequestRef.current = request;
    try {
      const image = await capturar();
      if (request.signal.aborted) return;
      const params = new URLSearchParams({ question: consulta });
      const contexto = lastAnswerRef.current ? (
        "Pregunta anterior: " + lastQuestionRef.current.slice(0, 90) +
        ". Orientación anterior: " + lastAnswerRef.current.slice(0, 330)
      ).slice(0, 500) : "";
      const response = await apiFetch("/api/conauti/screen/analyze?" + params.toString(), {
        method: "POST", cache: "no-store",
        headers: { Authorization: "Bearer " + token,
          "Content-Type": "image/jpeg", "X-Visual-Context": encodeURIComponent(contexto) },
        body: image, signal: request.signal,
      });
      const result: Resultado & { detail?: string } = await response.json().catch(() => ({
        analysis: "", provider: "", image_stored: false, detail: "Respuesta inválida del servidor.",
      }));
      if (!response.ok) throw new Error(result.detail || "No fue posible analizar la pantalla.");
      if (!result.analysis?.trim()) throw new Error("La IA no devolvió una orientación.");
      if (!mountedRef.current || request.signal.aborted) return;
      lastQuestionRef.current = consulta;
      lastAnswerRef.current = result.analysis;
      setHistorial(previous => [...previous, { id: ++dialogIdRef.current, role: "tutor" as const, text: result.analysis }].slice(-16));
      setEstado("Respuesta lista. Puedes seguir preguntando.");
      hablar(result.analysis);
    } catch (fallo) {
      if (request.signal.aborted) return;
      setError(mensajeError(fallo, "Ocurrió un error durante el análisis."));
      setEstado("Prueba otra vez con una pregunta.");
    } finally {
      if (imageRequestRef.current === request) imageRequestRef.current = null;
      if (mountedRef.current) setAnalizando(false);
    }
  }

  async function transcribir(blob: Blob) {
    if (!mountedRef.current) return;
    setEstadoVoz("transcribiendo");
    setEstado("Reconociendo lo que dijiste...");
    const token = sessionStorage.getItem("conauti_token");
    if (!token) { setError("Tu sesión ha expirado."); setEstadoVoz("listo"); return; }
    const request = new AbortController();
    transcriptRequestRef.current = request;
    try {
      if (blob.size < 900) throw new Error("Habla un poco más antes de detener la grabación.");
      const response = await apiFetch("/api/conauti/voice/transcribe", {
        method: "POST", cache: "no-store", headers: {
          Authorization: "Bearer " + token, "Content-Type": blob.type || "audio/webm",
        },
        body: blob, signal: request.signal,
      });
      const result: { text?: string; detail?: string } = await response.json();
      if (!response.ok) throw new Error(result.detail || "No se pudo transcribir la pregunta.");
      const texto = String(result.text || "").trim();
      if (!texto) throw new Error("No se reconocieron palabras. Inténtalo otra vez.");
      setPregunta(texto.slice(0, MAX_QUESTION));
      setEstadoVoz("listo");
      await consultar(texto);
    } catch (fallo) {
      if (!request.signal.aborted) setError(mensajeError(fallo, "Error de reconocimiento de voz."));
    } finally {
      if (transcriptRequestRef.current === request) transcriptRequestRef.current = null;
      if (mountedRef.current) setEstadoVoz("listo");
    }
  }

  function terminarGrabacion() {
    if (audioTimerRef.current !== null) clearTimeout(audioTimerRef.current);
    audioTimerRef.current = null;
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }

  async function alternarMicrofono() {
    if (estadoVoz === "grabando") { terminarGrabacion(); return; }
    if (estadoVoz !== "listo" || analizando) return;
    if (!compartiendo && !archivo) {
      setError("Primero comparte una vista o selecciona una imagen.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Tu navegador no permite grabar audio. Puedes escribir tu pregunta.");
      return;
    }
    window.speechSynthesis?.cancel();
    setEstadoVoz("permiso");
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!mountedRef.current) { media.getTracks().forEach(track => track.stop()); return; }
      audioStreamRef.current = media;
      audioChunksRef.current = [];
      const format = elegirAudio();
      const recorder = new MediaRecorder(media, format ? { mimeType: format } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
        recorderRef.current = null;
        if (mountedRef.current) void transcribir(blob);
      };
      recorder.start();
      setEstadoVoz("grabando");
      setEstado("Escuchando tu pregunta. Pulsa el micrófono para enviar.");
      audioTimerRef.current = setTimeout(terminarGrabacion, MAX_AUDIO_SECONDS * 1000);
    } catch (fallo) {
      audioStreamRef.current?.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
      setEstadoVoz("listo");
      setError(mensajeError(fallo, "No se pudo activar el micrófono."));
    }
  }

  async function abrirVentanaFlotante() {
    const pip = (window as Window & { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture;
    if (!pip) {
      setError("Tu navegador no ofrece una ventana flotante sobre otras aplicaciones. Puedes utilizar la vista minimizada dentro del navegador.");
      return;
    }
    if (popoutRef.current && !popoutRef.current.closed) { popoutRef.current.focus(); return; }
    try {
      // Debe invocarse durante el gesto directo del botón.
      const floating = await pip.requestWindow({ width: 450, height: 650 });
      floating.document.title = "My Teacher IA · Vista compartida";
      floating.document.documentElement.dataset.myteacherTheme =
        document.documentElement.dataset.myteacherTheme || "light";
      floating.document.body.style.margin = "0";
      floating.document.body.className = "mt-pantalla-pip-body";
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(element => {
        floating.document.head.appendChild(element.cloneNode(true));
      });
      popoutRef.current = floating;
      setPopout(floating);
      setMinimizado(false);
      floating.addEventListener("pagehide", () => {
        if (popoutRef.current === floating) {
          popoutRef.current = null;
          if (mountedRef.current) { setPopout(null); setMinimizado(true); }
        }
      }, { once: true });
    } catch (fallo) {
      setError(mensajeError(fallo, "No se pudo abrir la ventana flotante."));
    }
  }

  const disponible = compartiendo || Boolean(archivo);
  const activo = estadoVoz !== "listo" || analizando;
  const ventanaFlotanteCompatible =
    typeof window !== "undefined" &&
    Boolean((window as Window & { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture);

  const contenido = (
    <section className={"mt-pantalla " + (minimizado ? "mt-pantalla-min" : "mt-pantalla-full")}
      role="region" aria-label="Asistente de vista compartida de My Teacher IA">
      <header className="mt-pantalla-top">
        <div className="mt-pantalla-brand">
          <span className="mt-pantalla-symbol" aria-hidden="true">✦</span>
          <div><strong>My Teacher IA</strong><small>Asistente de vista compartida</small></div>
        </div>
        <div className="mt-pantalla-window-actions">
          {ventanaFlotanteCompatible && !popout && (
            <button type="button" title="Mantener sobre otras ventanas" aria-label="Abrir ventana flotante"
              onClick={() => void abrirVentanaFlotante()}>▣</button>
          )}
          <button type="button" onClick={() => setMinimizado(v => !v)}
            aria-label={minimizado ? "Ampliar asistente" : "Minimizar asistente"}
            title={minimizado ? "Ampliar" : "Minimizar"}>{minimizado ? "□" : "─"}</button>
          <button type="button" onClick={cerrar} aria-label="Cerrar asistente" title="Cerrar">×</button>
        </div>
      </header>

      <div className="mt-pantalla-status" role="status">
        <span className={"mt-pantalla-dot " + (disponible ? "conectado" : "")} />
        <span>{compartiendo ? "Vista activa" : archivo ? "Imagen seleccionada" : "Vista no compartida"}</span>
        <small>{estadoVoz === "grabando" ? " · Escuchando..." : analizando ? " · Analizando..." : ""}</small>
      </div>

      <video ref={videoRef} className={"mt-pantalla-video " + (compartiendo ? "visible" : "")}
        autoPlay muted playsInline aria-label="Vista previa en directo de la pantalla autorizada" />
      {!compartiendo && vistaArchivo && (
        <img className="mt-pantalla-file-preview" src={vistaArchivo} alt="Imagen seleccionada para analizar" />
      )}
      {!disponible && (
        <div className="mt-pantalla-start">
          <span aria-hidden="true">▣</span>
          <strong>Comparte lo que estás estudiando</strong>
          <p>Elige una ventana, una pestaña o tu pantalla. La IA analizará una captura nueva con cada pregunta.</p>
          <button type="button" className="mt-pantalla-primary" onClick={() => void comenzar()}>
            Compartir vista de pantalla
          </button>
          <label className="mt-pantalla-upload">
            O subir imagen <input type="file" accept="image/jpeg,image/png"
              onChange={e => { seleccionarArchivo(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      )}

      {!minimizado && (
        <>
          <div className="mt-pantalla-toolbar">
            {ventanaFlotanteCompatible && !popout && (
              <button type="button" onClick={() => void abrirVentanaFlotante()}
                title="Mostrar el asistente sobre otras aplicaciones">▣ Ventana flotante</button>
            )}
            {disponible && (
              <button type="button" onClick={() => void comenzar()} title="Cambiar la vista compartida">
                ▣ Cambiar vista
              </button>
            )}
            {compartiendo && (
              <button type="button" onClick={detener} className="mt-pantalla-stop">
                ■ Dejar de compartir
              </button>
            )}
            {archivo && (
              <button type="button" onClick={() => {setArchivo(null);setEstado("Selecciona una vista para continuar.");}}>
                × Quitar imagen
              </button>
            )}
            <label className="mt-pantalla-upload mt-pantalla-upload-small">
              ▧ Imagen <input type="file" accept="image/jpeg,image/png"
                onChange={e => { seleccionarArchivo(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
          <div className="mt-pantalla-conversation" ref={messageListRef} role="log" aria-label="Conversación acerca de la vista">
            {historial.length ? historial.map(message => (
              <div key={message.id} className={"mt-pantalla-message " + message.role}>
                <strong>{message.role === "alumno" ? "Tú" : "My Teacher IA"}</strong>
                <p>{message.text}</p>
              </div>
            )) : (
              <div className="mt-pantalla-hint">
                <strong>Ahora puedes hablarme sobre lo que ves.</strong>
                <p>Prueba: «¿Me explicas lo que aparece en esta pantalla?»</p>
              </div>
            )}
          </div>
          <p className="mt-pantalla-privacy">
            La pantalla no se transmite continuamente: se envía una imagen a Gemini
            cuando haces una pregunta. El audio del micrófono se envía a transcripción
            solo cuando grabas. No se guardan capturas. Oculta datos personales.
          </p>
        </>
      )}

      {minimizado && historial.length > 0 && (
        <div className="mt-pantalla-latest" role="status">
          <strong>Última orientación</strong>
          <p>{[...historial].reverse().find(message => message.role === "tutor")?.text || estado}</p>
        </div>
      )}

      <form className="mt-pantalla-composer" onSubmit={event => {event.preventDefault();void consultar();}}>
        <input type="text" value={pregunta} maxLength={MAX_QUESTION}
          disabled={analizando || estadoVoz === "transcribiendo"}
          onChange={event => setPregunta(event.target.value)}
          aria-label="Pregunta sobre la vista compartida"
          placeholder="Pregunta sobre lo que estoy viendo..." />
        <button type="button" className={"mt-pantalla-mic " + (estadoVoz === "grabando" ? "grabando" : "")}
          title={estadoVoz === "grabando" ? "Detener y preguntar" : "Hablar con la IA"}
          aria-label={estadoVoz === "grabando" ? "Detener grabación y enviar" : "Hablar sobre la vista"}
          disabled={analizando || estadoVoz === "transcribiendo" || estadoVoz === "permiso"}
          onClick={() => void alternarMicrofono()}>
          {estadoVoz === "grabando" ? "■" : "🎙"}
        </button>
        <button type="submit" className="mt-pantalla-send" disabled={!disponible || !pregunta.trim() || activo}
          title="Enviar pregunta" aria-label="Enviar pregunta sobre la vista">➤</button>
      </form>

      <div className="mt-pantalla-bottom">
        <button type="button" className={"mt-pantalla-speech " + (leerRespuestas ? "active" : "")}
          onClick={() => {
            const next = !speechEnabledRef.current;
            speechEnabledRef.current = next;
            setLeerRespuestas(next);
            if (!next) window.speechSynthesis?.cancel();
          }}
          aria-pressed={leerRespuestas} title="Leer respuestas en voz alta">
          {leerRespuestas ? "🔊 Respuestas por voz: sí" : "🔇 Respuestas por voz: no"}
        </button>
        <span>{estadoVoz === "grabando" ? "Escuchando..." : estadoVoz === "transcribiendo" ? "Transcribiendo..." : analizando ? "Analizando..." : estado}</span>
      </div>
      {error && <div className="mt-pantalla-error" role="alert">{error}</div>}
    </section>
  );

  return popout && !popout.closed
    ? createPortal(contenido, popout.document.body)
    : contenido;
}
