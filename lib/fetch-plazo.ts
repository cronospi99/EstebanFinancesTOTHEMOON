/**
 * `fetch` con plazo, para las llamadas del servidor a proveedores externos.
 *
 * Las rutas de mercado consultan varias fuentes en cadena, y `fetch` no tiene
 * límite de tiempo propio. Una fuente que acepta la conexión y no contesta
 * —Yahoo lo hace con bastante alegría desde las IP de los centros de datos—
 * no falla: se queda esperando, y con ella la cadena entera. El cliente aborta
 * a los 12 segundos y el usuario ve «sin cotizaciones» sin que se haya llegado
 * nunca a la fuente que sí funcionaba, que estaba dos posiciones más abajo.
 *
 * Con plazo, una fuente muerta cuesta unos segundos y la cadena sigue.
 */
export async function fetchConPlazo(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    // El motivo importa: «no contestó a tiempo» es un diagnóstico útil y
    // «AbortError» no dice nada a quien lee el aviso en la app.
    if ((e as Error)?.name === 'AbortError') throw new Error(`sin respuesta en ${ms / 1000} s`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}
