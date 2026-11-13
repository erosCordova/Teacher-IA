package pe.myteacheria.alumno;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.util.Log;

import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Inicio de sesión mediante la interfaz de cuentas del sistema Android.
 * Nunca abre accounts.google.com dentro del WebView ni recibe contraseñas.
 * El token de Google se entrega solo a la interfaz en memoria, que lo envía
 * por HTTPS al backend /auth/google para verificar firma y audiencia.
 */
@CapacitorPlugin(name = "AccesoGoogleNativo")
public final class AccesoGoogleNativoPlugin extends Plugin {
    private final AtomicBoolean ocupado = new AtomicBoolean(false);

    /**
     * SHA-1 PÚBLICO del certificado realmente instalado en el teléfono.
     * Evita usar la huella de otro APK con clave temporal diferente.
     * Ni la clave privada ni tokens de usuario se consultan o registran.
     */
    @SuppressWarnings("deprecation")
    private String huellaFirmaSha1() throws Exception {
        PackageManager pm = getContext().getPackageManager();
        String nombre = getContext().getPackageName();
        Signature[] firmas;
        if (Build.VERSION.SDK_INT >= 28) {
            PackageInfo info = pm.getPackageInfo(nombre, PackageManager.GET_SIGNING_CERTIFICATES);
            if (info.signingInfo == null) throw new IllegalStateException("Firma no disponible");
            firmas = info.signingInfo.getApkContentsSigners();
        } else {
            PackageInfo info = pm.getPackageInfo(nombre, PackageManager.GET_SIGNATURES);
            firmas = info.signatures;
        }
        if (firmas == null || firmas.length == 0) {
            throw new IllegalStateException("No hay certificado de firma");
        }
        byte[] digest = MessageDigest.getInstance("SHA-1").digest(firmas[0].toByteArray());
        StringBuilder hex = new StringBuilder(59);
        for (int index = 0; index < digest.length; index++) {
            if (index > 0) hex.append(':');
            hex.append(String.format(java.util.Locale.US, "%02X", digest[index] & 0xff));
        }
        return hex.toString();
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject result = new JSObject();
        result.put("native", true);
        result.put("embeddedWebView", false);
        result.put("provider", "android-credential-manager");
        result.put("paqueteAndroid", getContext().getPackageName());
        try {
            result.put("firmaSha1", huellaFirmaSha1());
            result.put("firmaConsultada", true);
        } catch (Exception error) {
            result.put("firmaSha1", "");
            result.put("firmaConsultada", false);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void iniciar(PluginCall call) {
        String webClientId = call.getString("clientId", "").trim();
        if (!webClientId.matches("^[0-9]+-[A-Za-z0-9_-]+\\.apps\\.googleusercontent\\.com$")) {
            call.reject("El cliente de Google no está configurado correctamente.");
            return;
        }
        if (!ocupado.compareAndSet(false, true)) {
            call.reject("Ya hay una identificación con Google en curso.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                GetSignInWithGoogleOption option =
                    new GetSignInWithGoogleOption.Builder(webClientId).build();
                GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(option).build();

                CredentialManager.create(getContext()).getCredentialAsync(
                    getActivity(), request, null, getContext().getMainExecutor(),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse response) {
                            ocupado.set(false);
                            Credential credencial = response.getCredential();
                            if (!(credencial instanceof CustomCredential)) {
                                call.reject("El dispositivo devolvió una credencial no compatible.");
                                return;
                            }
                            CustomCredential google = (CustomCredential) credencial;
                            if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                                    .equals(google.getType())) {
                                call.reject("Google no proporcionó una identidad verificable.");
                                return;
                            }
                            try {
                                String idToken = GoogleIdTokenCredential
                                    .createFrom(google.getData()).getIdToken();
                                if (idToken == null || idToken.length() < 40) {
                                    call.reject("Google no entregó un token de identidad válido.");
                                    return;
                                }
                                JSObject result = new JSObject();
                                result.put("credential", idToken);
                                call.resolve(result);
                            } catch (RuntimeException ex) {
                                call.reject("No fue posible interpretar la identidad de Google.");
                            }
                        }

                        @Override
                        public void onError(GetCredentialException error) {
                            ocupado.set(false);
                            // Android puede devolver CancellationException aunque
                            // ningún estudiante haya cerrado el selector de cuentas.
                            // NO atribuir automáticamente la cancelación al usuario.
                            String tipo = error.getClass().getSimpleName();
                            Log.w("MyTeacherGoogle", "Credential Manager no completó acceso: " + tipo);
                            if (error instanceof GetCredentialCancellationException) {
                                call.reject(
                                    "Google no completó el acceso. Si no cerraste la ventana, "
                                    + "comprueba que Google Cloud tenga registrado el cliente "
                                    + "OAuth Android con el paquete y SHA-1 de ESTA instalación.",
                                    "GOOGLE_AUTORIZACION_NO_COMPLETADA");
                            } else {
                                call.reject(
                                    "Google no pudo iniciar sesión en Android (" + tipo + "). "
                                    + "Revisa Google Play Services, tu cuenta y el cliente OAuth Android.",
                                    "GOOGLE_CREDENTIAL_ERROR");
                            }
                        }
                    }
                );
            } catch (Exception ex) {
                ocupado.set(false);
                call.reject("No está disponible el inicio de sesión nativo de Google.");
            }
        });
    }
}
