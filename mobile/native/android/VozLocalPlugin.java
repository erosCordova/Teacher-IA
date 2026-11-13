package pe.myteacheria.alumno;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.ModelDownloadListener;
import android.speech.RecognitionSupport;
import android.speech.RecognitionSupportCallback;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Solo voz que el sistema Android declara ejecutable en el dispositivo.
 * NUNCA usa SpeechRecognizer.createSpeechRecognizer (puede usar la nube).
 * Si faltan los idiomas locales, informa al estudiante y no inicia grabación.
 */
@CapacitorPlugin(
    name = "VozLocal",
    permissions = {
        @Permission(alias = "microfono", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public final class VozLocalPlugin extends Plugin {
    private TextToSpeech tts;
    private Voice vozEsp;
    private boolean ttsReady = false;
    private SpeechRecognizer recognizer;
    private PluginCall pendingListen;

    // Tras instalar una voz desde ajustes, el mismo proceso puede seguir
    // abierto. Volver a comprobar evita exigir reinstalar la aplicación.
    private void refrescarVozLocal() {
        if (tts == null) return;
        if (ttsReady && vozEsp != null) return;
        try {
            if (tts.getVoices() == null) return;
            for (Voice voice : tts.getVoices()) {
                if (voice == null || voice.isNetworkConnectionRequired()) continue;
                if (!"es".equals(voice.getLocale().getLanguage())) continue;
                if (tts.setVoice(voice) == TextToSpeech.SUCCESS) {
                    vozEsp = voice;
                    ttsReady = true;
                    tts.setSpeechRate(0.96f);
                    break;
                }
            }
        } catch (Exception ignored) { ttsReady = false; }
    }

    @Override
    public void load() {
        super.load();
        getActivity().runOnUiThread(() ->
            tts = new TextToSpeech(getContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    getActivity().runOnUiThread(this::refrescarVozLocal);
                }
            })
        );
    }

    private boolean onDeviceRecognitionAvailable() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
    }

    @PluginMethod
    public void estado(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            refrescarVozLocal();
            JSObject data = new JSObject();
            data.put("sintesisDisponible", ttsReady);
            data.put("reconocimientoDisponible", onDeviceRecognitionAvailable());
            data.put("reconociendo", pendingListen != null);
            data.put("idioma", "es");
            data.put("soloDispositivo", true);
            call.resolve(data);
        });
    }

    @PluginMethod
    public void abrirAjustesVoz(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                // Pantalla de datos de síntesis de voz; el fabricante puede
                // proporcionar su propia actividad para descargar español.
                Intent ajustes = new Intent("com.android.settings.TTS_SETTINGS");
                if (ajustes.resolveActivity(getContext().getPackageManager()) == null) {
                    ajustes = new Intent(Settings.ACTION_SETTINGS);
                }
                getActivity().startActivity(ajustes);
                call.resolve();
            } catch (Exception error) {
                call.reject("No se pudieron abrir los ajustes de voz de Android.");
            }
        });
    }

    /**
     * API 33+: distinguir un servicio de voz presente de un paquete español
     * efectivamente instalado. No usa un servicio remoto ni abre el micrófono.
     * Si el proveedor no permite consultar soporte, indica "desconocido"
     * en lugar de afirmar falsamente que español ya está instalado.
     */
    private static boolean admiteEspanol(List<String> languages) {
        if (languages == null) return false;
        for (String language : languages) {
            if ("es".equals(Locale.forLanguageTag(language.replace('_', '-')).getLanguage())) {
                return true;
            }
        }
        return false;
    }

    private static Intent intentEspanol() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
            RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES");
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        return intent;
    }

    @PluginMethod
    public void comprobarIdioma(PluginCall call) {
        if (!onDeviceRecognitionAvailable()) {
            JSObject info = new JSObject();
            info.put("comprobacionSoportada", true);
            info.put("espanolInstalado", false);
            info.put("espanolDescargable", false);
            info.put("motivo", "Android no ofrece reconocimiento de voz en este dispositivo.");
            call.resolve(info);
            return;
        }
        if (Build.VERSION.SDK_INT < 33) {
            JSObject info = new JSObject();
            info.put("comprobacionSoportada", false);
            info.put("espanolInstalado", false);
            info.put("espanolDescargable", false);
            info.put("motivo", "Esta versión de Android no permite consultar idiomas de reconocimiento instalados.");
            call.resolve(info);
            return;
        }
        getActivity().runOnUiThread(() -> {
            final AtomicBoolean completado = new AtomicBoolean(false);
            final SpeechRecognizer[] instancia = new SpeechRecognizer[1];
            try {
                final SpeechRecognizer verificador =
                    SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
                instancia[0] = verificador;
                final Handler handler = new Handler(Looper.getMainLooper());
                final Runnable timeout = () -> {
                    if (!completado.compareAndSet(false, true)) return;
                    verificador.destroy();
                    JSObject info = new JSObject();
                    info.put("comprobacionSoportada", false);
                    info.put("espanolInstalado", false);
                    info.put("espanolDescargable", false);
                    info.put("motivo", "El servicio de voz no confirmó el idioma en ocho segundos.");
                    call.resolve(info);
                };
                handler.postDelayed(timeout, 8000);
                verificador.checkRecognitionSupport(intentEspanol(),
                    getContext().getMainExecutor(), new RecognitionSupportCallback() {
                        @Override
                        public void onSupportResult(RecognitionSupport support) {
                            if (!completado.compareAndSet(false, true)) return;
                            handler.removeCallbacks(timeout);
                            verificador.destroy();
                            JSObject info = new JSObject();
                            info.put("comprobacionSoportada", true);
                            info.put("espanolInstalado",
                                admiteEspanol(support.getInstalledOnDeviceLanguages()));
                            info.put("espanolDescargable",
                                admiteEspanol(support.getSupportedOnDeviceLanguages())
                                || admiteEspanol(support.getPendingOnDeviceLanguages()));
                            call.resolve(info);
                        }
                        @Override
                        public void onError(int error) {
                            if (!completado.compareAndSet(false, true)) return;
                            handler.removeCallbacks(timeout);
                            verificador.destroy();
                            JSObject info = new JSObject();
                            info.put("comprobacionSoportada", false);
                            info.put("espanolInstalado", false);
                            info.put("espanolDescargable", false);
                            info.put("motivo", "El sistema no permite consultar el idioma (" + error + ").");
                            call.resolve(info);
                        }
                    });
            } catch (Exception error) {
                // Si el proveedor lanza una excepción, no resolver dos veces
                // cuando se ejecute el temporizador de ocho segundos.
                if (!completado.compareAndSet(false, true)) return;
                if (instancia[0] != null) instancia[0].destroy();
                JSObject info = new JSObject();
                info.put("comprobacionSoportada", false);
                info.put("espanolInstalado", false);
                info.put("espanolDescargable", false);
                info.put("motivo", "No se pudo comprobar el paquete de voz local.");
                call.resolve(info);
            }
        });
    }

    /**
     * Android puede instalar el reconocimiento de español en el dispositivo
     * tras la confirmación explícita del alumno en la interfaz. La descarga
     * del paquete del sistema no envía conversaciones al backend de Teacher IA.
     * La solicitud no significa que el idioma haya quedado instalado.
     */
    @PluginMethod
    public void prepararIdioma(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || !onDeviceRecognitionAvailable()) {
            call.reject("Android no permite instalar el idioma local desde esta aplicación.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            final AtomicBoolean completado = new AtomicBoolean(false);
            final SpeechRecognizer[] referencia = new SpeechRecognizer[1];
            final Handler handler = new Handler(Looper.getMainLooper());
            final Runnable timeout = () -> {
                if (!completado.compareAndSet(false, true)) return;
                if (referencia[0] != null) referencia[0].destroy();
                JSObject estado = new JSObject();
                estado.put("estado", "solicitado");
                estado.put("detalle", "Android todavía no confirma la descarga. Comprueba el idioma más tarde.");
                call.resolve(estado);
            };
            try {
                final SpeechRecognizer verificador =
                    SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
                referencia[0] = verificador;
                if (Build.VERSION.SDK_INT >= 34) {
                    handler.postDelayed(timeout, 90000);
                    verificador.triggerModelDownload(intentEspanol(),
                        getContext().getMainExecutor(), new ModelDownloadListener() {
                            private void terminar(String estado, String detalle) {
                                if (!completado.compareAndSet(false, true)) return;
                                handler.removeCallbacks(timeout);
                                verificador.destroy();
                                JSObject resultado = new JSObject();
                                resultado.put("estado", estado);
                                resultado.put("detalle", detalle);
                                call.resolve(resultado);
                            }
                            @Override public void onProgress(int completedPercent) {
                                JSObject progress = new JSObject();
                                progress.put("porcentaje", completedPercent);
                                notifyListeners("progresoIdioma", progress);
                            }
                            @Override public void onScheduled() {
                                terminar("programado", "Android programó la instalación del español.");
                            }
                            @Override public void onSuccess() {
                                terminar("instalado", "Android confirmó la instalación del idioma.");
                            }
                            @Override public void onError(int error) {
                                terminar("error", "Android no pudo preparar el idioma (" + error + ").");
                            }
                        });
                } else {
                    // API 33 permite solicitar, no informar finalización.
                    verificador.triggerModelDownload(intentEspanol());
                    completado.set(true);
                    verificador.destroy();
                    JSObject resultado = new JSObject();
                    resultado.put("estado", "solicitado");
                    resultado.put("detalle", "Android recibió la solicitud. Revisa la instalación del idioma.");
                    call.resolve(resultado);
                }
            } catch (Exception error) {
                if (!completado.compareAndSet(false, true)) return;
                handler.removeCallbacks(timeout);
                if (referencia[0] != null) referencia[0].destroy();
                call.reject("No se pudo solicitar el paquete de español sin conexión.");
            }
        });
    }

    @PluginMethod
    public void hablar(PluginCall call) {
        final String texto = call.getString("texto", "").trim();
        if (texto.isEmpty() || texto.length() > 2500) {
            call.reject("El texto de voz debe tener entre 1 y 2500 caracteres.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            refrescarVozLocal();
            if (!ttsReady || tts == null || vozEsp == null) {
                call.reject("Instala una voz española sin conexión en los ajustes de Android.");
                return;
            }
            int result = tts.speak(texto, TextToSpeech.QUEUE_FLUSH, null, "myteacheria-local");
            if (result == TextToSpeech.SUCCESS) call.resolve();
            else call.reject("No se pudo sintetizar la voz local.");
        });
    }

    @PluginMethod
    public void detener(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (tts != null) tts.stop();
            call.resolve();
        });
    }

    @PluginMethod
    public void escuchar(PluginCall call) {
        if (!onDeviceRecognitionAvailable()) {
            call.reject("Este Android no tiene reconocimiento de voz en el dispositivo.");
            return;
        }
        if (getPermissionState("microfono") != PermissionState.GRANTED) {
            requestPermissionForAlias("microfono", call, "permisoMicrofono");
            return;
        }
        iniciarReconocimiento(call);
    }

    @PermissionCallback
    private void permisoMicrofono(PluginCall call) {
        if (getPermissionState("microfono") != PermissionState.GRANTED) {
            call.reject("El micrófono necesita permiso para escuchar.");
            return;
        }
        iniciarReconocimiento(call);
    }

    private void iniciarReconocimiento(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pendingListen != null) {
                call.reject("Ya se está escuchando una pregunta.");
                return;
            }
            if (!onDeviceRecognitionAvailable()) {
                call.reject("El reconocimiento local no está instalado.");
                return;
            }
            pendingListen = call;
            try {
                recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) { }
                    @Override public void onBeginningOfSpeech() { }
                    @Override public void onRmsChanged(float rmsdB) { }
                    @Override public void onBufferReceived(byte[] buffer) { }
                    @Override public void onEndOfSpeech() { }
                    @Override public void onPartialResults(Bundle partialResults) { }
                    @Override public void onEvent(int eventType, Bundle params) { }
                    @Override public void onError(int error) {
                        terminarEscucha(null, "El reconocimiento local falló (" + error
                            + "). Comprueba que descargaste el idioma español en Android.");
                    }
                    @Override public void onResults(Bundle results) {
                        ArrayList<String> matches = results.getStringArrayList(
                            SpeechRecognizer.RESULTS_RECOGNITION);
                        String phrase = matches != null && !matches.isEmpty()
                            ? matches.get(0) : "";
                        if (phrase.isEmpty()) terminarEscucha(null, "No se reconoció ninguna frase.");
                        else terminarEscucha(phrase, null);
                    }
                });
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES");
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                recognizer.startListening(intent);
            } catch (Exception error) {
                terminarEscucha(null, "No se pudo activar el reconocimiento local.");
            }
        });
    }

    private void terminarEscucha(String phrase, String error) {
        PluginCall call = pendingListen;
        pendingListen = null;
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
        if (call == null) return;
        if (error != null) call.reject(error);
        else {
            JSObject result = new JSObject();
            result.put("texto", phrase);
            result.put("origen", "dispositivo");
            call.resolve(result);
        }
    }

    @PluginMethod
    public void cancelarEscucha(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) recognizer.cancel();
            terminarEscucha(null, "Escucha cancelada.");
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        super.handleOnDestroy();
    }
}
