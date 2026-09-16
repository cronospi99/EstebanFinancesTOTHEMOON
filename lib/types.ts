export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment'
export type TxType = 'expense' | 'income' | 'transfer'
export type AssetType = 'stock' | 'etf' | 'crypto' | 'fx' | 'cdt'
export type Currency = 'COP' | 'USD'

/** Bolsillo: subdivisión de una cuenta, como los de Nequi o Lulo. */
export interface Pocket {
  id: string
  name: string
  balance: number
  /** Rendimiento efectivo anual en %, si el bolsillo lo genera. */
  apy?: number
  color?: string
}

export interface Account {
  id: string
  name: string
  institution: string
  type: AccountType
  /** Saldo en la moneda de la cuenta. Los bolsillos suman aparte. */
  balance: number
  currency: Currency
  color: string
  /** Rendimiento efectivo anual en % de la cuenta. */
  apy?: number
  pockets?: Pocket[]
  /** Solo tarjetas de crédito: cupo total aprobado. */
  creditLimit?: number
  /** Solo tarjetas de crédito: cuotas pactadas de la deuda actual. */
  installments?: number
  /** Solo tarjetas de crédito: cuotas ya pagadas. */
  installmentsPaid?: number
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  /**
   * 'transfer' no sale en ningún selector: es la etiqueta interna de los
   * movimientos entre cuentas, que no son ni gasto ni ingreso. Sin ella, la
   * transferencia tendría que colgar de una categoría de gasto y aparecería
   * ofrecida como presupuestable.
   */
  kind: 'expense' | 'income' | 'transfer'
  /** Agrupa en el selector para que la lista larga siga siendo navegable. */
  group: string
}

export interface Transaction {
  id: string
  accountId: string
  /** Bolsillo concreto dentro de la cuenta, si aplica. */
  pocketId?: string
  /**
   * Cuenta de destino. Solo en las transferencias, y ahí es obligatoria.
   *
   * Una transferencia es un movimiento con dos puntas y no dos movimientos:
   * guardarla partida en un gasto y un ingreso obliga a mantenerlos
   * sincronizados al editar y al borrar, y basta con que uno se pierda para
   * que aparezca dinero de la nada.
   */
  toAccountId?: string
  toPocketId?: string
  categoryId: string
  amount: number
  type: TxType
  description: string
  occurredAt: string
  /** Moneda en la que se registró; por defecto la de la cuenta. */
  currency?: Currency
}

export interface Budget {
  categoryId: string
  amount: number
  /**
   * Tope de gasto en un solo día para esta categoría, si se quiere.
   *
   * Convive con `amount` porque son la misma decisión a dos plazos: «500.000
   * al mes» dice cuánto cabe, «40.000 en un día» impide gastárselo el martes.
   */
  dailyCap?: number
}

/**
 * Dinero de una cuenta asignado a un presupuesto — un bolsillo virtual.
 *
 * Asignar NO mueve dinero: el saldo de la cuenta sigue siendo el del banco.
 * Lo único que cambia es cuánto de ese saldo está libre. Por eso son filas y
 * no un campo del presupuesto: un mismo presupuesto puede fondearse desde
 * varias cuentas, y hay que poder restar de cada una lo que salió de ella.
 *
 * Un importe negativo retira dinero del bolsillo. Se guarda como fila nueva en
 * vez de editar la anterior, así el historial queda entero.
 */
export interface BudgetAllocation {
  id: string
  categoryId: string
  /** Cuenta de origen. Se queda vacía si la cuenta se borra después. */
  accountId?: string
  amount: number
  note?: string
  createdAt: string
}

/** Preferencias que no cuelgan de ninguna entidad. */
export interface Settings {
  /** Tope de gasto diario para todo, sin distinguir categoría. */
  dailyCap?: number
}

/** Meta de ahorro: un objetivo con importe y, si se quiere, fecha límite. */
export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  currency: Currency
  /** ISO (solo día). Opcional: no toda meta tiene plazo. */
  deadline?: string
  color: string
  /** Bolsillo donde vive el dinero, si está separado en uno. */
  accountId?: string
  pocketId?: string
}

/**
 * De qué lado está el préstamo.
 *
 * `owe` es la deuda de toda la vida: alguien te prestó. `lent` es la misma
 * historia contada al revés —prestaste tú— y necesita ser un campo y no otra
 * tabla porque todo lo demás es idéntico: un nombre, un monto, una fecha, una
 * tasa opcional y un historial de abonos. Lo único que cambia es hacia dónde
 * va el dinero, y por eso cambia el signo del movimiento que se crea al
 * cuadrar y cambia cada rótulo de la pantalla.
 */
export type DebtDirection = 'owe' | 'lent'

/**
 * Préstamo entre personas: lo que le debes a alguien —o lo que alguien te
 * debe— y no a un banco.
 *
 * Va aparte de las cuentas de crédito porque el dato de partida es otro. Una
 * tarjeta tiene cupo, corte y cuotas; un préstamo entre personas tiene con
 * quién es, cuánto fue, desde cuándo y —si lo pactaron— qué interés corre.
 * Meterlo como cuenta en negativo obligaba a inventar una institución y dejaba
 * sin sitio lo único que de verdad se consulta: cuánto se lleva pagado.
 */
export interface Debt {
  id: string
  /** La otra persona: a quién le debes, o quién te debe. */
  person: string
  /**
   * Quién le prestó a quién. Las deudas de antes de que existiera el campo son
   * todas `owe`, que es lo único que se podía registrar entonces.
   */
  direction: DebtDirection
  /** El monto prestado, en la moneda de la deuda. */
  principal: number
  currency: Currency
  /**
   * Interés efectivo anual en %. Sin él la deuda no genera intereses, que es
   * el caso normal entre conocidos.
   *
   * Se guarda anual aunque casi siempre se pacte mensual («el 2 % al mes»)
   * porque es como lo guardan las cuentas y así una tasa significa lo mismo en
   * toda la app. La conversión la hace el formulario.
   */
  rate?: number
  /** Desde cuándo corre la deuda. ISO (solo día). */
  startedAt: string
  /** Cuándo quedó de pagarla, si hay plazo. ISO (solo día). */
  dueDate?: string
  note?: string
  color: string
}

/**
 * Un abono a una deuda, la deba quien la deba.
 *
 * Filas y no un campo `pagado` en la deuda: con interés, *cuándo* se pagó
 * cambia cuánto se debe hoy —cada abono baja el saldo sobre el que corre la
 * tasa—, así que un total suelto no permitiría calcularlo. Y sin interés
 * sigue siendo lo que uno quiere ver: qué se ha ido dando y en qué fechas.
 */
export interface DebtPayment {
  id: string
  debtId: string
  /**
   * Lo que baja la deuda. Negativo la sube: un cargo.
   *
   * Que pueda ir en los dos sentidos es lo que permite cuadrar cuentas de
   * verdad. Entre personas la deuda no solo se paga: también crece porque el
   * otro puso algo más, o se corrige porque alguien se equivocó al apuntar.
   *
   * El signo es siempre respecto al saldo, no respecto a tu bolsillo: en un
   * préstamo que hiciste tú, un positivo es lo que te devolvieron y un
   * negativo es lo que le prestaste de más. Quién recibe la plata lo decide
   * `direction`, no este número.
   */
  amount: number
  occurredAt: string
  note?: string
  /**
   * De dónde salió el dinero, cuando salió de algún sitio.
   *
   * Puede ser una cuenta o una tarjeta —pagarle a alguien con la tarjeta es
   * cambiar de acreedor, no dejar de deber— y al registrarlo se crea el
   * movimiento correspondiente para que el saldo de esa cuenta lo acuse.
   */
  accountId?: string
  /**
   * Un movimiento que ya existía y que se cruza contra la deuda.
   *
   * Es el caso que no cabía de ninguna otra forma: pagaste algo con la tarjeta
   * que en realidad era de la otra persona, ese gasto ya está registrado, y lo
   * que falta es decir que descuenta de lo que le debes. Crear un movimiento
   * nuevo lo cobraría dos veces; aquí solo se enlaza.
   */
  transactionId?: string
}

/** Cómo se saldó un abono. Se deduce de los campos, no se guarda. */
export type FormaDeAbono = 'cuenta' | 'cruce' | 'ajuste'

/*
 * Manda `accountId`, y por eso va primero.
 *
 * Pagar desde una cuenta también deja `transactionId`: el del movimiento que
 * el propio abono creó, que es lo que permite deshacerlo después. Preguntar
 * antes por `transactionId` daba «cruzado con un gasto» a todos los pagos, que
 * es justo lo contrario de lo que pasó. Un cruce es el único caso en que hay
 * movimiento pero no salió dinero de ninguna cuenta por este abono.
 */
export const formaDeAbono = (p: Pick<DebtPayment, 'accountId' | 'transactionId'>): FormaDeAbono =>
  p.accountId ? 'cuenta' : p.transactionId ? 'cruce' : 'ajuste'

/**
 * Cada cuánto se cobra una suscripción.
 *
 * Cerrado a cinco ciclos y no a «cada N días» a propósito: así se cobra de
 * verdad —al mes, al año, y de vez en cuando por trimestre o semestre— y un
 * catálogo cerrado permite decir «un pago anual» en vez de «cada 365 días»,
 * que es como lo diría cualquiera.
 */
export type SubCycle = 'semanal' | 'mensual' | 'trimestral' | 'semestral' | 'anual'

/**
 * Una suscripción: lo que se cobra solo, mes tras mes, sin que nadie decida
 * nada.
 *
 * Va aparte de los gastos normales porque la pregunta es otra. Un gasto se
 * mira hacia atrás —en qué se me fue— y una suscripción hacia adelante: qué me
 * van a cobrar, cuándo, y cuánto suma todo esto al año. Esa última cifra es la
 * que sorprende: nueve cobros pequeños que nadie recuerda haber aceptado y que
 * juntos valen más que el arriendo de una semana.
 *
 * No genera movimientos por su cuenta. La app no corre en un servidor que
 * pueda despertarse el día 19 a cobrar, y un movimiento inventado sin que el
 * banco lo haya cobrado deja el saldo mintiendo. Lo que hay es un botón para
 * registrarlo cuando llega, que además sirve de recordatorio.
 */
export interface Subscription {
  id: string
  /** Cómo se llama el servicio: Netflix, iCloud+, el gimnasio. */
  name: string
  /** Lo que cobran cada ciclo, en su moneda. */
  amount: number
  currency: Currency
  cycle: SubCycle
  /**
   * Un día en el que cobraron —o van a cobrar—. De aquí sale todo lo demás.
   *
   * Se guarda un ancla y no «el próximo cobro» porque el próximo cobro caduca:
   * quien no abre la app en dos meses volvería a una fecha pasada. Con el ancla
   * y el ciclo, la siguiente fecha se calcula siempre, y sigue saliendo bien
   * dentro de un año.
   */
  anchorAt: string
  /** Con qué se paga. Sirve para avisar de la tarjeta que vence. */
  accountId?: string
  /**
   * Si es una prueba gratis, cuándo deja de serlo. ISO (solo día).
   *
   * Es el agujero clásico: la prueba de un mes que nadie cancela y que lleva
   * cobrando desde marzo. Por eso tiene campo propio y su propio filtro.
   */
  trialEndsAt?: string
  /**
   * Entre cuántos se reparte, contándote a ti. 1 o vacío = la pagas tú solo.
   *
   * Lo que sale de tu bolsillo es el importe entre esta cifra; el resto te lo
   * deben. Un plan familiar de cuatro no cuesta lo que dice la factura.
   */
  sharedWith?: number
  /** Cancelada: se conserva por historial, pero ya no cuenta en los totales. */
  cancelled?: boolean
  note?: string
  color: string
}

export interface Holding {
  id: string
  symbol: string
  name: string
  /** Admite fracciones: 0,085 BTC o 2,4 acciones. */
  quantity: number
  avgCost: number
  assetType: AssetType
  currency: Currency
  /** Cuenta de inversión a la que pertenece (ARQ, Trii, Insights…). */
  accountId?: string
}

/**
 * Operación de inversión: una compra o una venta concreta.
 *
 * El libro de operaciones es la fuente de verdad; la posición (`Holding`) se
 * recalcula a partir de él. Antes solo se guardaba la posición: al registrar
 * una compra se fundía en el promedio y la operación desaparecía, así que no
 * había historial que consultar ni forma de corregir una cifra mal tecleada
 * sin rehacer la posición entera a mano.
 */
export interface Trade {
  id: string
  symbol: string
  name: string
  side: 'buy' | 'sell'
  /** Admite fracciones, igual que la posición. */
  quantity: number
  /** Precio por unidad de esta operación, en su moneda. */
  price: number
  currency: Currency
  assetType: AssetType
  /** Plataforma donde se hizo (ARQ, Insights, Tyba, Trii). */
  accountId?: string
  occurredAt: string
  /**
   * Marca la operación sintética que representa una posición anterior al libro.
   * Se crea sola la primera vez que se toca un símbolo que ya existía, para que
   * el historial explique la posición completa en vez de arrancar a mitad.
   */
  opening?: boolean
}

export interface Quote {
  symbol: string
  price: number
  previousClose: number
  change: number
  changePercent: number
  currency: string
  stale?: boolean
  /** Proveedor que respondió. Sirve para diagnosticar por qué falta un precio. */
  source?: string
}
