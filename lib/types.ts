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
 * Deuda con una persona: lo que le debes a alguien, no a un banco.
 *
 * Va aparte de las cuentas de crédito porque el dato de partida es otro. Una
 * tarjeta tiene cupo, corte y cuotas; un préstamo entre personas tiene a quién
 * le debes, cuánto te prestó, desde cuándo y —si lo pactaron— qué interés
 * corre. Meterlo como cuenta en negativo obligaba a inventar una institución y
 * dejaba sin sitio lo único que de verdad se consulta: cuánto llevas pagado.
 */
export interface Debt {
  id: string
  /** A quién le debes. */
  person: string
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
 * Un abono a una deuda.
 *
 * Filas y no un campo `pagado` en la deuda: con interés, *cuándo* pagaste
 * cambia cuánto debes hoy —cada abono baja el saldo sobre el que corre la
 * tasa—, así que un total suelto no permitiría calcularlo. Y sin interés
 * sigue siendo lo que uno quiere ver: qué le has ido dando y en qué fechas.
 */
export interface DebtPayment {
  id: string
  debtId: string
  amount: number
  occurredAt: string
  note?: string
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
