/**
 * Sueldo pasivo y proyección de independencia financiera (FIRE).
 *
 * La idea entera cabe en una frase: el dinero invertido produce algo todos los
 * meses, y el día en que eso cubre lo que gastas, trabajar pasa a ser una
 * decisión y no una obligación.
 *
 * Lo que se enseña en la app es el primer número y no el segundo. «Te faltan
 * 23,4 años» es una cifra que no se puede usar para nada hoy y que además es
 * falsamente precisa: depende de rendimientos futuros que nadie conoce. «Tu
 * portafolio ya paga el 7 % de tus gastos del mes» sí se puede usar: es
 * comprobable, sube cuando aportas, y convierte una meta lejana en una barra
 * que se mueve.
 *
 * Por eso el indicador principal es el sueldo pasivo y la fecha va debajo, en
 * pequeño y con sus supuestos escritos.
 *
 * ---------------------------------------------------------------------------
 * Sobre la tasa de retiro seguro
 * ---------------------------------------------------------------------------
 * El 4 % viene del estudio Trinity (1998) sobre carteras en dólares: retirando
 * un 4 % del capital inicial al año, ajustado por inflación, una cartera mixta
 * aguantó treinta años en el 95 % de los períodos históricos.
 *
 * En pesos colombianos ese número es optimista y conviene decirlo. La
 * inflación local ha sido históricamente más alta y más volátil que la
 * estadounidense, así que el rendimiento REAL —el que queda después de la
 * inflación— es lo único que cuenta, y es lo que se pide aquí. Un CDT al 11 %
 * con inflación del 6 % no renta un 11 %: renta un 5 % escaso.
 */
import type { Transaction } from './types'
import { monthKey } from './format'
import { hoyEnZona, sumarDias } from './zona'

/** Tasa de retiro seguro por defecto, en % anual sobre el capital. */
export const SWR_POR_DEFECTO = 4

/** Rendimiento real anual por defecto, en %. Descontada la inflación. */
export const RENDIMIENTO_REAL_POR_DEFECTO = 5

export interface EntradaFire {
  /** Valor de mercado del portafolio, en pesos. */
  portafolio: number
  /** Rendimiento mensual esperado de cuentas y bolsillos por su tasa E.A. */
  rendimientoCuentas: number
  /** Gasto mensual medio, en pesos. */
  gastoMensual: number
  /** Lo que se aporta al mes a la inversión, en pesos. */
  aporteMensual: number
  /** Dividendos y rendimientos efectivamente cobrados en los últimos 12 meses. */
  cobradoUltimoAnio: number
  /** Tasa de retiro seguro, en % anual. */
  swr?: number
  /** Rendimiento real esperado, en % anual. */
  rendimientoReal?: number
}

export interface Fire {
  /**
   * Lo que el portafolio podría pagarte cada mes sin encogerse.
   *
   * Es una estimación: el capital por la tasa de retiro seguro, más lo que
   * rinden de verdad las cuentas con tasa declarada.
   */
  sueldoPasivo: number
  /**
   * Lo que de verdad llegó a la cuenta en dividendos y rendimientos, al mes.
   *
   * Va al lado del estimado a propósito. Un ETF de acumulación no reparte nada
   * y aquí sale cero aunque el portafolio crezca; enseñar solo esta cifra
   * diría que no rinde, y enseñar solo la estimada escondería que todavía no
   * hay un peso entrando. Las dos juntas cuentan la historia completa.
   */
  sueldoPasivoReal: number
  /** Qué fracción de tus gastos del mes cubre el sueldo pasivo, en %. */
  cobertura: number
  /** El capital que haría falta para cubrirlos todos, en pesos. */
  numeroFire: number
  /** Lo que llevas del camino, en %. */
  avance: number
  /** Cuántos años faltan al ritmo actual. null si no se puede saber. */
  anios: number | null
  /** En qué año caería. null por lo mismo. */
  anio: number | null
  /**
   * Coast FIRE: el capital que, sin aportar un peso más, llega solo al número
   * a los 65. Cruzarlo cambia la pregunta de «cuánto falta» a «cuánto quiero
   * seguir aportando», y es el hito que de verdad se alcanza siendo joven.
   */
  coast: number
  /** Ya no hace falta aportar más para llegar a tiempo. */
  enCoast: boolean
  /** Cuánto de tus gastos cubriría medio portafolio: el hito de «media jornada». */
  baristaCobertura: number
}

/**
 * Cuántos meses tarda un capital en llegar a una meta aportando cada mes.
 *
 * Es la fórmula del valor futuro de una anualidad, despejada para el tiempo:
 *
 *     n = ln((M·i + C) / (P·i + C)) / ln(1 + i)
 *
 * con `i` mensual. Devuelve null cuando no hay camino: sin aportes y sin
 * capital no se llega nunca, y con rendimiento cero la fórmula se indetermina
 * —ahí la respuesta es la resta simple, que también se contempla.
 */
export function mesesHasta(capital: number, aporte: number, meta: number, tasaMensual: number): number | null {
  if (meta <= capital) return 0
  if (aporte <= 0 && tasaMensual <= 0) return null
  if (tasaMensual <= 0) return (meta - capital) / aporte

  const arriba = meta * tasaMensual + aporte
  const abajo = capital * tasaMensual + aporte
  if (abajo <= 0 || arriba <= 0) return null

  const n = Math.log(arriba / abajo) / Math.log(1 + tasaMensual)
  // Más de un siglo es lo mismo que nunca, y enseñar «en 340 años» es una
  // broma que nadie pidió.
  return Number.isFinite(n) && n > 0 && n < 1200 ? n : null
}

export function calcularFire(e: EntradaFire): Fire {
  const swr = e.swr ?? SWR_POR_DEFECTO
  const real = e.rendimientoReal ?? RENDIMIENTO_REAL_POR_DEFECTO
  const mensualReal = Math.pow(1 + real / 100, 1 / 12) - 1

  const sueldoPasivo = (e.portafolio * (swr / 100)) / 12 + e.rendimientoCuentas
  const sueldoPasivoReal = e.cobradoUltimoAnio / 12

  const gasto = Math.max(0, e.gastoMensual)
  const cobertura = gasto > 0 ? (sueldoPasivo / gasto) * 100 : 0
  // El capital que renta lo que gastas: gasto anual entre la tasa de retiro.
  // Con el 4 %, veinticinco veces el gasto de un año.
  const numeroFire = gasto > 0 ? (gasto * 12) / (swr / 100) : 0
  const avance = numeroFire > 0 ? Math.min(100, (e.portafolio / numeroFire) * 100) : 0

  const meses = numeroFire > 0 ? mesesHasta(e.portafolio, e.aporteMensual, numeroFire, mensualReal) : null
  const anios = meses === null ? null : meses / 12

  /*
   * Coast FIRE a 65 años. Se toma la edad como fija y no se pregunta: pedirla
   * para un número que va en letra pequeña no compensa, y 65 es el horizonte
   * que casi todo el mundo tiene en la cabeza. Lo que sí cambia es el plazo
   * que queda, y por eso se calcula sobre 30 años: es la vida laboral que le
   * queda a quien anda por los treinta y cinco, que es cuando esta cifra
   * empieza a ser interesante.
   */
  const anios_hasta_retiro = 30
  const coast = numeroFire / Math.pow(1 + real / 100, anios_hasta_retiro)

  return {
    sueldoPasivo,
    sueldoPasivoReal,
    cobertura,
    numeroFire,
    avance,
    anios,
    anio: anios === null ? null : new Date().getFullYear() + Math.round(anios),
    coast,
    enCoast: e.portafolio >= coast && coast > 0,
    baristaCobertura: cobertura / 2,
  }
}

/**
 * Lo que de verdad entró por rendimientos y dividendos en los últimos 12 meses.
 *
 * Solo tres categorías, y ninguna de ellas es «otros ingresos»: aquí meter de
 * más falsearía justo la cifra que existe para ser la honesta de las dos.
 */
export function cobradoPasivo(transactions: Transaction[], fxRate: number, hoy: string = hoyEnZona()): number {
  const desde = sumarDias(hoy, -365)
  let total = 0
  for (const t of transactions) {
    if (t.type !== 'income') continue
    if (!['dividends', 'returns', 'rent-income'].includes(t.categoryId)) continue
    const dia = t.occurredAt.slice(0, 10)
    if (dia < desde || dia > hoy) continue
    total += t.currency === 'USD'
      ? (t.fxRate && t.fxRate > 0 ? t.amount * t.fxRate : fxRate > 0 ? t.amount * fxRate : 0)
      : t.amount
  }
  return total
}

/**
 * Lo que se aporta al mes a la inversión.
 *
 * Sale de los movimientos etiquetados como paso a inversión y a ahorro, y de
 * los últimos seis meses: menos que eso lo decide un mes suelto. Es una
 * media, así que un mes sin aportar no tira la proyección al suelo.
 */
export function aporteMensual(transactions: Transaction[], fxRate: number, hoy: string = hoyEnZona()): number {
  const desde = sumarDias(hoy, -182)
  let total = 0
  const meses = new Set<string>()
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (t.categoryId !== 'to-investment' && t.categoryId !== 'to-savings') continue
    const dia = t.occurredAt.slice(0, 10)
    if (dia < desde || dia > hoy) continue
    meses.add(monthKey(t.occurredAt))
    total += t.currency === 'USD'
      ? (t.fxRate && t.fxRate > 0 ? t.amount * t.fxRate : fxRate > 0 ? t.amount * fxRate : 0)
      : t.amount
  }
  // Entre seis siempre, no entre los meses en que hubo aportes: aportar una
  // vez en medio año son diez mil al mes, no sesenta mil.
  return total / 6
}

/** Gasto mensual medio de los últimos meses, que es la base de casi todo aquí. */
export function gastoMensualMedio(
  transactions: Transaction[],
  fxRate: number,
  meses = 6,
  hoy: string = hoyEnZona(),
): number {
  const desde = sumarDias(hoy, -meses * 30)
  let total = 0
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    // Lo que se aparta no es gasto: es la misma plata cambiada de sitio, y
    // contarla subiría el número FIRE justo por ahorrar más.
    if (t.categoryId === 'to-savings' || t.categoryId === 'to-investment') continue
    const dia = t.occurredAt.slice(0, 10)
    if (dia < desde || dia > hoy) continue
    total += t.currency === 'USD'
      ? (t.fxRate && t.fxRate > 0 ? t.amount * t.fxRate : fxRate > 0 ? t.amount * fxRate : 0)
      : t.amount
  }
  return total / meses
}
