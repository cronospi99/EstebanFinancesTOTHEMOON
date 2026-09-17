import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeSupabaseUrl } from '@/lib/supabase/url'
import { avisosPendientes, type Aviso } from '@/lib/avisos'
import { saldoDeuda } from '@/lib/deudas'
import { configVapid, enviarPush, type SuscripcionPush } from '@/lib/webpush'
import { enviarCorreo, enviarSms } from '@/lib/canales'
import type { Account, Debt, DebtPayment, Settings, Subscription, Transaction } from '@/lib/types'

/**
 * El trabajo diario que manda los recordatorios.
 *
 * Es lo que hace que el aviso llegue la víspera aunque nadie abra la app —que
 * es justo el día en que nadie la abre—. Lo dispara el cron de Vercel, que
 * está declarado en `vercel.json`.
 *
 * ---------------------------------------------------------------------------
 * Este archivo es el único que usa la llave de servicio, y hay que decir por qué
 * ---------------------------------------------------------------------------
 * Todo lo demás en esta app escribe con la sesión del usuario y deja que la
 * seguridad por filas de Supabase haga el trabajo. Aquí no hay usuario: es un
 * proceso que corre a las ocho de la mañana y tiene que mirar los datos de
 * todas las cuentas para saber a quién le vence algo hoy.
 *
 * La alternativa era una función `security definer` que devolviera los avisos
 * ya calculados, como se hizo con la ingesta rápida. No se hizo porque
 * significaría reescribir en SQL la lógica de los ciclos de facturación, de
 * los cobros de suscripción y de los saldos con interés —cuatro archivos de
 * TypeScript ya probados— y mantener las dos versiones en paralelo para
 * siempre. Dos implementaciones de la misma regla acaban discrepando, y aquí
 * discrepar significa avisar de un cobro que no existe o callarse uno que sí.
 *
 * A cambio, esta ruta se acota lo máximo posible:
 *
 *  · No se ejecuta sin `CRON_SECRET`, y compara en tiempo constante.
 *  · Si no hay llave de servicio, no falla: devuelve que no está disponible y
 *    los avisos siguen saliendo desde el navegador con la app abierta.
 *  · Solo lee lo que necesita —cuentas, suscripciones, deudas y preferencias—
 *    y no toca movimientos ni inversiones.
 *  · No escribe nada salvo el registro de lo ya avisado.
 *
 * Sin `SUPABASE_SERVICE_ROLE_KEY` configurada, la app funciona entera; lo que
 * se pierde es el aviso con la app cerrada.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Comparación en tiempo constante: una con `===` filtra el secreto carácter a carácter. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let distinto = 0
  for (let i = 0; i < a.length; i++) distinto |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return distinto === 0
}

/** Solo lo urgente sale por SMS: cada mensaje cuesta dinero. Ver `canales.ts`. */
const MERECE_SMS = (a: Aviso) => (a.tipo === 'pago' || a.tipo === 'deuda') && a.faltan <= 1

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto) {
    return NextResponse.json({ ok: false, error: 'Sin CRON_SECRET, esta ruta está apagada.' }, { status: 503 })
  }

  const cabecera = request.headers.get('authorization') ?? ''
  const enviado = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : ''
  if (!igualSeguro(enviado, secreto)) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !servicio) {
    return NextResponse.json({
      ok: false,
      error: 'Sin SUPABASE_SERVICE_ROLE_KEY no se pueden mandar avisos con la app cerrada.',
    }, { status: 503 })
  }

  const config = configVapid()
  const supabase = createClient(url, servicio, { auth: { persistSession: false } })

  /*
   * Se parte de los dispositivos suscritos y no de los usuarios.
   *
   * Quien no ha activado los avisos no tiene nada que recibir, así que
   * recorrer la tabla de usuarios sería leer los datos de gente a la que no
   * hay que mandarle nada. Empezando por aquí, la consulta solo alcanza a
   * quien lo pidió expresamente.
   */
  const { data: dispositivos, error: errorSubs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')

  if (errorSubs) {
    return NextResponse.json({ ok: false, error: errorSubs.message }, { status: 500 })
  }

  const porUsuario = new Map<string, SuscripcionPush[]>()
  for (const d of dispositivos ?? []) {
    porUsuario.set(d.user_id, [...(porUsuario.get(d.user_id) ?? []), d as SuscripcionPush])
  }

  let avisados = 0
  let enviadosPush = 0
  let correos = 0
  let mensajes = 0
  const caducados: string[] = []

  for (const [userId, subs] of porUsuario) {
    /*
     * Los movimientos del último mes y medio entran para separar lo que la
     * tarjeta ya facturó de lo gastado en el ciclo en curso. Sin ellos, quien
     * cortó en cero y lleva gastando desde entonces recibía un push de «pago
     * vencido» por una plata que el banco todavía no le ha cobrado. Ver
     * `deudaPorCiclo`.
     *
     * Cuarenta y cinco días porque el ciclo más largo que se puede configurar
     * cabe de sobra ahí, y traer el historial entero de cada usuario en un
     * proceso que corre para todos no hace falta para esto.
     */
    const desdeMovimientos = new Date(Date.now() - 45 * 864e5).toISOString()
    const [cuentas, suscripciones, deudas, abonos, ajustes, movimientos] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', userId),
      supabase.from('subscriptions').select('*').eq('user_id', userId),
      supabase.from('debts').select('*').eq('user_id', userId),
      supabase.from('debt_payments').select('*').eq('user_id', userId),
      supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('transactions')
        .select('id,account_id,to_account_id,category_id,amount,type,occurred_at,currency')
        .eq('user_id', userId)
        .gte('occurred_at', desdeMovimientos),
    ])

    const accounts = (cuentas.data ?? []).map((r) => ({
      id: r.id, name: r.name, institution: r.institution, type: r.type,
      balance: Number(r.balance), currency: r.currency, color: r.color,
      creditLimit: r.credit_limit == null ? undefined : Number(r.credit_limit),
      installments: r.installments ?? undefined,
      installmentsPaid: r.installments_paid ?? undefined,
      statementDay: r.statement_day ?? undefined,
      // Sin esto, los avisos del servidor deducen el inicio del período del
      // corte y se desfasan un par de días en las tarjetas que lo imprimen
      // aparte — que es justo donde el aviso de mora salía falso.
      periodStartDay: r.period_start_day ?? undefined,
      // El reparto declarado a mano. Sin esto el servidor manda un push de
      // «pago vencido» que la pantalla ya no enseña, que es la peor mezcla.
      statementBalance: r.statement_balance == null ? undefined : Number(r.statement_balance),
      statementBalanceAt: r.statement_balance_at ?? undefined,
      dueDay: r.due_day ?? undefined,
    })) as Account[]

    const subscriptions = (suscripciones.data ?? []).map((r) => ({
      id: r.id, name: r.name, amount: Number(r.amount), currency: r.currency ?? 'COP',
      cycle: r.cycle ?? 'mensual', anchorAt: String(r.anchor_at).slice(0, 10),
      accountId: r.account_id ?? undefined, trialEndsAt: r.trial_ends_at ?? undefined,
      sharedWith: r.shared_with ?? undefined, cancelled: Boolean(r.cancelled), color: r.color,
    })) as Subscription[]

    const debts = (deudas.data ?? []).map((r) => ({
      id: r.id, person: r.person, direction: r.direction === 'lent' ? 'lent' : 'owe',
      principal: Number(r.principal), currency: r.currency ?? 'COP',
      rate: r.rate == null ? undefined : Number(r.rate),
      startedAt: String(r.started_at).slice(0, 10), dueDate: r.due_date ?? undefined, color: r.color,
    })) as Debt[]

    const pagos = (abonos.data ?? []).map((r) => ({
      id: r.id, debtId: r.debt_id, amount: Number(r.amount),
      occurredAt: String(r.occurred_at).slice(0, 10),
    })) as DebtPayment[]

    // El saldo de una deuda con interés depende de las fechas de los abonos:
    // se calcula con el mismo código que usa la app. Ver `deudas.ts`.
    const saldos = new Map<string, number>()
    for (const d of debts) {
      saldos.set(d.id, saldoDeuda(d, pagos.filter((p) => p.debtId === d.id)).saldo)
    }

    const settings: Settings = {
      avisoDias: ajustes.data?.aviso_dias ?? undefined,
      avisarSuscripciones: ajustes.data?.avisar_suscripciones ?? true,
      avisarTarjetas: ajustes.data?.avisar_tarjetas ?? true,
      avisarDeudas: ajustes.data?.avisar_deudas ?? true,
      avisoEmail: ajustes.data?.aviso_email ?? undefined,
    }

    /*
     * La tasa de cambio va en cero a propósito.
     *
     * Aquí no hay a quién preguntarle, y el único uso que tiene en los avisos
     * es ordenar por importe. Convertir mal ordenaría mal; con cero, lo que
     * está en dólares se ordena al final y su aviso sale igual, con la cifra
     * en su moneda, que es como hay que leerla.
     */
    const transactions = (movimientos.data ?? []).map((r) => ({
      id: r.id, accountId: r.account_id, toAccountId: r.to_account_id ?? undefined,
      categoryId: r.category_id, amount: Number(r.amount), type: r.type,
      description: '', occurredAt: r.occurred_at, currency: r.currency ?? undefined,
    })) as Transaction[]

    const avisos = avisosPendientes({
      accounts, subscriptions, debts, saldos, settings, fxRate: 0, transactions,
    })
    if (!avisos.length) continue

    // Lo que ya salió no vuelve a salir.
    const { data: yaEnviados } = await supabase
      .from('avisos_enviados')
      .select('aviso_id')
      .eq('user_id', userId)
      .in('aviso_id', avisos.map((a) => a.id))

    const vistos = new Set((yaEnviados ?? []).map((r) => r.aviso_id))
    const nuevos = avisos.filter((a) => !vistos.has(a.id))
    if (!nuevos.length) continue

    avisados++

    for (const aviso of nuevos) {
      let llego = false

      if (config) {
        for (const sub of subs) {
          const r = await enviarPush(sub, {
            titulo: aviso.titulo,
            cuerpo: aviso.cuerpo,
            url: aviso.url,
            etiqueta: aviso.id,
          }, config)
          if (r.ok) { llego = true; enviadosPush++ }
          if (r.caducada) caducados.push(sub.endpoint)
        }
      }

      if (settings.avisoEmail) {
        const r = await enviarCorreo({
          para: settings.avisoEmail,
          asunto: aviso.titulo,
          texto: `${aviso.cuerpo}\n\nLo ves completo en la app.`,
        })
        if (r.ok) { llego = true; correos++ }
      }

      if (MERECE_SMS(aviso) && settings.avisoEmail) {
        // El teléfono no se guarda aparte: quien quiera SMS pone un número en
        // el campo de contacto. Si no parece un número internacional, no se
        // intenta —Twilio cobra igual el intento fallido—.
        const telefono = settings.avisoEmail.trim()
        if (/^\+\d{8,15}$/.test(telefono)) {
          const r = await enviarSms({ para: telefono, texto: `${aviso.titulo}. ${aviso.cuerpo}` })
          if (r.ok) { llego = true; mensajes++ }
        }
      }

      // Se marca solo si llegó por algún lado. Si no salió por ninguno, mañana
      // se vuelve a intentar en vez de darlo por avisado.
      if (llego) {
        await supabase.from('avisos_enviados').insert({
          user_id: userId, aviso_id: aviso.id, canal: 'push',
        })
      }
    }
  }

  if (caducados.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', [...new Set(caducados)])
  }

  /*
   * Limpieza del registro. Noventa días: pasado ese tiempo, el identificador
   * de un aviso lleva dentro una fecha que ya no vuelve a salir de ningún
   * cálculo, así que conservarlo no evita ningún duplicado.
   */
  const limite = new Date(Date.now() - 90 * 86_400_000).toISOString()
  await supabase.from('avisos_enviados').delete().lt('enviado_el', limite)

  return NextResponse.json({
    ok: true,
    usuarios: avisados,
    push: enviadosPush,
    correos,
    sms: mensajes,
    retirados: caducados.length,
  })
}
