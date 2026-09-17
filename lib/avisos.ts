/**
 * Qué hay que recordarle a alguien, y cuándo.
 *
 * El módulo es puro a propósito: entra el estado y salen los avisos. Así lo
 * usan los dos lados sin duplicar la regla —el navegador, para enseñar la
 * lista y para pedir el permiso en el momento oportuno, y el servidor, para
 * mandar el Web Push la víspera—. Cuando esa regla vive en dos sitios, la app
 * acaba enseñando un aviso que el correo no mandó, o al revés.
 *
 * El criterio de qué merece un aviso: solo lo que se puede arreglar el día
 * anterior. Que la tarjeta corte mañana se puede aprovechar —comprar hoy o
 * esperar a pasado—; que el patrimonio haya bajado un 2 % no se arregla con
 * nada, así que no se avisa. Una app que manda notificaciones que no llevan a
 * ninguna acción se silencia entera, y con ella las que sí importaban.
 */
import { avisoDe, cicloDe, deudaPorCiclo } from './tarjetas'
import { cobraDeVerdad, diasEntre, proximoCobro } from './suscripciones'
import { formatMoney } from './format'
import type { Account, Debt, Settings, Subscription, Transaction } from './types'
import { hoyEnZona } from './zona'

export type TipoAviso = 'suscripcion' | 'corte' | 'pago' | 'deuda' | 'prueba'

export interface Aviso {
  /** Estable entre ejecuciones: es lo que impide mandarlo dos veces. */
  id: string
  tipo: TipoAviso
  /** El día del hecho, no el día del aviso. */
  dia: string
  /** Cuántos días faltan. 0 = hoy. */
  faltan: number
  titulo: string
  cuerpo: string
  /** A dónde lleva el aviso al tocarlo. */
  url: string
  /** Cuánto dinero hay detrás. Ordena cuando hay varios el mismo día. */
  monto: number
}

export interface EntradaAvisos {
  accounts: Account[]
  subscriptions: Subscription[]
  debts: Debt[]
  /** Saldo pendiente de cada deuda, en su moneda. Del store. */
  saldos: Map<string, number>
  settings: Settings
  fxRate: number
  /**
   * Los movimientos, para separar lo que la tarjeta ya facturó de lo gastado
   * en el ciclo en curso. Ver `deudaPorCiclo`.
   *
   * Opcional porque quien no los tenga a mano —un proceso que solo cargue
   * cuentas— sigue recibiendo el aviso: sin movimientos, el reparto da todo
   * por facturado, que es lo prudente cuando no hay información.
   */
  transactions?: Transaction[]
  hoy?: string
}

/** Lo que hay por delante en los próximos días, ya filtrado por preferencias. */
export function avisosPendientes(e: EntradaAvisos): Aviso[] {
  const hoy = e.hoy ?? hoyEnZona()
  // `undefined` es «no lo ha configurado», y el valor sensato de partida es la
  // víspera: es el último momento en que todavía se puede hacer algo.
  const margen = e.settings.avisoDias ?? 1
  const salida: Aviso[] = []

  const enPesos = (v: number, moneda: string) =>
    moneda === 'USD' ? (e.fxRate > 0 ? v * e.fxRate : 0) : v

  // ---- Suscripciones -------------------------------------------------------
  if (e.settings.avisarSuscripciones !== false) {
    for (const sub of e.subscriptions) {
      if (sub.cancelled) continue

      /*
       * El fin de una prueba avisa aparte y antes, con tres días.
       *
       * Es el único aviso de esta lista que sirve para no gastar en vez de
       * para pagar a tiempo, y por eso se adelanta: cancelar una prueba el
       * mismo día en que empieza a cobrar ya no sirve de nada en la mitad de
       * los servicios.
       */
      if (sub.trialEndsAt) {
        const faltan = diasEntre(hoy, sub.trialEndsAt)
        if (faltan >= 0 && faltan <= Math.max(3, margen)) {
          salida.push({
            id: `prueba:${sub.id}:${sub.trialEndsAt}`,
            tipo: 'prueba',
            dia: sub.trialEndsAt,
            faltan,
            titulo: `La prueba de ${sub.name} termina ${faltan === 0 ? 'hoy' : faltan === 1 ? 'mañana' : `en ${faltan} días`}`,
            cuerpo: `A partir de ahí cobra ${formatMoney(sub.amount, sub.currency)}. Si no la vas a usar, este es el momento.`,
            url: '/suscripciones',
            monto: enPesos(sub.amount, sub.currency),
          })
        }
        // Durante la prueba no hay cobro del que avisar.
        if (sub.trialEndsAt >= hoy) continue
      }

      if (!cobraDeVerdad(sub, hoy)) continue
      const cobro = proximoCobro(sub, hoy)
      const faltan = diasEntre(hoy, cobro)
      if (faltan < 0 || faltan > margen) continue

      const cuenta = e.accounts.find((a) => a.id === sub.accountId)
      salida.push({
        id: `sub:${sub.id}:${cobro}`,
        tipo: 'suscripcion',
        dia: cobro,
        faltan,
        titulo: `${sub.name} cobra ${faltan === 0 ? 'hoy' : faltan === 1 ? 'mañana' : `en ${faltan} días`}`,
        cuerpo: `${formatMoney(sub.amount, sub.currency)}${cuenta ? ` de ${cuenta.name}` : ''}.`,
        url: '/suscripciones',
        monto: enPesos(sub.amount, sub.currency),
      })
    }
  }

  // ---- Tarjetas ------------------------------------------------------------
  if (e.settings.avisarTarjetas !== false) {
    for (const cuenta of e.accounts) {
      const ciclo = cicloDe(cuenta, hoy)
      if (!ciclo) continue
      // Lo facturado, no el saldo: lo gastado desde el corte no está en el
      // extracto que vence y avisarlo sería un cobro que nadie ha hecho.
      const { facturado: deuda } = deudaPorCiclo(cuenta, e.transactions ?? [], hoy)

      // El pago: solo si hay algo que pagar.
      if (deuda > 0 && ciclo.faltanLimite >= 0 && ciclo.faltanLimite <= Math.max(2, margen)) {
        const aviso = avisoDe(cuenta, hoy, e.transactions ?? [])
        salida.push({
          id: `pago:${cuenta.id}:${ciclo.limiteEnCurso}`,
          tipo: 'pago',
          dia: ciclo.limiteEnCurso,
          faltan: ciclo.faltanLimite,
          titulo: `${cuenta.name}: ${ciclo.faltanLimite === 0 ? 'hoy vence el pago' : ciclo.faltanLimite === 1 ? 'el pago vence mañana' : `el pago vence en ${ciclo.faltanLimite} días`}`,
          cuerpo: `Debes ${formatMoney(deuda, cuenta.currency)}. ${aviso?.detalle ?? ''}`.trim(),
          url: '/cuentas',
          monto: enPesos(deuda, cuenta.currency),
        })
      }

      /*
       * El corte: se avisa aunque no se deba nada, y aquí no es un olvido.
       *
       * El corte no es una tarea sino una oportunidad, y es justo la que nadie
       * aprovecha porque nadie se sabe la fecha. «Tu tarjeta corta mañana:
       * lo que compres pasado se paga un mes después» es el aviso que convierte
       * un dato de la letra pequeña en una decisión.
       */
      if (ciclo.faltanCorte >= 0 && ciclo.faltanCorte <= Math.min(1, margen)) {
        salida.push({
          id: `corte:${cuenta.id}:${ciclo.corteProximo}`,
          tipo: 'corte',
          dia: ciclo.corteProximo,
          faltan: ciclo.faltanCorte,
          titulo: `${cuenta.name} corta ${ciclo.faltanCorte === 0 ? 'hoy' : 'mañana'}`,
          cuerpo: ciclo.faltanCorte === 0
            ? `Lo que compres desde mañana se paga hasta el ${ciclo.limiteDeHoy.slice(8, 10)} del mes siguiente.`
            : 'Lo que compres hoy entra en el extracto que cierra; esperar un día lo mueve al siguiente.',
          url: '/cuentas',
          monto: 0,
        })
      }
    }
  }

  // ---- Deudas con personas -------------------------------------------------
  if (e.settings.avisarDeudas !== false) {
    for (const deuda of e.debts) {
      if (!deuda.dueDate) continue
      const saldo = e.saldos.get(deuda.id) ?? 0
      if (saldo <= 0) continue
      const faltan = diasEntre(hoy, deuda.dueDate)
      if (faltan < 0 || faltan > Math.max(2, margen)) continue

      const tuya = deuda.direction === 'owe'
      salida.push({
        id: `deuda:${deuda.id}:${deuda.dueDate}`,
        tipo: 'deuda',
        dia: deuda.dueDate,
        faltan,
        titulo: tuya
          ? `Quedaste de pagarle a ${deuda.person} ${faltan === 0 ? 'hoy' : faltan === 1 ? 'mañana' : `en ${faltan} días`}`
          : `${deuda.person} quedó de pagarte ${faltan === 0 ? 'hoy' : faltan === 1 ? 'mañana' : `en ${faltan} días`}`,
        cuerpo: `${formatMoney(saldo, deuda.currency)} pendientes.`,
        url: '/cuentas',
        monto: enPesos(saldo, deuda.currency),
      })
    }
  }

  // Lo más cercano primero y, a igualdad de día, lo más caro.
  return salida.sort((a, b) => a.faltan - b.faltan || b.monto - a.monto)
}

const CLAVE_ENVIADOS = 'eftm.avisos.enviados'

/**
 * Los avisos que ya se enseñaron.
 *
 * El identificador lleva la fecha del hecho dentro, así que el del cobro de
 * octubre es distinto del de septiembre y el recordatorio vuelve a salir el
 * mes siguiente sin que haya que limpiar nada. Lo único que se limpia es lo
 * viejo, para que la lista no crezca sin fin.
 */
export function yaEnviados(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = JSON.parse(localStorage.getItem(CLAVE_ENVIADOS) || '{}') as Record<string, string>
    const limite = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)
    return Object.fromEntries(Object.entries(raw).filter(([, d]) => d >= limite))
  } catch {
    return {}
  }
}

export function marcarEnviado(id: string) {
  try {
    const actual = yaEnviados()
    actual[id] = hoyEnZona()
    localStorage.setItem(CLAVE_ENVIADOS, JSON.stringify(actual))
  } catch { /* storage bloqueado */ }
}
