package pe.myteacheria.alumno;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** Activar los módulos nativos de My Teacher IA. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SesionSeguraPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
