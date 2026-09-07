import { NextResponse } from 'next/server'
import type { Quote } from '@/lib/types'

/**
 * Proxy de cotizaciones.
 *
 * Existe por dos razones concretas:
 *  1. Yahoo Finance no envía cabeceras CORS — el navegador no puede llamarlo.
 *  2. La llave de Alpha Vantage se queda aquí, jamás llega al bundle del cliente.
 *
 * Y consulta varias fuentes en cadena por una tercera: Yahoo responde 401 o 429
 * a las IP de los centros de datos con bastante alegría, así que desplegado en
 * Vercel puede fallar siempre aunque en local funcione. Antes esa era la única
 * fuente y el portafolio entero se quedaba en «valorado al costo». Igual que
 * en /api/fx, se informa de qué proveedor respondió y de qué falló, para poder
 * diagnosticarlo desde la propia app en vez de adivinar.
 *
 * GET /api/quotes?symbols=AAPL,VOO,BTC-USD
 */

export const runtime = 'nodejs'
export const revalidate = 0

const CACHE_TTL_MS = 60_000
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36'

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

/** Yahoo, en sus dos hosts: query2 a veces contesta cuando query1 rechaza. */
async function yahoo(symbol: string, host: 'query1' | 'query2'): Promise<Quote | null> {
  const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) return null

  const meta = (await res.json())?.chart?.result?.[0]?.meta
  const price = Number(meta?.regularMarketPrice)
  if (!price) return null
  const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price)
  return arma(symbol, price, prev, `yahoo:${host}`, meta.currency ?? 'USD')
}

/**
 * Stooq: CSV sin llave ni límites agresivos, y responde bien desde servidores.
 * Cubre acciones y ETF estadounidenses con el sufijo `.us`.
 */
async function stooq(symbol: string): Promise<Quote | null> {
  if (esCripto(symbol)) return null

  const dia = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  const hoy = new Date()
  const desde = new Date(hoy.getTime() - 12 * 86_400_000)
  const s = `${symbol.toLowerCase()}.us`
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d&d1=${dia(desde)}&d2=${dia(hoy)}`

  const res = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
  if (!res.ok) return null

  // Date,Open,High,Low,Close,Volume — una fila por sesión, la última al final.
  const filas = (await res.text()).trim().split('\n').slice(1).filter(Boolean)
  if (!filas.length) return null

  const cierre = (fila: string) => Number(fila.split(',')[4])
  const price = cierre(filas[filas.length - 1])
  if (!price) return null
  const prev = filas.length > 1 ? cierre(filas[filas.length - 2]) || price : price
  return arma(symbol, price, prev, 'stooq')
}

/** Coinbase para los pares cripto: sin llave y estable desde servidores. */
async function coinbase(symbol: string): Promise<Quote | null> {
  if (!esCripto(symbol)) return null

  const par = symbol.toUpperCase().replace(/-USDT$/, '-USD')
  const spot = async (fecha?: string) => {
    const url = `https://api.coinbase.com/v2/prices/${encodeURIComponent(par)}/spot${fecha ? `?date=${fecha}` : ''}`
    const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!r.ok) return null
    const v = Number((await r.json())?.data?.amount)
    return v > 0 ? v : null
  }

  const price = await spot()
  if (!price) return null
  const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const prev = (await spot(ayer).catch(() => null)) ?? price
  return arma(symbol, price, prev, 'coinbase')
}

/** Respaldo opcional. Solo se intenta si hay llave configurada. */
async function alphaVantage(symbol: string): Promise<Quote | null> {
  const key = process.env.ALPHA_VANTAGE_API_KEY
  if (!key) return null

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null

  const q = (await res.json())?.['Global Quote']
  const price = Number(q?.['05. price'])
  if (!price) return null
  return arma(symbol, price, Number(q?.['08. previous close'] ?? price), 'alpha-vantage')
}

const FUENTES: [string, (s: string) => Promise<Quote | null>][] = [
  ['yahoo:query1', (s) => yahoo(s, 'query1')],
  ['yahoo:query2', (s) => yahoo(s, 'query2')],
  ['coinbase', coinbase],
  ['stooq', stooq],
  ['alpha-vantage', alphaVantage],
]

async function getQuote(symbol: string, fallos: string[]): Promise<Quote> {
  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.quote

  for (const [nombre, fn] of FUENTES) {
    try {
      const quote = await fn(symbol)
      if (quote) {
        cache.set(symbol, { quote, at: Date.now() })
        return quote
      }
    } catch (e) {
      fallos.push(`${symbol} · ${nombre}: ${(e as Error).message}`)
    }
  }

  // Sin esto, un proveedor que responde 401 o 429 —en vez de lanzar— no dejaba
  // rastro, y desde fuera «no hay precio» y «nos están bloqueando» se veían
  // exactamente igual.
  fallos.push(`${symbol}: ninguna fuente devolvió precio`)

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
