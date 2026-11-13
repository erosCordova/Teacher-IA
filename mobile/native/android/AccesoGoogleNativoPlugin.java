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

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject result = new JSObject();
        result.put("native", true);
        result.put("embeddedWebView", false);
        result.put("provider", "android-credential-manager");
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
                            if (error instanceof GetCredentialCancellationException) {
                                call.reject("Se canceló el inicio de sesión con Google.");
                            } else {
                                call.reject("No se pudo abrir Google en Android. "
                                    + "Comprueba Play Services y la autorización de la aplicación en Google Cloud.");
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
