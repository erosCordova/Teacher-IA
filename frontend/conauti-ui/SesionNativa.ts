/**
 * El backend conserva la autoridad de la sesión. En Android el token del alumno
 * se guarda cifrado con Android Keystore, fuera del almacenamiento de la web.
 * Si se pierde la clave del dispositivo, no restaura el token: exige reingreso.
 */
type SesionSegura = {
  guardar(options: { token: string }): Promise<void>
  leer(): Promise<{ token: string | null }>
  borrar(): Promise<void>
}
type CapacitorBridge = {
  isNativePlatform?: () => boolean
  Plugins?: { SesionSegura?: SesionSegura }
  registerPlugin?: (name: string) => SesionSegura
}
declare global {
  interface Window {
    Capacitor?: CapacitorBridge
  }
}
export function sesionNativaDisponible(): boolean {
  return Boolean(window.Capacitor?.isNativePlatform?.())
}
function plugin(): SesionSegura | undefined {
  const capacitor = window.Capacitor
  return capacitor?.Plugins?.SesionSegura ?? capacitor?.registerPlugin?.('SesionSegura')
}
export async function recuperarSesionAndroid(): Promise<string | null> {
  if (!sesionNativaDisponible()) return null
  const vault = plugin()
  if (!vault) return null
  const result = await vault.leer()
  return result.token ?? null
}
export async function protegerSesionAndroid(token: string): Promise<void> {
  if (!sesionNativaDisponible()) return
  const vault = plugin()
  if (!vault) throw new Error('Almacenamiento seguro no disponible en Android')
  await vault.guardar({ token })
}
export async function eliminarSesionAndroid(): Promise<void> {
  if (!sesionNativaDisponible()) return
  await plugin()?.borrar()
}
