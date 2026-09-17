/**
 * De dónde sale el dinero que entra, y cuánto de eso se puede dar por hecho.
 *
 * El gasto ya tenía su reparto —la regla 50/30/20 de `salud.ts`— y el ingreso
 * no tenía ninguno: un peso que entra contaba igual viniera del sueldo o de
 * una rifa. Para mirar hacia atrás da casi lo mismo; para proyectar hacia
 * adelante es la diferencia entre un presupuesto y un deseo. Quien tuvo un
 * golpe de suerte en agosto no gana eso todos los meses, y una proyección que
 * lo promedie le dirá que puede comprometerse a un arriendo que no puede
 * pagar.
 *
 * Tres niveles, de más seguro a menos:
 *
 *  · FIJO. Está pactado y llega solo: el sueldo, un arriendo que cobras, los
 *    dividendos de un ETF, los rendimientos de la cuenta. Se proyecta entero.
 *  · VARIABLE. Llega de verdad y con cierta regularidad, pero ni la fecha ni
 *    el importe están escritos: freelance, ventas, un bono por desempeño. Se
 *    proyecta, pero con la mediana de los últimos meses y no con la media
 *    —ver abajo—, y siempre dicho como estimación.
 *  · EXTRAORDINARIO. Pasó y puede no volver a pasar: lotería, apuestas,
 *    rifas, un regalo, un reembolso. No se proyecta nunca. Se registra y se
 *    enseña aparte, que es lo que permite ver cuánto del año pasado fue
 *    suerte y no ingreso.
 *
 * El criterio para separar variable de extraordinario no es el tamaño sino de
 * quién depende: si repetirlo está en tu mano —trabajar más, vender más— es
 * variable; si depende del azar o de que alguien decida regalarte algo, es
 * extraordinario.
 *
 * Igual que con los gastos, nadie tiene que clasificar nada: cada categoría de
 * ingreso ya existe y aquí solo se dice a qué nivel pertenece. Y como allí,
 * quien no esté de acuerdo puede cambiarlo, porque el freelance de uno es el
 * sueldo de otro.
 */
import { DEFAULT_CATEGORIES } from './categories'
import type { Transaction } from './types'
import { anioMes, hoyEnZona, primeroDeMes } from './zona'

export type OrigenIngreso = 'fijo' | 'variable' | 'extraordinario'

export const ORIGENES: {
  id: OrigenIngreso
  nombre: string
  color: string
  descripcion: string
  /** Si cuenta para la proyección de los próximos meses. */
  proyecta: boolean
}[] = [
  {
    id: 'fijo', nombre: 'Fijos', color: '#30D158', proyecta: true,
    descripcion: 'Está pactado y llega solo: sueldo, arriendos que cobras, dividendos, rendimientos. Se proyecta entero.',
  },
  {
    id: 'variable', nombre: 'Variables', color: '#0A84FF', proyecta: true,
    descripcion: 'Llega, pero ni la fecha ni el importe están escritos: freelance, ventas, bonos. Se proyecta con la mediana de los últimos meses.',
  },
  {
    id: 'extraordinario', nombre: 'Extraordinarios', color: '#FFD60A', proyecta: false,
    descripcion: 'Pasó y puede no repetirse: loterías, apuestas, rifas, regalos, reembolsos. No se proyecta nunca.',
  },
]

/**
 * Lo que entra pero no es ingreso, y por eso no se reparte.
 *
 * Un préstamo recibido es deuda que entra hoy y sale después. Un préstamo que
 * te devuelven es plata tuya que vuelve. Un retiro de ahorro es dinero que ya
 * era tuyo cambiando de sitio. Contarlos como ingreso inflaría la base y, peor
 * para lo que nos ocupa, haría creer que hay más que proyectar.
 *
 * Es el mismo criterio que `SIN_GRUPO` aplica al otro lado con los retiros en
 * cajero, y `repartir()` ya dejaba fuera `loan-income` por su cuenta.
 */
export const SIN_ORIGEN = new Set(['loan-income', 'loan-repaid', 'from-savings', 'transfer'])

export const ORIGEN_POR_CATEGORIA: Record<string, OrigenIngreso> = {
  // Fijos: pactados, con fecha, y no dependen de que este mes salga bien.
  salary: 'fijo',
  'rent-income': 'fijo',
  dividends: 'fijo',
  returns: 'fijo',

  // Variables: dependen de ti, y por eso se pueden estimar del historial.
  freelance: 'variable',
  sales: 'variable',
  // La prima legal es previsible y cabe en los fijos como ingreso recurrente
  // anual o semestral; lo que queda aquí es el bono por desempeño, que ni se
  // sabe si llega ni cuánto.
  bonus: 'variable',
  cashback: 'variable',
  'other-income': 'variable',

  // Extraordinarios: dependen del azar o de que alguien decida.
  gambling: 'extraordinario',
  'gift-income': 'extraordinario',
  refund: 'extraordinario',
}

const CLAVE_AJUSTES = 'eftm.ingresos.origen'

/**
 * Reclasificaciones hechas por el usuario.
 *
 * En el dispositivo y no en la cuenta, por lo mismo que el reparto de gastos:
 * es una preferencia de lectura, no un dato financiero. Perderla al cambiar de
 * teléfono devuelve el reparto por defecto y no mueve ni un peso de sitio.
 */
export function leerOrigenes(): Record<string, OrigenIngreso> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CLAVE_AJUSTES)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function guardarOrigen(categoryId: string, origen: OrigenIngreso | null) {
  try {
    const ajustes = leerOrigenes()
    if (origen) ajustes[categoryId] = origen
    else delete ajustes[categoryId]
    localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes))
  } catch { /* storage bloqueado */ }
}

/**
 * El nivel de una categoría, contando lo que el usuario haya cambiado.
 *
 * Por defecto, variable: una categoría de ingreso que nadie ha clasificado
 * —una nueva, o una que alguien añada después— no debería colarse en los
 * fijos, que es lo que se proyecta entero.
 */
export function origenDe(
  categoryId: string,
  ajustes: Record<string, OrigenIngreso> = {},
): OrigenIngreso | null {
  if (SIN_ORIGEN.has(categoryId)) return null
  return ajustes[categoryId] ?? ORIGEN_POR_CATEGORIA[categoryId] ?? 'variable'
}

/** Las categorías de ingreso agrupadas por nivel, para la pantalla de ajuste. */
export function categoriasPorOrigen(ajustes: Record<string, OrigenIngreso> = {}) {
  const mapa: Record<OrigenIngreso, typeof DEFAULT_CATEGORIES> = {
    fijo: [], variable: [], extraordinario: [],
  }
  for (const c of DEFAULT_CATEGORIES) {
    if (c.kind !== 'income') continue
    const o = origenDe(c.id, ajustes)
    if (o) mapa[o].push(c)
  }
  return mapa
}

export interface ParteIngreso {
  origen: OrigenIngreso
  /** Lo que entró por este nivel en toda la ventana, en pesos. */
  total: number
  /** Ese total repartido entre los meses de la ventana. */
  mensual: number
  /** Qué porcentaje de todo lo que entró se llevó este nivel. */
  porcentaje: number
  /** Cuántos de los meses de la ventana tuvieron algo de este nivel. */
  mesesConAlgo: number
  detalle: { categoryId: string; monto: number }[]
}

export interface DesgloseIngresos {
  /** Meses completos mirados. El mes en curso no cuenta: ver abajo. */
  meses: number
  desde: string
  partes: Record<OrigenIngreso, ParteIngreso>
  /** Media mensual de todo lo que entró, de los tres niveles. */
  totalMensual: number
  /**
   * Lo que se puede dar por hecho al mes: los fijos tal cual más la
   * estimación prudente de lo variable. Es la cifra con la que se presupuesta.
   */
  contableMensual: number
  /** La estimación prudente de lo variable. Ver `estimarVariable`. */
  variableEstimado: number
  /** Qué parte del ingreso es contable, de 0 a 100. */
  estabilidad: number
  /** Lo que entró y no es ingreso: préstamos, retiros de ahorro. */
  sinClasificar: number
  vacio: boolean
  /** En cuántos de los meses de la ventana entró algo, sea del nivel que sea. */
  mesesConIngreso: number
  /**
   * Si hay historial suficiente para juzgar la estabilidad.
   *
   * Con uno o dos meses de datos no se puede: quien empezó a usar la app en
   * agosto y registró una factura suelta sale con un 0 % de ingreso previsible,
   * y eso no describe su vida, describe su historial. Tres meses es el mínimo
   * para que la mediana signifique algo; por debajo, las cifras se enseñan
   * igual pero el puntaje de salud no las usa.
   */
  suficiente: boolean
}

/** A pesos, con la tasa del día del movimiento si se guardó. */
const enPesos = (t: Transaction, fxRate: number) =>
  t.currency === 'USD'
    ? (t.fxRate && t.fxRate > 0 ? t.amount * t.fxRate : fxRate > 0 ? t.amount * fxRate : 0)
    : t.amount

/** Las claves «2026-09» de los N meses completos anteriores a `hoy`. */
function mesesCompletos(hoy: string, n: number): string[] {
  const [a, m] = anioMes(hoy)
  const salida: string[] = []
  for (let k = n; k >= 1; k--) salida.push(primeroDeMes(a, m - k).slice(0, 7))
  return salida
}

/**
 * Lo que se puede contar de un ingreso variable: la mediana mensual.
 *
 * Mediana y no media, por lo mismo que el gasto corriente de `liquidez.ts`
 * usa mediana: un mes con una factura grande de freelance no se parece a
 * ningún otro mes, y la media lo reparte por todo el año como si volviera a
 * pasar. La mediana dice qué entra un mes cualquiera.
 *
 * Los meses en blanco cuentan como cero y esa es la parte importante. Quien
 * facturó tres de los últimos seis meses tiene una mediana de cero, y eso no
 * es un fallo del cálculo: es la respuesta correcta a «¿con cuánto puedo
 * contar todos los meses?». La media le habría dado medio sueldo imaginario.
 */
export function estimarVariable(porMes: number[]): number {
  if (!porMes.length) return 0
  const orden = [...porMes].sort((a, b) => a - b)
  const mitad = Math.floor(orden.length / 2)
  const mediana = orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2
  return Math.round(mediana)
}

/**
 * El desglose de lo que entra, sobre los últimos meses completos.
 *
 * Completos, sin el mes en curso: a día 3 el mes lleva un sueldo sin cobrar y
 * dos días de datos, y meterlo en la media hunde todas las cifras justo al
 * principio de cada mes, que es cuando más se consulta.
 */
export function desglosarIngresos(
  transacciones: Transaction[],
  fxRate: number,
  meses = 6,
  hoy: string = hoyEnZona(),
  ajustes: Record<string, OrigenIngreso> = {},
): DesgloseIngresos {
  const ventana = mesesCompletos(hoy, meses)
  const desde = `${ventana[0]}-01`
  const enVentana = new Set(ventana)

  const totales: Record<OrigenIngreso, number> = { fijo: 0, variable: 0, extraordinario: 0 }
  const detalles: Record<OrigenIngreso, Map<string, number>> = {
    fijo: new Map(), variable: new Map(), extraordinario: new Map(),
  }
  const porMes: Record<OrigenIngreso, Map<string, number>> = {
    fijo: new Map(), variable: new Map(), extraordinario: new Map(),
  }
  let sinClasificar = 0

  for (const t of transacciones) {
    if (t.type !== 'income') continue
    const mes = t.occurredAt.slice(0, 7)
    if (!enVentana.has(mes)) continue

    const v = enPesos(t, fxRate)
    if (!v) continue

    const origen = origenDe(t.categoryId, ajustes)
    if (!origen) { sinClasificar += v; continue }

    totales[origen] += v
    detalles[origen].set(t.categoryId, (detalles[origen].get(t.categoryId) ?? 0) + v)
    porMes[origen].set(mes, (porMes[origen].get(mes) ?? 0) + v)
  }

  const total = totales.fijo + totales.variable + totales.extraordinario

  const partes = {} as Record<OrigenIngreso, ParteIngreso>
  for (const o of ORIGENES) {
    partes[o.id] = {
      origen: o.id,
      total: Math.round(totales[o.id]),
      mensual: Math.round(totales[o.id] / meses),
      porcentaje: total > 0 ? (totales[o.id] / total) * 100 : 0,
      mesesConAlgo: [...porMes[o.id].values()].filter((v) => v > 0).length,
      detalle: [...detalles[o.id].entries()]
        .map(([categoryId, monto]) => ({ categoryId, monto: Math.round(monto) }))
        .sort((a, b) => b.monto - a.monto),
    }
  }

  // Los meses en blanco entran como cero: son parte de la historia, y quitarlos
  // convertiría «facturé dos veces en seis meses» en «facturo todos los meses».
  const variablePorMes = ventana.map((m) => porMes.variable.get(m) ?? 0)
  const variableEstimado = estimarVariable(variablePorMes)

  const fijoMensual = Math.round(totales.fijo / meses)
  const contableMensual = fijoMensual + variableEstimado
  const totalMensual = Math.round(total / meses)

  // Meses en los que entró algo, del nivel que sea. Es la medida de cuánto
  // historial hay, y decide si la estabilidad es una lectura o un espejismo.
  const mesesConIngreso = ventana.filter((m) =>
    (porMes.fijo.get(m) ?? 0) + (porMes.variable.get(m) ?? 0) + (porMes.extraordinario.get(m) ?? 0) > 0,
  ).length

  return {
    meses,
    desde,
    partes,
    totalMensual,
    contableMensual,
    variableEstimado,
    estabilidad: totalMensual > 0 ? Math.min(100, (contableMensual / totalMensual) * 100) : 0,
    sinClasificar: Math.round(sinClasificar),
    vacio: total <= 0,
    mesesConIngreso,
    suficiente: mesesConIngreso >= 3,
  }
}
