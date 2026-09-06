/**
 * Normaliza la URL del proyecto de Supabase a su origen.
 *
 * En el panel de Supabase conviven el "Project URL" y el endpoint REST, y es
 * muy fácil copiar el segundo. Pegar `https://xxx.supabase.co/rest/v1/` deja la
 * app inservible con un "invalid path specified in request URL" que no dice
 * dónde está el fallo. Quedarnos con el origen hace que ambas formas funcionen.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/^['"]|['"]$/g, '')
  if (!trimmed) return ''
  try {
    return new URL(trimmed).origin
  } catch {
    // No parsea como URL (le falta el esquema, por ejemplo): al menos quitamos
    // las barras finales para no generar rutas con doble barra.
    return trimmed.replace(/\/+$/, '')
  }
}
