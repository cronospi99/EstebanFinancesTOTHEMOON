import { NextResponse } from 'next/server'
import { fetchConPlazo } from '@/lib/fetch-plazo'
import { motivoTwelveData, simboloTwelveData, twelveDataKey } from '@/lib/twelve-data'

/**
 * Series históricas de cierre, para dibujar el rendimiento del portafolio.
 *
 * Va aparte de /api/quotes porque responde a otra pregunta —cómo llegó hasta
 * aquí, no cuánto vale ahora— y porque se pide mucho menos a menudo: los
 * cierres de días pasados no cambian, así que se guardan seis horas.
 *
 * GET /api/history?symbols=VOO,SCHD&days=365
 * → { series: { VOO: [{ d: '2026-01-02', c: 512.3 }, …] }, fallos: [...] }
 */

export const runtime = 'nodejs'
export const revalidate = 0

const TTL_MS = 6 * 60 * 60_000

/**
 * Plazo por fuente. Más holgado que en /api/quotes porque aquí viaja una serie
 * entera y no un número, pero acotado: sin él, una fuente que acepta la
 * conexión y no contesta se lleva por delante a las que vienen detrás.
 */
const PLAZO_MS = 6_000
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36'

export interface Punto { d: string; c: number }

const cache = new Map<string, { serie: Punto[]; at: number }>()

const esCripto = (s: string) => /-(USD|USDT)$/i.test(s)
const dia = (t: number) => new Date(t).toISOString().slice(0, 10)

/** Resume un cuerpo inesperado: el HTML crudo llenaba el aviso sin decir nada. */
function resumirCuerpo(cuerpo: string): string {
  const t = cuerpo.trim()
  if (/^<(!doctype|html|\?xml)/i.test(t)) return 'devolvió una página HTML (bloqueado o redirigido)'
  return t.slice(0, 70) || 'respuesta vacía'
}

type Resultado = Punto[] | { error: string }
const esError = (r: Resultado): r is { error: string } => !Array.isArray(r)

/** Yahoo devuelve toda la serie en una sola llamada; es la fuente ideal. */
async function yahoo(symbol: string, days: number, host: 'query1' | 'query2'): Promise<Resultado> {
  const range = days <= 7 ? '1mo' : days <= 35 ? '3mo' : days <= 100 ? '6mo' : days <= 400 ? '2y' : '10y'
  const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  const res = await fetchConPlazo(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' }, PLAZO_MS)
  if (!res.ok) return { error: `HTTP ${res.status}` }

  const r = (await res.json())?.chart?.result?.[0]
  const ts: number[] = r?.timestamp ?? []
  const cierres: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? []
  if (!ts.length) return { error: 'respuesta sin serie' }

  const serie: Punto[] = []
  for (let i = 0; i < ts.length; i++) {
    const c = cierres[i]
    if (typeof c === 'number' && c > 0) serie.push({ d: dia(ts[i] * 1000), c })
  }
  return serie.length ? serie : { error: 'serie vacía' }
}

/** Stooq: CSV diario, sin llave. Acciones y ETF estadounidenses. */
async function stooq(symbol: string, days: number): Promise<Resultado> {
  if (esCripto(symbol)) return { error: 'no aplica a cripto' }

  const fmt = (t: number) => dia(t).replace(/-/g, '')
  const hoy = Date.now()
  // Un margen generoso: los fines de semana y festivos no cotizan.
  const desde = hoy - (days + 20) * 86_400_000
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&i=d&d1=${fmt(desde)}&d2=${fmt(hoy)}`

  const res = await fetchConPlazo(url, { headers: { 'User-Agent': UA }, cache: 'no-store' }, PLAZO_MS)
  if (!res.ok) return { error: `HTTP ${res.status}` }

  const cuerpo = (await res.text()).trim()
  const filas = cuerpo.split('\n').slice(1).filter(Boolean)
  if (!filas.length) return { error: resumirCuerpo(cuerpo) }

  const serie: Punto[] = []
  for (const fila of filas) {
    const p = fila.split(',')
    const c = Number(p[4])
    if (p[0] && c > 0) serie.push({ d: p[0], c })
  }
  return serie.length ? serie : { error: resumirCuerpo(cuerpo) }
}

/** Velas diarias públicas de Coinbase para los pares cripto. */
async function coinbase(symbol: string, days: number): Promise<Resultado> {
  if (!esCripto(symbol)) return { error: 'solo cripto' }

  const par = symbol.toUpperCase().replace(/-USDT$/, '-USD')
  // La API devuelve como mucho 300 velas por llamada.
  const desde = new Date(Date.now() - Math.min(days, 300) * 86_400_000).toISOString()
  const url = `https://api.exchange.coinbase.com/products/${encodeURIComponent(par)}/candles`
    + `?granularity=86400&start=${desde}&end=${new Date().toISOString()}`

  const res = await fetchConPlazo(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' }, PLAZO_MS)
  if (!res.ok) return { error: `HTTP ${res.status}` }

  // [time, low, high, open, close, volume], de más reciente a más antigua.
  const velas: number[][] = await res.json()
  if (!Array.isArray(velas) || !velas.length) return { error: 'sin velas' }

  const serie = velas
    .filter((v) => Array.isArray(v) && v[4] > 0)
    .map((v) => ({ d: dia(v[0] * 1000), c: v[4] }))
    .sort((a, b) => a.d.localeCompare(b.d))
  return serie.length ? serie : { error: 'velas sin cierre' }
}

/**
 * Twelve Data, con llave. Es la salida cuando ninguna fuente abierta sirve:
 * Yahoo responde 429 a las IP de Vercel y Stooq devuelve HTML en vez de CSV.
 * La misma llave cubre precio e histórico. Variable: TWELVE_DATA_API_KEY.
 */
async function twelveData(symbol: string, days: number): Promise<Resultado> {
  const key = twelveDataKey()
  if (!key) return { error: 'sin TWELVE_DATA_API_KEY' }

  const s = simboloTwelveData(symbol, esCripto(symbol))
  // Su tope por llamada es 5.000 velas; de sobra para cinco años diarios.
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(s)}`
    + `&interval=1day&outputsize=${Math.min(days + 20, 5000)}&order=ASC&apikey=${key}`

  const res = await fetchConPlazo(url, { cache: 'no-store' }, PLAZO_MS)

  const j = await res.json().catch(() => null)
  const fallo = motivoTwelveData(res.status, j)
  if (fallo) return { error: fallo }

  const valores: { datetime: string; close: string }[] = j?.values ?? []
  const serie = valores
    .map((v) => ({ d: String(v.datetime).slice(0, 10), c: Number(v.close) }))
    .filter((p) => p.d && p.c > 0)
  return serie.length ? serie : { error: 'serie vacía' }
}

type Fuente = [string, (s: string, d: number) => Promise<Resultado>]

/** Mismo criterio que en /api/quotes: con llave, Twelve Data delante. */
function fuentes(): Fuente[] {
  const abiertas: Fuente[] = [
    ['coinbase', coinbase],
    ['yahoo:query1', (s, d) => yahoo(s, d, 'query1')],
    ['yahoo:query2', (s, d) => yahoo(s, d, 'query2')],
    ['stooq', stooq],
  ]
  const [cripto, ...resto] = abiertas
  const td: Fuente = ['twelve-data', twelveData]
  return twelveDataKey() ? [cripto, td, ...resto] : [...abiertas, td]
}

async function getSerie(symbol: string, days: number, fallos: string[]): Promise<Punto[]> {
  const clave = `${symbol}|${days}`
  const hit = cache.get(clave)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.serie

  const motivos: string[] = []
  for (const [nombre, fn] of fuentes()) {
    try {
      const r = await fn(symbol, days)
      if (!esError(r)) {
        cache.set(clave, { serie: r, at: Date.now() })
        return r
      }
      motivos.push(`${nombre} ${r.error}`)
    } catch (e) {
      motivos.push(`${nombre} ${(e as Error).message}`)
    }
  }

  fallos.push(`${symbol}: ${motivos.join(' · ')}`)
  return hit?.serie ?? []
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbols = [...new Set((searchParams.get('symbols') ?? '').split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 25)
  const days = Math.min(Math.max(Number(searchParams.get('days')) || 365, 5), 1900)

  if (!symbols.length) return NextResponse.json({ error: 'Falta el parámetro "symbols"' }, { status: 400 })

  const fallos: string[] = []
  const pares = await Promise.all(symbols.map(async (s) => [s, await getSerie(s, days, fallos)] as const))

  return NextResponse.json(
    { series: Object.fromEntries(pares), fetchedAt: new Date().toISOString(), fallos },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
