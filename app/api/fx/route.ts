import { NextResponse } from 'next/server'
import { fetchConPlazo } from '@/lib/fetch-plazo'

/**
 * Tasa USD → COP.
 *
 * Va aparte de /api/quotes porque la divisa es el dato del que cuelga todo el
 * patrimonio: si falla, las cuentas en dólares quedan mal valoradas y el
 * total miente. Por eso se consultan dos fuentes en cadena y se informa de
 * cuál respondió, en vez de devolver un número sin procedencia.
 *
 * Yahoo iba en cabeza y se quitó: devuelve 429 a las IP de los centros de
 * datos, así que desplegado no acertaba nunca y lo único que aportaba era la
 * espera antes de llegar a las dos que sí contestan. Las dos que quedan son
 * abiertas, sin llave y sin cupo.
 */

export const runtime = 'nodejs'
export const revalidate = 0

const TTL = 10 * 60_000
let cache: { rate: number; source: string; at: number } | null = null

/** Plazo por fuente: sin él, una que no cierre la conexión cuelga la cadena. */
const PLAZO_MS = 3_500

async function erApi(): Promise<number | null> {
  const r = await fetchConPlazo('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' }, PLAZO_MS)
  if (!r.ok) return null
  const rate = (await r.json())?.rates?.COP
  return typeof rate === 'number' && rate > 0 ? rate : null
}

async function frankfurter(): Promise<number | null> {
  const r = await fetchConPlazo('https://api.frankfurter.app/latest?from=USD&to=COP', { cache: 'no-store' }, PLAZO_MS)
  if (!r.ok) return null
  const rate = (await r.json())?.rates?.COP
  return typeof rate === 'number' && rate > 0 ? rate : null
}

const FUENTES: [string, () => Promise<number | null>][] = [
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
