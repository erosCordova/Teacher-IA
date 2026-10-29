/**
 * Micrófono de conversación para compartir vista.
 *
 * El permiso lo concede el estudiante mediante un clic. Mantiene activa
 * una sola pista de micrófono con cancelación de eco y detección local de voz:
 * nunca se envía audio mientras no se haya detectado una pregunta.
 * Reacciona incluso durante la reproducción de la IA (barge-in).
 */
type EscuchaOpciones = {
  onSpeechStart: () => void;
  onAudio: (audio: Blob) => Promise<void>;
  onState: (state: "escuchando" | "grabando" | "procesando") => void;
  onError: (error: string) => void;
  isPlaying: () => boolean;
};

export class VistaEscuchaContinua {
  private media: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private recorder: MediaRecorder | null = null;
  private fragments: Blob[] = [];
  private started = false;
  private recording = false;
  private processing = false;
  private startedAt = 0;
  private lastVoiceAt = 0;
  private voiceFrames = 0;
  private baseline = 0.008;
  private ignoreUntil = 0;

  constructor(private readonly options: EscuchaOpciones) {}

  async start(): Promise<void> {
    if (this.started) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Este navegador no admite conversación continua por micrófono.");
    }
    this.started = true;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (error) {
      this.started = false;
      throw error;
    }
    if (!this.started) {
      media.getTracks().forEach(track => track.stop());
      return;
    }

    this.media = media;
    try {
      const context = new AudioContext();
      this.context = context;
      if (context.state === "suspended") await context.resume();
      if (!this.started) return;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(media).connect(analyser);
      this.analyser = analyser;
      this.ignoreUntil = Date.now() + 300;
      const data = new Uint8Array(analyser.fftSize);
      this.options.onState("escuchando");

      this.interval = setInterval(() => {
        if (!this.started || !this.analyser || !this.media?.active || this.processing) return;
        this.analyser.getByteTimeDomainData(data);
        let energy = 0;
        for (const sample of data) energy += ((sample - 128) / 128) ** 2;
        const rms = Math.sqrt(energy / data.length);
        const now = Date.now();
        if (now < this.ignoreUntil) return;

        const threshold = Math.max(
          this.options.isPlaying() ? 0.045 : 0.027,
          this.baseline * (this.options.isPlaying() ? 4 : 2.8),
        );
        if (rms > threshold) {
          this.voiceFrames += 1;
          this.lastVoiceAt = now;
        } else {
          this.voiceFrames = Math.max(0, this.voiceFrames - 1);
          if (!this.recording) this.baseline = Math.min(0.04, this.baseline * 0.96 + rms * 0.04);
        }

        if (!this.recording && this.voiceFrames >= 3) {
          this.startRecording();
          return;
        }
        if (this.recording && (now - this.lastVoiceAt > 1150 || now - this.startedAt > 18000)) {
          this.stopRecording();
        }
      }, 90);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  private startRecording(): void {
    if (!this.media?.active || this.recording || this.processing) return;
    this.options.onSpeechStart();
    try {
      const formats = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mime = formats.find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(this.media, mime ? { mimeType: mime } : undefined);
      this.recorder = recorder;
      this.fragments = [];
      this.recording = true;
      this.startedAt = Date.now();
      this.lastVoiceAt = this.startedAt;
      recorder.ondataavailable = event => {
        if (event.data.size > 0) this.fragments.push(event.data);
      };
      recorder.onerror = () => {
        this.options.onError("No se pudo grabar la pregunta. Comprueba el micrófono.");
        this.stopRecording();
      };
      recorder.onstop = () => {
        if (this.recorder === recorder) this.recorder = null;
        this.recording = false;
        this.voiceFrames = 0;
        if (!this.started) return;
        const blob = new Blob(this.fragments, { type: recorder.mimeType || "audio/webm" });
        this.fragments = [];
        if (blob.size < 900) {
          this.options.onState("escuchando");
          return;
        }
        this.processing = true;
        this.options.onState("procesando");
        void this.options.onAudio(blob).catch(error => {
          this.options.onError(error instanceof Error ? error.message : "Error al procesar la pregunta.");
        }).finally(() => {
          if (!this.started) return;
          this.processing = false;
          this.ignoreUntil = Date.now() + 300;
          this.options.onState("escuchando");
        });
      };
      recorder.start(160);
      this.options.onState("grabando");
    } catch (error) {
      this.recording = false;
      this.options.onError(error instanceof Error ? error.message : "No se pudo iniciar la grabación.");
    }
  }

  private stopRecording(): void {
    if (this.recorder?.state === "recording") this.recorder.stop();
  }

  stop(): void {
    this.started = false;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    const recorder = this.recorder;
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    this.recorder = null;
    this.media?.getTracks().forEach(track => track.stop());
    this.media = null;
    this.analyser = null;
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.fragments = [];
    this.recording = false;
    this.processing = false;
    this.voiceFrames = 0;
  }
}
