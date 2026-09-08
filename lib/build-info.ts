/**
 * Identidad de la compilación que está sirviendo esta página.
 *
 * Los valores los inyecta `next.config.mjs` en el build, así que viajan dentro
 * del bundle: lo que se lee aquí es lo que se desplegó, no lo que hay en el
 * repositorio. Esa es justo la pregunta que responde —«¿estoy viendo la
 * versión nueva?»— y por eso no puede venir de una llamada al servidor.
 */

export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA || 'local'
export const BUILD_REF = process.env.NEXT_PUBLIC_BUILD_REF || ''
export const BUILD_AT = process.env.NEXT_PUBLIC_BUILD_AT || ''

/** True si esto no salió de un despliegue (desarrollo o build a mano). */
export const esBuildLocal = BUILD_SHA === 'local'

/**
 * Fecha del build en horario local, o cadena vacía si no se sabe.
 *
 * Se llama desde un efecto, nunca al pintar: el servidor y el teléfono no
 * comparten zona horaria y formatearla en el render rompería la hidratación.
 */
export function fechaBuild(): string {
  if (!BUILD_AT) return ''
  const d = new Date(BUILD_AT)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
