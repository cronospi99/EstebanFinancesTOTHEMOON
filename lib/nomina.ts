/**
 * Nómina colombiana: del sueldo pactado a lo que llega a la cuenta.
 *
 * Existe porque la cifra que uno dice cuando le preguntan cuánto gana no es la
 * que le entra. Entre una y otra hay dos descuentos obligatorios, puede haber
 * un tercero, y en el otro sentido hay recargos que el contrato no menciona y
 * que en un turno de noche son la diferencia entre llegar y no llegar. Una
 * proyección construida sobre el sueldo bruto se equivoca en un 8 % todos los
 * meses, siempre hacia arriba, que es el lado que hace daño.
 *
 * ------------------------------------------------------------------------
 * LAS CIFRAS SON DE 2026 Y CADUCAN. Están todas aquí arriba, con su fecha de
 * vigencia, para que actualizarlas sea cambiar un número y no buscarlas por
 * diez archivos. El salario mínimo cambia cada enero; los recargos y la
 * jornada vienen cambiando por la reforma laboral (Ley 2466 de 2025) y la
 * reducción de jornada (Ley 2101 de 2021), las dos con calendario escalonado
 * que se aplica más abajo por fecha.
 * ------------------------------------------------------------------------
 */

/** Salario mínimo mensual legal vigente, 2026. */
export const SMMLV = 1_750_905

/**
 * Auxilio de transporte 2026.
 *
 * Se paga a quien gana hasta dos salarios mínimos. NO es salario: no cotiza a
 * salud ni a pensión, y por eso se suma después de los descuentos. Pero sí
 * entra en la base de la prima y las cesantías, que es la trampa clásica.
 */
export const AUXILIO_TRANSPORTE = 249_095
export const TOPE_AUXILIO = 2 * SMMLV

/** Lo que aporta el trabajador. Al empleador le cuesta bastante más. */
export const APORTE_SALUD = 0.04
export const APORTE_PENSION = 0.04

/**
 * Fondo de Solidaridad Pensional: un aporte extra, solo del trabajador, desde
 * cuatro salarios mínimos. Progresivo, del 1 % al 2 %.
 */
export const TRAMOS_FSP: { desdeSMMLV: number; tasa: number }[] = [
  { desdeSMMLV: 20, tasa: 0.02 },
  { desdeSMMLV: 19, tasa: 0.018 },
  { desdeSMMLV: 18, tasa: 0.016 },
  { desdeSMMLV: 17, tasa: 0.014 },
  { desdeSMMLV: 16, tasa: 0.012 },
  { desdeSMMLV: 4, tasa: 0.01 },
]

/**
 * La jornada máxima semanal, que la Ley 2101 viene bajando por etapas.
 *
 * Importa más de lo que parece: el valor de la hora ordinaria es el sueldo
 * mensual dividido entre las horas del mes, así que al bajar la jornada sube
 * la hora — y con ella cada recargo y cada extra. El mismo turno de noche vale
 * más en agosto de 2026 que en junio.
 */
const JORNADAS: { desde: string; horas: number }[] = [
  { desde: '2026-07-15', horas: 42 },
  { desde: '0000-01-01', horas: 44 },
]

export const jornadaSemanal = (fecha: string): number =>
  JORNADAS.find((j) => fecha >= j.desde)!.horas

/**
 * Las horas del mes entre las que se divide el sueldo para sacar la hora.
 *
 * Es jornada ÷ 6 × 30, y sale 210 con la jornada de 42, 220 con la de 44 y
 * 240 con la vieja de 48. No es un recuento de horas trabajadas sino el
 * divisor legal, y la diferencia tiene una razón: el sueldo mensual paga
 * treinta días, domingos incluidos, y por eso el divisor reparte la jornada
 * entre seis días y no entre siete.
 *
 * Aquí había un error que inflaba TODO. Estaba dividiendo entre las horas
 * realmente trabajadas al mes —42 × 30/7 = 180— y eso da una hora un 17 % más
 * cara de lo que dice la ley, con ese 17 % metido en cada recargo y cada
 * extra. Con el mínimo de 2026 la hora salía en $ 9.727 cuando el valor
 * publicado es $ 8.338 = 1.750.905 ÷ 210.
 */
export const horasDelMes = (fecha: string): number => (jornadaSemanal(fecha) / 6) * 30

/**
 * El tope legal de horas extra: dos al día y doce a la semana.
 *
 * Ley 2466 de 2025, art. 13, y la circular externa 101 de 2025. No es una
 * recomendación: por encima de ahí el empleador necesita autorización del
 * Ministerio y, sin ella, esas horas no se están pagando como extra. Un
 * horario que pase del tope está diciendo otra cosa —que hay descansos sin
 * contar, o que no las pagan— y estimarlas como extra sería prometer plata
 * que no llega.
 */
export const TOPE_EXTRAS_SEMANA = 12
export const TOPE_EXTRAS_DIA = 2

/**
 * La franja nocturna, en horas del reloj.
 *
 * La reforma la adelantó de las 21:00 a las 19:00, con efecto desde el 25 de
 * diciembre de 2025. Dos horas más de recargo cada noche no es un detalle: en
 * un turno de 14:00 a 22:00 pasa de una hora recargada a tres.
 */
const FRANJAS_NOCTURNAS: { desde: string; inicio: number; fin: number }[] = [
  { desde: '2025-12-25', inicio: 19, fin: 6 },
  { desde: '0000-01-01', inicio: 21, fin: 6 },
]

export const franjaNocturna = (fecha: string) =>
  FRANJAS_NOCTURNAS.find((f) => fecha >= f.desde)!

/** Recargo por trabajar de noche, sobre la hora ordinaria. */
export const RECARGO_NOCTURNO = 0.35
/** Hora extra: la que pasa de la jornada. Se paga la hora MÁS el recargo. */
export const EXTRA_DIURNA = 0.25
export const EXTRA_NOCTURNA = 0.75

/**
 * Dominical y festivo, que la reforma sube por etapas hasta el 100 %.
 *
 * Aquí solo están los tramos que ya rigen o están fijados por ley; cuando
 * llegue el siguiente se añade una línea.
 */
const DOMINICALES: { desde: string; tasa: number }[] = [
  { desde: '2027-07-01', tasa: 1.0 },
  { desde: '2026-07-01', tasa: 0.9 },
  { desde: '2025-07-01', tasa: 0.8 },
  { desde: '0000-01-01', tasa: 0.75 },
]

export const recargoDominical = (fecha: string): number =>
  DOMINICALES.find((d) => fecha >= d.desde)!.tasa

/* ===========================================================================
 *  Festivos
 * ======================================================================== */

/**
 * El domingo de Pascua, del que cuelgan seis de los dieciocho festivos.
 *
 * Es el algoritmo gregoriano anónimo, tal cual. Se calcula en vez de
 * tabularse porque una tabla de festivos caduca cada diciembre y nadie se
 * acuerda de actualizarla; esto vale para cualquier año sin tocar nada.
 */
export function pascuaDe(anio: number): string {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const n = h + l - 7 * m + 114
  const mes = Math.floor(n / 31)
  const dia = (n % 31) + 1
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const mas = (fecha: string, dias: number) =>
  iso(new Date(Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10) + dias)))

/** Qué día de la semana cae una fecha. 0 = domingo, como `Date.getDay()`. */
export const diaSemanaDe = (fecha: string): number =>
  new Date(`${fecha}T00:00:00Z`).getUTCDay()

/** El lunes siguiente, o la misma fecha si ya es lunes. La Ley Emiliani. */
const alLunes = (fecha: string): string => {
  const d = diaSemanaDe(fecha)
  return d === 1 ? fecha : mas(fecha, (8 - d) % 7)
}

/**
 * Los dieciocho festivos de Colombia en un año.
 *
 * Tres familias, y la diferencia entre ellas es justo lo que hace que esto no
 * se pueda resolver con una lista de fechas fijas:
 *
 *   · Los que no se mueven (Ley 51 de 1983, art. 1): Año Nuevo, Trabajo,
 *     Independencia, Boyacá, Inmaculada, Navidad y los dos de Semana Santa.
 *     Caen donde caigan, y si es domingo se pierden.
 *   · Los que se corren al lunes siguiente —la Ley Emiliani, que es la razón
 *     de que Colombia tenga tantos puentes—. Para quien trabaja los lunes esto
 *     no es folclore: en 2026 son once de los dieciocho.
 *   · Los que cuelgan de la Pascua y ya caen en lunes por construcción:
 *     Ascensión, Corpus Christi y Sagrado Corazón.
 */
export function festivosDe(anio: number): string[] {
  const pascua = pascuaDe(anio)
  const p = (dias: number) => mas(pascua, dias)

  const fijos = [
    `${anio}-01-01`, `${anio}-05-01`, `${anio}-07-20`, `${anio}-08-07`,
    `${anio}-12-08`, `${anio}-12-25`,
    p(-3), // Jueves Santo
    p(-2), // Viernes Santo
  ]
  const trasladables = [
    `${anio}-01-06`, `${anio}-03-19`, `${anio}-06-29`,
    `${anio}-08-15`, `${anio}-10-12`, `${anio}-11-01`, `${anio}-11-11`,
  ].map(alLunes)
  // Ascensión, Corpus Christi y Sagrado Corazón: ya trasladados al lunes.
  const dePascua = [p(43), p(64), p(71)]

  return [...fijos, ...trasladables, ...dePascua].sort()
}

/** Cuántos festivos del año caen en cada día de la semana. Índice 0 = domingo. */
export function festivosPorDiaSemana(anio: number): number[] {
  const cuenta = [0, 0, 0, 0, 0, 0, 0]
  for (const f of festivosDe(anio)) cuenta[diaSemanaDe(f)]++
  return cuenta
}

/**
 * Cuántas veces al mes, de media, cae un festivo en ese día de la semana.
 *
 * Se reparte el año entre doce y no se mira el mes concreto a propósito: el
 * horario es una plantilla semanal que se repite y la cifra que sale de aquí
 * es una media mensual, no el calendario de junio. Junio trae cuatro festivos
 * y febrero ninguno, y prometer esa precisión sobre un horario que nadie ha
 * confirmado mes a mes sería precisión falsa.
 *
 * El domingo devuelve cero. No es un olvido: un domingo festivo no se paga dos
 * veces, y los domingos ya llevan su recargo todas las semanas. Sumarlo aquí
 * sería contarlo dos veces en el único caso en que la ley cuenta uno.
 */
export const festivosAlMes = (diaSemana: number, anio: number): number =>
  diaSemana === 0 ? 0 : festivosPorDiaSemana(anio)[diaSemana] / 12

/* ===========================================================================
 *  Descuentos
 * ======================================================================== */

export interface Deducciones {
  /** El sueldo pactado, sin auxilio ni recargos. */
  base: number
  salud: number
  pension: number
  /** Fondo de Solidaridad Pensional. Cero por debajo de 4 salarios mínimos. */
  fsp: number
  total: number
  /** Lo que queda del salario tras los descuentos. */
  neto: number
  /** El auxilio de transporte, si le corresponde. No cotiza. */
  auxilio: number
  /** Lo que de verdad llega a la cuenta: neto + auxilio. */
  aCuenta: number
}

/**
 * De bruto a lo que llega.
 *
 * Salud y pensión se calculan sobre el salario, nunca sobre el auxilio de
 * transporte: el auxilio no es salario y meterlo en la base descontaría de más
 * a quien menos gana, que es justo a quien va dirigido.
 *
 * `cotiza` existe para los contratos de prestación de servicios, donde el
 * aporte lo hace el contratista sobre el 40 % del ingreso y con otras reglas.
 * Ahí esto no aplica, y decirlo es mejor que calcular un número equivocado.
 */
export function deduccionesDe(
  base: number,
  opciones: { auxilio?: boolean; cotiza?: boolean } = {},
): Deducciones {
  const cotiza = opciones.cotiza !== false
  const auxilio = opciones.auxilio && base <= TOPE_AUXILIO ? AUXILIO_TRANSPORTE : 0

  if (!cotiza) {
    return { base, salud: 0, pension: 0, fsp: 0, total: 0, neto: base, auxilio, aCuenta: base + auxilio }
  }

  const salud = Math.round(base * APORTE_SALUD)
  const pension = Math.round(base * APORTE_PENSION)

  const enSMMLV = base / SMMLV
  const tramo = TRAMOS_FSP.find((t) => enSMMLV >= t.desdeSMMLV)
  const fsp = tramo ? Math.round(base * tramo.tasa) : 0

  const total = salud + pension + fsp
  return { base, salud, pension, fsp, total, neto: base - total, auxilio, aCuenta: base - total + auxilio }
}

/* ===========================================================================
 *  Horario y recargos
 * ======================================================================== */

/**
 * Un turno de un día de la semana.
 *
 * `desde` y `hasta` en horas decimales del reloj (19,5 = 19:30). `hasta`
 * menor que `desde` significa que el turno cruza la medianoche, que es
 * exactamente el caso en que los recargos importan.
 */
export interface Turno {
  /** 0 = domingo … 6 = sábado, como `Date.getDay()`. */
  dia: number
  desde: number
  hasta: number
  /**
   * Horas de descanso dentro del turno que no son trabajo. Almuerzo, sobre todo.
   *
   * El art. 167 del CST es explícito: «el tiempo de este descanso no se computa
   * en la jornada». Un turno de 8:00 a 17:00 con una hora de almuerzo son ocho
   * horas de trabajo, no nueve, y esa hora no cuenta para las extras.
   *
   * Contar la presencia como trabajo era el error más caro de todos, porque el
   * sobrante caía entero del lado de las extras, que se pagan al 125 %: seis
   * turnos con una hora de almuerzo inventaban seis horas extra por semana.
   */
  descanso?: number
}

export interface Recargos {
  /** Horas de presencia a la semana: de la entrada a la salida, descansos incluidos. */
  horasPresencia: number
  /** Horas de trabajo efectivo a la semana. Es `horasPresencia` menos los descansos. */
  horasSemana: number
  /** De esas, cuántas caen en franja nocturna. */
  horasNocturnas: number
  /** Cuántas caen en domingo. */
  horasDominicales: number
  /** Las que se pagan como extra: las que pasan de la jornada, con el tope legal puesto. */
  horasExtra: number
  /** Las que pasan de la jornada legal, se paguen o no. */
  horasSobreJornada: number
  /** De esas, las que pasan del tope legal de doce semanales. */
  horasSobreTope: number
  /** Si las horas de más se pagan como extra. Ver `calcularRecargos`. */
  pagaExtras: boolean
  jornadaLegal: number
  /** Lo que suman los recargos al mes, en pesos. */
  nocturno: number
  dominical: number
  extra: number
  /**
   * Lo que suman los festivos al mes. Cero si no se trabajan.
   *
   * Va aparte del dominical aunque se paguen a la misma tasa: son dos hechos
   * distintos —uno es «trabajo los domingos» y el otro «me toca el 20 de
   * julio»— y quien mira el desglose quiere saber cuál de los dos le está
   * poniendo la plata.
   */
  festivo: number
  total: number
  /** El valor de una hora ordinaria con este sueldo: sueldo ÷ `horasDelMes`. */
  valorHora: number
  /** El divisor con el que sale esa hora. 210 con la jornada de 42. */
  horasMensuales: number
  /** Festivos del año que caen en un día que trabajas. El domingo no cuenta. */
  festivosAlAnio: number
  /** Si esos festivos se trabajan. Cambia el signo de lo que hacen. */
  trabajaFestivos: boolean
}

/** Las semanas que trae un mes de media: 30 días entre 7. */
export const SEMANAS_POR_MES = 30 / 7

/**
 * Cuántas horas de un turno caen en la franja nocturna.
 *
 * El turno se recorre en tramos de hora reloj y se mira cada uno, en vez de
 * restar fronteras a mano. Es más lento y da igual —son horas, no millones de
 * filas— y evita el nido de casos que sale al intentarlo con restas: un turno
 * de 22:00 a 6:00 cruza la medianoche, uno de 18:00 a 20:00 entra a mitad de
 * la franja, y uno de 5:00 a 8:00 sale de ella por el otro lado.
 */
export function horasNocturnasDe(turno: Turno, fecha: string): number {
  const { inicio, fin } = franjaNocturna(fecha)
  const duracion = turno.hasta > turno.desde ? turno.hasta - turno.desde : 24 - turno.desde + turno.hasta

  let nocturnas = 0
  const paso = 0.25
  for (let t = 0; t < duracion; t += paso) {
    const hora = (turno.desde + t) % 24
    // La franja va de `inicio` (tarde) a `fin` (mañana) cruzando medianoche.
    if (hora >= inicio || hora < fin) nocturnas += paso
  }
  return Math.round(nocturnas * 100) / 100
}

/** Lo que dura el turno de reloj a reloj, descansos incluidos. */
export const duracionDe = (t: Turno): number =>
  t.hasta > t.desde ? t.hasta - t.desde : 24 - t.desde + t.hasta

/** Lo que de verdad se trabaja: la presencia menos el descanso. Nunca negativo. */
export const horasEfectivasDe = (t: Turno): number =>
  Math.max(0, duracionDe(t) - (t.descanso ?? 0))

/**
 * Lo que suman los recargos de un horario, al mes.
 *
 * Un horario fijo semanal se repite, así que se calcula la semana y se lleva a
 * mes con 30/7 semanas. No son las semanas exactas de cada mes —febrero tiene
 * cuatro justas y marzo cuatro y media— y eso está bien para una estimación:
 * la alternativa era pedir el calendario del turno mes a mes, que nadie
 * mantiene.
 *
 * Los festivos sí se cuentan, y en Colombia no es un redondeo: son dieciocho
 * al año y once de ellos caen en lunes por la Ley Emiliani. Para quien trabaja
 * los lunes eso es casi un turno festivo al mes, todos los meses, pagado al
 * noventa por ciento. `trabajaFestivos` decide hacia dónde: si se trabajan,
 * suman un recargo; si no, esos turnos no ocurren y hay que restar el nocturno
 * de las noches que no se hacen. Darlos por trabajados sin preguntarlo
 * inflaría el ingreso de quien libra los festivos, que es el lado que hace
 * daño.
 */
export function calcularRecargos(
  salarioBase: number,
  turnos: Turno[],
  fecha: string,
  opciones: { trabajaFestivos?: boolean; pagaExtras?: boolean } = {},
): Recargos {
  const jornadaLegal = jornadaSemanal(fecha)
  const horasMensuales = horasDelMes(fecha)
  // La hora ordinaria sale del divisor legal —sueldo entre 210 con la jornada
  // de 42— y no de las horas que uno trabaje. Es el precio de una hora según
  // la ley, y todos los recargos se cuelgan de él.
  const valorHora = salarioBase / horasMensuales
  const trabajaFestivos = Boolean(opciones.trabajaFestivos)
  const pagaExtras = Boolean(opciones.pagaExtras)
  const anio = Number(fecha.slice(0, 4))
  const festivosSemana = festivosPorDiaSemana(anio)

  let horasPresencia = 0
  let horasSemana = 0
  let horasNocturnas = 0
  let horasDominicales = 0
  // Estas dos van al MES, no a la semana: un festivo no se repite cada siete
  // días. Mezclar las unidades aquí sería el error fácil y silencioso.
  let horasFestivasMes = 0
  let nocturnasFestivasMes = 0
  let festivosAlAnio = 0

  for (const t of turnos) {
    const presencia = duracionDe(t)
    const efectivas = horasEfectivasDe(t)
    /*
     * El descanso se reparte entre las horas diurnas y las nocturnas en la
     * misma proporción que tiene el turno.
     *
     * No hay manera de saber a qué hora se almuerza. En un turno de tarde el
     * descanso cae casi seguro antes de las siete y el reparto se queda corto;
     * en uno de noche cae dentro de la franja y acierta. Repartir es el
     * término medio defendible, y equivocarse por lo bajo en un ingreso es el
     * lado que no hace daño.
     */
    const nocturnas = horasNocturnasDe(t, fecha) * (presencia > 0 ? efectivas / presencia : 0)

    horasPresencia += presencia
    horasSemana += efectivas
    horasNocturnas += nocturnas
    if (t.dia === 0) horasDominicales += efectivas

    const alMes = festivosAlMes(t.dia, anio)
    if (alMes > 0) {
      festivosAlAnio += festivosSemana[t.dia]
      horasFestivasMes += efectivas * alMes
      nocturnasFestivasMes += nocturnas * alMes
    }
  }

  /*
   * Las horas de más no son horas extra hasta que alguien las pague.
   *
   * Es la corrección que más cambia la cifra. Dar por pagada como extra —al
   * 125 %— cada hora que pase de la jornada suponía que el empleador liquida
   * extras todas las semanas, y en un sueldo mensual con horario largo eso
   * casi nunca es verdad: o hay descansos que no se estaban restando, o
   * sencillamente no las pagan. Un horario de 55 h/semana producía así un 45 %
   * de ingreso inventado, y la app lo presentaba como plata que iba a llegar.
   *
   * Ahora hay que decir que sí, y aun diciéndolo se aplica el tope legal de
   * doce semanales: por encima de ahí no es que se pague peor, es que sin
   * autorización del Ministerio no se paga como extra.
   */
  const horasSobreJornada = Math.max(0, horasSemana - jornadaLegal)
  const horasSobreTope = Math.max(0, horasSobreJornada - TOPE_EXTRAS_SEMANA)
  const horasExtra = pagaExtras ? Math.min(horasSobreJornada, TOPE_EXTRAS_SEMANA) : 0

  const alMes = (horasSemana_: number) => horasSemana_ * SEMANAS_POR_MES
  const tasaFestivo = recargoDominical(fecha)

  /*
   * Cuáles de las horas extra son de noche.
   *
   * Sin saber qué horas concretas sobran se aplica la proporción nocturna de
   * la semana. Importa porque la extra nocturna y la diurna no se pagan igual,
   * y sobre todo porque hay que descontarlas del recargo nocturno: ese es el
   * segundo error que había aquí.
   */
  const proporcionNocturna = horasSemana > 0 ? horasNocturnas / horasSemana : 0
  const extrasNocturnas = horasExtra * proporcionNocturna
  const extrasDiurnas = horasExtra - extrasNocturnas

  /*
   * El recargo nocturno va solo sobre las horas nocturnas ORDINARIAS.
   *
   * La hora extra nocturna se paga al 75 % y ese 75 % ya lleva dentro la
   * nocturnidad (art. 168 núm. 4 del CST): no se le suma además el 35 %.
   * Sumando los dos, cada hora extra de noche salía al 210 % en vez del 175 %.
   *
   * Lo que sí se acumula es el dominical y el festivo: una hora de noche en
   * domingo lleva 35 % + 90 %. Eso ya sale bien porque el nocturno y el
   * dominical se cuentan por separado sobre las mismas horas.
   */
  const nocturnasOrdinarias = Math.max(0, horasNocturnas - extrasNocturnas)

  /*
   * El nocturno de las noches festivas.
   *
   * Si se trabajan, ya está dentro: la plantilla semanal las incluye y el
   * recargo festivo se suma encima, que es como los acumula la ley. Si no se
   * trabajan, hay que restarlas, porque esa noche no se hizo.
   */
  const nocturnasMes = alMes(nocturnasOrdinarias) - (trabajaFestivos ? 0 : nocturnasFestivasMes)
  const nocturno = Math.round(Math.max(0, nocturnasMes) * valorHora * RECARGO_NOCTURNO)
  const dominical = Math.round(alMes(horasDominicales) * valorHora * tasaFestivo)
  const festivo = trabajaFestivos
    ? Math.round(horasFestivasMes * valorHora * tasaFestivo)
    : 0
  // La hora extra se paga entera más su recargo: el sueldo mensual solo cubre
  // la jornada ordinaria, así que la hora de más se suma completa.
  const extra = Math.round(
    alMes(extrasDiurnas) * valorHora * (1 + EXTRA_DIURNA)
    + alMes(extrasNocturnas) * valorHora * (1 + EXTRA_NOCTURNA),
  )

  const dec = (n: number) => Math.round(n * 100) / 100
  return {
    horasPresencia: dec(horasPresencia),
    horasSemana: dec(horasSemana),
    horasNocturnas: dec(horasNocturnas),
    horasDominicales: dec(horasDominicales),
    horasExtra: dec(horasExtra),
    horasSobreJornada: dec(horasSobreJornada),
    horasSobreTope: dec(horasSobreTope),
    pagaExtras,
    jornadaLegal,
    nocturno,
    dominical,
    extra,
    festivo,
    total: nocturno + dominical + extra + festivo,
    valorHora: Math.round(valorHora),
    horasMensuales,
    festivosAlAnio,
    trabajaFestivos,
  }
}

/* ===========================================================================
 *  Prima de servicios
 * ======================================================================== */

/**
 * La prima legal: un mes de salario al año, en dos mitades.
 *
 * Se paga la primera quincena de junio —a más tardar el 30— y antes del 20 de
 * diciembre. La base incluye el auxilio de transporte, que es lo que casi
 * todo el mundo olvida, y también el promedio de lo variable (recargos,
 * comisiones) del semestre.
 *
 * La fórmula legal es base × días trabajados / 360. Con el semestre completo
 * sale medio mes de salario, que es la cifra que la gente espera.
 */
export function primaSemestral(
  salarioBase: number,
  opciones: { auxilio?: boolean; variableMensual?: number; diasTrabajados?: number } = {},
): number {
  const auxilio = opciones.auxilio && salarioBase <= TOPE_AUXILIO ? AUXILIO_TRANSPORTE : 0
  const base = salarioBase + auxilio + (opciones.variableMensual ?? 0)
  const dias = opciones.diasTrabajados ?? 180
  return Math.round((base * dias) / 360)
}

/** Cuándo cae cada mitad de la prima en un año. Fechas límite legales. */
export function fechasPrima(anio: number): string[] {
  return [`${anio}-06-30`, `${anio}-12-20`]
}

/**
 * Las cesantías y sus intereses, que también se reciben y casi nadie proyecta.
 *
 * Las cesantías no llegan a la cuenta —van a un fondo— pero los intereses sí,
 * en enero, y son un ingreso real. Se calculan sobre lo acumulado en el año.
 */
export function cesantiasAnuales(
  salarioBase: number,
  opciones: { auxilio?: boolean; variableMensual?: number; diasTrabajados?: number } = {},
): { cesantias: number; intereses: number } {
  const auxilio = opciones.auxilio && salarioBase <= TOPE_AUXILIO ? AUXILIO_TRANSPORTE : 0
  const base = salarioBase + auxilio + (opciones.variableMensual ?? 0)
  const dias = opciones.diasTrabajados ?? 360
  const cesantias = Math.round((base * dias) / 360)
  // 12 % anual sobre lo acumulado, proporcional al tiempo. Se pagan al
  // trabajador directamente, a más tardar el 31 de enero.
  const intereses = Math.round((cesantias * dias * 0.12) / 360)
  return { cesantias, intereses }
}

/* ===========================================================================
 *  El paquete completo
 * ======================================================================== */

export interface PerfilNomina {
  /** Sueldo pactado al mes, sin recargos ni descuentos. */
  base: number
  /** Si recibe auxilio de transporte. */
  auxilio?: boolean
  /** Si cotiza a salud y pensión como empleado. */
  cotiza?: boolean
  /** El horario, para los recargos. Vacío = no se calculan. */
  turnos?: Turno[]
  /** Si le toca trabajar los festivos. Ver `calcularRecargos`. */
  trabajaFestivos?: boolean
  /** Si le pagan como extra las horas que pasan de la jornada. Ver `calcularRecargos`. */
  pagaExtras?: boolean
}

export interface ResumenNomina {
  deducciones: Deducciones
  recargos: Recargos | null
  /** Lo que llega a la cuenta cada mes, recargos incluidos. */
  mensual: number
  /** Cada mitad de la prima. */
  prima: number
  /** Los intereses de cesantías, que llegan en enero. */
  interesesCesantias: number
  /** Lo que se recibe en el año contando las dos primas y los intereses. */
  anual: number
}

/**
 * Todo junto: lo que entra al mes y lo que entra al año.
 *
 * Los recargos entran en la base de la prima porque la ley los considera
 * salario; el auxilio de transporte también entra en la prima aunque no
 * cotice. Son las dos asimetrías que hacen que la prima casi nunca sea
 * exactamente medio sueldo.
 */
export function resumirNomina(perfil: PerfilNomina, fecha: string): ResumenNomina {
  const deducciones = deduccionesDe(perfil.base, { auxilio: perfil.auxilio, cotiza: perfil.cotiza })
  const recargos = perfil.turnos?.length
    ? calcularRecargos(perfil.base, perfil.turnos, fecha, {
      trabajaFestivos: perfil.trabajaFestivos,
      pagaExtras: perfil.pagaExtras,
    })
    : null

  const variableMensual = recargos?.total ?? 0
  const mensual = deducciones.aCuenta + variableMensual
  const prima = primaSemestral(perfil.base, { auxilio: perfil.auxilio, variableMensual })
  const { intereses } = cesantiasAnuales(perfil.base, { auxilio: perfil.auxilio, variableMensual })

  return {
    deducciones,
    recargos,
    mensual,
    prima,
    interesesCesantias: intereses,
    anual: mensual * 12 + prima * 2 + intereses,
  }
}
