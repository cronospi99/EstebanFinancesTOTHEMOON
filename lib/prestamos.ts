import { diasEntre, sumarMeses } from './suscripciones'

/**
 * Préstamos a clientes con interés mensual fijo.
 *
 * Es el préstamo de toda la vida entre particulares: se entregan 500.000 al
 * 10 % mensual y cada mes el cliente paga 50.000 de intereses, mientras el
 * capital sigue intacto hasta que lo devuelva. Puede abonar a capital cuando
 * quiera, y desde el mes siguiente el interés se calcula sobre lo que queda:
 * si abona 100.000, el mes siguiente paga 40.000.
 *
 * No es la deuda entre personas de `deudas.ts`, y a propósito. Aquella lleva
 * una tasa efectiva anual que corre día a día y se compone; aquí la regla es
 * la que se pacta de palabra —«el diez al mes»— y se cobra por meses enteros
 * sobre el capital, sin intereses sobre intereses. Meterla en el mismo molde
 * daba cifras que no coinciden con lo que cobra quien presta, y esas son las
 * únicas que le sirven.
 *
 * ---------------------------------------------------------------------------
 * La regla, completa
 * ---------------------------------------------------------------------------
 * - Los meses se cuentan desde el día del préstamo. Uno del 5 de enero corta
 *   el 5 de febrero, el 5 de marzo… (un 31 corta el último día de los meses
 *   cortos, y vuelve al 31 cuando puede: ver `sumarMeses`).
 * - Cada mes cobra el interés sobre el capital que había al EMPEZAR ese mes,
 *   contando lo que se abonó ese mismo día. Un abono a mitad de mes baja el
 *   interés desde el mes siguiente: el mes que ya empezó se cobra entero. Es
 *   el ejemplo de siempre —paga 50.000 de intereses y 100.000 de capital el
 *   día del corte, y el mes siguiente son 40.000— y es también lo que evita
 *   que un abono el día 29 cueste lo mismo que uno el día 1.
 * - El interés de un mes vence el día de su corte. Ese día «vence hoy»; desde
 *   el día siguiente, lo que falte es mora.
 * - El mes que empieza el día del corte no se debe todavía ese mismo día: lo
 *   que se abone hoy baja su interés. Por eso el día del corte, para saldar,
 *   basta capital más el interés que vence —los 550.000 del ejemplo—, y no
 *   capital más dos meses.
 * - Los pagos de intereses cubren los meses del más viejo al más nuevo, sin
 *   importar a qué mes «quería» pagar el cliente: la mora se salda antes que
 *   el mes en curso, que es como la cuenta cualquiera que presta.
 * - Sin capital no hay meses nuevos. El préstamo queda saldado cuando no
 *   queda capital ni interés por pagar de los meses que llegaron a empezar.
 */

export interface Prestamo {
  id: string
  /** A quién se le prestó. */
  cliente: string
  telefono?: string
  /** El capital entregado. */
  monto: number
  /** Interés fijo por mes, en %: 10 es el diez por ciento mensual. */
  tasaMensual: number
  /** El día en que se entregó la plata. De aquí salen todos los cortes. */
  fecha: string
  nota?: string
  /**
   * Fuera de la tabla sin borrarse. Un cliente que ya pagó deja de interesar
   * en el día a día, pero su historial es lo que dice si se le vuelve a
   * prestar.
   */
  archivado?: boolean
}

/**
 * Un pago del cliente. Puede ser solo de intereses, solo abono a capital, o
 * las dos cosas a la vez, que es lo más común el día del corte.
 */
export interface PagoPrestamo {
  id: string
  prestamoId: string
  fecha: string
  /** Lo que va a intereses. */
  interes: number
  /** Lo que baja el capital. */
  capital: number
  nota?: string
}

export type EstadoMes = 'pagado' | 'en-curso' | 'vencido'

export interface MesPrestamo {
  numero: number
  inicio: string
  /** Cuándo vence el interés de este mes. */
  corte: string
  /** El capital sobre el que se cobra. */
  base: number
  interes: number
  /** Cuánto de ese interés ya está cubierto por los pagos. */
  pagado: number
  estado: EstadoMes
}

export type EstadoCliente = 'al-dia' | 'vence-hoy' | 'mora' | 'saldado'

export interface EstadoPrestamo {
  /** El capital que falta por devolver. */
  capital: number
  capitalPagado: number
  interesPagado: number
  /** Interés de todos los meses que ya empezaron. */
  interesCausado: number
  /** Interés de cortes ya pasados sin pagar. */
  mora: number
  /** Días desde el corte más viejo sin pagar. 0 si no hay mora. */
  diasMora: number
  /** Interés que vence hoy y todavía no se ha pagado. */
  venceHoy: number
  /** Lo que debería pagar hoy: la mora más lo que vence hoy. */
  pendienteHoy: number
  /** El siguiente corte después de hoy. Null si ya no corre ningún mes. */
  proximoCorte: string | null
  /** Lo que falta del interés que vence en ese corte. */
  interesProximoCorte: number
  /** Solo intereses para estar al día en el próximo corte: lo pendiente más lo de ese corte. */
  pagoProximoCorte: number
  /** Lo que tiene que pagar para cerrar el préstamo hoy mismo. */
  paraSaldarHoy: number
  /** Lo que tendrá que pagar para cerrarlo el día del próximo corte. */
  paraSaldarEnCorte: number
  /**
   * El interés del mes que empieza en el próximo corte, si no abona nada más
   * a capital. Es el «el mes que viene pagas 40.000».
   */
  interesSiguienteMes: number
  /** Intereses pagados de más: cubren los meses que vengan. */
  saldoAFavor: number
  meses: MesPrestamo[]
  estado: EstadoCliente
}

/** Pesos enteros: nadie cobra 33.333,33 pesos de interés. */
const redondear = (n: number) => Math.round(n)

/** El interés de un mes sobre un capital. */
export const interesDelMes = (capital: number, tasaMensual: number) =>
  redondear(Math.max(0, capital) * tasaMensual / 100)

/**
 * La tasa mensual en efectiva anual, para poder compararla con la de un banco
 * o con la de usura, que se publican así. Supone que los intereses se cobran
 * cada mes y se vuelven a prestar, que es lo que hace quien vive de esto.
 */
export const efectivaAnual = (tasaMensual: number) => (Math.pow(1 + tasaMensual / 100, 12) - 1) * 100

export function estadoPrestamo(p: Prestamo, pagos: PagoPrestamo[], hoy: string): EstadoPrestamo {
  const propios = pagos.filter((x) => x.prestamoId === p.id)
  const capitalPagado = propios.reduce((s, x) => s + x.capital, 0)
  const interesPagado = propios.reduce((s, x) => s + x.interes, 0)
  const capital = Math.max(0, p.monto - capitalPagado)

  // El capital que quedaba al empezar un día: lo abonado ese mismo día cuenta.
  const capitalAl = (dia: string) =>
    Math.max(0, p.monto - propios.filter((x) => x.fecha <= dia).reduce((s, x) => s + x.capital, 0))

  // Los meses que ya empezaron, mientras quede capital. El tope es de pura
  // prudencia: cien años de meses no los tiene ningún préstamo de verdad, y
  // una fecha mal escrita no puede dejar la pantalla calculando para siempre.
  const meses: MesPrestamo[] = []
  for (let k = 1; k <= 1200; k++) {
    const inicio = sumarMeses(p.fecha, k - 1)
    if (inicio > hoy) break
    const base = capitalAl(inicio)
    if (base <= 0) break
    const corte = sumarMeses(p.fecha, k)
    meses.push({
      numero: k, inicio, corte, base,
      interes: interesDelMes(base, p.tasaMensual),
      pagado: 0,
      estado: corte <= hoy ? 'vencido' : 'en-curso',
    })
  }

  // Los pagos de intereses, del mes más viejo al más nuevo.
  let disponible = interesPagado
  for (const m of meses) {
    m.pagado = Math.min(m.interes, disponible)
    disponible -= m.pagado
    if (m.pagado >= m.interes) m.estado = 'pagado'
  }
  const saldoAFavor = Math.max(0, disponible)

  const interesCausado = meses.reduce((s, m) => s + m.interes, 0)
  const falta = (m: MesPrestamo) => m.interes - m.pagado
  const pasados = meses.filter((m) => m.corte < hoy)
  const mora = pasados.reduce((s, m) => s + falta(m), 0)
  const primeroSinPagar = pasados.find((m) => falta(m) > 0)
  const diasMora = primeroSinPagar ? diasEntre(primeroSinPagar.corte, hoy) : 0
  const venceHoy = meses.filter((m) => m.corte === hoy).reduce((s, m) => s + falta(m), 0)
  const pendienteHoy = mora + venceHoy

  // El mes que corre: el que empezó y aún no corta. El día del corte es el
  // que empieza ese día.
  const actual = meses.find((m) => m.inicio <= hoy && hoy < m.corte)
  const interesProximoCorte = actual ? falta(actual) : 0
  const proximoCorte = actual?.corte ?? null
  // Se debe entero si empezó antes de hoy; si empieza hoy, un abono de hoy
  // todavía le cambia la base.
  const delMesQueCorre = actual && actual.inicio < hoy ? interesProximoCorte : 0

  const paraSaldarHoy = capital + pendienteHoy + delMesQueCorre
  const pagoProximoCorte = pendienteHoy + interesProximoCorte
  const paraSaldarEnCorte = capital + pagoProximoCorte
  const interesSiguienteMes = capital > 0 ? interesDelMes(capital, p.tasaMensual) : 0

  return {
    capital, capitalPagado, interesPagado, interesCausado, mora, diasMora, venceHoy, pendienteHoy,
    proximoCorte, interesProximoCorte, pagoProximoCorte, paraSaldarHoy, paraSaldarEnCorte,
    interesSiguienteMes, saldoAFavor, meses,
    estado: paraSaldarHoy <= 0 ? 'saldado' : mora > 0 ? 'mora' : venceHoy > 0 ? 'vence-hoy' : 'al-dia',
  }
}

export interface ResumenCartera {
  clientesActivos: number
  clientesEnMora: number
  clientesSaldados: number
  /** Todo lo que se ha prestado, saldado o no. */
  prestadoTotal: number
  /** El capital que sigue en manos de los clientes. */
  capitalEnLaCalle: number
  capitalRecuperado: number
  interesCobrado: number
  interesCobradoEsteMes: number
  /** Lo que entraría cada mes si todos pagan solo intereses. */
  interesMensualCartera: number
  /** Lo que hay que cobrar en los próximos cortes para que todos queden al día. */
  porCobrarProximosCortes: number
  moraTotal: number
}

/** Las cifras de toda la cartera, para la cabecera del tablero. */
export function resumenCartera(prestamos: Prestamo[], pagos: PagoPrestamo[], hoy: string): ResumenCartera {
  const mes = hoy.slice(0, 7)
  const r: ResumenCartera = {
    clientesActivos: 0, clientesEnMora: 0, clientesSaldados: 0,
    prestadoTotal: 0, capitalEnLaCalle: 0, capitalRecuperado: 0,
    interesCobrado: 0, interesCobradoEsteMes: 0, interesMensualCartera: 0,
    porCobrarProximosCortes: 0, moraTotal: 0,
  }
  for (const p of prestamos) {
    const e = estadoPrestamo(p, pagos, hoy)
    r.prestadoTotal += p.monto
    r.capitalRecuperado += e.capitalPagado
    r.interesCobrado += e.interesPagado
    if (e.estado === 'saldado') { r.clientesSaldados++; continue }
    r.clientesActivos++
    if (e.estado === 'mora') r.clientesEnMora++
    r.capitalEnLaCalle += e.capital
    r.interesMensualCartera += e.interesSiguienteMes
    r.porCobrarProximosCortes += e.pagoProximoCorte
    r.moraTotal += e.mora
  }
  r.interesCobradoEsteMes = pagos
    .filter((x) => x.fecha.slice(0, 7) === mes && prestamos.some((p) => p.id === x.prestamoId))
    .reduce((s, x) => s + x.interes, 0)
  return r
}
