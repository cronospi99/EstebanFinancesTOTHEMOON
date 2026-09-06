import { NextResponse } from 'next/server'

/**
 * Resuelve el nombre de un símbolo (VOO → "Vanguard S&P 500 ETF").
 *
 * Existe para que el usuario no tenga que decidir cómo llamar a cada
 * posición: escribe el ticker y el nombre lo pone el proveedor.
 */

export const runtime = 'nodejs'
export const revalidate = 0

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36'
const cache = new Map<string, { name: string; type?: string; at: number }>()
const TTL = 24 * 60 * 60_000 // el nombre de un ETF no cambia a diario

export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get('symbol') ?? '').trim().toUpperCase()
  if (!symbol) return NextResponse.json({ error: 'falta symbol' }, { status: 400 })

  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ symbol, name: hit.name, type: hit.type, cached: true })
  }

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=6&newsCount=0`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' },
    )
    if (res.ok) {
      const quotes: any[] = (await res.json())?.quotes ?? []
      // Preferimos la coincidencia exacta de ticker; la búsqueda de Yahoo
      // devuelve también parecidos y el primero no siempre es el correcto.
      const q = quotes.find((x) => String(x.symbol).toUpperCase() === symbol) ?? quotes[0]
      const name: string | undefined = q?.longname || q?.shortname
      if (name) {
        const tipo = String(q.quoteType ?? '').toLowerCase()
        const entry = { name, type: tipo, at: Date.now() }
        cache.set(symbol, entry)
        return NextResponse.json({ symbol, name, type: tipo, cached: false })
      }
    }
  } catch {
    /* Sin red o proveedor caído: se responde sin nombre y el cliente usa el
       ticker, que siempre es válido aunque sea menos descriptivo. */
  }

  return NextResponse.json({ symbol, name: null, type: null })
}
