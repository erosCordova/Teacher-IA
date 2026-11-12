package pe.myteacheria.alumno;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
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

    @Override
    public void load() {
        super.load();
        getActivity().runOnUiThread(() ->
            tts = new TextToSpeech(getContext(), status -> {
                if (status != TextToSpeech.SUCCESS || tts == null) return;
                try {
                    for (Voice voice : tts.getVoices()) {
                        if (voice == null || voice.isNetworkConnectionRequired()) continue;
                        if (!"es".equals(voice.getLocale().getLanguage())) continue;
                        vozEsp = voice;
                        break;
                    }
                    if (vozEsp != null && tts.setVoice(vozEsp) == TextToSpeech.SUCCESS) {
                        ttsReady = true;
                        tts.setSpeechRate(0.96f);
                    }
                } catch (Exception ignored) {
                    ttsReady = false;
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
        JSObject data = new JSObject();
        data.put("sintesisDisponible", ttsReady);
        data.put("reconocimientoDisponible", onDeviceRecognitionAvailable());
        data.put("reconociendo", pendingListen != null);
        data.put("idioma", "es");
        data.put("soloDispositivo", true);
        call.resolve(data);
    }

    @PluginMethod
    public void hablar(PluginCall call) {
        final String texto = call.getString("texto", "").trim();
        if (texto.isEmpty() || texto.length() > 2500) {
            call.reject("El texto de voz debe tener entre 1 y 2500 caracteres.");
            return;
        }
        getActivity().runOnUiThread(() -> {
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
