/**
 * Proyección mes a mes, hasta doce meses.
 *
 * La de `liquidez.ts` responde «¿llego al día 30?» y para eso va día a día: el
 * punto más bajo del mes puede caer un martes en que no pasa nada, y ese día
 * es justo el que hay que enseñar. Pero esa misma precisión, estirada a un
 * año, es falsa: nadie sabe qué día de octubre de 2027 va a pagar el mercado.
 * Para presupuestar la pregunta es otra —«¿cuánto me sobra cada mes, y a dónde
 * llego si esto sigue así?»— y la unidad es el mes.
 *
 * No hay un motor nuevo. Se corre el de siempre sobre 365 días y se agrupa por
 * mes. Escribir una segunda proyección en paralelo habría significado mantener
 * dos veces las mismas reglas —los cortes de tarjeta, las pruebas gratis, las
 * quincenas que caen el 15 y el 30— y que se separaran a la primera corrección
 * que solo se hiciera en una. Aquí, cualquier arreglo en la diaria llega solo
 * a la mensual.
 *
 * Lo que sí se añade es lo variable. La diaria solo cuenta lo que tiene fecha,
 * y para treinta días eso está bien. A doce meses, dejar fuera el freelance de
 * quien vive de facturar convierte la proyección en una caída libre que no se
 * parece a su vida. Entra la mediana mensual de los últimos meses —ver
 * `estimarVariable`— y entra marcada como estimación, en su propia cifra y su
 * propio color, para que nadie la confunda con el sueldo.
 *
 * Lo extraordinario no entra nunca. Una lotería en el historial no es dinero
 * futuro, y promediarla sería construir el presupuesto del año sobre que
 * vuelva a tocar.
 *
 * Todo en pesos de hoy: sin inflación ni aumentos. Es un supuesto y está
 * escrito en la pantalla. Meter una inflación estimada daría cifras nominales
 * más grandes que parecen más precisas y no lo son, porque el número que de
 * verdad decide —cuánto sobra al mes— se calcula igual con sueldos y precios
 * de hoy.
 */
import { proyectarLiquidez, type EntradaProyeccion, type EventoLiquidez } from './liquidez'
import { anioMes, hoyEnZona, primeroDeMes } from './zona'

/** Hasta dónde llega la vista mensual. Un año: más allá, todo es escenario. */
export const MESES_PROYECTADOS = 12

export interface MesProyectado {
  /** Clave «2026-10». */
  mes: string
  /** Lo que entra con fecha: ingresos recurrentes y cobros de deudas. */
  entraFijo: number
  /** La estimación mensual de lo variable. Igual todos los meses, a propósito. */
  entraVariable: number
  /** Todo lo que sale: suscripciones, tarjetas, deudas y gasto corriente. */
  sale: number
  /** Entra menos sale. Lo que sobra —o falta— ese mes. */
  neto: number
  /** Saldo proyectado al cierre del mes. */
  saldo: number
  /** Si el mes cierra en rojo. */
  enRojo: boolean
  /** Lo que sale, desglosado por tipo, para poder explicar el mes. */
  salePorTipo: Record<string, number>
}

export interface ProyeccionMeses {
  meses: MesProyectado[]
  saldoInicial: number
  /** Dónde se acaba tras los doce meses. */
  saldoFinal: number
  /** La media de lo que sobra al mes. Es la cifra con la que se presupuesta. */
  netoMedio: number
  /** El primer mes que cierra en rojo, si lo hay. */
  primerRojo?: string
  /** Cuántos de los doce cierran en rojo. */
  mesesEnRojo: number
  /** La estimación de variable que se está aplicando, para poder decirlo. */
  variableEstimado: number
  /** Cuántas cosas quedaron fuera por estar en dólares sin tasa conocida. */
  sinConvertir: number
}

export interface EntradaProyeccionMeses extends Omit<EntradaProyeccion, 'dias'> {
  /** La mediana mensual de los ingresos variables. Ver `lib/ingresos.ts`. */
  variableEstimado?: number
  meses?: number
}

/** Las claves «2026-10» de los N meses que empiezan en el de `hoy`. */
function clavesDesde(hoy: string, n: number): string[] {
  const [a, m] = anioMes(hoy)
  return Array.from({ length: n }, (_, k) => primeroDeMes(a, m + k).slice(0, 7))
}

export function proyectarMeses(e: EntradaProyeccionMeses): ProyeccionMeses {
  const hoy = e.hoy ?? hoyEnZona()
  const meses = e.meses ?? MESES_PROYECTADOS
  const variableEstimado = Math.max(0, Math.round(e.variableEstimado ?? 0))

  /*
   * Un día de más, no exactamente los meses.
   *
   * La ventana se pide en días y los meses no miden lo mismo, así que se pide
   * de sobra y luego se recorta por clave de mes. Pedir justo 30×12 dejaba
   * fuera los últimos días de diciembre y el mes doce salía siempre corto,
   * como si en diciembre se gastara menos.
   */
  const diario = proyectarLiquidez({ ...e, hoy, dias: meses * 31 + 1 })

  const claves = clavesDesde(hoy, meses)
  const indice = new Map(claves.map((m, i) => [m, i]))

  const acum = claves.map((mes) => ({
    mes,
    entraFijo: 0,
    sale: 0,
    salePorTipo: {} as Record<string, number>,
  }))

  for (const punto of diario.serie) {
    const i = indice.get(punto.dia.slice(0, 7))
    if (i === undefined) continue
    for (const ev of punto.eventos as EventoLiquidez[]) {
      if (ev.monto >= 0) {
        acum[i].entraFijo += ev.monto
      } else {
        acum[i].sale += -ev.monto
        acum[i].salePorTipo[ev.tipo] = (acum[i].salePorTipo[ev.tipo] ?? 0) + -ev.monto
      }
    }
  }

  /*
   * El mes en curso lleva lo variable a prorrata.
   *
   * Si estamos a 20 de septiembre, lo que iba a entrar de freelance este mes
   * ya entró en su mayor parte y está dentro del saldo de hoy. Sumar la
   * estimación entera contaría ese dinero dos veces justo en el primer mes,
   * que es el que más se mira.
   */
  const diaDeHoy = Number(hoy.slice(8, 10))
  const diasDelMes = new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), 0).getDate()
  const restaDelMes = Math.max(0, (diasDelMes - diaDeHoy) / diasDelMes)

  const salida: MesProyectado[] = []
  let saldo = diario.saldoInicial
  let primerRojo: string | undefined
  let mesesEnRojo = 0
  let sumaNeto = 0

  for (let i = 0; i < acum.length; i++) {
    const a = acum[i]
    const entraVariable = Math.round(variableEstimado * (i === 0 ? restaDelMes : 1))
    const neto = a.entraFijo + entraVariable - a.sale
    saldo += neto
    sumaNeto += neto

    const enRojo = saldo < 0
    if (enRojo) {
      mesesEnRojo++
      if (!primerRojo) primerRojo = a.mes
    }

    salida.push({
      mes: a.mes,
      entraFijo: Math.round(a.entraFijo),
      entraVariable,
      sale: Math.round(a.sale),
      neto: Math.round(neto),
      saldo: Math.round(saldo),
      enRojo,
      salePorTipo: Object.fromEntries(
        Object.entries(a.salePorTipo).map(([k, v]) => [k, Math.round(v)]),
      ),
    })
  }

  return {
    meses: salida,
    saldoInicial: Math.round(diario.saldoInicial),
    saldoFinal: Math.round(saldo),
    netoMedio: Math.round(sumaNeto / Math.max(1, salida.length)),
    primerRojo,
    mesesEnRojo,
    variableEstimado,
    sinConvertir: diario.sinConvertir,
  }
}
