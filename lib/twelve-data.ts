/**
 * Lo que /api/quotes y /api/history comparten sobre Twelve Data.
 *
 * Es la única fuente con llave que cubre las dos mitades del problema —el
 * precio de ahora y la serie de cierres—, así que las dos rutas la consultan
 * y las dos tienen que leer sus errores igual.
 */

/** La llave, o `null`. Una variable vacía en Vercel no es una llave. */
export const twelveDataKey = () => process.env.TWELVE_DATA_API_KEY?.trim() || null

/** Su convención para cripto es BTC/USD, no BTC-USD. */
export const simboloTwelveData = (symbol: string, cripto: boolean) =>
  cripto ? symbol.toUpperCase().replace('-', '/') : symbol.toUpperCase()

/**
 * Traduce un fallo de Twelve Data a algo accionable, o `null` si no lo hubo.
 *
 * Sus dos errores frecuentes se arreglan de formas opuestas y como «HTTP 401»
 * o «HTTP 429» a secas se leían igual: una llave mal copiada se corrige en las
 * variables de entorno, y agotar el cupo del plan gratuito solo se corrige
 * esperando. Manda el motivo en el cuerpo aunque el HTTP no sea 200, así que
 * se mira el cuerpo primero.
 */
export function motivoTwelveData(status: number, cuerpo: any): string | null {
  const esFallo = cuerpo?.status === 'error' || status < 200 || status >= 300
  if (!esFallo) return null

  const code = Number(cuerpo?.code) || status
  if (code === 401) return 'llave rechazada (revisa TWELVE_DATA_API_KEY)'
  if (code === 429) return 'sin llamadas disponibles en el plan gratuito'
  return String(cuerpo?.message ?? `HTTP ${status}`).slice(0, 70)
}
