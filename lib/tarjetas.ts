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
import { diasEntre, sumarMeses } from './suscripciones'
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
  /** El corte que ya pasó: desde el día siguiente corre el extracto abierto. */
  corteAnterior: string
  /**
   * El primer día del período en el que cae lo que compres hoy.
   *
   * Va emparejado con `limiteDeHoy` y con el corte que lo cierra
   * (`corteDeHoy`), no con `corteProximo`. La diferencia solo se nota el día
   * del corte, y ahí es la diferencia entre decir la verdad y decir un
   * disparate: ese día el extracto ya se emitió, así que el período abierto es
   * el que empieza mañana. Emparejarlo con `corteProximo` —que ese día es
   * hoy— daba períodos que terminaban antes de empezar.
   *
   * No se guarda en ninguna parte a propósito: el inicio y el corte son un
   * solo hecho dicho de dos maneras, y guardar los dos significa que alguien
   * edite uno y la tarjeta diga dos cosas distintas del mismo ciclo.
   *
   * Se calcula sumando un día a la FECHA y no al número del mes: el 31 de
   * enero más un día es el 1 de febrero sin ningún caso especial, mientras que
   * «día 31 + 1» no significa nada en un mes de treinta.
   */
  inicioEnCurso: string
  /** El próximo corte. Lo que compres hasta ese día entra en ese extracto. */
  corteProximo: string
  /** Cuándo hay que pagar el extracto que ya cerró. Lo urgente. */
  limiteEnCurso: string
  /** El corte que cerrará lo que compres hoy. Cierra el período de `inicioEnCurso`. */
  corteDeHoy: string
  /** Cuándo se pagará lo que compres hoy. Lo que decide la jugada. */
  limiteDeHoy: string
  /** Días que faltan para el corte. 0 = corta hoy. */
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
  /** Acaba de cortar: estamos en los primeros días del extracto nuevo. */
  reciénCortada: boolean
}

/*
 * Corte e inicio son el mismo dato dicho al revés.
 *
 * Muchos bancos no imprimen «día de corte» sino «el período va del 26 al 25»,
 * y obligar a restar uno mentalmente es justo el tipo de cuenta que alguien
 * hace mal una vez y deja la tarjeta mal configurada para siempre. Se puede
 * escribir cualquiera de los dos y la app guarda solo el corte, que es el que
 * usa todo lo demás.
 *
 * El caso raro es el 1 y el 31. Un período que empieza el 1 corta el último
 * día del mes, y ese día es 31, 30 o 28 según el mes; se guarda 31 y
 * `fechaDelMes` ya lo recorta al último día real de cada mes, que es lo que
 * hace el banco.
 */
export const inicioDeCorte = (corte: number): number => (corte >= 31 ? 1 : corte + 1)
export const corteDeInicio = (inicio: number): number => (inicio <= 1 ? 31 : inicio - 1)

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
  cuenta: Pick<Account, 'type' | 'statementDay' | 'dueDay'>,
  hoy: string = hoyEnZona(),
): CicloTarjeta | null {
  if (!tieneCiclo(cuenta)) return null
  const corteDia = cuenta.statementDay!
  const pagoDia = cuenta.dueDay!

  const corteProximo = proximoDiaDelMes(corteDia, hoy)
  const corteAnterior = corteProximo === hoy ? hoy : anteriorDiaDelMes(corteDia, hoy)

  /*
   * Lo que se compra HOY entra en el extracto que cierra en `corteProximo`
   * —hoy todavía no ha cerrado— salvo que hoy sea justo el día del corte. Ese
   * día el extracto ya se emitió, así que la compra de hoy cae en el
   * siguiente. Es el detalle que convierte el día del corte en el mejor día
   * del mes para comprar, y darlo por el peor sería invertir el consejo.
   */
  const corteDeHoy = hoy === corteProximo ? sumarMeses(corteProximo, 1) : corteProximo
  const limiteDeHoy = limiteDelCorte(corteDeHoy, pagoDia)
  const limiteEnCurso = limiteDelCorte(corteAnterior, pagoDia)

  return {
    corteAnterior,
    inicioEnCurso: sumarDias(corteAnterior, 1),
    corteProximo,
    corteDeHoy,
    limiteEnCurso,
    limiteDeHoy,
    faltanCorte: diasEntre(hoy, corteProximo),
    faltanLimite: diasEntre(hoy, limiteEnCurso),
    diasDeFinanciacion: diasEntre(hoy, limiteDeHoy),
    // Tres días: lo que dura la ventaja de verdad. Al cuarto ya hay tarjetas
    // mejores y decirle a alguien que esta «acaba de cortar» sería engañarlo.
    reciénCortada: diasEntre(corteAnterior, hoy) <= 3,
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
}

/** Lo que se debe en una tarjeta: el saldo en negativo, en positivo. */
export const deudaDe = (a: Pick<Account, 'balance' | 'type'>) =>
  a.type === 'credit' && a.balance < 0 ? -a.balance : 0

/** Cupo que queda libre, o null si la tarjeta no tiene cupo declarado. */
export function cupoLibre(a: Pick<Account, 'balance' | 'type' | 'creditLimit'>): number | null {
  if (a.type !== 'credit' || !a.creditLimit) return null
  return Math.max(0, a.creditLimit - deudaDe(a))
}

export function avisoDe(cuenta: Account, hoy: string = hoyEnZona()): AvisoTarjeta | null {
  const ciclo = cicloDe(cuenta, hoy)
  if (!ciclo) return null
  const deuda = deudaDe(cuenta)

  // En mora: la fecha pasó y sigue habiendo saldo. Es lo único que cuesta
  // dinero de verdad y por eso va antes que todo lo demás.
  if (deuda > 0 && ciclo.faltanLimite < 0) {
    return {
      cuenta, ciclo, deuda, urgencia: 'mora',
      titulo: 'Pago vencido',
      detalle: `El límite era hace ${Math.abs(ciclo.faltanLimite)} ${Math.abs(ciclo.faltanLimite) === 1 ? 'día' : 'días'}.`,
    }
  }

  if (deuda > 0 && ciclo.faltanLimite <= 5) {
    return {
      cuenta, ciclo, deuda, urgencia: 'pago',
      titulo: ciclo.faltanLimite === 0 ? 'Hoy vence el pago' : `Paga en ${ciclo.faltanLimite} ${ciclo.faltanLimite === 1 ? 'día' : 'días'}`,
      detalle: 'Pagar el total evita intereses; el mínimo, no.',
    }
  }

  if (ciclo.faltanCorte <= 2) {
    return {
      cuenta, ciclo, deuda, urgencia: 'corte',
      titulo: ciclo.faltanCorte === 0 ? 'Corta hoy' : `Corta en ${ciclo.faltanCorte} ${ciclo.faltanCorte === 1 ? 'día' : 'días'}`,
      detalle: ciclo.faltanCorte === 0
        ? 'Lo que compres desde hoy ya entra en el extracto siguiente.'
        : 'Lo que compres hasta ese día se paga en el extracto que cierra.',
    }
  }

  // La ventana buena: acaba de cortar y lo que se compre ahora se paga dentro
  // de mes y medio. No es una tarea, es una oportunidad, y solo se enseña
  // mientras dure.
  if (ciclo.reciénCortada) {
    return {
      cuenta, ciclo, deuda, urgencia: 'ventana',
      titulo: `${ciclo.diasDeFinanciacion} días sin intereses`,
      detalle: 'Acaba de cortar: lo que compres hoy se paga hasta el próximo extracto.',
    }
  }

  return { cuenta, ciclo, deuda, urgencia: 'nada', titulo: '', detalle: '' }
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
  // Desde el día siguiente al corte: lo del propio día del corte ya se facturó.
  const desde = ciclo.corteAnterior
  let total = 0
  for (const t of transactions) {
    if (t.accountId !== cuenta.id || t.type !== 'expense') continue
    const dia = t.occurredAt.slice(0, 10)
    if (dia > desde && dia <= hoy) total += t.amount
  }
  return total
}
