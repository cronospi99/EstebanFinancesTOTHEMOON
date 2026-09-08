import type { Holding, Trade } from './types'

export interface PuntoSerie { date: string; value: number }

export interface SeriePortafolio {
  serie: PuntoSerie[]
  /** Valor al principio y al final del rango, en pesos. */
  inicio: number
  fin: number
  /** Dinero que entró (compras) menos el que salió (ventas) dentro del rango. */
  aportes: number
  /** fin − inicio − aportes: lo que se movió el mercado, no lo que se aportó. */
  variacion: number
  variacionPct: number
  /** Símbolos sin serie de precios: el tramo se valora al costo. */
  sinPrecio: string[]
}

const DIA_MS = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

/**
 * Precio de cierre vigente en una fecha: el último que haya en o antes de
 * ella. Los fines de semana y festivos no cotizan, así que buscar el cierre
 * exacto del día dejaría huecos en la mitad de los puntos.
 */
function cierreEn(serie: { d: string; c: number }[], dia: string): number | null {
  if (!serie.length) return null
  let lo = 0
  let hi = serie.length - 1
  let res: number | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (serie[mid].d <= dia) { res = serie[mid].c; lo = mid + 1 } else hi = mid - 1
  }
  // Antes del primer cierre conocido se usa ese primero: es lo más cercano a
  // la verdad que hay, y mejor que dejar el tramo en cero.
  return res ?? serie[0].c
}

/**
 * Valor del portafolio a lo largo del tiempo.
 *
 * Se reconstruye hacia atrás desde lo que se sabe con certeza —las posiciones
 * de hoy— deshaciendo las operaciones del libro: la cantidad en una fecha es
 * la actual menos todo lo que se compró después, más todo lo que se vendió
 * después. Cada cantidad se multiplica por el cierre de mercado de ese día.
 *
 * Dos aproximaciones, dichas aquí para que no se lean como exactitud:
 *
 *  · La tasa de cambio es la de hoy en toda la serie. No se guarda el
 *    histórico de la divisa, y aplicar la de hoy al pasado distorsiona menos
 *    que descartar las posiciones en dólares.
 *  · Un símbolo sin cierres se valora a su coste promedio, plano. Sale en
 *    `sinPrecio` para que la interfaz pueda advertirlo en vez de fingir.
 */
export function calcularSeriePortafolio({
  holdings, trades, series, fxRate, days, puntos = 60,
}: {
  holdings: Holding[]
  trades: Trade[]
  series: Record<string, { d: string; c: number }[]>
  fxRate: number
  days: number
  puntos?: number
}): SeriePortafolio {
  const ahora = Date.now()
  const n = Math.max(2, Math.min(puntos, days))
  const paso = days / (n - 1)

  const sinPrecio: string[] = []
  for (const h of holdings) {
    if (h.quantity > 0 && !series[h.symbol]?.length) sinPrecio.push(h.symbol)
  }

  const fechas: number[] = []
  for (let k = n - 1; k >= 0; k--) fechas.push(ahora - k * paso * DIA_MS)

  const serie: PuntoSerie[] = fechas.map((t) => {
    const dia = iso(t)
    let total = 0

    for (const h of holdings) {
      // Cantidad en esa fecha: la de hoy deshaciendo lo posterior.
      let unidades = h.quantity
      for (const op of trades) {
        if (op.symbol !== h.symbol) continue
        if (Date.parse(op.occurredAt) <= t) continue
        unidades += op.side === 'buy' ? -op.quantity : op.quantity
      }
      if (unidades <= 0) continue

      const precio = cierreEn(series[h.symbol] ?? [], dia) ?? h.avgCost
      const fx = h.currency === 'USD' ? (fxRate > 0 ? fxRate : 0) : 1
      total += unidades * precio * fx
    }

    return { date: new Date(t).toISOString(), value: Math.round(total) }
  })

  const desde = ahora - days * DIA_MS
  let aportes = 0
  for (const op of trades) {
    const t = Date.parse(op.occurredAt)
    if (t < desde || t > ahora) continue
    const h = holdings.find((x) => x.symbol === op.symbol)
    const fx = (h?.currency ?? op.currency) === 'USD' ? (fxRate > 0 ? fxRate : 0) : 1
    aportes += (op.side === 'buy' ? 1 : -1) * op.quantity * op.price * fx
  }

  const inicio = serie[0]?.value ?? 0
  const fin = serie[serie.length - 1]?.value ?? 0
  const variacion = fin - inicio - aportes
  // La base es lo que había más lo que se metió: sin restar los aportes, una
  // compra grande se leería como un rendimiento enorme.
  const base = inicio + Math.max(aportes, 0)

  return {
    serie,
    inicio,
    fin,
    aportes,
    variacion,
    variacionPct: base > 0 ? (variacion / base) * 100 : 0,
    sinPrecio,
  }
}
