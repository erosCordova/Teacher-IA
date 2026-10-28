/**
 * Kokoro 82M en el propio navegador.
 *
 * Kokoro-js incluye un fonemizador inglés por defecto. Para
 * Dora, Alex y Santa se fonemiza explícitamente en español
 * y se invoca la inferencia directamente con los IDs.
 * No se envían textos ni audio a un servicio TTS de pago.
 */
import { KokoroTTS } from 'kokoro-js'
import { phonemize } from 'phonemizer'
import type { KokoroVoice } from './KokoroPlayer'

type Motor = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>
let motorPromise: Promise<Motor> | null = null

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

  const instancia = await motor()

  // eSpeak-NG WASM: idioma español, no pronunciación inglesa.
  const palabras = await phonemize(texto, 'es')
  const fonemas = palabras.join(' ').trim()
  if (!fonemas) throw new Error('No se obtuvieron fonemas en español.')

  const { input_ids } = instancia.tokenizer(fonemas, {
    truncation: true,
  })

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
