import { NextResponse } from 'next/server'
import { fetchConPlazo } from '@/lib/fetch-plazo'
import { finnhubKey, motivoFinnhub } from '@/lib/finnhub'

/**
 * Resuelve el nombre de un símbolo (VOO → "Vanguard S&P 500 ETF").
 *
 * Existe para que el usuario no tenga que decidir cómo llamar a cada posición:
 * escribe el ticker y el nombre lo pone el proveedor. Es la última red: los
 * instrumentos habituales ya salen de la tabla local de `lib/issuers.ts`, que
 * no necesita red y da nombres mejor escritos que ninguna API.
 *
 * Antes preguntaba a la búsqueda de Yahoo, que devuelve 429 a las IP de los
 * centros de datos: desplegado no acertaba nunca y encima podía quedarse
 * colgada, porque la llamada no tenía plazo. Ahora pregunta a Finnhub, que ya
 * es quien pone los precios, y con plazo.
 */

export const runtime = 'nodejs'
export const revalidate = 0

const PLAZO_MS = 3_500
const cache = new Map<string, { name: string; type?: string; at: number }>()
const TTL = 24 * 60 * 60_000 // el nombre de un ETF no cambia a diario

/**
 * Finnhub devuelve los nombres en mayúsculas ("VANGUARD S&P 500 ETF"), que
 * junto a los de la tabla local se lee como un grito. Se pasa a capitalización
 * de título respetando las siglas y las palabras de enlace.
 *
 * La lista de siglas es explícita a propósito. La regla obvia —"si son cuatro
 * letras o menos, es una sigla"— convierte BANK, CORP e INC en gritos otra
 * vez, que es peor que no hacer nada.
 *
 * Lo que no intenta resolver es la capitalización de marca: de aquí sale
 * "Ishares" y no "iShares", "Jpmorgan" y no "JPMorgan". No hay regla que lo
 * acierte, y no hace falta: esos nombres salen bien escritos de la tabla local
 * de `lib/issuers.ts`, y esta función solo actúa sobre lo que no está en ella.
 */
const SIGLAS = new Set([
  'ETF', 'ETN', 'ETP', 'REIT', 'MSCI', 'FTSE', 'SPDR', 'ADR', 'GDR', 'PLC',
  'ESG', 'TIPS', 'USD', 'EUR', 'GBP', 'JPY', 'USA', 'US', 'UK', 'EU', 'AI',
  'NV', 'AG', 'SA', 'SE', 'LP', 'II', 'III', 'IV',
])
const MENORES = new Set(['de', 'del', 'la', 'el', 'of', 'the', 'and', 'y', 'for', 'in'])

function comoTitulo(bruto: string): string {
  return bruto
    .trim()
    .split(/\s+/)
    .map((original, i) => {
      // Siglas conocidas, y cosas como "S&P" o "U.S.", se quedan como venían.
      if (/[&.]/.test(original) || SIGLAS.has(original.toUpperCase())) return original

      const p = original.toLowerCase()
      if (i > 0 && MENORES.has(p)) return p
      // Cada tramo entre guiones va con mayúscula: "TAKE-TWO" → "Take-Two".
      return p.replace(/(^|-)([a-z])/g, (_, sep, c) => sep + c.toUpperCase())
    })
    .join(' ')
}

export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get('symbol') ?? '').trim().toUpperCase()
  if (!symbol) return NextResponse.json({ error: 'falta symbol' }, { status: 400 })

  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ symbol, name: hit.name, type: hit.type, cached: true })
  }

  const key = finnhubKey()
  if (key) {
    try {
      const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(symbol)}&token=${key}`
      const res = await fetchConPlazo(url, { headers: { Accept: 'application/json' }, cache: 'no-store' }, PLAZO_MS)
      const j = await res.json().catch(() => null)

      if (!motivoFinnhub(res.status, j)) {
        const resultados: any[] = j?.result ?? []
        // La coincidencia exacta de ticker primero: la búsqueda devuelve
        // también parecidos, y el primero no siempre es el que se pidió.
        const q = resultados.find((x) => String(x.symbol).toUpperCase() === symbol) ?? resultados[0]
        const bruto: string | undefined = q?.description
        if (bruto) {
          const name = comoTitulo(bruto)
          const tipo = String(q.type ?? '').toLowerCase()
          cache.set(symbol, { name, type: tipo, at: Date.now() })
          return NextResponse.json({ symbol, name, type: tipo, cached: false })
        }
      }
    } catch {
      /* Sin red o proveedor caído: se responde sin nombre y el cliente usa el
         ticker, que siempre es válido aunque sea menos descriptivo. */
    }
  }

  return NextResponse.json({ symbol, name: null, type: null })
}
