import { NextResponse } from 'next/server'
import { fetchConPlazo } from '@/lib/fetch-plazo'

/**
 * TRM: la Tasa Representativa del Mercado.
 *
 * Va aparte de /api/fx porque no es lo mismo, aunque las dos den «pesos por
 * dólar». /api/fx da el precio de mercado: lo que vale un dólar ahora mismo en
 * el mundo. La TRM es un dato oficial —la calcula la Superintendencia
 * Financiera con las operaciones de compraventa del día hábil anterior— y es
 * la que manda para todo lo que tenga consecuencias:
 *
 *   · Declarar ante la DIAN el saldo de una cuenta en dólares.
 *   · Lo que el banco aplica cuando llega la factura de una compra en dólares.
 *   · El valor en pesos de un portafolio en dólares, en cualquier informe.
 *
 * Las dos cifras se separan por poco —décimas de por ciento— pero no son
 * intercambiables, y usar la de mercado donde toca la oficial es la clase de
 * error que solo aparece meses después, al cuadrar con un extracto.
 *
 * Detalle que no es intuitivo: la TRM tiene vigencia de un día completo y se
 * publica con un día de desfase. La de hoy se calculó con lo que pasó ayer.
 * Por eso un sábado, un domingo o un festivo devuelve la del último día hábil,
 * que es lo correcto y no un fallo.
 *
 * ---------------------------------------------------------------------------
 * La fuente
 * ---------------------------------------------------------------------------
 * datos.gov.co, el portal de datos abiertos del Estado. El conjunto 32sa-8pi3
 * es la serie histórica de la TRM publicada por la Superintendencia
 * Financiera, y se consulta con la API SODA: abierta, sin llave y sin cupo
 * declarado.
 *
 * Si no responde, se cae al precio de mercado de /api/fx y se dice que es una
 * aproximación. Enseñar una cifra de mercado llamándola TRM sería exactamente
 * el error que este archivo existe para no cometer.
 */

export const runtime = 'nodejs'
export const revalidate = 0

const PLAZO_MS = 4_000

/**
 * Media hora de caché.
 *
 * La TRM cambia una vez al día, así que podría ser mucho más largo. Es corto
 * a propósito por el momento en que sí cambia: a primera hora de la mañana. Un
 * caché de horas haría que quien abre la app a las ocho viera la de ayer hasta
 * el mediodía.
 */
const TTL = 30 * 60_000

const SODA = 'https://www.datos.gov.co/resource/32sa-8pi3.json'

interface Trm {
  /** Pesos por dólar. */
  valor: number
  /** Día de vigencia, como «2026-09-16». */
  dia: string
  /** 'superfinanciera' o el respaldo de mercado que respondió. */
  fuente: string
  /** Es la TRM de verdad y no una aproximación de mercado. */
  oficial: boolean
}

const cache = new Map<string, { trm: Trm; at: number }>()

const soloDia = (iso: string) => String(iso).slice(0, 10)

/** Filtro de cordura, el mismo de /api/fx: el peso nunca ha estado fuera de ahí. */
const plausible = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 1500 && v < 10000

/**
 * La TRM vigente en un día concreto.
 *
 * Se pide por rango de vigencia y no por «el último registro»: los fines de
 * semana y los festivos no hay publicación nueva, y la fila del viernes tiene
 * `vigenciahasta` el lunes. Preguntando por el rango sale la que de verdad
 * aplicaba ese día; preguntando por la fecha exacta, no saldría ninguna.
 */
async function oficialDe(dia: string): Promise<Trm | null> {
  const where = encodeURIComponent(
    `vigenciadesde <= '${dia}T23:59:59.000' AND vigenciahasta >= '${dia}T00:00:00.000'`,
  )
  const url = `${SODA}?$where=${where}&$order=vigenciadesde%20DESC&$limit=1`

  const r = await fetchConPlazo(url, { cache: 'no-store' }, PLAZO_MS)
  if (!r.ok) return null

  const filas = await r.json()
  const fila = Array.isArray(filas) ? filas[0] : null
  if (!fila) return null

  const valor = Number(fila.valor)
  if (!plausible(valor)) return null

  return { valor, dia: soloDia(fila.vigenciadesde ?? dia), fuente: 'superfinanciera', oficial: true }
}

/** Sin TRM oficial, el precio de mercado, dicho como lo que es. */
async function deMercado(origen: string, dia: string): Promise<Trm | null> {
  const r = await fetchConPlazo(`${origen}/api/fx`, { cache: 'no-store' }, PLAZO_MS)
  if (!r.ok) return null
  const datos = await r.json()
  if (!plausible(datos?.rate)) return null
  return { valor: datos.rate, dia, fuente: datos.source ?? 'mercado', oficial: false }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  // Sin parámetro, la de hoy. Con él, la de un día pasado: es lo que necesita
  // un movimiento antiguo al que le falta la tasa con la que se registró.
  const pedido = url.searchParams.get('dia')
  const hoy = new Date().toISOString().slice(0, 10)
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(pedido ?? '') ? pedido! : hoy

  const guardada = cache.get(dia)
  /*
   * Un día pasado no caduca nunca: la TRM del 3 de marzo ya no va a cambiar.
   * Solo la de hoy tiene plazo, porque hoy todavía puede publicarse.
   */
  const esHoy = dia === hoy
  if (guardada && (!esHoy || Date.now() - guardada.at < TTL)) {
    return NextResponse.json({ ...guardada.trm, cached: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const intentos: string[] = []
  try {
    const trm = await oficialDe(dia)
    if (trm) {
      cache.set(dia, { trm, at: Date.now() })
      return NextResponse.json({ ...trm, cached: false }, { headers: { 'Cache-Control': 'no-store' } })
    }
    intentos.push('superfinanciera: sin dato para ese día')
  } catch (e) {
    intentos.push(`superfinanciera: ${(e as Error).message}`)
  }

  /*
   * El respaldo solo tiene sentido para hoy: el precio de mercado de hace tres
   * meses no lo regala nadie, y devolver el de hoy fechado en marzo sería
   * mentir con más precisión.
   */
  if (esHoy) {
    try {
      const trm = await deMercado(url.origin, dia)
      if (trm) {
        cache.set(dia, { trm, at: Date.now() })
        return NextResponse.json({ ...trm, cached: false, intentos }, { headers: { 'Cache-Control': 'no-store' } })
      }
      intentos.push('mercado: fuera de rango o vacío')
    } catch (e) {
      intentos.push(`mercado: ${(e as Error).message}`)
    }
  }

  if (guardada) {
    return NextResponse.json({ ...guardada.trm, cached: true, stale: true, intentos })
  }
  return NextResponse.json(
    { valor: null, dia, fuente: null, oficial: false, stale: true, intentos },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
