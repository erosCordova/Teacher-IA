package pe.myteacheria.alumno;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;

/**
 * Historial del modo local, separado de las conversaciones de cuentas web.
 * Únicamente el usuario de este dispositivo puede leer el contenido cifrado
 * con AES-256-GCM y una clave no exportable del Android Keystore.
 *
 * El historial NO se sincroniza ni se almacena en PostgreSQL.
 */
@CapacitorPlugin(name = "HistorialLocal")
public final class HistorialLocalPlugin extends Plugin {
    private static final String ALIAS = "myteacher_offline_history_aes_v1";
    private static final String PREF = "myteacher_historial_local";
    private static final String FIELD = "contenido_cifrado";
    private static final int MAX_CHARS = 150_000;

    private static SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
            );
            generator.init(new KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }

    @PluginMethod
    public void leer(PluginCall call) {
        String stored = getContext().getSharedPreferences(PREF, 0)
            .getString(FIELD, null);
        JSObject result = new JSObject();
        if (stored == null) {
            result.put("datos", "[]");
            call.resolve(result);
            return;
        }
        try {
            String[] parts = stored.split("\\.", 2);
            if (parts.length != 2) throw new IllegalArgumentException("Formato inválido");
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
            byte[] plaintext = cipher.doFinal(encrypted);
            result.put("datos", new String(plaintext, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se puede descifrar el historial local. No fue modificado.");
        }
    }

    @PluginMethod
    public void guardar(PluginCall call) {
        String json = call.getString("datos", "");
        if (json.isEmpty() || json.length() > MAX_CHARS) {
            call.reject("El historial supera el límite de almacenamiento local.");
            return;
        }
        try {
            JSONArray arr = new JSONArray(json);
            if (arr.length() > 100) {
                call.reject("Solo se conservan las últimas 100 intervenciones.");
                return;
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] result = cipher.doFinal(json.getBytes(StandardCharsets.UTF_8));
            String encoded = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                + "." + Base64.encodeToString(result, Base64.NO_WRAP);
            if (!getContext().getSharedPreferences(PREF, 0)
                    .edit().putString(FIELD, encoded).commit()) {
                throw new IllegalStateException("No se pudo confirmar el guardado.");
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("No se pudo cifrar y guardar el historial", error);
        }
    }

    @PluginMethod
    public void borrar(PluginCall call) {
        if (!getContext().getSharedPreferences(PREF, 0)
                .edit().remove(FIELD).commit()) {
            call.reject("No se pudo eliminar el historial local.");
            return;
        }
        call.resolve();
    }
}
