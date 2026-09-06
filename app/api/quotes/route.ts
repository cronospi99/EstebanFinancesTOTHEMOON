import { NextResponse } from 'next/server'
import type { Quote } from '@/lib/types'

/**
 * Proxy de cotizaciones.
 *
 * Existe por dos razones concretas:
 *  1. Yahoo Finance no envía cabeceras CORS — el navegador no puede llamarlo.
 *  2. La llave de Alpha Vantage se queda aquí, jamás llega al bundle del cliente.
 *
 * GET /api/quotes?symbols=AAPL,VOO,BTC-USD,COP=X
 */

export const runtime = 'nodejs'
export const revalidate = 0

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart'
const CACHE_TTL_MS = 60_000

// Caché en memoria: evita golpear Yahoo en cada render y respeta sus límites.
// Al ser una app personal, un único proceso es suficiente.
const cache = new Map<string, { quote: Quote; at: number }>()

async function fetchYahoo(symbol: string): Promise<Quote | null> {
  const url = `${YAHOO}/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  const res = await fetch(url, {
    headers: {
      // Yahoo responde 403 a peticiones sin User-Agent de navegador.
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36',
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) return null

  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) return null

  const price = Number(meta.regularMarketPrice)
  const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price)
  const change = price - prev

  return {
    symbol,
    price,
    previousClose: prev,
    change,
    changePercent: prev ? (change / prev) * 100 : 0,
    currency: meta.currency ?? 'USD',
  }
}

/** Respaldo opcional. Solo se intenta si hay llave configurada. */
async function fetchAlphaVantage(symbol: string): Promise<Quote | null> {
  const key = process.env.ALPHA_VANTAGE_API_KEY
  if (!key) return null

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null

  const q = (await res.json())?.['Global Quote']
  const price = Number(q?.['05. price'])
  if (!price) return null

  const prev = Number(q?.['08. previous close'] ?? price)
  return {
    symbol,
    price,
    previousClose: prev,
    change: price - prev,
    changePercent: prev ? ((price - prev) / prev) * 100 : 0,
    currency: 'USD',
  }
}

async function getQuote(symbol: string): Promise<Quote> {
  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.quote

  try {
    const quote = (await fetchYahoo(symbol)) ?? (await fetchAlphaVantage(symbol))
    if (quote) {
      cache.set(symbol, { quote, at: Date.now() })
      return quote
    }
  } catch {
    /* Red caída o proveedor con problemas: caemos al último valor conocido. */
  }

  // Degradación elegante: preferimos un precio viejo marcado como tal
  // antes que romper el portafolio entero por un símbolo.
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

  const quotes = await Promise.all(symbols.map(getQuote))

  return NextResponse.json(
    { quotes, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
