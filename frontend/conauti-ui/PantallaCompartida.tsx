import { apiFetch } from './apiFetch'
import { VistaEscuchaContinua } from './VistaEscuchaContinua'
import { obtenerVozKokoro, cancelarVozKokoro, hablarConKokoro } from './KokoroPlayer'
import { habilitarAudioKokoro } from './KokoroAudio'
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
  // La respuesta hablada viene activada: preguntar por micrófono debe recibir voz.
  // Se puede silenciar expresamente con el botón de la interfaz.
  const speechEnabledRef = useRef(true);
  const speechTurnRef = useRef(0);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechPlayingRef = useRef(false);
  const continuousRef = useRef<VistaEscuchaContinua | null>(null);
  const dialogIdRef = useRef(0);
  const lastAnswerRef = useRef("");
  const lastQuestionRef = useRef("");
  const popoutRef = useRef<Window | null>(null);
  const [popout, setPopout] = useState<Window | null>(null);
  const [minimizado, setMinimizado] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [estadoVoz, setEstadoVoz] = useState<"listo" | "permiso" | "escuchando" | "grabando" | "transcribiendo">("listo");
  const [leerRespuestas, setLeerRespuestas] = useState(true);
  const [hablando, setHablando] = useState(false);
  const [escuchaContinua, setEscuchaContinua] = useState(false);
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

  const detenerLectura = useCallback(() => {
    speechTurnRef.current += 1;
    speechUtteranceRef.current = null;
    speechPlayingRef.current = false;
    if ("speechSynthesis" in window) cancelarVozKokoro(window.speechSynthesis);
    if (mountedRef.current) setHablando(false);
  }, []);

  const detenerEscuchaContinua = useCallback(() => {
    continuousRef.current?.stop();
    continuousRef.current = null;
    if (mountedRef.current) {
      setEscuchaContinua(false);
      setEstadoVoz("listo");
    }
  }, []);

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
    detenerEscuchaContinua();
    detenerVoz();
    detener();
    imageRequestRef.current?.abort();
    detenerLectura();
    if (popoutRef.current && !popoutRef.current.closed) popoutRef.current.close();
    popoutRef.current = null;
    onClose();
  }, [detener, detenerVoz, detenerEscuchaContinua, detenerLectura, onClose]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      continuousRef.current?.stop();
      continuousRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      audioStreamRef.current?.getTracks().forEach(track => track.stop());
      if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
      recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
      imageRequestRef.current?.abort();
      transcriptRequestRef.current?.abort();
      detenerLectura();
      if (popoutRef.current && !popoutRef.current.closed) popoutRef.current.close();
    };
  }, [detenerLectura]);

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
      // Captura ligera, no vídeo continuo: menor latencia sin exceder límites.
      const escala = Math.min(1, 1024 / medidas.ancho, 700 / medidas.alto);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(medidas.ancho * escala));
      canvas.height = Math.max(1, Math.round(medidas.alto * escala));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo obtener la captura.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(fuente, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.64));
      if (!blob) throw new Error("No se pudo generar una captura.");
      if (blob.size > LIMITE_ENVIO) throw new Error("La captura supera el tamaño permitido.");
      return blob;
    } finally { bitmap?.close(); }
  }

  function hablar(texto: string) {
    if (!speechEnabledRef.current || !mountedRef.current) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setError("Este navegador no admite reproducción de voz.");
      return;
    }
    const limpio = texto.replace(/https?:\/\/\S+/g, "un enlace")
      .replace(/[`*_#]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1800);
    if (!limpio) return;
    detenerLectura();
    const turno = speechTurnRef.current;
    const mensaje = new SpeechSynthesisUtterance(limpio);
    mensaje.lang = "es-PE";
    mensaje.rate = 1;
    speechUtteranceRef.current = mensaje;
    speechPlayingRef.current = true;
    setEstado("Preparando la voz Kokoro seleccionada...");
    mensaje.onstart = () => {
      if (speechTurnRef.current !== turno || !mountedRef.current) return;
      setHablando(true);
      setEstado("My Teacher IA está respondiendo. Puedes interrumpirla hablando.");
    };
    mensaje.onend = () => {
      if (speechTurnRef.current !== turno || !mountedRef.current) return;
      speechPlayingRef.current = false;
      speechUtteranceRef.current = null;
      setHablando(false);
      setEstado("Puedes hacer otra pregunta; el micrófono sigue escuchando.");
    };
    mensaje.onerror = () => {
      if (speechTurnRef.current !== turno || !mountedRef.current) return;
      speechPlayingRef.current = false;
      speechUtteranceRef.current = null;
      setHablando(false);
      setError("No se pudo reproducir la respuesta. Comprueba el volumen o pulsa Escuchar de nuevo.");
    };
    // Respeta ef_dora / em_alex / em_santa y la velocidad configurada.
    // En Render no hay servidor Kokoro local, por eso se prefiere Kokoro WASM
    // y se limita la espera inicial para no bloquear la conversación.
    hablarConKokoro(mensaje, window.speechSynthesis, {
      omitirServidor: true,
      esperaLocalMs: 3200,
      onFallback: () => {
        if (speechTurnRef.current !== turno || !mountedRef.current) return;
        setEstado("Kokoro todavía se está preparando; usando temporalmente la voz del navegador.");
      },
    });
  }

  async function consultar(texto?: string) {
    const consulta = (texto ?? pregunta).trim().slice(0, MAX_QUESTION);
    if (imageRequestRef.current || (!compartiendo && !archivo)) {
      setError("Comparte una vista o selecciona una imagen antes de preguntar.");
      return;
    }
    if (!consulta) {
      setError("Escribe una pregunta o utiliza el micrófono.");
      return;
    }
    const token = sessionStorage.getItem("conauti_token");
    if (!token) { setError("Inicia sesión para consultar la vista."); return; }
    detenerLectura();
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

  async function alternarMicrofono() {
    if (continuousRef.current) {
      detenerEscuchaContinua();
      detenerLectura();
      setEstado("Escucha desactivada. Vuelve a pulsar el micrófono para conversar.");
      return;
    }
    if (!compartiendo && !archivo) {
      setError("Comparte una vista o selecciona una imagen antes de hablar.");
      return;
    }
    // Desbloquear WebAudio durante la interacción real del estudiante.
    habilitarAudioKokoro();
    setEstadoVoz("permiso");
    setError("");
    const escuchador = new VistaEscuchaContinua({
      isPlaying: () => speechPlayingRef.current,
      onSpeechStart: () => {
        // Barge-in: callar inmediatamente tanto Kokoro como speechSynthesis.
        detenerLectura();
        imageRequestRef.current?.abort();
        transcriptRequestRef.current?.abort();
        imageRequestRef.current = null;
        transcriptRequestRef.current = null;
        setAnalizando(false);
        setEstado("Te escucho: continúa hablando, enviaré tu pregunta tras una pausa.");
      },
      onAudio: async audio => {
        await transcribir(audio);
      },
      onState: value => {
        if (!mountedRef.current) return;
        setEstadoVoz(value === "grabando" ? "grabando"
          : value === "procesando" ? "transcribiendo" : "escuchando");
      },
      onError: message => { if (mountedRef.current) setError(message); },
    });
    continuousRef.current = escuchador;
    try {
      await escuchador.start();
      if (!mountedRef.current) { escuchador.stop(); return; }
      setEscuchaContinua(true);
      setEstado("Escucha continua activa. Habla y haz una pausa para enviar.");
      // El modelo se prepara al hablar; nunca se solicita audio sin permiso.
    } catch (fallo) {
      if (continuousRef.current === escuchador) continuousRef.current = null;
      escuchador.stop();
      setEscuchaContinua(false);
      setEstadoVoz("listo");
      setError(mensajeError(fallo, "No se pudo activar la escucha continua."));
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
  const activo = analizando || estadoVoz === "transcribiendo" || estadoVoz === "permiso";
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
            únicamente si detecta una pregunta y deja de escuchar al desactivarlo.
            No se guardan capturas. Oculta datos personales; usa auriculares para reducir el eco.
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
          title={escuchaContinua ? "Detener conversación y micrófono" : "Activar conversación continua por voz"}
          aria-label={escuchaContinua ? "Apagar escucha y detener la voz" : "Activar escucha continua"}
          disabled={estadoVoz === "permiso"}
          onClick={() => void alternarMicrofono()}>
          {escuchaContinua ? "■" : "🎙"}
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
            if (!next) detenerLectura();
            else if (lastAnswerRef.current) hablar(lastAnswerRef.current);
          }}
          aria-pressed={leerRespuestas} title="Leer respuestas en voz alta">
          {leerRespuestas ? "🔊 Voz activada" : "🔇 Voz silenciada"}
        </button>
        {lastAnswerRef.current && (
          <button type="button" className="mt-pantalla-replay"
            title={hablando ? "Detener la lectura" : "Repetir la última respuesta en voz alta"}
            onClick={() => {
              if (hablando) { detenerLectura(); return; }
              speechEnabledRef.current = true;
              setLeerRespuestas(true);
              hablar(lastAnswerRef.current);
            }}>
            {hablando ? "■ Detener voz" : "↻ Escuchar de nuevo"}
          </button>
        )}
        <span>{estadoVoz === "grabando" ? "Escuchando tu pregunta..." : estadoVoz === "escuchando" ? "🎙 Micrófono activo" : estadoVoz === "transcribiendo" ? "Procesando pregunta..." : analizando ? "Analizando la vista..." : hablando ? "Respondiendo con voz..." : estado}</span>
      </div>
      {error && <div className="mt-pantalla-error" role="alert">{error}</div>}
    </section>
  );

  return popout && !popout.closed
    ? createPortal(contenido, popout.document.body)
    : contenido;
}
