package pe.myteacheria.alumno;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Biblioteca privada de archivos GGUF seleccionados por el estudiante.
 * Este plugin NO ejecuta inferencia: llama.cpp será integrado en una etapa posterior.
 */
@CapacitorPlugin(name = "ModelFiles")
public class ModelFilesPlugin extends Plugin {
    private static final long MAX_BYTES = 2_000_000_000L;
    private static final long MIN_BYTES = 1_000_000L;
    private static final long RESERVE = 256L * 1024L * 1024L;
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    private File modelsDir() {
        File dir = new File(getContext().getFilesDir(), "gguf");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("No se pudo crear almacenamiento privado");
        }
        return dir;
    }

    @PluginMethod
    public void status(PluginCall call) {
        try {
            File dir = modelsDir();
            JSArray list = new JSArray();
            File[] entries = dir.listFiles();
            if (entries != null) for (File f : entries) {
                if (f.isFile() && f.getName().matches("modelo-[a-f0-9]{20}\\.gguf")) {
                    JSObject item = new JSObject();
                    item.put("name", f.getName());
                    item.put("bytes", f.length());
                    list.put(item);
                }
            }
            JSObject result = new JSObject();
            result.put("models", list);
            result.put("availableBytes", dir.getUsableSpace());
            result.put("inferenceAvailable", false);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("No se pudo consultar el almacenamiento local", e);
        }
    }

    @PluginMethod
    public void selectModel(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(call, intent, "onModelSelected");
    }

    @ActivityCallback
    private void onModelSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK ||
                result.getData() == null || result.getData().getData() == null) {
            call.reject("Selección cancelada");
            return;
        }
        Uri uri = result.getData().getData();
        io.execute(() -> importModel(uri, call));
    }

    private void importModel(Uri uri, PluginCall call) {
        File temp = null;
        try {
            File dir = modelsDir();
            long free = dir.getUsableSpace();
            if (free < RESERVE + MIN_BYTES) {
                throw new IOException("No hay espacio suficiente");
            }
            temp = File.createTempFile("modelo-", ".partial", dir);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] head = new byte[4];
            byte[] buf = new byte[131072];
            long total = 0;
            try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                 FileOutputStream out = new FileOutputStream(temp)) {
                if (in == null) throw new IOException("No se pudo abrir el archivo");
                int readHead = 0;
                while (readHead < 4) {
                    int n = in.read(head, readHead, 4 - readHead);
                    if (n < 0) break;
                    readHead += n;
                }
                if (readHead != 4 || head[0] != 'G' || head[1] != 'G' ||
                        head[2] != 'U' || head[3] != 'F') {
                    throw new IOException("Archivo inválido: no es GGUF");
                }
                out.write(head);
                digest.update(head);
                total = 4;
                int n;
                while ((n = in.read(buf)) != -1) {
                    total += n;
                    if (total > MAX_BYTES) throw new IOException("Modelo superior a 2 GB");
                    if (free - total < RESERVE) throw new IOException("Espacio insuficiente");
                    out.write(buf, 0, n);
                    digest.update(buf, 0, n);
                }
                out.getFD().sync();
            }
            if (total < MIN_BYTES) throw new IOException("Modelo incompleto");
            StringBuilder sum = new StringBuilder(64);
            for (byte b : digest.digest()) sum.append(String.format(Locale.ROOT, "%02x", b & 0xff));
            String name = "modelo-" + sum.substring(0, 20) + ".gguf";
            File dest = new File(dir, name);
            if (dest.exists()) {
                if (dest.length() != total) throw new IOException("Archivo existente inconsistente");
                temp.delete();
            } else if (!temp.renameTo(dest)) {
                throw new IOException("No se pudo guardar el archivo");
            }
            temp = null;
            JSObject result = new JSObject();
            result.put("name", name);
            result.put("bytes", total);
            result.put("sha256", sum.toString());
            result.put("inferenceAvailable", false);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("No se pudo importar el modelo: " + e.getMessage(), e);
        } finally {
            if (temp != null && temp.exists()) temp.delete();
        }
    }

    @PluginMethod
    public void deleteModel(PluginCall call) {
        String name = call.getString("name");
        if (name == null || !name.matches("modelo-[a-f0-9]{20}\\.gguf")) {
            call.reject("Identificador inválido");
            return;
        }
        File f = new File(modelsDir(), name);
        if (!f.isFile()) call.reject("Modelo no encontrado");
        else if (!f.delete()) call.reject("No se pudo eliminar");
        else {
            JSObject result = new JSObject();
            result.put("deleted", true);
            call.resolve(result);
        }
    }

    @Override
    protected void handleOnDestroy() {
        io.shutdownNow();
        super.handleOnDestroy();
    }
}
