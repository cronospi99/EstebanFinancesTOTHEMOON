/**
 * El ciclo de una tarjeta de crédito: corte, límite de pago y los días que
 * hay en medio.
 *
 * Son las dos fechas que todo el mundo confunde y que deciden cuánto dinero
 * gratis te presta el banco.
 *
 * El CORTE es el día en que la tarjeta cierra el período: todo lo comprado
 * hasta ese día entra en el extracto que están a punto de emitir. El LÍMITE DE
 * PAGO es el día en que hay que pagar ese extracto, entre quince y veinte días
 * después. En el corte no hay que hacer nada; en el límite sí, y ahí está la
 * mitad del lío.
 *
 * La otra mitad es la jugada que sale de las dos fechas juntas: comprar el día
 * DESPUÉS del corte. Esa compra no entra en el extracto que acaba de cerrar
 * sino en el siguiente, que se paga un mes y medio más tarde. Comprar la
 * víspera del corte es lo contrario: entra en el extracto que cierra mañana y
 * se paga en dos semanas.
 *
 * Con la misma tarjeta y la misma compra, la diferencia entre las dos jugadas
 * es de hasta 45 días sin un peso de interés. Por eso este archivo existe y
 * por eso el recomendador de abajo ordena por días de financiación y no por
 * cupo disponible, que es lo que uno miraría sin pensarlo.
 *
 * Nada de esto es una recomendación de endeudarse: el cálculo da por hecho que
 * la compra se paga entera el día del límite. Financiar a cuotas tiene una
 * tasa detrás y eso ya no es dinero gratis.
 */
import type { Account, Transaction } from './types'
import { diasEntre } from './suscripciones'
import { anioMes, hoyEnZona, sumarDias } from './zona'

/** Cuántos días trae un mes, contando los febreros bisiestos. */
const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate()

/**
 * El día `dia` del mes indicado, recortado al último día si el mes es corto.
 *
 * Un corte el 31 cae el 28 en febrero, que es lo que hacen los bancos. Se
 * recorta al pintar y no se guarda recortado: el mes siguiente vuelve al 31.
 */
export function fechaDelMes(anio: number, mes: number, dia: number): string {
  const a = anio + Math.floor((mes - 1) / 12)
  const m = ((mes - 1) % 12 + 12) % 12 + 1
  const d = Math.min(Math.max(1, Math.round(dia)), diasDelMes(a, m))
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** La próxima vez que caiga ese día del mes, contando hoy. */
export function proximoDiaDelMes(dia: number, desde: string = hoyEnZona()): string {
  const [a, m] = anioMes(desde)
  const enEste = fechaDelMes(a, m, dia)
  return enEste >= desde ? enEste : fechaDelMes(a, m + 1, dia)
}

/** La última vez que cayó ese día del mes, contando hoy. */
export function anteriorDiaDelMes(dia: number, desde: string = hoyEnZona()): string {
  const [a, m] = anioMes(desde)
  const enEste = fechaDelMes(a, m, dia)
  return enEste <= desde ? enEste : fechaDelMes(a, m - 1, dia)
}

/**
 * El límite de pago del extracto que cerró un día concreto.
 *
 * Es la primera vez que cae el día de pago DESPUÉS del corte, no el día de
 * pago de ese mismo mes. Importa cuando el pago cae antes que el corte en el
 * calendario —corte el 25, pago el 10—: ahí el extracto del 25 de septiembre
 * se paga el 10 de octubre, y tomar «el 10 de septiembre» daría una fecha ya
 * pasada y un aviso de mora que no existe.
 */
export function limiteDelCorte(corte: string, dueDay: number): string {
  const [a, m] = anioMes(corte)
  const enEse = fechaDelMes(a, m, dueDay)
  return enEse > corte ? enEse : fechaDelMes(a, m + 1, dueDay)
}

export interface CicloTarjeta {
  /**
   * El primer día del período en el que cae lo que compres hoy.
   *
   * Es la frontera que decide todo: una compra de este día entra en el
   * extracto siguiente y se paga un mes más tarde que una compra de la
   * víspera.
   */
  inicioEnCurso: string
  /** El último día de ese período. La víspera del siguiente inicio. */
  finEnCurso: string
  /** El día en que el banco emite el extracto de ese período. Ver `emisionDelPeriodo`. */
  corteDeHoy: string
  /** Cuándo se pagará lo que compres hoy. Lo que decide la jugada. */
  limiteDeHoy: string
  /**
   * El extracto anterior: el día en que se emitió.
   *
   * Puede caer en el futuro durante los días que el banco tarda en emitirlo:
   * un período que cerró el 3 con extracto el 5 deja el día 4 en esa tierra de
   * nadie. Lo que importa ahí es `limiteEnCurso`, que ya está fijado.
   */
  corteAnterior: string
  /** Cuándo hay que pagar el extracto anterior. Lo urgente. */
  limiteEnCurso: string
  /** El próximo corte que verá el calendario: el primero que no ha pasado. */
  corteProximo: string
  /**
   * Días que faltan para que cierre el período abierto. 0 = cierra hoy.
   *
   * Cuenta hasta `finEnCurso` y no hasta el corte impreso, que son la misma
   * fecha salvo que el banco tarde unos días en emitir. Lo que decide en qué
   * extracto cae una compra es el cierre del período, no el papel.
   */
  faltanCorte: number
  /** Días que faltan para pagar el extracto ya cerrado. Negativo = en mora. */
  faltanLimite: number
  /**
   * Días de financiación sin intereses que da una compra hecha hoy.
   *
   * Es la cifra que ordena el recomendador: de 15 a 45 según dónde caiga hoy
   * dentro del ciclo.
   */
  diasDeFinanciacion: number
  /** Acaba de empezar el período: estamos en los primeros días del extracto nuevo. */
  reciénCortada: boolean
  /**
   * Días entre que el período cierra y el banco emite el extracto.
   *
   * Cero en la mayoría de las tarjetas. Cuando no lo es, la app tiene tres
   * fechas que enseñar en vez de dos y conviene decirlo.
   */
  retardoEmision: number
}

/*
 * Corte e inicio: casi siempre el mismo dato dicho al revés.
 *
 * Muchos bancos no imprimen «día de corte» sino «el período va del 26 al 25»,
 * y obligar a restar uno mentalmente es justo el tipo de cuenta que alguien
 * hace mal una vez y deja la tarjeta mal configurada para siempre. Estas dos
 * funciones convierten de uno al otro y sirven para rellenar el campo que
 * falta cuando solo se sabe el otro.
 *
 * El caso raro es el 1 y el 31. Un período que empieza el 1 corta el último
 * día del mes, y ese día es 31, 30 o 28 según el mes; se guarda 31 y
 * `fechaDelMes` ya lo recorta al último día real de cada mes, que es lo que
 * hace el banco.
 */
export const inicioDeCorte = (corte: number): number => (corte >= 31 ? 1 : corte + 1)
export const corteDeInicio = (inicio: number): number => (inicio <= 1 ? 31 : inicio - 1)

/**
 * Lo que el banco tarda como mucho en emitir el extracto, en días.
 *
 * No es una regla del negocio sino una defensa contra los números absurdos.
 * Si alguien pone un inicio de período y un corte que no pueden ser del mismo
 * ciclo —inicio el 10, corte el 8, veintinueve días de retardo— lo más
 * probable es que haya confundido los campos, y en ese caso vale más ignorar
 * el corte y cerrar el período en su propio fin que calcular un ciclo
 * imposible y presentarlo con toda seriedad.
 */
export const RETARDO_MAXIMO = 10

/**
 * El día en que se emite el extracto de un período que cierra en `fin`.
 *
 * En la mayoría de las tarjetas es el mismo día: el período cierra y el
 * extracto sale. Pero hay bancos que imprimen tres fechas —«inicio del
 * período: 4 de septiembre, fecha de corte: 5 de octubre, fecha de pago: 15 de
 * octubre»— donde el corte NO es el fin del período sino el día en que emiten
 * el papel, un par de días después de que el período cerrara. El siguiente
 * período ya empezó el día 4; lo del 4 y el 5 de octubre ya es del ciclo
 * nuevo aunque el extracto del anterior salga el 5.
 *
 * Tomar el corte impreso por el fin del período es exactamente el error que
 * hacía que las compras de esos días salieran como vencidas un mes antes de
 * tiempo.
 */
export function emisionDelPeriodo(fin: string, corteDia: number): string {
  const emision = proximoDiaDelMes(corteDia, fin)
  return diasEntre(fin, emision) > RETARDO_MAXIMO ? fin : emision
}

/** El día en que empieza el período de una tarjeta, se haya escrito o se deduzca del corte. */
export const inicioDelPeriodo = (
  a: Pick<Account, 'statementDay' | 'periodStartDay'>,
): number => a.periodStartDay ?? inicioDeCorte(a.statementDay!)

/** Una tarjeta con las dos fechas puestas. Sin ellas no hay ciclo que calcular. */
export const tieneCiclo = (a: Pick<Account, 'type' | 'statementDay' | 'dueDay'>): boolean =>
  a.type === 'credit' && Boolean(a.statementDay) && Boolean(a.dueDay)

/**
 * El ciclo de una tarjeta visto desde hoy.
 *
 * Devuelve null si a la tarjeta le faltan las fechas: es mejor no enseñar nada
 * que enseñar un ciclo inventado con valores por defecto. Una app que dice «te
 * quedan 40 días» cuando no sabe cuándo corta la tarjeta es peor que una que
 * no lo dice.
 */
export function cicloDe(
  cuenta: Pick<Account, 'type' | 'statementDay' | 'dueDay' | 'periodStartDay'>,
  hoy: string = hoyEnZona(),
): CicloTarjeta | null {
  if (!tieneCiclo(cuenta)) return null
  const corteDia = cuenta.statementDay!
  const pagoDia = cuenta.dueDay!
  const inicioDia = inicioDelPeriodo(cuenta)

  /*
   * Todo se cuelga del INICIO del período, no del corte.
   *
   * Es el cambio que arregla las tarjetas de tres fechas. El período va de un
   * día `inicioDia` al `inicioDia` siguiente sin solaparse, y de ahí salen sus
   * dos extremos sin ninguna cuenta rara; el corte es después, y es un dato
   * del papel, no de la frontera.
   *
   * El día siguiente se busca sobre la FECHA y no sobre el número del mes: el
   * 31 de enero más un día es el 1 de febrero sin casos especiales, mientras
   * que «día 31 + 1» no significa nada en un mes de treinta.
   */
  const inicioEnCurso = anteriorDiaDelMes(inicioDia, hoy)
  const finEnCurso = sumarDias(proximoDiaDelMes(inicioDia, sumarDias(hoy, 1)), -1)

  const corteDeHoy = emisionDelPeriodo(finEnCurso, corteDia)
  const limiteDeHoy = limiteDelCorte(corteDeHoy, pagoDia)

  const corteAnterior = emisionDelPeriodo(sumarDias(inicioEnCurso, -1), corteDia)
  const limiteEnCurso = limiteDelCorte(corteAnterior, pagoDia)

  return {
    inicioEnCurso,
    finEnCurso,
    corteDeHoy,
    limiteDeHoy,
    corteAnterior,
    limiteEnCurso,
    // Durante el retardo de emisión el corte «anterior» todavía no ha salido,
    // y entonces el próximo corte del calendario es ese y no el de este ciclo.
    corteProximo: corteAnterior >= hoy ? corteAnterior : corteDeHoy,
    faltanCorte: diasEntre(hoy, finEnCurso),
    faltanLimite: diasEntre(hoy, limiteEnCurso),
    diasDeFinanciacion: diasEntre(hoy, limiteDeHoy),
    // Tres días: lo que dura la ventaja de verdad. Al cuarto ya hay tarjetas
    // mejores y decirle a alguien que esta «acaba de cortar» sería engañarlo.
    reciénCortada: diasEntre(inicioEnCurso, hoy) <= 3,
    retardoEmision: diasEntre(finEnCurso, corteDeHoy),
  }
}

/**
 * Qué hay que hacer con esta tarjeta, si es que hay que hacer algo.
 *
 * Las dos fechas producen avisos de naturaleza distinta y mezclarlos sería
 * volver a la confusión de partida: el corte es información —«a partir de
 * mañana lo que compres se paga un mes después»— y el límite es una tarea con
 * consecuencias. Por eso el límite manda cuando los dos caen cerca.
 */
export type UrgenciaTarjeta = 'mora' | 'pago' | 'corte' | 'ventana' | 'nada'

export interface AvisoTarjeta {
  cuenta: Account
  ciclo: CicloTarjeta
  urgencia: UrgenciaTarjeta
  titulo: string
  detalle: string
  /** Lo que se debe, en la moneda de la tarjeta. Positivo. */
  deuda: number
  /** El reparto entre lo facturado y lo del ciclo en curso. Ver `deudaPorCiclo`. */
  reparto: DeudaTarjeta
}

/** Lo que se debe en una tarjeta: el saldo en negativo, en positivo. */
export const deudaDe = (a: Pick<Account, 'balance' | 'type'>) =>
  a.type === 'credit' && a.balance < 0 ? -a.balance : 0

export interface DeudaTarjeta {
  /** Todo lo que se debe. Es el saldo, y manda: lo dice el banco. */
  total: number
  /**
   * Lo que ya está en un extracto emitido. Esto es lo que hay que pagar en
   * `limiteEnCurso`, y lo único que puede estar vencido.
   */
  facturado: number
  /**
   * Lo gastado desde el último corte. Todavía no lo han facturado: entra en el
   * extracto que cierra en `corteProximo` y se paga un mes después.
   */
  enCurso: number
  /** Si se pudo separar de verdad, o `facturado` es todo el saldo por defecto. */
  separada: boolean
}

/**
 * Cuánto de la deuda hay que pagar YA y cuánto todavía no.
 *
 * Esto no es un detalle: era un aviso falso de mora. `deudaDe` devuelve el
 * saldo entero sin mirar cuándo se gastó, y todo lo que consume esa cifra
 * —los avisos, la proyección, los recordatorios— daba por hecho que el saldo
 * entero estaba en el último extracto. Para alguien que cortó el día 5, no
 * debía nada de ese extracto y lleva gastando desde el 6, la app decía «pago
 * vencido» el día 16 por una plata que el banco todavía no le ha facturado y
 * que no vence hasta el mes siguiente. Un aviso de mora que no existe es peor
 * que no avisar: enseña a ignorar los avisos.
 *
 * El reparto se hace al revés de lo que parece natural: se calcula lo gastado
 * DESDE el corte con los movimientos registrados, y lo facturado es el resto
 * del saldo. Así el total sigue siendo siempre el del banco —que es el dato
 * bueno— y lo que se estima es solo el reparto. Si alguien no registra sus
 * compras, `enCurso` sale 0 y todo queda como antes, que es el comportamiento
 * correcto cuando no hay información: sin movimientos anotados, lo prudente es
 * suponer que el saldo ya está facturado.
 *
 * La frontera es `inicioEnCurso`, inclusive: lo de ese día ya es del ciclo
 * nuevo y lo de la víspera es del extracto que cerró. Es la misma frontera que
 * usa `diasDeFinanciacion` para decir cuántos días sin intereses da una
 * compra, y que las dos coincidan no es un detalle: si el consejo dice que hoy
 * la compra se paga dentro de mes y medio, la deuda no puede estar diciendo
 * que esa compra ya está facturada.
 */
export function deudaPorCiclo(
  cuenta: Account,
  transacciones: Transaction[],
  hoy: string = hoyEnZona(),
): DeudaTarjeta {
  const total = deudaDe(cuenta)
  const ciclo = cicloDe(cuenta, hoy)
  if (!ciclo || total <= 0) return { total, facturado: total, enCurso: 0, separada: false }

  let enCurso = 0
  for (const t of transacciones) {
    const dia = t.occurredAt.slice(0, 10)
    if (dia < ciclo.inicioEnCurso || dia > hoy) continue
    // Comprar con la tarjeta sube la deuda; pagarla —una transferencia hacia
    // ella— la baja. Un abono hecho en este ciclo descuenta de lo de este
    // ciclo, que es donde lo imputaría cualquiera.
    if (t.type === 'expense' && t.accountId === cuenta.id) enCurso += t.amount
    else if (t.type === 'transfer' && t.toAccountId === cuenta.id) enCurso -= t.amount
  }

  // Nunca más que el saldo ni menos que cero: el reparto es una estimación y
  // no puede inventar deuda que el banco no reconoce ni borrar la que sí.
  const acotado = Math.max(0, Math.min(enCurso, total))
  return { total, facturado: total - acotado, enCurso: acotado, separada: true }
}

/** Cupo que queda libre, o null si la tarjeta no tiene cupo declarado. */
export function cupoLibre(a: Pick<Account, 'balance' | 'type' | 'creditLimit'>): number | null {
  if (a.type !== 'credit' || !a.creditLimit) return null
  return Math.max(0, a.creditLimit - deudaDe(a))
}

export function avisoDe(
  cuenta: Account,
  hoy: string = hoyEnZona(),
  transacciones: Transaction[] = [],
): AvisoTarjeta | null {
  const ciclo = cicloDe(cuenta, hoy)
  if (!ciclo) return null
  const deuda = deudaDe(cuenta)
  const reparto = deudaPorCiclo(cuenta, transacciones, hoy)

  /*
   * Lo que manda aquí es `facturado`, no el saldo.
   *
   * Un aviso de pago habla del extracto que ya cerró, y lo gastado después de
   * ese corte no está en él: el banco todavía no lo ha facturado y no vence
   * hasta el mes que viene. Mirando el saldo entero, quien cortó en cero y
   * lleva gastando desde entonces recibía «pago vencido» por una plata que
   * nadie le ha cobrado.
   */
  if (reparto.facturado > 0 && ciclo.faltanLimite < 0) {
    return {
      cuenta, ciclo, deuda, reparto, urgencia: 'mora',
      titulo: 'Pago vencido',
      detalle: `El límite era hace ${Math.abs(ciclo.faltanLimite)} ${Math.abs(ciclo.faltanLimite) === 1 ? 'día' : 'días'}.`,
    }
  }

  if (reparto.facturado > 0 && ciclo.faltanLimite <= 5) {
    return {
      cuenta, ciclo, deuda, reparto, urgencia: 'pago',
      titulo: ciclo.faltanLimite === 0 ? 'Hoy vence el pago' : `Paga en ${ciclo.faltanLimite} ${ciclo.faltanLimite === 1 ? 'día' : 'días'}`,
      detalle: 'Pagar el total evita intereses; el mínimo, no.',
    }
  }

  if (ciclo.faltanCorte <= 2) {
    return {
      cuenta, ciclo, deuda, reparto, urgencia: 'corte',
      titulo: ciclo.faltanCorte === 0 ? 'Corta hoy' : `Corta en ${ciclo.faltanCorte} ${ciclo.faltanCorte === 1 ? 'día' : 'días'}`,
      detalle: ciclo.faltanCorte === 0
        ? 'Lo de hoy entra todavía en este extracto; lo de mañana, en el siguiente.'
        : 'Lo que compres hasta ese día se paga en el extracto que cierra.',
    }
  }

  // La ventana buena: acaba de cortar y lo que se compre ahora se paga dentro
  // de mes y medio. No es una tarea, es una oportunidad, y solo se enseña
  // mientras dure.
  if (ciclo.reciénCortada) {
    return {
      cuenta, ciclo, deuda, reparto, urgencia: 'ventana',
      titulo: `${ciclo.diasDeFinanciacion} días sin intereses`,
      detalle: 'Acaba de cortar: lo que compres hoy se paga hasta el próximo extracto.',
    }
  }

  return { cuenta, ciclo, deuda, reparto, urgencia: 'nada', titulo: '', detalle: '' }
}

export interface Recomendacion {
  cuenta: Account
  ciclo: CicloTarjeta
  /** Días de financiación que daría una compra de hoy. */
  dias: number
  /** Cupo libre, si la tarjeta lo tiene declarado. */
  cupo: number | null
  /** Por qué esta y no otra, en una frase. */
  motivo: string
  /** No sirve para esta compra, y por qué. */
  descartada?: string
}

/**
 * Con qué tarjeta conviene pagar hoy.
 *
 * Ordena por días de financiación y no por cupo disponible, que es lo que uno
 * miraría sin pensarlo. El cupo dice si la compra cabe; los días dicen cuánto
 * tiempo tienes el dinero en tu cuenta en vez de en la del banco, y con la
 * plata rindiendo en un bolsillo al 10 % E.A. eso es dinero de verdad, no un
 * tecnicismo.
 *
 * `monto` es opcional: sin él responde «¿cuál está en mejor momento?», y con
 * él descarta las que no tienen cupo para esta compra concreta. Las
 * descartadas se devuelven igual, con el motivo: esconderlas dejaría al
 * usuario preguntándose por qué no sale la tarjeta que tiene en la mano.
 */
export function recomendarTarjeta(
  cuentas: Account[],
  monto = 0,
  hoy: string = hoyEnZona(),
): Recomendacion[] {
  const filas: Recomendacion[] = []

  for (const cuenta of cuentas) {
    if (cuenta.type !== 'credit') continue
    const ciclo = cicloDe(cuenta, hoy)
    if (!ciclo) continue

    const cupo = cupoLibre(cuenta)
    const deuda = deudaDe(cuenta)
    let descartada: string | undefined

    if (monto > 0 && cupo !== null && cupo < monto) {
      descartada = 'El cupo libre no alcanza para esta compra.'
    } else if (deuda > 0 && ciclo.faltanLimite < 0) {
      // Con un extracto vencido, más compras es lo último que hace falta.
      descartada = 'Tiene un pago vencido: primero hay que ponerla al día.'
    }

    filas.push({
      cuenta,
      ciclo,
      dias: ciclo.diasDeFinanciacion,
      cupo,
      descartada,
      motivo: ciclo.reciénCortada
        ? 'Acaba de cortar, que es el mejor momento del ciclo.'
        : ciclo.faltanCorte <= 2
          ? 'Está a punto de cortar: lo de hoy se paga en dos semanas.'
          : `Le quedan ${ciclo.faltanCorte} días de ciclo abierto.`,
    })
  }

  // Las utilizables primero y, dentro de ellas, la que más días da. A igualdad
  // de días gana la que tenga más cupo libre: si la compra es grande, deja
  // margen para la siguiente.
  return filas.sort((a, b) =>
    Number(Boolean(a.descartada)) - Number(Boolean(b.descartada))
    || b.dias - a.dias
    || (b.cupo ?? 0) - (a.cupo ?? 0))
}

/**
 * Lo que entró en el extracto que está abierto ahora mismo.
 *
 * Es la cifra que el banco va a facturar en el próximo corte, y no coincide
 * con el saldo de la tarjeta: el saldo incluye lo del extracto anterior, que
 * ya está facturado y se paga aparte.
 */
export function gastoDelCiclo(
  cuenta: Account,
  transactions: Transaction[],
  hoy: string = hoyEnZona(),
): number {
  const ciclo = cicloDe(cuenta, hoy)
  if (!ciclo) return 0
  let total = 0
  for (const t of transactions) {
    if (t.accountId !== cuenta.id || t.type !== 'expense') continue
    const dia = t.occurredAt.slice(0, 10)
    if (dia >= ciclo.inicioEnCurso && dia <= hoy) total += t.amount
  }
  return total
}
