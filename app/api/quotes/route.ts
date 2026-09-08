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

// Cinco minutos, no uno. Los proveedores gratuitos racionan por día, y un
// portafolio personal no cambia de decisión por 60 segundos de precio.
const CACHE_TTL_MS = 5 * 60_000
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36'

// Caché en memoria: evita golpear a los proveedores en cada render y respeta
// sus límites. Al ser una app personal, un único proceso es suficiente.
const cache = new Map<string, { quote: Quote; at: number }>()

/** Un par cripto del estilo BTC-USD; el resto se trata como renta variable. */
const esCripto = (symbol: string) => /-(USD|USDT)$/i.test(symbol)

/**
 * Resume el cuerpo de una respuesta que no era lo esperado.
 *
 * Volcarlo tal cual llenaba el aviso de la app de «<!DOCTYPE html><html>…»,
 * que ocupa tres líneas y no dice nada. Cuando llega HTML es que el proveedor
 * nos ha mandado a una página —bloqueo, consentimiento o redirección—, y eso
 * es lo que hay que leer.
 */
function resumirCuerpo(cuerpo: string): string {
  const t = cuerpo.trim()
  if (/^<(!doctype|html|\?xml)/i.test(t)) return 'devolvió una página HTML (bloqueado o redirigido)'
  return t.slice(0, 70) || 'respuesta vacía'
}

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

/** Yahoo, en sus dos hosts: query2 a veces contesta cuando query1 rechaza. */
async function yahoo(symbol: string, host: 'query1' | 'query2'): Promise<Resultado> {
  const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) return { error: `HTTP ${res.status}` }

  const meta = (await res.json())?.chart?.result?.[0]?.meta
  const price = Number(meta?.regularMarketPrice)
  if (!price) return { error: 'respuesta sin precio' }
  const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price)
  return arma(symbol, price, prev, `yahoo:${host}`, meta.currency ?? 'USD')
}

/**
 * Stooq: CSV sin llave ni límites agresivos, y responde bien desde servidores.
 * Cubre acciones y ETF estadounidenses con el sufijo `.us`.
 */
async function stooq(symbol: string): Promise<Resultado> {
  if (esCripto(symbol)) return { error: 'no aplica a cripto' }

  const dia = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  const hoy = new Date()
  const desde = new Date(hoy.getTime() - 12 * 86_400_000)
  const s = `${symbol.toLowerCase()}.us`
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d&d1=${dia(desde)}&d2=${dia(hoy)}`

  const res = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
  if (!res.ok) return { error: `HTTP ${res.status}` }

  // Date,Open,High,Low,Close,Volume — una fila por sesión, la última al final.
  const cuerpo = (await res.text()).trim()
  const filas = cuerpo.split('\n').slice(1).filter(Boolean)
  // Stooq contesta 200 con un texto plano cuando raciona ("Exceeded the daily
  // hits limit"). Sin mirar el cuerpo, eso se confundía con "no hay datos".
  if (!filas.length) return { error: resumirCuerpo(cuerpo) }

  const cierre = (fila: string) => Number(fila.split(',')[4])
  const price = cierre(filas[filas.length - 1])
  if (!price) return { error: resumirCuerpo(cuerpo) }
  const prev = filas.length > 1 ? cierre(filas[filas.length - 2]) || price : price
  return arma(symbol, price, prev, 'stooq')
}

/** Coinbase para los pares cripto: sin llave y estable desde servidores. */
async function coinbase(symbol: string): Promise<Resultado> {
  if (!esCripto(symbol)) return { error: 'solo cripto' }

  const par = symbol.toUpperCase().replace(/-USDT$/, '-USD')
  const spot = async (fecha?: string) => {
    const url = `https://api.coinbase.com/v2/prices/${encodeURIComponent(par)}/spot${fecha ? `?date=${fecha}` : ''}`
    const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
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
 * Twelve Data: la salida cuando ninguna fuente abierta sirve.
 *
 * Yahoo responde 429 a las IP de Vercel y Stooq devuelve una página HTML en
 * vez del CSV, así que desplegado no queda ninguna gratuita en pie. Su plan
 * libre da 800 llamadas al día —de sobra para una cartera personal con la
 * caché de este proxy— y cubre tanto el precio como el histórico, que es la
 * otra mitad del problema.
 *
 * Se pide la llave en https://twelvedata.com y se guarda en la variable
 * TWELVE_DATA_API_KEY. Sin ella no se intenta.
 */
async function twelveData(symbol: string): Promise<Resultado> {
  const key = process.env.TWELVE_DATA_API_KEY
  if (!key) return { error: 'sin TWELVE_DATA_API_KEY' }

  // Su convención para cripto es BTC/USD, no BTC-USD.
  const s = esCripto(symbol) ? symbol.toUpperCase().replace('-', '/') : symbol.toUpperCase()
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(s)}&apikey=${key}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return { error: `HTTP ${res.status}` }

  const q = await res.json()
  if (q?.status === 'error') return { error: String(q.message ?? 'error').slice(0, 70) }
  const price = Number(q?.close)
  if (!price) return { error: 'respuesta sin precio' }
  return arma(symbol, price, Number(q?.previous_close ?? price), 'twelve-data', q?.currency ?? 'USD')
}

/** Respaldo opcional. Solo se intenta si hay llave configurada. */
async function alphaVantage(symbol: string): Promise<Resultado> {
  const key = process.env.ALPHA_VANTAGE_API_KEY
  if (!key) return { error: 'sin ALPHA_VANTAGE_API_KEY' }

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return { error: `HTTP ${res.status}` }

  const q = (await res.json())?.['Global Quote']
  const price = Number(q?.['05. price'])
  if (!price) return { error: 'respuesta sin precio (¿límite de llamadas?)' }
  return arma(symbol, price, Number(q?.['08. previous close'] ?? price), 'alpha-vantage')
}

const FUENTES: [string, (s: string) => Promise<Resultado>][] = [
  ['yahoo:query1', (s) => yahoo(s, 'query1')],
  ['yahoo:query2', (s) => yahoo(s, 'query2')],
  ['coinbase', coinbase],
  ['stooq', stooq],
  ['twelve-data', twelveData],
  ['alpha-vantage', alphaVantage],
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
