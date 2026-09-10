import type { Currency, Debt, DebtPayment } from './types'

/**
 * Cuánto se debe hoy de un préstamo entre personas.
 *
 * El interés corre sobre el saldo pendiente, no sobre el monto original. Es la
 * diferencia entre una cuenta que cuadra y una que no: si prestaron un millón
 * al 2 % mensual y ya se devolvió la mitad, el segundo mes el interés se
 * calcula sobre lo que queda. Cobrar sobre el millón entero —interés simple
 * sobre el original— haría que pagar no sirviera de nada, que es justo lo
 * contrario de lo que uno quiere ver al abrir la pantalla.
 *
 * Por eso se recorre el tiempo por tramos: se acumula interés desde el último
 * evento hasta el siguiente abono, se resta el abono, y así hasta hoy. Cada
 * abono baja el saldo desde su propia fecha, que es lo que premia haber pagado
 * antes.
 *
 * La tasa se guarda efectiva anual y se prorratea por días completos con la
 * misma fórmula que usa el resto de la app para las cuentas —(1 + i)^(días/365)—,
 * así que un 24 % E.A. son treinta días de 1,81 %, no de 2 %. Es interés
 * compuesto, que es como funciona un saldo que no se paga.
 */

const DIA_MS = 86_400_000

/**
 * Días completos entre dos fechas.
 *
 * Enteros a propósito. Con fracción de día, una deuda con interés cambiaba de
 * cifra cada vez que se abría la pantalla —setenta y cuatro pesos más que hace
 * dos horas— y el saldo dejaba de ser algo que uno pueda comparar con lo que
 * tiene apuntado. Así el número solo se mueve una vez al día, que además es
 * como se habla de estos préstamos: «lleva tres días», no «lleva 3,4 días».
 *
 * Nunca negativos: un abono con fecha anterior al préstamo no descuenta tiempo.
 */
const dias = (desde: number, hasta: number) => Math.max(0, Math.floor((hasta - desde) / DIA_MS))

const tiempo = (iso: string) => {
  // Solo día: se ancla a mediodía UTC para que el desfase horario del teléfono
  // no mueva un abono al día anterior y le regale —o le cobre— una jornada.
  const t = new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime()
  return Number.isNaN(t) ? Date.now() : t
}

export interface SaldoDeuda {
  /** El monto prestado, tal cual. */
  capital: number
  /** Intereses corridos hasta hoy sobre el saldo pendiente. */
  interes: number
  /** Todo lo abonado, sumado. */
  pagado: number
  /** Lo que falta por pagar. Cero si ya se saldó. */
  saldo: number
  /** Lo que se pagó de más, si se pagó de más. */
  excedente: number
  /** Cuánto de la deuda va cubierto, de 0 a 1. */
  progreso: number
  /** True cuando no queda nada por pagar. */
  saldada: boolean
}

/**
 * Estado de una deuda a una fecha.
 *
 * `hasta` existe para poder calcular a una fecha distinta de hoy; por defecto
 * es ahora, que es lo que enseña la pantalla.
 */
export function saldoDeuda(
  deuda: Pick<Debt, 'principal' | 'rate' | 'startedAt'>,
  pagos: Pick<DebtPayment, 'amount' | 'occurredAt'>[],
  hasta: Date | number = Date.now(),
): SaldoDeuda {
  const capital = Math.max(0, deuda.principal)
  const fin = typeof hasta === 'number' ? hasta : hasta.getTime()
  const inicio = tiempo(deuda.startedAt)
  const tasa = deuda.rate && deuda.rate > 0 ? deuda.rate / 100 : 0

  const ordenados = [...pagos].sort((a, b) => tiempo(a.occurredAt) - tiempo(b.occurredAt))
  const pagado = ordenados.reduce((t, p) => t + Math.max(0, p.amount), 0)

  let pendiente = capital
  let interes = 0
  let reloj = inicio

  const correr = (momento: number) => {
    // Un saldo en cero o negativo no genera intereses: quien ya pagó de más no
    // le debe nada a nadie, y componer sobre un número negativo lo haría crecer
    // en la dirección equivocada.
    if (tasa > 0 && pendiente > 0) {
      const crecido = pendiente * (1 + tasa) ** (dias(reloj, momento) / 365)
      interes += crecido - pendiente
      pendiente = crecido
    }
    reloj = Math.max(reloj, momento)
  }

  for (const p of ordenados) {
    const cuando = Math.max(tiempo(p.occurredAt), inicio)
    if (cuando > fin) break // un abono con fecha futura aún no ha ocurrido
    correr(cuando)
    pendiente -= Math.max(0, p.amount)
  }
  correr(fin)

  const saldo = Math.max(0, pendiente)
  const excedente = Math.max(0, -pendiente)
  const total = capital + interes

  return {
    capital,
    interes,
    pagado,
    saldo,
    excedente,
    progreso: total > 0 ? Math.min(1, Math.max(0, (total - saldo) / total)) : 1,
    saldada: saldo <= 0.5,
  }
}

/**
 * Tasa efectiva anual equivalente a una mensual, y al revés.
 *
 * Un préstamo entre personas se pacta casi siempre al mes —«el 2 %»— pero se
 * guarda anual para que una tasa signifique lo mismo en toda la app. Un 2 %
 * mensual no es un 24 % anual sino un 26,8 %: los intereses del mes siguiente
 * corren también sobre los del anterior.
 */
export const anualDesdeMensual = (mensual: number) => ((1 + mensual / 100) ** 12 - 1) * 100
export const mensualDesdeAnual = (anual: number) => ((1 + anual / 100) ** (1 / 12) - 1) * 100

/**
 * Redondea un importe de deuda para enseñarlo.
 *
 * El interés sale con decimales, y en pesos eso es ruido: nadie le debe a su
 * madre «1.267.144,65». Los pesos van enteros y los dólares a dos decimales,
 * que ahí sí significan algo. El cálculo se queda con toda su precisión: esto
 * es solo para pintar.
 */
export const redondeaMoneda = (valor: number, moneda: Currency) =>
  moneda === 'USD' ? Math.round(valor * 100) / 100 : Math.round(valor)
