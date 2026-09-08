/**
 * Finnhub: la fuente de precios en vivo.
 *
 * Se eligió por el único número que importaba aquí. El plan gratuito de Twelve
 * Data da ocho llamadas por minuto y esta cartera tiene diez posiciones, así
 * que cada refresco pedía diez precios y el proveedor rechazaba los últimos:
 * el portafolio no podía valorarse entero ni una sola vez. Finnhub da sesenta
 * por minuto en su plan gratuito, con cotización en tiempo real de acciones y
 * ETF estadounidenses, que es exactamente lo que hay en la cartera.
 *
 * Lo que no cubre gratis es el histórico —sus velas son de pago—, así que el
 * histórico se queda en Twelve Data, donde entra de sobra: al guardarse seis
 * horas, gasta unos pocos créditos al día.
 *
 * Se pide la llave en https://finnhub.io y se guarda en FINNHUB_API_KEY.
 */

/** La llave, o `null`. Una variable vacía no es una llave. */
export const finnhubKey = () => process.env.FINNHUB_API_KEY?.trim() || null

/**
 * Traduce un fallo de Finnhub a algo accionable, o `null` si no lo hubo.
 *
 * Sus dos errores se arreglan de formas opuestas —una llave mal copiada se
 * corrige en las variables de entorno, el límite por minuto solo se corrige
 * esperando— y como «HTTP 401» y «HTTP 429» se leían igual, no había forma de
 * saber cuál de los dos tenías delante.
 */
export function motivoFinnhub(status: number, cuerpo: any): string | null {
  if (status >= 200 && status < 300) return null
  // Finnhub distingue las dos: 401 es la llave, 403 es el plan. Confundirlas
  // manda a revisar la variable de entorno a quien lo que necesita es otro
  // endpoint —sus velas históricas, por ejemplo, son de pago—.
  if (status === 401) return 'llave rechazada (revisa FINNHUB_API_KEY)'
  if (status === 403) return 'el plan gratuito no cubre este dato'
  if (status === 429) return 'límite de 60 llamadas por minuto alcanzado'
  return String(cuerpo?.error ?? `HTTP ${status}`).slice(0, 70)
}
