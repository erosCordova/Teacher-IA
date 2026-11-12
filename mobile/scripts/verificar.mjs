import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobile = resolve(fileURLToPath(new URL('..', import.meta.url)))
const root = resolve(mobile, '..')
const readJSON = path => JSON.parse(readFileSync(resolve(mobile, path), 'utf8'))

const config = readJSON('capacitor.config.json')
const pkg = readJSON('package.json')
const progress = readJSON('progreso.json')
assert.equal(config.appName, 'My Teacher IA')
for (const path of [
  'native/android/MotorLocalPlugin.java',
  'native/cpp/CMakeLists.txt',
  'native/cpp/teacher_llama.cpp',
  'scripts/preparar_motor_android.sh'
]) {
  assert(existsSync(resolve(mobile, path)), 'Falta el motor local: ' + path)
}
assert.equal(config.webDir, '../frontend/dist-conauti')
assert.equal(config.server?.hostname, 'localhost')
assert.equal(config.server?.androidScheme, 'http')
assert.equal(config.server?.url, undefined, 'La app debe distribuir el frontend, no depender de una web remota')
assert.equal(pkg.dependencies['@capacitor/core'], pkg.dependencies['@capacitor/android'])
assert.equal(pkg.dependencies['@capacitor/core'], pkg.devDependencies['@capacitor/cli'])
assert.equal(progress.milestones.reduce((sum, step) => sum + step.weight, 0), 100)

const allowed = new Set(['pending', 'in_progress', 'completed'])
assert(progress.milestones.every(step => allowed.has(step.status) && step.weight > 0))
const advanced = progress.milestones
  .filter(step => step.status === 'completed')
  .reduce((sum, step) => sum + step.weight, 0)
const partial = progress.milestones.filter(step => step.status === 'in_progress')
assert(partial.length <= 1, 'Solo debe haber un hito en progreso para no inflar el porcentaje')

const apiSource = readFileSync(resolve(root, 'frontend/conauti-ui/apiFetch.ts'), 'utf8')
assert.match(apiSource, /my-teacher-ia-api\.onrender\.com/, 'Falta backend HTTPS externo')
assert.match(apiSource, /capacitor|nativa|native/i, 'Falta reconocer el origen del WebView móvil')
const html = resolve(root, 'frontend/dist-conauti/index.html')
assert(existsSync(html), 'Primero ejecutar npm run build:conauti en frontend')
const appHtml = readFileSync(html, 'utf8')
assert.match(appHtml, /My Teacher IA/)
console.log('Configuración móvil verificada')
console.log('Nombre:', config.appName)
console.log('Origen nativo:', config.server.androidScheme + '://' + config.server.hostname)
console.log('Bundle web:', config.webDir)
console.log('Porcentaje ponderado terminado:', advanced + '%')
console.log('Hito activo:', partial.map(step => step.id + '. ' + step.name).join(' | ') || 'ninguno')
