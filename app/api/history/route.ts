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
 * Dos fuentes, no cinco. Yahoo (sus dos hosts) devuelve 429 a las IP de los
 * centros de datos y Stooq contesta 200 con una página HTML en vez del CSV:
 * ninguna de las tres sirve desde el despliegue, y cada una gastaba plazo y
 * llenaba el aviso de la app de ruido inaccionable.
 *
 * Queda Coinbase para cripto y Twelve Data para lo demás. El histórico se
 * queda en Twelve Data —y no pasa a Finnhub con los precios en vivo— porque
 * las velas de Finnhub son de pago.
 *
 * Una serie por símbolo, no una por rango
 * ---------------------------------------
 * De Twelve Data se pide siempre la ventana larga y se recorta al rango al
 * salir. Antes la caché iba por símbolo *y* días, así que tocar 1D, 5D, 1S y
 * 1M pedía cuatro veces la misma serie diaria: cuatro créditos por posición en
 * cuestión de segundos. Su plan gratuito da ocho créditos por minuto, de modo
 * que a partir de la novena llamada del minuto todo volvía con 429 y esas
 * posiciones se quedaban «al costo» en el gráfico — con una cartera de once
 * ETF, tres se quedaban fuera en cada carga.
 *
 * Con una sola ventana por símbolo, cambiar de rango no cuesta nada y la
 * cartera entera cabe de sobra en el cupo: un crédito por posición cada seis
 * horas.
 *
 * GET /api/history?symbols=VOO,SCHD&days=365
 * → { series: { VOO: [{ d: '2026-01-02', c: 512.3 }, …] }, fallos: [...] }
 */

export const runtime = 'nodejs'
export const revalidate = 0

const TTL_MS = 6 * 60 * 60_000

/**
 * La ventana que se pide siempre, cubra lo que cubra el rango elegido.
 *
 * Son los mismos cierres diarios para todos los rangos, así que pedir la larga
 * una vez y recortar sale por un crédito en vez de por uno cada vez que el
 * dedo toca el selector de rango.
 */
const DIAS_CANONICOS = 1_900
/** Coinbase no devuelve más de 300 velas por llamada. */
const DIAS_CANONICOS_CRIPTO = 300

/**
 * Margen por delante del rango pedido.
 *
 * La curva necesita un cierre *anterior* al primer día que dibuja: sin él, el
 * primer punto de un lunes festivo se queda sin precio y el tramo arranca en
 * el coste. Veinte días cubren cualquier puente.
 */
const MARGEN_DIAS = 20

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

type Resultado = Punto[] | { error: string }
const esError = (r: Resultado): r is { error: string } => !Array.isArray(r)

/** Velas diarias públicas de Coinbase para los pares cripto. */
async function coinbase(symbol: string): Promise<Resultado> {
  if (!esCripto(symbol)) return { error: 'solo cripto' }

  const par = symbol.toUpperCase().replace(/-USDT$/, '-USD')
  const desde = new Date(Date.now() - DIAS_CANONICOS_CRIPTO * 86_400_000).toISOString()
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

/** Twelve Data: series diarias de acciones y ETF. Variable TWELVE_DATA_API_KEY. */
async function twelveData(symbol: string): Promise<Resultado> {
  const key = twelveDataKey()
  if (!key) return { error: 'sin TWELVE_DATA_API_KEY' }

  const s = simboloTwelveData(symbol, esCripto(symbol))
  // Su tope por llamada es 5.000 velas; de sobra para la ventana canónica.
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(s)}`
    + `&interval=1day&outputsize=${DIAS_CANONICOS}&order=ASC&apikey=${key}`

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

const FUENTES: [string, (s: string) => Promise<Resultado>][] = [
  ['coinbase', coinbase],
  ['twelve-data', twelveData],
]

/** Recorta la ventana canónica al rango que se pidió, con su margen. */
const recortar = (serie: Punto[], days: number) => {
  const desde = dia(Date.now() - (days + MARGEN_DIAS) * 86_400_000)
  return serie.filter((p) => p.d >= desde)
}

async function getSerie(symbol: string, days: number, fallos: string[]): Promise<Punto[]> {
  // La clave es el símbolo a secas: la serie guardada sirve para todos los
  // rangos, que es lo que hace que cambiar de rango no cueste créditos.
  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < TTL_MS) return recortar(hit.serie, days)

  const motivos: string[] = []
  for (const [nombre, fn] of FUENTES) {
    try {
      const r = await fn(symbol)
      if (!esError(r)) {
        cache.set(symbol, { serie: r, at: Date.now() })
        return recortar(r, days)
      }
      motivos.push(`${nombre} ${r.error}`)
    } catch (e) {
      motivos.push(`${nombre} ${(e as Error).message}`)
    }
  }

  fallos.push(`${symbol}: ${motivos.join(' · ')}`)
  // Una serie vencida sigue siendo mejor que ninguna: los cierres de días
  // pasados no cambian, y lo único viejo es el último tramo.
  return hit ? recortar(hit.serie, days) : []
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
