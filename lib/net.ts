/**
 * Peticiones de red con plazo.
 *
 * `fetch` no tiene límite de tiempo propio: si la conexión se queda a medias,
 * la promesa nunca se resuelve ni se rechaza. En un navegador de escritorio
 * eso casi nunca ocurre, pero en una app instalada en la pantalla de inicio de
 * iOS es el caso normal: al salir de la app el sistema congela el proceso, y
 * al volver las conexiones keep-alive que quedaron abiertas están muertas
 * aunque WebKit siga creyéndolas válidas. La petición que reutiliza una de
 * esas conexiones no falla — se queda esperando indefinidamente.
 *
 * El daño no se queda en esa petición. Safari permite seis conexiones
 * simultáneas por dominio, así que basta con media docena colgadas —el sondeo
 * de precios, la tasa de cambio, las cargas del router al cambiar de pestaña—
 * para que la siguiente ni siquiera salga. Es exactamente lo que se ve como
 * "la app se congeló": el JavaScript sigue corriendo, las animaciones siguen,
 * pero nada que toque la red vuelve a responder y los toques no hacen nada.
 *
 * Con un plazo, la petición muerta se aborta, el hueco de conexión se libera y
 * el siguiente intento abre una conexión nueva y sana.
 */

/** Doce segundos: por encima de cualquier respuesta legítima nuestra. */
export const TIMEOUT_MS = 12_000

export function fetchConTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController()
  let vencido = false
  const timer = setTimeout(() => { vencido = true; ctrl.abort() }, ms)

  // Se respeta el signal que traiga quien llama (p. ej. cancelar el sondeo
  // anterior de cotizaciones): abortar cualquiera de los dos aborta la petición.
  const externa = init.signal
  const propagar = () => ctrl.abort()
  if (externa) {
    if (externa.aborted) ctrl.abort()
    else externa.addEventListener('abort', propagar, { once: true })
  }

  return fetch(input, { ...init, signal: ctrl.signal })
    .catch((e) => {
      // Agotar el plazo y que te cancelen llegan los dos como AbortError, pero
      // significan cosas opuestas: lo primero es un fallo que el usuario
      // debería ver, lo segundo es una petición que ya no interesa a nadie.
      if (vencido) throw new DOMException(`La petición superó ${ms} ms`, 'TimeoutError')
      throw e
    })
    .finally(() => {
      clearTimeout(timer)
      externa?.removeEventListener('abort', propagar)
    })
}

/** True solo si la petición se canceló a propósito (no si venció el plazo). */
export const esCancelacion = (e: unknown) => (e as Error | undefined)?.name === 'AbortError'
