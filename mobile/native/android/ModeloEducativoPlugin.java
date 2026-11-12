package pe.myteacheria.alumno;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.net.URL;
import java.net.HttpURLConnection;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.net.ssl.HttpsURLConnection;

/**
 * Instalador real de un modelo GGUF conocido en almacenamiento privado Android.
 * No ejecuta inferencia: únicamente descarga, comprueba SHA256 y gestiona el
 * archivo que después será consumido por llama.cpp.
 *
 * La URL, la huella y el nombre están fijados para evitar descargas arbitrarias.
 * Fuente pública: Antigma/Qwen3-0.6B-GGUF (quant Q4_K_M, ~484 MB).
 * SHA-256: el anunciado en la ficha del fichero de Hugging Face.
 */
@CapacitorPlugin(name = "ModeloEducativo")
public final class ModeloEducativoPlugin extends Plugin {
    private static final String MODEL_NAME = "qwen3-0.6b-q4_k_m.gguf";
    private static final String URL_MODEL =
        "https://huggingface.co/Antigma/Qwen3-0.6B-GGUF/resolve/main/qwen3-0.6b-q4_k_m.gguf";
    private static final String MODEL_SHA256 =
        "28b1c721c1e476d3e41c629d5993c0aaeca0f3b747afdbab667f5a4bc8e37665";
    private static final long MAX_BYTES = 600_000_000L;
    private static final long MIN_BYTES = 350_000_000L;
    private static final long RECOMMENDED_FREE = 650_000_000L;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private final AtomicBoolean cancelled = new AtomicBoolean(false);

    private File modelDirectory() throws IOException {
        File dir = new File(getContext().getNoBackupFilesDir(), "modelos");
        if (!dir.isDirectory() && !dir.mkdirs()) {
            throw new IOException("No se pudo crear el directorio privado");
        }
        return dir;
    }

    private JSObject info(File dir) {
        File file = new File(dir, MODEL_NAME);
        JSObject state = new JSObject();
        state.put("modelId", "qwen3-0.6b-q4_k_m");
        state.put("filename", MODEL_NAME);
        state.put("installed", file.isFile() && file.length() > MIN_BYTES);
        state.put("bytes", file.isFile() ? file.length() : 0);
        state.put("downloadBytes", new File(dir, MODEL_NAME + ".part").length());
        state.put("approximateBytes", 484_000_000);
        state.put("downloading", busy.get());
        state.put("engineAvailable", MotorLocalPlugin.estaDisponible()); // Biblioteca JNI real por ABI.
        return state;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        try {
            call.resolve(info(modelDirectory()));
        } catch (IOException error) {
            call.reject("No se pudo leer el almacenamiento", error);
        }
    }

    @PluginMethod
    public void cancelar(PluginCall call) {
        cancelled.set(true);
        call.resolve();
    }

    @PluginMethod
    public void eliminar(PluginCall call) {
        if (busy.get() || MotorLocalPlugin.estaOcupado()) {
            call.reject("Termina la descarga o la respuesta de IA antes de eliminar el modelo");
            return;
        }
        try {
            File dir = modelDirectory();
            File finalModel = new File(dir, MODEL_NAME);
            File part = new File(dir, MODEL_NAME + ".part");
            if ((finalModel.exists() && !finalModel.delete())
                || (part.exists() && !part.delete())) {
                throw new IOException("No se pudieron eliminar todos los archivos");
            }
            call.resolve(info(dir));
        } catch (Exception error) {
            call.reject("No se pudo eliminar el modelo", error);
        }
    }

    @PluginMethod
    public void descargar(PluginCall call) {
        if (!busy.compareAndSet(false, true)) {
            call.reject("Ya hay una descarga del modelo en curso");
            return;
        }
        cancelled.set(false);
        worker.execute(() -> {
            try {
                File dir = modelDirectory();
                File finalModel = new File(dir, MODEL_NAME);
                if (finalModel.isFile() && finalModel.length() > MIN_BYTES) {
                    // No reutilizar un fichero final sin comprobar su integridad.
                    if (sha256Matches(finalModel)) {
                        call.resolve(info(dir));
                        return;
                    }
                    if (!finalModel.delete()) throw new IOException("Modelo local dañado");
                }
                if (dir.getUsableSpace() < RECOMMENDED_FREE) {
                    throw new IOException("Libera al menos 650 MB antes de descargar el modelo");
                }
                File part = new File(dir, MODEL_NAME + ".part");
                long received = part.isFile() ? part.length() : 0;
                if (received >= MAX_BYTES) {
                    if (!part.delete()) throw new IOException("No se puede reiniciar la descarga");
                    received = 0;
                }

                // La URL de entrada es HTTPS fija; el servidor puede redirigir
                // a otro host HTTPS para la distribución de grandes archivos.
                URL target = new URL(URL_MODEL);
                HttpsURLConnection connection = null;
                try {
                    for (int redirect = 0; redirect < 6; redirect++) {
                        if (!"https".equalsIgnoreCase(target.getProtocol())) {
                            throw new IOException("Se rechazó un enlace sin HTTPS");
                        }
                        connection = (HttpsURLConnection) target.openConnection();
                        connection.setConnectTimeout(25000);
                        connection.setReadTimeout(45000);
                        connection.setInstanceFollowRedirects(false);
                        connection.setRequestProperty("User-Agent", "MyTeacherIA-Android/1.0");
                        if (received > 0) connection.setRequestProperty("Range", "bytes=" + received + "-");
                        int status = connection.getResponseCode();
                        if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                            String location = connection.getHeaderField("Location");
                            if (location == null) throw new IOException("Redirección sin destino");
                            URL next = new URL(target, location);
                            connection.disconnect();
                            connection = null;
                            target = next;
                            continue;
                        }
                        if (status != 200 && status != 206) {
                            throw new IOException("Servidor respondió HTTP " + status);
                        }
                        boolean append = status == 206 && received > 0;
                        if (!append) received = 0;
                        long content = connection.getContentLengthLong();
                        long expected = content > 0 ? received + content : 0;
                        if (expected > MAX_BYTES) throw new IOException("Descarga demasiado grande");
                        long previousReport = 0;
                        try (InputStream in = connection.getInputStream();
                             FileOutputStream out = new FileOutputStream(part, append)) {
                            byte[] buffer = new byte[64 * 1024];
                            int read;
                            while ((read = in.read(buffer)) != -1) {
                                if (cancelled.get()) throw new IOException("Descarga cancelada");
                                received += read;
                                if (received > MAX_BYTES) throw new IOException("Límite de tamaño superado");
                                out.write(buffer, 0, read);
                                if (received - previousReport >= 2_000_000) {
                                    previousReport = received;
                                    JSObject update = new JSObject();
                                    update.put("received", received);
                                    update.put("expected", expected);
                                    update.put("percentage", expected > 0
                                        ? Math.min(99, Math.round(received * 100.0 / expected)) : -1);
                                    notifyListeners("progreso", update);
                                }
                            }
                            out.getFD().sync();
                        }
                        if (received < MIN_BYTES) throw new IOException("Modelo incompleto");
                        if (!sha256Matches(part)) {
                            if (!part.delete()) throw new IOException("Huella incorrecta");
                            throw new IOException("El modelo no coincide con el SHA-256 publicado");
                        }
                        if (!part.renameTo(finalModel)) {
                            Files.move(part.toPath(), finalModel.toPath());
                        }
                        JSObject update = new JSObject();
                        update.put("received", received);
                        update.put("expected", received);
                        update.put("percentage", 100);
                        notifyListeners("progreso", update);
                        call.resolve(info(dir));
                        return;
                    }
                    throw new IOException("Se excedió el límite de redirecciones");
                } finally {
                    if (connection != null) connection.disconnect();
                }
            } catch (Exception error) {
                call.reject("No se pudo completar la descarga: " + error.getMessage(), error);
            } finally {
                busy.set(false);
                cancelled.set(false);
            }
        });
    }

    static boolean sha256Matches(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[256 * 1024];
            int size;
            while ((size = in.read(buffer)) >= 0) {
                if (size > 0) digest.update(buffer, 0, size);
            }
        }
        byte[] hash = digest.digest();
        StringBuilder out = new StringBuilder(64);
        for (byte b : hash) out.append(String.format(Locale.ROOT, "%02x", b & 255));
        return MODEL_SHA256.equals(out.toString());
    }
}
