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
  kind: 'expense' | 'income'
  /** Agrupa en el selector para que la lista larga siga siendo navegable. */
  group: string
}

export interface Transaction {
  id: string
  accountId: string
  /** Bolsillo concreto dentro de la cuenta, si aplica. */
  pocketId?: string
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
}
