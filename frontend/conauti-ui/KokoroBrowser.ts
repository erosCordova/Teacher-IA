/**
 * Kokoro 82M en el propio navegador.
 *
 * Kokoro-js incluye un fonemizador inglés por defecto. Para
 * Dora, Alex y Santa se fonemiza explícitamente en español
 * y se invoca la inferencia directamente con los IDs.
 * No se envían textos ni audio a un servicio TTS de pago.
 */
import { KokoroTTS } from 'kokoro-js'
import { createEspeak } from '@spelling-creator/spellophone/browser'
import type { KokoroVoice } from './KokoroPlayer'

type Motor = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>
let motorPromise: Promise<Motor> | null = null
let fonemizadorPromise: ReturnType<typeof createEspeak> | null = null

async function fonemizarEspanol(texto: string): Promise<string> {
  if (!fonemizadorPromise) {
    const tarea = createEspeak({
      cdn: 'jsdelivr',
      languages: ['es'],
    })
    fonemizadorPromise = tarea
    void tarea.catch(() => {
      if (fonemizadorPromise === tarea) fonemizadorPromise = null
    })
  }

  const espeak = await fonemizadorPromise
  espeak.setVoice('es')
  const fonemas = espeak.phonemes(texto).trim()

  if (!fonemas) {
    throw new Error('eSpeak no pudo convertir el texto a fonemas españoles.')
  }

  return fonemas
}

function motor(): Promise<Motor> {
  // Un fallo de red no debe deshabilitar Kokoro definitivamente.
  // Permitir un nuevo intento cuando el usuario vuelva a escuchar.
  if (!motorPromise) {
    const tarea = KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      { dtype: 'q8', device: 'wasm' },
    )
    motorPromise = tarea
    void tarea.catch(() => {
      if (motorPromise === tarea) motorPromise = null
    })
  }

  return motorPromise
}

export async function sintetizarKokoroEnNavegador(
  texto: string,
  voz: KokoroVoice,
  velocidad: number,
): Promise<Blob> {
  if (!texto.trim()) throw new Error('No hay texto para reproducir.')

  // La version 1.2.1 de "phonemizer" solo admite ingles.
  // Spellophone utiliza eSpeak-NG completo con diccionario español.
  // Primero validar G2P; luego descargar el modelo de ~92 MB.
  const fonemas = await fonemizarEspanol(texto)
  const instancia = await motor()

  const { input_ids } = instancia.tokenizer(fonemas, {
    truncation: true,
  })

  if (input_ids.dims.at(-1)! <= 2) {
    throw new Error('Los fonemas españoles no produjeron tokens válidos.')
  }

  // Kokoro-js 1.2.1 publica las voces españolas como pesos,
  // aunque su lista TypeScript enumera solamente voces inglesas.
  // generate_from_ids carga el archivo real de cada voz sin
  // aplicar la validación de idioma de generate().
  const audio = await instancia.generate_from_ids(input_ids, {
    voice: voz as 'af_heart',
    speed: velocidad,
  })

  const wav = await audio.toBlob()
  if (!wav.size) throw new Error('Kokoro no generó audio.')

  return wav
}
