export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment'
export type TxType = 'expense' | 'income' | 'transfer'
export type AssetType = 'stock' | 'etf' | 'crypto' | 'fx'

export interface Account {
  id: string
  name: string
  institution: string
  type: AccountType
  balance: number
  currency: 'COP' | 'USD'
  color: string
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  kind: 'expense' | 'income'
}

export interface Transaction {
  id: string
  accountId: string
  categoryId: string
  amount: number
  type: TxType
  description: string
  occurredAt: string // ISO
}

export interface Budget {
  categoryId: string
  amount: number
}

export interface Holding {
  id: string
  symbol: string
  name: string
  quantity: number
  avgCost: number // en USD (o COP para activos locales)
  assetType: AssetType
  currency: 'COP' | 'USD'
}

/** Precio devuelto por /api/quotes */
export interface Quote {
  symbol: string
  price: number
  previousClose: number
  change: number
  changePercent: number
  currency: string
  stale?: boolean
}
