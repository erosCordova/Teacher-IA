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

/**
 * Sesión del estudiante cifrada con Android Keystore (AES/GCM).
 * Solo guarda el token de acceso; jamás almacena contraseñas.
 * Se llama exclusivamente desde la WebView nativa vía Capacitor.
 */
@CapacitorPlugin(name = "SesionSegura")
public final class SesionSeguraPlugin extends Plugin {
    private static final String PREF = "myteacheria_session";
    private static final String FIELD = "encrypted_token";
    private static final String ALIAS = "myteacheria_session_aes_v1";

    private SecretKey key() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (!keyStore.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
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
        return (SecretKey) keyStore.getKey(ALIAS, null);
    }

    @PluginMethod
    public void guardar(PluginCall call) {
        String value = call.getString("token", "");
        if (value.isEmpty() || value.length() > 2048) {
            call.reject("Token ausente o inválido");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            String saved = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                + "." + Base64.encodeToString(encrypted, Base64.NO_WRAP);
            getContext().getSharedPreferences(PREF, 0).edit()
                .putString(FIELD, saved).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo proteger la sesión", e);
        }
    }

    @PluginMethod
    public void leer(PluginCall call) {
        JSObject result = new JSObject();
        String saved = getContext().getSharedPreferences(PREF, 0)
            .getString(FIELD, null);
        if (saved == null) {
            result.put("token", JSObject.NULL);
            call.resolve(result);
            return;
        }
        try {
            String[] pieces = saved.split("\\.", 2);
            if (pieces.length != 2) throw new IllegalArgumentException("Formato");
            byte[] nonce = Base64.decode(pieces[0], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(pieces[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            String decoded = new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
            result.put("token", decoded);
            call.resolve(result);
        } catch (Exception e) {
            getContext().getSharedPreferences(PREF, 0).edit().remove(FIELD).apply();
            result.put("token", JSObject.NULL);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void borrar(PluginCall call) {
        getContext().getSharedPreferences(PREF, 0).edit().remove(FIELD).apply();
        call.resolve();
    }
}
