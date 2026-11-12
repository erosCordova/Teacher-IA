import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const mobile = resolve(fileURLToPath(new URL('..', import.meta.url)))
const pkg = 'pe.myteacheria.alumno'
const source = resolve(mobile, 'native/ModelFilesPlugin.java')
const folder = resolve(mobile, 'android/app/src/main/java', ...pkg.split('.'))
const main = resolve(folder, 'MainActivity.java')
const target = resolve(folder, 'ModelFilesPlugin.java')
assert(existsSync(resolve(mobile, 'android')), 'Primero generar plataforma con cap add android')
assert(existsSync(main), 'No se encontró MainActivity de Capacitor')
assert(readFileSync(source, 'utf8').startsWith('package pe.myteacheria.alumno;'))
mkdirSync(folder, { recursive: true })
writeFileSync(target, readFileSync(source))
const mainContent = [
  'package pe.myteacheria.alumno;',
  '',
  'import android.os.Bundle;',
  'import com.getcapacitor.BridgeActivity;',
  '',
  'public class MainActivity extends BridgeActivity {',
  '  @Override public void onCreate(Bundle savedInstanceState) {',
  '    registerPlugin(ModelFilesPlugin.class);',
  '    super.onCreate(savedInstanceState);',
  '  }',
  '}',
  ''
].join('\n')
writeFileSync(main, mainContent)
assert(readFileSync(main, 'utf8').includes('registerPlugin(ModelFilesPlugin.class)'))
console.log('Android: biblioteca GGUF privada registrada')
