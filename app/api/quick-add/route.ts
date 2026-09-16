import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeSupabaseUrl } from '@/lib/supabase/url'
import { descripcionDe, leerTexto } from '@/lib/parseo'

/**
 * Registrar un gasto desde fuera de la app.
 *
 * Es la puerta para el atajo de iOS, para una automatización que lea el SMS
 * del banco y para cualquier cosa que sepa hacer una petición HTTP. El caso
 * que la justifica dura tres segundos: llega el mensaje «Compra por $47.900 en
 * EXITO», se toca compartir, se elige el atajo, y el gasto queda anotado con
 * su categoría sin abrir nada.
 *
 * ---------------------------------------------------------------------------
 * Dos formas de llamarla, y por qué las dos
 * ---------------------------------------------------------------------------
 *   GET  /api/quick-add?token=…&amount=15000&category=food&account=Nequi
 *   POST /api/quick-add   { token, texto: "Bancolombia: compra por $47.900…" }
 *
 * El GET existe porque un atajo de iOS —o un widget, o un botón de Siri— manda
 * una URL y nada más. Es menos elegante que un POST y es lo que hace que esto
 * se use: pedirle a alguien que construya un cuerpo JSON desde la app de
 * Atajos significa que no lo va a hacer.
 *
 * El POST es el que lleva texto crudo. Ahí no hay que decirle a la app cuánto
 * ni de qué: se le pasa el mensaje entero del banco y ella lo interpreta. Ver
 * `parseo.ts`.
 *
 * ---------------------------------------------------------------------------
 * Cómo se autoriza
 * ---------------------------------------------------------------------------
 * Con un token que se genera en Ajustes y que solo se enseña una vez. No hay
 * sesión: un atajo de iOS no tiene cookies. El token viaja en la URL o en la
 * cabecera `Authorization`, y la escritura la hace una función de Postgres que
 * lo comprueba antes de tocar nada —ver la migración `ingesta_rapida`—. Este
 * servidor nunca ve la llave de servicio de Supabase; si se filtrara el
 * código entero de esta ruta, lo máximo que se aprende es que hace falta un
 * token que no está aquí.
 *
 * Que el token vaya en la URL tiene un coste que conviene decir: queda escrito
 * en los registros de acceso del servidor y en el historial del navegador si
 * alguien la abre a mano. Por eso se puede revocar de un toque y por eso solo
 * puede hacer una cosa: insertar un movimiento. Ni leer, ni borrar, ni ver un
 * saldo.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const URL_SUPABASE = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const LLAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

interface Entrada {
  token?: string
  /** Texto crudo del SMS, del correo o de la factura. */
  texto?: string
  amount?: number | string
  type?: string
  category?: string
  description?: string
  merchant?: string
  currency?: string
  /** Nombre de la cuenta o su id. */
  account?: string
  /** Día del movimiento, «2026-09-16». Por defecto, ahora. */
  date?: string
  /** Referencia del origen, para no anotar dos veces lo mismo. */
  id?: string
}

/** Lo que se devuelve pase lo que pase: un atajo necesita saber qué decir. */
const responder = (cuerpo: Record<string, unknown>, status = 200) =>
  NextResponse.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store' } })

function tokenDe(request: Request, entrada: Entrada): string | null {
  const cabecera = request.headers.get('authorization')
  if (cabecera?.startsWith('Bearer ')) return cabecera.slice(7).trim()
  const enUrl = new URL(request.url).searchParams.get('token')
  return entrada.token || enUrl || null
}

async function registrar(request: Request, entrada: Entrada) {
  if (!URL_SUPABASE || !LLAVE_ANON) {
    return responder({ ok: false, error: 'El servidor no tiene configurado Supabase.' }, 503)
  }

  const token = tokenDe(request, entrada)
  if (!token) {
    return responder({ ok: false, error: 'Falta el token. Se genera en Ajustes → Atajos y automatizaciones.' }, 401)
  }

  /*
   * Si viene texto crudo, manda lo que se lea de él, pero cualquier campo
   * explícito lo pisa. Es el orden que hace falta: el atajo de iOS puede
   * mandar el SMS entero y además forzar la cuenta, porque el SMS no siempre
   * dice de cuál salió.
   */
  const lectura = entrada.texto ? leerTexto(entrada.texto) : null

  const monto = Number(
    entrada.amount !== undefined && entrada.amount !== ''
      ? String(entrada.amount).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
      : lectura?.monto ?? 0,
  )

  if (!Number.isFinite(monto) || monto <= 0) {
    return responder({
      ok: false,
      error: lectura
        ? 'No se encontró un monto en el texto.'
        : 'Falta el monto.',
      leido: lectura ?? undefined,
    }, 400)
  }

  const tipo = entrada.type === 'income' || entrada.type === 'ingreso'
    ? 'income'
    : entrada.type === 'expense' || entrada.type === 'gasto'
      ? 'expense'
      : lectura?.tipo === 'income' ? 'income' : 'expense'

  const cuerpo = {
    p_token: token,
    p_amount: monto,
    p_category: entrada.category || lectura?.categoryId || 'other',
    p_type: tipo,
    p_description: entrada.description || (lectura ? descripcionDe(lectura) : '') || '',
    p_merchant: entrada.merchant || lectura?.comercio || null,
    p_currency: (entrada.currency || lectura?.moneda || 'COP').toUpperCase() === 'USD' ? 'USD' : 'COP',
    p_account: entrada.account || lectura?.institucion || null,
    p_occurred_at: fechaValida(entrada.date) ?? (lectura?.dia ? `${lectura.dia}T12:00:00Z` : new Date().toISOString()),
    p_source: entrada.texto ? 'sms' : 'atajo',
    p_external_id: entrada.id || null,
    p_fx_rate: null,
  }

  // El cliente va con la llave anónima y sin sesión: la función es la que
  // autoriza, a partir del token. Ver la migración.
  const supabase = createClient(URL_SUPABASE, LLAVE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.rpc('ingesta_rapida', cuerpo)

  if (error) {
    // 28000 es el código que la función usa para un token que no vale. Se
    // devuelve 401 y no 500: quien llama tiene que saber que hay que
    // regenerarlo, no reintentar.
    const invalido = error.code === '28000' || /token inválido/i.test(error.message)
    return responder({ ok: false, error: invalido ? 'Token inválido o revocado.' : error.message },
      invalido ? 401 : 400)
  }

  const fila = data as { id: string; duplicado: boolean; cuenta?: string } | null
  return responder({
    ok: true,
    id: fila?.id,
    duplicado: Boolean(fila?.duplicado),
    // Lo que se devuelve es lo que el atajo enseña en la notificación de iOS,
    // así que va escrito para leerse de un vistazo y no como datos crudos.
    mensaje: fila?.duplicado
      ? 'Ese movimiento ya estaba registrado.'
      : `Registrado: ${cuerpo.p_currency === 'USD' ? 'US$' : '$'}${monto.toLocaleString('es-CO')}${fila?.cuenta ? ` en ${fila.cuenta}` : ''}`,
    leido: lectura ?? undefined,
  })
}

const fechaValida = (d?: string) => {
  if (!d) return null
  // Solo día: se ancla al mediodía para que ninguna zona horaria lo mueva al
  // día de al lado, que es el mismo cuidado que tiene el resto de la app.
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d}T12:00:00Z`
  const t = Date.parse(d)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  return registrar(request, {
    token: p.get('token') ?? undefined,
    texto: p.get('texto') ?? p.get('text') ?? undefined,
    amount: p.get('amount') ?? p.get('monto') ?? undefined,
    type: p.get('type') ?? p.get('tipo') ?? undefined,
    category: p.get('category') ?? p.get('categoria') ?? undefined,
    description: p.get('description') ?? p.get('nota') ?? undefined,
    merchant: p.get('merchant') ?? p.get('comercio') ?? undefined,
    currency: p.get('currency') ?? p.get('moneda') ?? undefined,
    account: p.get('account') ?? p.get('cuenta') ?? undefined,
    date: p.get('date') ?? p.get('fecha') ?? undefined,
    id: p.get('id') ?? undefined,
  })
}

export async function POST(request: Request) {
  let entrada: Entrada = {}
  const tipo = request.headers.get('content-type') ?? ''

  try {
    if (tipo.includes('application/json')) {
      entrada = await request.json()
    } else if (tipo.includes('form')) {
      entrada = Object.fromEntries((await request.formData()).entries()) as Entrada
    } else {
      // Texto plano: el cuerpo entero es el mensaje del banco. Es la forma más
      // corta de configurar una automatización de iOS, que manda el contenido
      // del SMS tal cual.
      entrada = { texto: await request.text() }
    }
  } catch {
    return responder({ ok: false, error: 'No se pudo leer el cuerpo de la petición.' }, 400)
  }

  return registrar(request, entrada)
}

/**
 * Los atajos de iOS y algunas automatizaciones hacen una comprobación previa.
 * Sin esto reciben un 405 y se detienen antes de mandar nada.
 */
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
