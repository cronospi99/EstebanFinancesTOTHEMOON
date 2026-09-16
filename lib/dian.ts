/**
 * Declaración de renta de personas naturales en Colombia.
 *
 * Lo que hace este módulo es responder, con los datos que la app ya tiene, a
 * la pregunta que llega cada agosto: «¿me toca declarar?». Y si toca, dejar el
 * desglose listo para sentarse a hacerlo o para pasárselo a un contador sin
 * tener que reconstruir un año entero de extractos.
 *
 * Lo que NO hace, y conviene decirlo aquí arriba: no calcula el impuesto
 * definitivo ni sustituye a nadie. Faltan datos que la app no tiene por qué
 * conocer —aportes a seguridad social, retenciones practicadas, dependientes,
 * qué parte del patrimonio es la casa, ganancias ocasionales— y una cifra de
 * impuesto calculada a medias es peor que ninguna porque se cree.
 *
 * ---------------------------------------------------------------------------
 * De dónde salen las cifras
 * ---------------------------------------------------------------------------
 * Todo en el sistema tributario colombiano se expresa en UVT (Unidad de Valor
 * Tributario), que la DIAN fija cada año por resolución. Así los topes se
 * actualizan con la inflación sin tener que reformar la ley cada diciembre.
 *
 *   UVT 2026: $52.374  — Resolución DIAN 000238 del 15 de diciembre de 2025.
 *                        Sube un 5,18 % sobre la de 2025, que es la variación
 *                        del IPC entre el 1 de octubre de 2024 y el 1 de
 *                        octubre de 2025 según el DANE.
 *   UVT 2025: $49.799  — Resolución DIAN 000193 de 2024.
 *   UVT 2024: $47.065  — Resolución DIAN 000187 de 2023.
 *   UVT 2023: $42.412  — Resolución DIAN 001264 de 2022.
 *
 * Cuál se usa: la del AÑO GRAVABLE, no la del año en que se declara. La
 * declaración que se presenta en 2026 es la del año gravable 2025, y sus topes
 * van con la UVT de 2025. Confundirlas es el error más común y mueve los topes
 * un 5 % largo, justo en el margen donde está la gente que duda.
 */

/** Valor de la UVT por año gravable, en pesos. */
export const UVT: Record<number, number> = {
  2023: 42_412,
  2024: 47_065,
  2025: 49_799,
  2026: 52_374,
}

/** El año gravable más reciente del que se conoce la UVT. */
export const ULTIMO_ANIO = Math.max(...Object.keys(UVT).map(Number))

/**
 * La UVT de un año. Si no se conoce, se proyecta desde la última con un 5 %.
 *
 * Proyectar y no fallar: en enero, antes de que salga la resolución, la app
 * tiene que seguir dando una cifra. Se marca como estimada para que en
 * pantalla se pueda decir que lo es, porque un tope estimado con el que
 * alguien decida no declarar es un problema de verdad.
 */
export function uvtDe(anio: number): { valor: number; estimada: boolean } {
  const exacta = UVT[anio]
  if (exacta) return { valor: exacta, estimada: false }
  if (anio < ULTIMO_ANIO) return { valor: UVT[ULTIMO_ANIO], estimada: true }
  const saltos = anio - ULTIMO_ANIO
  return { valor: Math.round(UVT[ULTIMO_ANIO] * Math.pow(1.05, saltos)), estimada: true }
}

export const enPesos = (uvts: number, anio: number) => Math.round(uvts * uvtDe(anio).valor)

/* ===========================================================================
 *  Quién está obligado a declarar
 * ===========================================================================
 *  Artículos 592 a 594-3 del Estatuto Tributario, con los topes que fija cada
 *  año el decreto de plazos. Basta con superar UNO para quedar obligado, y esa
 *  es la parte que sorprende: se puede tener que declarar sin haber ganado
 *  nada, solo por haber movido plata por la cuenta.
 * ------------------------------------------------------------------------ */

export type ClaveTope =
  | 'patrimonio' | 'ingresos' | 'tarjeta' | 'compras' | 'consignaciones' | 'iva'

export interface Tope {
  clave: ClaveTope
  nombre: string
  /** El umbral en UVT. `null` en el de IVA, que no es una cifra. */
  uvts: number | null
  explicacion: string
  /** El detalle que más confunde de ese tope concreto. */
  ojo?: string
}

export const TOPES: Tope[] = [
  {
    clave: 'patrimonio', nombre: 'Patrimonio bruto', uvts: 4500,
    explicacion: 'Lo que tenías el 31 de diciembre, sin restar deudas: cuentas, inversiones, vehículos, inmuebles.',
    ojo: 'Bruto significa sin descontar la hipoteca. Un apartamento financiado cuenta por su valor completo.',
  },
  {
    clave: 'ingresos', nombre: 'Ingresos brutos', uvts: 1400,
    explicacion: 'Todo lo que entró en el año por cualquier concepto, antes de descuentos.',
    ojo: 'Incluye lo que no es salario: ventas, arriendos, freelance, rendimientos.',
  },
  {
    clave: 'tarjeta', nombre: 'Consumos con tarjeta de crédito', uvts: 1400,
    explicacion: 'Lo que pasaste por tarjetas de crédito en todo el año, sumando todas.',
    ojo: 'Suma el consumo, no lo que pagaste. Diferir a cuotas no baja este número.',
  },
  {
    clave: 'compras', nombre: 'Compras y consumos totales', uvts: 1400,
    explicacion: 'Todo lo que compraste en el año, con cualquier medio de pago.',
  },
  {
    clave: 'consignaciones', nombre: 'Consignaciones, depósitos e inversiones', uvts: 1400,
    explicacion: 'Lo que entró a tus cuentas bancarias y lo que pusiste en productos financieros.',
    ojo: 'El tope que más gente sorprende: pasarte plata de una cuenta tuya a otra también consigna.',
  },
  {
    clave: 'iva', nombre: 'Responsable de IVA', uvts: null,
    explicacion: 'Si fuiste responsable de IVA en cualquier momento del año, declaras sin importar los topes.',
  },
]

export interface CifrasAnio {
  patrimonio: number
  ingresos: number
  tarjeta: number
  compras: number
  consignaciones: number
  responsableIva?: boolean
}

export interface EvaluacionTope {
  tope: Tope
  /** El umbral en pesos del año gravable. */
  limite: number
  /** Lo que tienes tú. */
  valor: number
  supera: boolean
  /** Qué fracción del tope llevas, en %. Por encima de 100 está superado. */
  avance: number
  /** Lo que falta para superarlo. Negativo si ya se superó. */
  margen: number
}

export interface Evaluacion {
  anio: number
  uvt: number
  uvtEstimada: boolean
  obligado: boolean
  /** Los topes superados, que son los que obligan. */
  superados: EvaluacionTope[]
  /** Todos, para el desglose completo. */
  topes: EvaluacionTope[]
}

/**
 * Si te toca declarar, y por cuál de los seis motivos.
 *
 * Devuelve los seis evaluados y no solo el que dispara: el valor está en ver
 * lo cerca que se anda de los otros. Quien va por el 90 % del tope de
 * consignaciones en septiembre sabe que el año que viene le toca, y eso es
 * accionable hoy.
 */
export function evaluar(cifras: CifrasAnio, anio: number): Evaluacion {
  const { valor: uvt, estimada } = uvtDe(anio)

  const topes = TOPES.map<EvaluacionTope>((tope) => {
    if (tope.clave === 'iva') {
      const supera = Boolean(cifras.responsableIva)
      return { tope, limite: 0, valor: 0, supera, avance: supera ? 100 : 0, margen: 0 }
    }
    const limite = Math.round(tope.uvts! * uvt)
    const valor = Math.max(0, cifras[tope.clave] ?? 0)
    return {
      tope, limite, valor,
      supera: valor >= limite,
      avance: limite > 0 ? (valor / limite) * 100 : 0,
      margen: limite - valor,
    }
  })

  const superados = topes.filter((t) => t.supera)
  return { anio, uvt, uvtEstimada: estimada, obligado: superados.length > 0, superados, topes }
}

/* ===========================================================================
 *  Depuración de la cédula general
 * ===========================================================================
 *  Los beneficios que bajan la base del impuesto, con sus topes. Están aquí
 *  porque son la otra mitad de la pregunta: saber que toca declarar sin saber
 *  qué se puede restar lleva a pagar de más.
 *
 *  El límite global del artículo 336 del Estatuto —el 40 % de los ingresos
 *  netos, sin pasar de 1.340 UVT al año— se aplica al conjunto de rentas
 *  exentas y deducciones. Dos beneficios quedan FUERA de ese límite y por eso
 *  van marcados: la deducción por dependientes y el 1 % de las compras con
 *  factura electrónica.
 * ------------------------------------------------------------------------ */

export interface Beneficio {
  clave: string
  nombre: string
  /** Tope anual en UVT. */
  uvts: number
  /** Base legal, para quien quiera comprobarlo. */
  norma: string
  explicacion: string
  /** Queda fuera del límite global del 40 % / 1.340 UVT. */
  fueraDelLimite?: boolean
}

export const LIMITE_GLOBAL_UVT = 1340
export const LIMITE_GLOBAL_PCT = 40

export const BENEFICIOS: Beneficio[] = [
  {
    clave: 'exenta25', nombre: 'Renta exenta del 25 %', uvts: 790,
    norma: 'E.T. art. 206 num. 10',
    explicacion: 'El 25 % de lo que queda del salario tras restar lo demás, con tope de 790 UVT al año.',
  },
  {
    clave: 'dependientes', nombre: 'Dependientes', uvts: 288,
    norma: 'E.T. art. 336 par. 5 (Ley 2277 de 2022)',
    explicacion: '72 UVT por cada dependiente, hasta cuatro. Hijos menores, padres a cargo, cónyuge sin ingresos.',
    fueraDelLimite: true,
  },
  {
    clave: 'factura', nombre: '1 % de compras con factura electrónica', uvts: 240,
    norma: 'E.T. art. 336-1',
    explicacion: 'El 1 % de lo comprado con factura electrónica a tu nombre, pagado por medios bancarios.',
    fueraDelLimite: true,
  },
  {
    clave: 'vivienda', nombre: 'Intereses de crédito de vivienda', uvts: 1200,
    norma: 'E.T. art. 119',
    explicacion: 'Los intereses pagados por el crédito de tu vivienda, hasta 100 UVT al mes.',
  },
  {
    clave: 'prepagada', nombre: 'Medicina prepagada', uvts: 192,
    norma: 'E.T. art. 387',
    explicacion: 'Planes de salud complementarios para ti y tu familia, hasta 16 UVT al mes.',
  },
  {
    clave: 'afc', nombre: 'Aportes voluntarios (AFC y pensión)', uvts: 3800,
    norma: 'E.T. arts. 126-1 y 126-4',
    explicacion: 'Hasta el 30 % del ingreso del año, sin pasar de 3.800 UVT, con permanencia mínima.',
  },
]

/* ===========================================================================
 *  Tarifas
 * ===========================================================================
 *  La tabla del artículo 241, que es progresiva por tramos: cada tramo paga su
 *  porcentaje solo sobre la parte que le corresponde. Quien gana un peso más
 *  del tope de un tramo no pasa a pagar ese porcentaje sobre todo.
 * ------------------------------------------------------------------------ */

export interface Tramo {
  /** Desde, en UVT. */
  desde: number
  /** Hasta, en UVT. `null` es «en adelante». */
  hasta: number | null
  /** Tarifa marginal en %. */
  tarifa: number
  /** Lo que se suma en UVT una vez aplicada la tarifa al excedente. */
  masUvt: number
}

/** E.T. art. 241 — renta líquida gravable anual de la cédula general. */
export const TABLA_RENTA: Tramo[] = [
  { desde: 0, hasta: 1090, tarifa: 0, masUvt: 0 },
  { desde: 1090, hasta: 1700, tarifa: 19, masUvt: 0 },
  { desde: 1700, hasta: 4100, tarifa: 28, masUvt: 116 },
  { desde: 4100, hasta: 8670, tarifa: 33, masUvt: 788 },
  { desde: 8670, hasta: 18970, tarifa: 35, masUvt: 2296 },
  { desde: 18970, hasta: 31000, tarifa: 37, masUvt: 5901 },
  { desde: 31000, hasta: null, tarifa: 39, masUvt: 10352 },
]

/** E.T. art. 383 — retención en la fuente mensual sobre rentas de trabajo. */
export const TABLA_RETENCION: Tramo[] = [
  { desde: 0, hasta: 95, tarifa: 0, masUvt: 0 },
  { desde: 95, hasta: 150, tarifa: 19, masUvt: 0 },
  { desde: 150, hasta: 360, tarifa: 28, masUvt: 10 },
  { desde: 360, hasta: 640, tarifa: 33, masUvt: 69 },
  { desde: 640, hasta: 945, tarifa: 35, masUvt: 162 },
  { desde: 945, hasta: 2300, tarifa: 37, masUvt: 268 },
  { desde: 2300, hasta: null, tarifa: 39, masUvt: 770 },
]

/**
 * El impuesto que corresponde a una base, aplicando una tabla por tramos.
 *
 * `base` va en pesos y vuelve en pesos; por dentro se trabaja en UVT, que es
 * como está escrita la ley. Redondear al final y no por el camino evita que se
 * acumulen las diferencias de los tramos.
 */
export function aplicarTabla(base: number, anio: number, tabla: Tramo[] = TABLA_RENTA): number {
  const uvt = uvtDe(anio).valor
  const enUvt = base / uvt
  const tramo = tabla.find((t) => enUvt > t.desde && (t.hasta === null || enUvt <= t.hasta))
  if (!tramo || tramo.tarifa === 0) return 0
  const impuestoUvt = (enUvt - tramo.desde) * (tramo.tarifa / 100) + tramo.masUvt
  return Math.round(impuestoUvt * uvt)
}

/** La tarifa marginal que le toca a una base: el porcentaje del siguiente peso. */
export function tarifaMarginal(base: number, anio: number, tabla: Tramo[] = TABLA_RENTA): number {
  const enUvt = base / uvtDe(anio).valor
  return tabla.find((t) => enUvt > t.desde && (t.hasta === null || enUvt <= t.hasta))?.tarifa ?? 0
}

/* ===========================================================================
 *  Cuándo se declara
 * ===========================================================================
 *  El día lo fija el decreto de plazos de cada año y depende de los dos
 *  últimos dígitos de la cédula: los 01-02 abren en agosto y los 99-00
 *  cierran en octubre. La app da el grupo y la ventana; la fecha exacta sale
 *  del decreto, y por eso no se inventa aquí.
 * ------------------------------------------------------------------------ */

/**
 * En qué lugar de la fila te deja tu cédula, de 1 a 50.
 *
 * Los plazos van por pares de dígitos —01-02 el primer día, 03-04 el
 * segundo—, así que hay cincuenta grupos repartidos en unas diez semanas
 * hábiles entre agosto y octubre.
 */
export function grupoDePlazo(cedula: string): number | null {
  const digitos = cedula.replace(/\D/g, '')
  if (digitos.length < 2) return null
  const dos = Number(digitos.slice(-2))
  // El 00 es el último grupo, no el primero: la tabla va de 01-02 a 99-00.
  return dos === 0 ? 50 : Math.ceil(dos / 2)
}

export const VENTANA_PLAZOS = 'Entre agosto y octubre del año siguiente, según los dos últimos dígitos de la cédula.'

/* ===========================================================================
 *  De los movimientos de la app a las cifras de la declaración
 * ===========================================================================
 *  Con una advertencia que la pantalla repite: esto sale de lo que hay
 *  registrado aquí, y la DIAN cruza lo que reportan los bancos, los empleadores
 *  y los comercios. Si algo no se anotó en la app, aquí no está. Sirve para
 *  saber si uno anda cerca de un tope y para llegar con las cuentas hechas, no
 *  para sustituir el certificado de ingresos ni el extracto.
 * ------------------------------------------------------------------------ */

import type { Account, Holding, Transaction } from './types'

export interface EntradaCifras {
  transactions: Transaction[]
  accounts: Account[]
  holdings: Holding[]
  /** Valor de mercado del portafolio hoy, en pesos. */
  portafolio: number
  fxRate: number
  anio: number
}

/**
 * Convierte un movimiento a pesos.
 *
 * Con la tasa del día en que ocurrió si se guardó, y no con la de hoy: para la
 * DIAN lo que vale es la TRM de la fecha de la operación, no la de cuando uno
 * se sienta a declarar.
 */
const aPesos = (t: Transaction, fxRate: number) =>
  t.currency === 'USD'
    ? (t.fxRate && t.fxRate > 0 ? t.amount * t.fxRate : fxRate > 0 ? t.amount * fxRate : 0)
    : t.amount

/**
 * Las cinco cifras que deciden si toca declarar.
 *
 * El patrimonio del 31 de diciembre se reconstruye hacia atrás desde el saldo
 * de hoy, deshaciendo todo lo que pasó después. Es la misma técnica que usa la
 * gráfica de patrimonio y tiene su misma limitación: solo sabe de lo que está
 * registrado en la app. Para el año en curso se toma el saldo actual, que es
 * lo único que se puede saber a mitad de año.
 */
export function cifrasDelAnio(e: EntradaCifras): CifrasAnio & { patrimonioEsHoy: boolean } {
  const { transactions, accounts, portafolio, fxRate, anio } = e
  const desde = `${anio}-01-01`
  const hasta = `${anio}-12-31`

  let ingresos = 0
  let compras = 0
  let tarjeta = 0
  let consignaciones = 0

  const esTarjeta = new Set(accounts.filter((a) => a.type === 'credit').map((a) => a.id))
  // El efectivo no consigna: lo que entra ahí no pasa por ninguna cuenta y no
  // lo reporta nadie.
  const esEfectivo = new Set(accounts.filter((a) => a.type === 'cash').map((a) => a.id))

  for (const t of transactions) {
    const dia = t.occurredAt.slice(0, 10)
    if (dia < desde || dia > hasta) continue
    const v = aPesos(t, fxRate)
    if (!v) continue

    if (t.type === 'income') {
      // Un préstamo recibido no es ingreso —es deuda— pero sí es una
      // consignación, y la DIAN mira las dos cosas por separado.
      if (t.categoryId !== 'loan-income') ingresos += v
      if (!esEfectivo.has(t.accountId)) consignaciones += v
      continue
    }

    if (t.type === 'transfer') {
      /*
       * Pasar plata de una cuenta propia a otra también consigna, y es el tope
       * que más gente sorprende: quien mueve su sueldo del banco a la
       * fiduciaria y de vuelta cada mes puede superar las 1.400 UVT sin haber
       * ganado un peso de más.
       */
      if (t.toAccountId && !esEfectivo.has(t.toAccountId)) consignaciones += v
      continue
    }

    if (t.type === 'expense') {
      // Los pasos a ahorro e inversión no son consumo: es la misma plata
      // cambiada de sitio, y la cuenta de destino ya la cuenta como
      // consignación.
      if (t.categoryId !== 'to-savings' && t.categoryId !== 'to-investment') compras += v
      if (esTarjeta.has(t.accountId)) tarjeta += v
      // Una inversión hecha desde una cuenta cuenta como «inversión
      // financiera», que va en el mismo tope de las consignaciones.
      if (t.categoryId === 'to-investment') consignaciones += v
    }
  }

  /*
   * Patrimonio bruto: sin restar deudas, que es lo que significa «bruto» y lo
   * que más confunde. Un apartamento hipotecado cuenta por su valor completo.
   * La app no conoce inmuebles ni vehículos, así que esta cifra es un piso, no
   * el total, y la pantalla lo dice.
   */
  let patrimonio = portafolio
  for (const a of accounts) {
    const total = a.balance + (a.pockets ?? []).reduce((s, p) => s + p.balance, 0)
    // Las tarjetas son pasivo: no suman al bruto ni lo restan.
    if (a.type === 'credit') continue
    // Las de inversión ya están contadas en el portafolio valorado a mercado.
    if (a.type === 'investment') continue
    const enCop = a.currency === 'USD' ? (fxRate > 0 ? total * fxRate : 0) : total
    patrimonio += Math.max(0, enCop)
  }

  const esteAnio = new Date().getFullYear()
  if (anio < esteAnio) {
    // Se deshace lo ocurrido después del 31 de diciembre de ese año.
    for (const t of transactions) {
      if (t.occurredAt.slice(0, 10) <= hasta) continue
      const v = aPesos(t, fxRate)
      if (t.type === 'income') patrimonio -= v
      else if (t.type === 'expense' && !esTarjeta.has(t.accountId)) patrimonio += v
    }
  }

  return {
    patrimonio: Math.max(0, Math.round(patrimonio)),
    ingresos: Math.round(ingresos),
    tarjeta: Math.round(tarjeta),
    compras: Math.round(compras),
    consignaciones: Math.round(consignaciones),
    patrimonioEsHoy: anio >= esteAnio,
  }
}
