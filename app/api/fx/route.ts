import { NextResponse } from 'next/server'

/**
 * Tasa USD → COP.
 *
 * Va aparte de /api/quotes porque la divisa es el dato del que cuelga todo el
 * patrimonio: si falla, las cuentas en dólares quedan mal valoradas y el
 * total miente. Por eso se consultan tres fuentes en cadena y se informa de
 * cuál respondió, en vez de devolver un número sin procedencia.
 */

export const runtime = 'nodejs'
export const revalidate = 0

const TTL = 10 * 60_000
let cache: { rate: number; source: string; at: number } | null = null

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36'

async function yahoo(): Promise<number | null> {
  const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/COP=X?interval=1d&range=1d', {
    headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store',
  })
  if (!r.ok) return null
  const price = (await r.json())?.chart?.result?.[0]?.meta?.regularMarketPrice
  return typeof price === 'number' && price > 0 ? price : null
}

async function erApi(): Promise<number | null> {
  const r = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
  if (!r.ok) return null
  const rate = (await r.json())?.rates?.COP
  return typeof rate === 'number' && rate > 0 ? rate : null
}

async function frankfurter(): Promise<number | null> {
  const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=COP', { cache: 'no-store' })
  if (!r.ok) return null
  const rate = (await r.json())?.rates?.COP
  return typeof rate === 'number' && rate > 0 ? rate : null
}

const FUENTES: [string, () => Promise<number | null>][] = [
  ['yahoo', yahoo],
  ['er-api', erApi],
  ['frankfurter', frankfurter],
]

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ ...cache, cached: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const intentos: string[] = []
  for (const [nombre, fn] of FUENTES) {
    try {
      const rate = await fn()
      // Filtro de cordura: el peso ha estado entre 1.500 y 10.000 por dólar en
      // toda su historia moderna. Un valor fuera de ahí es un error de la
      // fuente (otra divisa, un índice), no una devaluación.
      if (rate && rate > 1500 && rate < 10000) {
        cache = { rate, source: nombre, at: Date.now() }
        return NextResponse.json({ ...cache, cached: false }, { headers: { 'Cache-Control': 'no-store' } })
      }
      intentos.push(`${nombre}: fuera de rango o vacío`)
    } catch (e) {
      intentos.push(`${nombre}: ${(e as Error).message}`)
    }
  }

  // Ninguna fuente respondió. Se devuelve la última conocida marcada como
  // vieja, o nada: inventar un número en una app de finanzas es peor que
  // admitir que no se sabe.
  if (cache) {
    return NextResponse.json({ ...cache, cached: true, stale: true, intentos })
  }
  return NextResponse.json(
    { rate: null, source: null, stale: true, intentos },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
