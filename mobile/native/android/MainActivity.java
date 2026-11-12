package pe.myteacheria.alumno;

import android.os.Bundle;
import android.content.pm.ApplicationInfo;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/** Activar los módulos nativos de My Teacher IA. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Solo APK debug: permitir DevTools para pruebas de WebView en CI.
        // Está prohibido en release para proteger los datos del estudiante.
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        registerPlugin(SesionSeguraPlugin.class);
        registerPlugin(ModeloEducativoPlugin.class);
        registerPlugin(MotorLocalPlugin.class);
        registerPlugin(HistorialLocalPlugin.class);
        registerPlugin(VozLocalPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
