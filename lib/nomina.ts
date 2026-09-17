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
}

export interface Recargos {
  /** Horas de la semana, en total. */
  horasSemana: number
  /** De esas, cuántas caen en franja nocturna. */
  horasNocturnas: number
  /** Cuántas caen en domingo. */
  horasDominicales: number
  /** Las que pasan de la jornada legal. */
  horasExtra: number
  jornadaLegal: number
  /** Lo que suman los recargos al mes, en pesos. */
  nocturno: number
  dominical: number
  extra: number
  total: number
  /** El valor de una hora ordinaria con este sueldo. */
  valorHora: number
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

export const duracionDe = (t: Turno): number =>
  t.hasta > t.desde ? t.hasta - t.desde : 24 - t.desde + t.hasta

/**
 * Lo que suman los recargos de un horario, al mes.
 *
 * Un horario fijo semanal se repite, así que se calcula la semana y se lleva a
 * mes con 30/7 semanas. No son las semanas exactas de cada mes —febrero tiene
 * cuatro justas y marzo cuatro y media— y eso está bien para una estimación:
 * la alternativa era pedir el calendario del turno mes a mes, que nadie
 * mantiene.
 *
 * Los festivos no se cuentan. Colombia tiene dieciocho al año y caen en lunes
 * casi todos; meterlos exigiría el calendario completo y una suposición sobre
 * si ese lunes se trabaja. Se dice en la pantalla que quedan fuera, y la
 * estimación se queda corta, que en un ingreso es el lado prudente.
 */
export function calcularRecargos(
  salarioBase: number,
  turnos: Turno[],
  fecha: string,
): Recargos {
  const jornadaLegal = jornadaSemanal(fecha)
  // La hora ordinaria sale de la jornada legal, no de las horas trabajadas:
  // es el precio de una hora, y bajarlo porque alguien trabaje de más sería
  // exactamente al revés de lo que dice la ley.
  const valorHora = salarioBase / (jornadaLegal * SEMANAS_POR_MES)

  let horasSemana = 0
  let horasNocturnas = 0
  let horasDominicales = 0

  for (const t of turnos) {
    const duracion = duracionDe(t)
    horasSemana += duracion
    horasNocturnas += horasNocturnasDe(t, fecha)
    if (t.dia === 0) horasDominicales += duracion
  }

  const horasExtra = Math.max(0, horasSemana - jornadaLegal)

  const alMes = (horasSemana_: number) => horasSemana_ * SEMANAS_POR_MES
  const nocturno = Math.round(alMes(horasNocturnas) * valorHora * RECARGO_NOCTURNO)
  const dominical = Math.round(alMes(horasDominicales) * valorHora * recargoDominical(fecha))
  // Las extras se pagan a la tarifa diurna salvo que caigan de noche; sin
  // saber cuáles de las horas sobrantes son las nocturnas, se aplica la
  // proporción de la semana. Es una estimación y va dicha como tal.
  const proporcionNocturna = horasSemana > 0 ? horasNocturnas / horasSemana : 0
  const recargoExtraMedio = EXTRA_DIURNA * (1 - proporcionNocturna) + EXTRA_NOCTURNA * proporcionNocturna
  const extra = Math.round(alMes(horasExtra) * valorHora * (1 + recargoExtraMedio))

  return {
    horasSemana: Math.round(horasSemana * 100) / 100,
    horasNocturnas: Math.round(horasNocturnas * 100) / 100,
    horasDominicales: Math.round(horasDominicales * 100) / 100,
    horasExtra: Math.round(horasExtra * 100) / 100,
    jornadaLegal,
    nocturno,
    dominical,
    extra,
    total: nocturno + dominical + extra,
    valorHora: Math.round(valorHora),
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
    ? calcularRecargos(perfil.base, perfil.turnos, fecha)
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
