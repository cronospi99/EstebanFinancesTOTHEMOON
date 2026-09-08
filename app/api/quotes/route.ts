import { NextResponse } from 'next/server'
import { fetchConPlazo } from '@/lib/fetch-plazo'
import { finnhubKey, motivoFinnhub } from '@/lib/finnhub'
import { motivoTwelveData, simboloTwelveData, twelveDataKey } from '@/lib/twelve-data'
import type { Quote } from '@/lib/types'

/**
 * Proxy de cotizaciones.
 *
 * Existe porque las llaves de API no deben llegar al bundle del cliente y
 * porque ningún proveedor de estos envía cabeceras CORS.
 *
 * Tres fuentes, no seis
 * ---------------------
 * Antes había seis en cadena y cuatro de ellas no servían desde un servidor.
 * Quedaron fuera con motivo, no por limpieza:
 *
 *  - **Yahoo** (sus dos hosts) devuelve 429 a las IP de los centros de datos.
 *    Funciona en local y nunca en el despliegue, que es la peor combinación
 *    posible: parece que está y no está.
 *  - **Stooq** contesta 200 con una página HTML en vez del CSV.
 *  - **Alpha Vantage** da 25 llamadas al día en su plan gratuito. Con diez
 *    posiciones eso son dos refrescos y medio: no es una fuente, es un gesto.
 *
 * Las tres gastaban plazo en cada consulta y llenaban el aviso de la app de
 * ruido que no se podía accionar.
 *
 * Lo que queda cubre la cartera entera:
 *
 *  - **Coinbase** para los pares cripto. Sin llave, sin cupo, estable desde
 *    servidores.
 *  - **Finnhub** para acciones y ETF. Sesenta llamadas por minuto en el plan
 *    gratuito, que es lo que hacía falta: con Twelve Data por delante (ocho
 *    por minuto) una cartera de diez posiciones no se podía valorar entera ni
 *    una vez, porque las dos últimas siempre volvían con 429.
 *  - **Twelve Data** de respaldo, para lo que Finnhub no conozca.
 *
 * GET /api/quotes?symbols=AAPL,VOO,BTC-USD
 */

export const runtime = 'nodejs'
export const revalidate = 0

// Cinco minutos, no uno. Los proveedores gratuitos racionan, y un portafolio
// personal no cambia de decisión por 60 segundos de precio.
const CACHE_TTL_MS = 5 * 60_000

/**
 * Plazo por fuente. `fetch` no tiene límite propio: una fuente que acepta la
 * conexión y no contesta se lleva por delante a las que vienen detrás, y el
 * cliente corta a los doce segundos sin haber llegado a la que sí funcionaba.
 */
const PLAZO_MS = 3_500

// Caché en memoria: evita golpear a los proveedores en cada render y respeta
// sus límites. Al ser una app personal, un único proceso es suficiente.
const cache = new Map<string, { quote: Quote; at: number }>()

/** Un par cripto del estilo BTC-USD; el resto se trata como renta variable. */
const esCripto = (symbol: string) => /-(USD|USDT)$/i.test(symbol)

const arma = (symbol: string, price: number, prev: number, source: string, currency = 'USD'): Quote => ({
  symbol,
  price,
  previousClose: prev,
  change: price - prev,
  changePercent: prev ? ((price - prev) / prev) * 100 : 0,
  currency,
  source,
})

/**
 * Resultado de un proveedor: la cotización, o el motivo de que no la haya.
 *
 * Devolver `null` a secas era el problema: «no hay precio» y «nos están
 * devolviendo 429» se veían igual desde fuera, así que no había forma de saber
 * si el ticker estaba mal escrito o si la fuente nos había cerrado la puerta.
 */
type Resultado = Quote | { error: string }
const esError = (r: Resultado): r is { error: string } => 'error' in r

/** Coinbase para los pares cripto: sin llave y estable desde servidores. */
async function coinbase(symbol: string): Promise<Resultado> {
  if (!esCripto(symbol)) return { error: 'solo cripto' }

  const par = symbol.toUpperCase().replace(/-USDT$/, '-USD')
  const spot = async (fecha?: string) => {
    const url = `https://api.coinbase.com/v2/prices/${encodeURIComponent(par)}/spot${fecha ? `?date=${fecha}` : ''}`
    const r = await fetchConPlazo(url, { headers: { Accept: 'application/json' }, cache: 'no-store' }, PLAZO_MS)
    if (!r.ok) return null
    const v = Number((await r.json())?.data?.amount)
    return v > 0 ? v : null
  }

  const price = await spot()
  if (!price) return { error: 'sin precio spot' }
  const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const prev = (await spot(ayer).catch(() => null)) ?? price
  return arma(symbol, price, prev, 'coinbase')
}

/**
 * Finnhub: la fuente principal de acciones y ETF.
 *
 * Su plan gratuito da sesenta llamadas por minuto, así que una cartera de diez
 * posiciones refrescándose cada minuto usa la sexta parte del cupo. Cubre los
 * mercados estadounidenses, que es donde está toda la cartera.
 */
async function finnhub(symbol: string): Promise<Resultado> {
  const key = finnhubKey()
  if (!key) return { error: 'sin FINNHUB_API_KEY' }
  // Cripto lo cubre Coinbase, que va delante y no gasta cupo de nadie.
  if (esCripto(symbol)) return { error: 'no aplica a cripto' }

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${key}`
  const res = await fetchConPlazo(url, { headers: { Accept: 'application/json' }, cache: 'no-store' }, PLAZO_MS)

  const q = await res.json().catch(() => null)
  const fallo = motivoFinnhub(res.status, q)
  if (fallo) return { error: fallo }

  // `c` es el precio actual y `pc` el cierre anterior. Un símbolo que no
  // conoce lo contesta con 200 y todo a cero, así que un precio en cero es su
  // forma de decir «no sé cuál es ese», no un valor.
  const price = Number(q?.c)
  if (!price) return { error: 'símbolo desconocido para Finnhub' }
  // No devuelve la divisa; todo lo que cubre gratis cotiza en dólares.
  return arma(symbol, price, Number(q?.pc) || price, 'finnhub')
}

/**
 * Twelve Data: respaldo para lo que Finnhub no conozca.
 *
 * Va de segunda y no de primera por su cupo: ocho llamadas por minuto en el
 * plan gratuito. Es de sobra para el histórico —que se guarda seis horas— y
 * demasiado poco para valorar una cartera entera cada minuto.
 */
async function twelveData(symbol: string): Promise<Resultado> {
  const key = twelveDataKey()
  if (!key) return { error: 'sin TWELVE_DATA_API_KEY' }

  const s = simboloTwelveData(symbol, esCripto(symbol))
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(s)}&apikey=${key}`
  const res = await fetchConPlazo(url, { cache: 'no-store' }, PLAZO_MS)

  const q = await res.json().catch(() => null)
  const fallo = motivoTwelveData(res.status, q)
  if (fallo) return { error: fallo }

  const price = Number(q?.close)
  if (!price) return { error: 'respuesta sin precio' }
  return arma(symbol, price, Number(q?.previous_close ?? price), 'twelve-data', q?.currency ?? 'USD')
}

/**
 * Orden de consulta.
 *
 * Coinbase primero porque descarta al instante lo que no es cripto y no gasta
 * cupo de nadie. Después Finnhub, que es quien tiene el cupo para valorar la
 * cartera entera. Twelve Data al final, para lo que quede suelto.
 */
const FUENTES: [string, (s: string) => Promise<Resultado>][] = [
  ['coinbase', coinbase],
  ['finnhub', finnhub],
  ['twelve-data', twelveData],
]

async function getQuote(symbol: string, fallos: string[]): Promise<Quote> {
  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.quote

  const motivos: string[] = []
  for (const [nombre, fn] of FUENTES) {
    try {
      const r = await fn(symbol)
      if (!esError(r)) {
        cache.set(symbol, { quote: r, at: Date.now() })
        return r
      }
      motivos.push(`${nombre} ${r.error}`)
    } catch (e) {
      motivos.push(`${nombre} ${(e as Error).message}`)
    }
  }

  fallos.push(`${symbol}: ${motivos.join(' · ')}`)

  // Degradación elegante: preferimos un precio viejo marcado como tal antes que
  // romper el portafolio entero por un símbolo.
  if (hit) return { ...hit.quote, stale: true }
  return { symbol, price: 0, previousClose: 0, change: 0, changePercent: 0, currency: 'USD', stale: true }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('symbols') ?? ''
  const symbols = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 25)

  if (!symbols.length) {
    return NextResponse.json({ error: 'Falta el parámetro "symbols"' }, { status: 400 })
  }

  const fallos: string[] = []
  const quotes = await Promise.all(symbols.map((s) => getQuote(s, fallos)))

  return NextResponse.json(
    { quotes, fetchedAt: new Date().toISOString(), fallos },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
