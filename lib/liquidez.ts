/**
 * Proyección de liquidez a 30, 60 y 90 días.
 *
 * Responde a la única pregunta que un saldo, por sí solo, nunca responde:
 * «¿puedo hacer este gasto hoy sin quedarme sin dinero a fin de mes?».
 *
 * El saldo del banco dice lo que hay ahora, y ahora casi siempre hay. Lo que
 * no dice es que el día 3 se va el arriendo, el 5 cortan la tarjeta, el 8
 * cobran cuatro suscripciones y el 15 hay que abonarle a alguien. Un millón en
 * la cuenta el día 1 y un millón el día 20 son dos situaciones distintas, y el
 * saldo las escribe igual.
 *
 * La proyección junta cinco cosas que ya están en la app y las pone en una
 * línea de tiempo:
 *
 *   + el saldo líquido de hoy          (cuentas, ahorros y efectivo)
 *   + los ingresos recurrentes         (sueldo, arriendos, clientes fijos)
 *   − las suscripciones                (lo que se cobra solo)
 *   − las cuotas de las tarjetas       (lo ya facturado, en su fecha límite)
 *   − los abonos de deudas con plazo   (lo pactado con personas)
 *   − el gasto corriente estimado      (ver más abajo)
 *
 * Sobre el último punto, que es el único que no es un dato sino una
 * estimación: sin él la proyección es inútil y además peligrosa. Una línea que
 * solo baja los días de cobro sube en cuanto entra el sueldo y termina el mes
 * en máximos, así que le diría a cualquiera que puede gastar lo que quiera.
 * Pero nadie deja de comer entre cobro y cobro. Se estima con la mediana del
 * gasto diario de los últimos 60 días —mediana y no media: una compra de un
 * televisor no es el martes típico— y se puede apagar, porque es lo único de
 * aquí que no ocurrió de verdad.
 *
 * Todo se calcula en pesos. Lo que esté en dólares se convierte con la tasa
 * vigente, y si no se conoce se deja fuera y se dice cuántas cosas quedaron
 * fuera: mejor una cifra incompleta y avisada que una inventada.
 */
import type { Account, Debt, IncomeCycle, RecurringIncome, Subscription, Transaction } from './types'
import { cicloDe, deudaDe, deudaPorCiclo, fechaDelMes, limiteDelCorte, proximoDiaDelMes } from './tarjetas'
import { diasEntre, proximoCobro, sumarMeses } from './suscripciones'
import { anioMes, hoyEnZona, sumarDias } from './zona'
import type { DeudaConSaldo } from './store'

/** Qué mueve el dinero en un día concreto de la proyección. */
export type TipoEvento = 'ingreso' | 'suscripcion' | 'tarjeta' | 'deuda' | 'cobro' | 'corriente'

export interface EventoLiquidez {
  dia: string
  tipo: TipoEvento
  concepto: string
  /** En pesos. Positivo entra, negativo sale. */
  monto: number
  color: string
}

export interface PuntoLiquidez {
  dia: string
  /** Saldo proyectado al cierre de ese día, en pesos. */
  saldo: number
  /** Lo que entra ese día. */
  entra: number
  /** Lo que sale ese día, en positivo. */
  sale: number
  eventos: EventoLiquidez[]
}

export interface Proyeccion {
  /** Un punto por día, desde hoy hasta el horizonte. */
  serie: PuntoLiquidez[]
  /** Todos los eventos, ordenados por fecha. */
  eventos: EventoLiquidez[]
  /** De dónde parte: el saldo líquido de hoy. */
  saldoInicial: number
  /** Dónde acaba. */
  saldoFinal: number
  /** El punto más bajo de todo el tramo: el día en que la cuerda se tensa. */
  minimo: { dia: string; saldo: number }
  /** Lo que entra y lo que sale en todo el tramo. */
  entra: number
  sale: number
  /** Cuántos días de la proyección quedan en números rojos. */
  diasEnRojo: number
  /** Cuántas cosas quedaron fuera por estar en dólares sin tasa conocida. */
  sinConvertir: number
  /** Estimación diaria del gasto corriente que se está aplicando. */
  gastoDiario: number
}

export const HORIZONTES = [30, 60, 90] as const
export type Horizonte = (typeof HORIZONTES)[number]

/** El color de cada tipo de evento. Se comparte con el gráfico y la lista. */
export const COLOR_EVENTO: Record<TipoEvento, string> = {
  ingreso: '#30D158',
  suscripcion: '#40C8E0',
  tarjeta: '#FF9F0A',
  deuda: '#FF453A',
  cobro: '#5E5CE6',
  corriente: '#8E8E93',
}

export const NOMBRE_EVENTO: Record<TipoEvento, string> = {
  ingreso: 'Ingresos',
  suscripcion: 'Suscripciones',
  tarjeta: 'Tarjetas',
  deuda: 'Deudas',
  cobro: 'Te pagan',
  corriente: 'Gasto corriente',
}

/**
 * Las fechas en que ocurre algo cíclico dentro de un rango.
 *
 * La quincena tiene su propio tratamiento y no es «cada 15 días»: en Colombia
 * se paga el 15 y el 30, y sumar quince días al ancla se va corriendo mes a
 * mes hasta caer el 13 o el 17. Lo que se hace es generar dos series
 * mensuales, una en el día del ancla y otra quince días corrida, que es como
 * caen las nóminas de verdad.
 */
export function ocurrencias(
  ancla: string,
  ciclo: IncomeCycle,
  desde: string,
  hasta: string,
): string[] {
  if (!ancla || desde > hasta) return []

  if (ciclo === 'semanal') {
    const salida: string[] = []
    const saltos = Math.max(0, Math.ceil(diasEntre(ancla, desde) / 7))
    for (let k = saltos; ; k++) {
      const dia = sumarDias(ancla, k * 7)
      if (dia > hasta) break
      if (dia >= desde) salida.push(dia)
      if (k - saltos > 60) break
    }
    return salida
  }

  if (ciclo === 'quincenal') {
    const d = Number(ancla.slice(8, 10))
    const otro = d <= 15 ? d + 15 : d - 15
    const salida: string[] = []
    // Tantos meses como abarque el rango, no un número fijo. Con el tope de
    // seis que había, una proyección a un año se quedaba sin sueldo a partir
    // del séptimo mes: la línea se hundía sola y el año terminaba en rojo
    // aunque no hubiera ningún problema. Con 30/60/90 días nunca se notó
    // porque ninguno llegaba a los seis meses.
    const [ad, md] = anioMes(desde)
    const [ah, mh] = anioMes(hasta)
    const mesesRango = (ah - ad) * 12 + (mh - md)
    for (const dia of [d, otro]) {
      for (let k = 0; k <= mesesRango + 1; k++) {
        const f = fechaDelMes(ad, md + k, dia)
        if (f > hasta) break
        if (f >= desde && f >= ancla) salida.push(f)
      }
    }
    return [...new Set(salida)].sort()
  }

  // Mensual y sus múltiplos: se apoya en el mismo cálculo que las
  // suscripciones, que ya recorta los meses cortos sin que el ancla se
  // desplace para siempre.
  const paso = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 }[ciclo]
  const salida: string[] = []

  /*
   * Cada fecha se cuenta desde el ancla, nunca encadenando una sobre la
   * anterior. Es la misma regla que sigue `sumarMeses` y aquí importa por lo
   * mismo: un ingreso del 31 de enero cae el 28 en febrero, pero en marzo
   * vuelve al 31. Encadenando —sumarle un mes al 28 de febrero— se quedaría
   * en el 28 para el resto de su vida, y en un año se habría corrido tres
   * días respecto a lo que de verdad paga el banco.
   */
  const primera = proximoCobro({ anchorAt: ancla, cycle: ciclo }, desde)
  // Cuántos ciclos hay del ancla a esa primera fecha. De ahí en adelante se
  // avanza sumando ciclos completos al ancla original.
  const [aa, am] = [Number(ancla.slice(0, 4)), Number(ancla.slice(5, 7))]
  const [pa, pm] = [Number(primera.slice(0, 4)), Number(primera.slice(5, 7))]
  const desdeElAncla = Math.max(0, Math.round(((pa - aa) * 12 + (pm - am)) / paso))

  for (let k = 0; k <= 40; k++) {
    const dia = sumarMeses(ancla, (desdeElAncla + k) * paso)
    if (dia > hasta) break
    if (dia >= desde) salida.push(dia)
  }
  return salida
}

/** Lo que de verdad se puede gastar hoy: cuentas, ahorros y efectivo. */
export function saldoLiquido(accounts: Account[], fxRate: number) {
  let total = 0
  let sinConvertir = 0
  for (const a of accounts) {
    // Las tarjetas son deuda, no dinero; las de inversión no son líquidas y
    // venderlas para pagar el arriendo no es «tener el dinero».
    if (a.type === 'credit' || a.type === 'investment') continue
    const suma = a.balance + (a.pockets ?? []).reduce((s, p) => s + p.balance, 0)
    if (a.currency === 'USD') {
      if (fxRate > 0) total += suma * fxRate
      else sinConvertir++
    } else {
      total += suma
    }
  }
  return { total, sinConvertir }
}

/**
 * El gasto corriente de un día normal.
 *
 * Mediana y no media, y por un motivo que se ve en cualquier historial real:
 * un mes con una nevera de dos millones tiene una media de gasto diario que no
 * se parece a ningún día de ese mes. La mediana dice qué pasa un martes
 * cualquiera, que es lo que hay que proyectar sobre noventa días.
 *
 * Se excluye lo que ya se proyecta por su lado —suscripciones, cuotas de
 * tarjeta, abonos a deudas, pasos a ahorro e inversión— porque si no se
 * contaría dos veces, y esos son justo los importes grandes.
 */
const CATEGORIAS_YA_PROYECTADAS = new Set([
  'subs', 'installment', 'loan-payment', 'loan-given', 'to-savings', 'to-investment', 'home',
])

export function gastoCorrienteDiario(
  transactions: Transaction[],
  fxRate: number,
  hoy: string = hoyEnZona(),
  ventanaDias = 60,
): number {
  const desde = sumarDias(hoy, -ventanaDias)
  const porDia = new Map<string, number>()

  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (t.subscriptionId || CATEGORIAS_YA_PROYECTADAS.has(t.categoryId)) continue
    const dia = t.occurredAt.slice(0, 10)
    if (dia < desde || dia > hoy) continue
    const monto = t.currency === 'USD' ? (fxRate > 0 ? t.amount * fxRate : 0) : t.amount
    porDia.set(dia, (porDia.get(dia) ?? 0) + monto)
  }

  // Los días sin ningún gasto cuentan como cero: son parte de la historia y
  // quitarlos subiría la mediana justo en quien gasta poco y en ráfagas.
  const dias: number[] = []
  for (let k = 0; k < ventanaDias; k++) dias.push(porDia.get(sumarDias(hoy, -k)) ?? 0)
  dias.sort((a, b) => a - b)

  const mitad = Math.floor(dias.length / 2)
  const mediana = dias.length % 2 ? dias[mitad] : (dias[mitad - 1] + dias[mitad]) / 2
  return Math.round(mediana)
}

export interface EntradaProyeccion {
  accounts: Account[]
  transactions: Transaction[]
  subscriptions: Subscription[]
  ingresos: RecurringIncome[]
  /** Las deudas con su saldo ya calculado: el interés depende de las fechas. */
  deudas: DeudaConSaldo[]
  fxRate: number
  /**
   * Cuántos días hacia adelante. Los de la gráfica son `HORIZONTES`, pero la
   * proyección mensual pide un año entero sobre este mismo motor, así que aquí
   * es un número y no uno de los tres de siempre.
   */
  dias: number
  hoy?: string
  /** Aplicar el gasto corriente estimado. Ver la nota de arriba. */
  conGastoCorriente?: boolean
}

/**
 * Construye la línea de tiempo.
 *
 * Día a día y no por saltos entre eventos: el punto más bajo del tramo puede
 * caer en un día en que no pasa nada —el día antes de que entre el sueldo—, y
 * es justo el día que hay que enseñar.
 */
export function proyectarLiquidez(e: EntradaProyeccion): Proyeccion {
  const hoy = e.hoy ?? hoyEnZona()
  const hasta = sumarDias(hoy, e.dias)
  const { total: saldoInicial, sinConvertir: sinConvertirCuentas } = saldoLiquido(e.accounts, e.fxRate)
  let sinConvertir = sinConvertirCuentas

  const eventos: EventoLiquidez[] = []
  /** A pesos, o null si no hay tasa y está en dólares. */
  const enPesos = (monto: number, moneda: string): number | null =>
    moneda === 'USD' ? (e.fxRate > 0 ? monto * e.fxRate : null) : monto

  // ---- Lo que entra: ingresos recurrentes ---------------------------------
  for (const ing of e.ingresos) {
    if (ing.active === false) continue
    const monto = enPesos(ing.amount, ing.currency)
    if (monto === null) { sinConvertir++; continue }
    // Desde mañana: lo de hoy, si entró, ya está en el saldo, y si no entró
    // todavía no hay forma de saberlo. Contarlo sería sumar dos veces.
    for (const dia of ocurrencias(ing.anchorAt, ing.cycle, sumarDias(hoy, 1), hasta)) {
      eventos.push({ dia, tipo: 'ingreso', concepto: ing.name, monto, color: COLOR_EVENTO.ingreso })
    }
  }

  // ---- Lo que sale solo: suscripciones ------------------------------------
  for (const sub of e.subscriptions) {
    if (sub.cancelled) continue
    const monto = enPesos(sub.amount, sub.currency)
    if (monto === null) { sinConvertir++; continue }

    for (const dia of ocurrencias(sub.anchorAt, sub.cycle, sumarDias(hoy, 1), hasta)) {
      // Durante la prueba la fecha pasa sin cobro: es gratis, esa es la gracia.
      if (sub.trialEndsAt && dia <= sub.trialEndsAt) continue
      /*
       * El importe entero, no tu parte. Lo que el banco se lleva de la cuenta
       * el día 8 es la factura completa aunque la compartan cuatro; lo que
       * ponen los demás vuelve después y por otro lado. Para la liquidez manda
       * lo que sale, no de quién era.
       */
      eventos.push({ dia, tipo: 'suscripcion', concepto: sub.name, monto: -monto, color: COLOR_EVENTO.suscripcion })
    }
  }

  // ---- Las tarjetas de crédito --------------------------------------------
  for (const cuenta of e.accounts) {
    if (cuenta.type !== 'credit') continue
    const ciclo = cicloDe(cuenta, hoy)
    const deuda = deudaDe(cuenta)
    if (!ciclo || deuda <= 0) continue

    /*
     * Solo lo ya facturado vence en `limiteEnCurso`.
     *
     * Lo gastado desde el corte todavía no está en ningún extracto: entra en
     * el que cierra en `corteProximo` y se paga un mes después. Metiéndolo
     * todo en la primera fecha, la línea se hundía de golpe por una plata que
     * el banco aún no ha cobrado, y justo a quien acaba de cortar en cero y
     * lleva gastando desde entonces —el caso más común— le salía el peor mes
     * del año. Ver `deudaPorCiclo`.
     */
    const reparto = deudaPorCiclo(cuenta, e.transactions, hoy)
    if (reparto.enCurso > 0) {
      const enCursoCOP = enPesos(reparto.enCurso, cuenta.currency)
      if (enCursoCOP === null) sinConvertir++
      else {
        const dia = limiteDelCorte(ciclo.corteProximo, cuenta.dueDay!)
        if (dia > hoy && dia <= hasta) {
          eventos.push({
            dia,
            tipo: 'tarjeta',
            concepto: `${cuenta.name} · lo de este ciclo`,
            monto: -enCursoCOP,
            color: COLOR_EVENTO.tarjeta,
          })
        }
      }
    }

    if (reparto.facturado <= 0) continue
    const deudaCOP = enPesos(reparto.facturado, cuenta.currency)
    if (deudaCOP === null) { sinConvertir++; continue }

    /*
     * Cuánto se paga cada mes.
     *
     * Con cuotas pactadas, la cuota: la deuda entre las que faltan. Sin
     * cuotas, la deuda entera en la primera fecha límite, que es lo que hace
     * quien paga el total —y lo que conviene hacer, porque el crédito rotativo
     * en Colombia ronda la tasa de usura—. Suponer que se paga el mínimo sería
     * proyectar una deuda que crece con intereses y presentarlo como un plan.
     */
    const restantes = cuenta.installments
      ? Math.max(1, cuenta.installments - (cuenta.installmentsPaid ?? 0))
      : 1
    const cuota = deudaCOP / restantes

    let fecha = ciclo.limiteEnCurso
    for (let k = 0; k < restantes && fecha <= hasta; k++) {
      if (fecha > hoy) {
        eventos.push({
          dia: fecha,
          tipo: 'tarjeta',
          concepto: restantes > 1 ? `${cuenta.name} · cuota ${k + 1}/${restantes}` : `${cuenta.name} · extracto`,
          monto: -cuota,
          color: COLOR_EVENTO.tarjeta,
        })
      }
      fecha = limiteDelCorte(proximoDiaDelMes(cuenta.statementDay!, sumarDias(fecha, 1)), cuenta.dueDay!)
    }
  }

  // ---- Las deudas con personas --------------------------------------------
  for (const d of e.deudas) {
    if (d.saldada || !d.deuda.dueDate) continue
    const dia = d.deuda.dueDate
    if (dia <= hoy || dia > hasta) continue
    const monto = d.saldoCOP
    if (monto === null) { sinConvertir++; continue }

    // Lo que debes sale; lo que te deben entra el día que quedaron. Que entre
    // es optimista y por eso va con su propio color y su propio nombre: quien
    // mire la línea sabe que ese pico depende de que el otro pague.
    const esTuya = d.deuda.direction === 'owe'
    eventos.push({
      dia,
      tipo: esTuya ? 'deuda' : 'cobro',
      concepto: esTuya ? `Pagar a ${d.deuda.person}` : `${d.deuda.person} te paga`,
      monto: esTuya ? -monto : monto,
      color: esTuya ? COLOR_EVENTO.deuda : COLOR_EVENTO.cobro,
    })
  }

  // ---- El día a día --------------------------------------------------------
  const gastoDiario = e.conGastoCorriente === false
    ? 0
    : gastoCorrienteDiario(e.transactions, e.fxRate, hoy)

  // ---- Se recorre el calendario -------------------------------------------
  const porDia = new Map<string, EventoLiquidez[]>()
  for (const ev of eventos) porDia.set(ev.dia, [...(porDia.get(ev.dia) ?? []), ev])

  const serie: PuntoLiquidez[] = []
  let saldo = saldoInicial
  let entra = 0
  let sale = 0
  let minimo = { dia: hoy, saldo: saldoInicial }
  let diasEnRojo = 0

  for (let k = 0; k <= e.dias; k++) {
    const dia = sumarDias(hoy, k)
    const delDia = porDia.get(dia) ?? []
    let entraHoy = 0
    let saleHoy = 0

    for (const ev of delDia) {
      if (ev.monto >= 0) entraHoy += ev.monto
      else saleHoy += -ev.monto
    }
    // El gasto corriente no se aplica al día de hoy: lo de hoy ya está en el
    // saldo, y volver a restarlo empezaría la línea un escalón por debajo de
    // lo que dice el banco.
    if (k > 0 && gastoDiario > 0) {
      saleHoy += gastoDiario
      delDia.push({
        dia, tipo: 'corriente', concepto: 'Gasto corriente estimado',
        monto: -gastoDiario, color: COLOR_EVENTO.corriente,
      })
    }

    saldo += entraHoy - saleHoy
    entra += entraHoy
    sale += saleHoy
    if (saldo < minimo.saldo) minimo = { dia, saldo }
    if (saldo < 0) diasEnRojo++

    serie.push({ dia, saldo: Math.round(saldo), entra: entraHoy, sale: saleHoy, eventos: delDia })
  }

  return {
    serie,
    eventos: eventos.sort((a, b) => a.dia.localeCompare(b.dia)),
    saldoInicial,
    saldoFinal: Math.round(saldo),
    minimo: { dia: minimo.dia, saldo: Math.round(minimo.saldo) },
    entra: Math.round(entra),
    sale: Math.round(sale),
    diasEnRojo,
    sinConvertir,
    gastoDiario,
  }
}

export type Veredicto = 'si' | 'justo' | 'no'

export interface RespuestaGasto {
  veredicto: Veredicto
  /** Lo que quedaría en el peor día si se hace el gasto. */
  colchon: number
  /** El día en que la cuerda queda más tensa. */
  diaCritico: string
  /** Cuántos días faltan para ese día. */
  faltan: number
  titulo: string
  detalle: string
}

/**
 * «¿Puedo gastarme esto hoy?».
 *
 * No mira el saldo de hoy sino el punto más bajo de los próximos días, que es
 * donde de verdad se rompe. Gastar medio millón cuando hay dos en la cuenta
 * parece obvio hasta que el día 28 quedan ochenta mil y falta el arriendo.
 *
 * El colchón mínimo no es cero. Quedarse exactamente en cero el peor día
 * significa que cualquier cosa no prevista —una consulta médica, un domicilio
 * más caro de la cuenta— pasa a ser un sobregiro. Así que por debajo de un
 * colchón razonable la respuesta es «justo», que no es un no: es un sí con la
 * cifra delante para que decida quien tiene que decidir.
 */
export function puedoGastar(
  p: Proyeccion,
  monto: number,
  colchonMinimo?: number,
): RespuestaGasto {
  // Un colchón proporcional al ritmo de gasto: una semana de gasto corriente,
  // con un suelo fijo para quien casi no registra movimientos. Un porcentaje
  // del saldo sería peor —a quien tiene mucho le pediría un colchón enorme y a
  // quien no tiene nada, ninguno.
  const colchonBase = colchonMinimo ?? Math.max(50_000, p.gastoDiario * 7)
  const colchon = p.minimo.saldo - monto
  const faltan = diasEntre(p.serie[0]?.dia ?? hoyEnZona(), p.minimo.dia)

  const comoQueda = `El día más ajustado quedarías con ${Math.round(colchon).toLocaleString('es-CO')} pesos.`

  if (colchon < 0) {
    return {
      veredicto: 'no', colchon, diaCritico: p.minimo.dia, faltan,
      titulo: 'Te quedarías corto',
      detalle: `Con este gasto no alcanza para lo que ya está comprometido${faltan > 0 ? ` de aquí al ${p.minimo.dia.slice(8, 10)}` : ''}. ${comoQueda}`,
    }
  }
  if (colchon < colchonBase) {
    return {
      veredicto: 'justo', colchon, diaCritico: p.minimo.dia, faltan,
      titulo: 'Sí, pero queda justo',
      detalle: `${comoQueda} Sin margen para nada que no esté previsto.`,
    }
  }
  return {
    veredicto: 'si', colchon, diaCritico: p.minimo.dia, faltan,
    titulo: 'Sí, sin apretarte',
    detalle: comoQueda,
  }
}
