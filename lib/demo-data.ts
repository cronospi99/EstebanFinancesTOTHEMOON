import type { Account, Budget, Holding, Transaction } from './types'

/** Fechas relativas a hoy para que el prototipo nunca se vea "viejo". */
const daysAgo = (n: number, hour = 12) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, Math.floor(Math.random() * 59), 0, 0)
  return d.toISOString()
}

export const DEMO_ACCOUNTS: Account[] = [
  { id: 'acc_banco', name: 'Cuenta de Ahorros', institution: 'Bancolombia', type: 'savings', balance: 14_820_000, currency: 'COP', color: '#FDDA24' },
  { id: 'acc_nequi', name: 'Nequi', institution: 'Nequi', type: 'checking', balance: 1_245_000, currency: 'COP', color: '#DA0081' },
  { id: 'acc_nu', name: 'Nu Tarjeta', institution: 'Nu', type: 'credit', balance: -2_380_000, currency: 'COP', color: '#820AD1' },
  { id: 'acc_lulo', name: 'Lulo Ahorros', institution: 'Lulo Bank', type: 'savings', balance: 6_500_000, currency: 'COP', color: '#00D1B0' },
  { id: 'acc_cash', name: 'Efectivo', institution: 'Efectivo', type: 'cash', balance: 320_000, currency: 'COP', color: '#30D158' },
]

export const DEMO_TRANSACTIONS: Transaction[] = [
  { id: 't1', accountId: 'acc_nequi', categoryId: 'food', amount: 38_500, type: 'expense', description: 'Almuerzo — Crepes', occurredAt: daysAgo(0, 13) },
  { id: 't2', accountId: 'acc_nu', categoryId: 'transport', amount: 14_200, type: 'expense', description: 'Uber a la oficina', occurredAt: daysAgo(0, 8) },
  { id: 't3', accountId: 'acc_banco', categoryId: 'market', amount: 264_800, type: 'expense', description: 'Éxito — mercado semanal', occurredAt: daysAgo(1, 19) },
  { id: 't4', accountId: 'acc_nu', categoryId: 'subs', amount: 26_900, type: 'expense', description: 'Spotify Premium', occurredAt: daysAgo(1, 9) },
  { id: 't5', accountId: 'acc_nequi', categoryId: 'fun', amount: 62_000, type: 'expense', description: 'Cine Colombia', occurredAt: daysAgo(2, 20) },
  { id: 't6', accountId: 'acc_banco', categoryId: 'salary', amount: 8_400_000, type: 'income', description: 'Nómina — quincena', occurredAt: daysAgo(3, 7) },
  { id: 't7', accountId: 'acc_banco', categoryId: 'services', amount: 189_000, type: 'expense', description: 'EPM — energía y agua', occurredAt: daysAgo(4, 11) },
  { id: 't8', accountId: 'acc_nu', categoryId: 'shopping', amount: 349_900, type: 'expense', description: 'Zara', occurredAt: daysAgo(5, 16) },
  { id: 't9', accountId: 'acc_cash', categoryId: 'food', amount: 12_000, type: 'expense', description: 'Café', occurredAt: daysAgo(5, 10) },
  { id: 't10', accountId: 'acc_banco', categoryId: 'home', amount: 2_100_000, type: 'expense', description: 'Arriendo', occurredAt: daysAgo(6, 9) },
  { id: 't11', accountId: 'acc_nequi', categoryId: 'transport', amount: 9_800, type: 'expense', description: 'Metro — recarga cívica', occurredAt: daysAgo(7, 7) },
  { id: 't12', accountId: 'acc_lulo', categoryId: 'returns', amount: 78_400, type: 'income', description: 'Rendimientos Lulo', occurredAt: daysAgo(8, 0) },
  { id: 't13', accountId: 'acc_nu', categoryId: 'health', amount: 145_000, type: 'expense', description: 'Farmatodo', occurredAt: daysAgo(9, 18) },
  { id: 't14', accountId: 'acc_banco', categoryId: 'education', amount: 420_000, type: 'expense', description: 'Curso de inglés', occurredAt: daysAgo(11, 15) },
  { id: 't15', accountId: 'acc_nequi', categoryId: 'food', amount: 45_600, type: 'expense', description: 'Domicilio — Rappi', occurredAt: daysAgo(12, 21) },
  { id: 't16', accountId: 'acc_nu', categoryId: 'subs', amount: 44_900, type: 'expense', description: 'Netflix', occurredAt: daysAgo(14, 9) },
  { id: 't17', accountId: 'acc_banco', categoryId: 'market', amount: 198_300, type: 'expense', description: 'D1', occurredAt: daysAgo(16, 17) },
  { id: 't18', accountId: 'acc_banco', categoryId: 'freelance', amount: 3_200_000, type: 'income', description: 'Proyecto freelance', occurredAt: daysAgo(18, 12) },
]

export const DEMO_BUDGETS: Budget[] = [
  { categoryId: 'food', amount: 900_000 },
  { categoryId: 'market', amount: 1_200_000 },
  { categoryId: 'transport', amount: 400_000 },
  { categoryId: 'fun', amount: 500_000 },
  { categoryId: 'subs', amount: 150_000 },
  { categoryId: 'shopping', amount: 600_000 },
]

export const DEMO_HOLDINGS: Holding[] = [
  { id: 'h1', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', quantity: 12, avgCost: 465.2, assetType: 'etf', currency: 'USD' },
  { id: 'h2', symbol: 'AAPL', name: 'Apple Inc.', quantity: 18, avgCost: 198.4, assetType: 'stock', currency: 'USD' },
  { id: 'h3', symbol: 'MSFT', name: 'Microsoft Corp.', quantity: 6, avgCost: 402.15, assetType: 'stock', currency: 'USD' },
  { id: 'h4', symbol: 'BTC-USD', name: 'Bitcoin', quantity: 0.085, avgCost: 61_200, assetType: 'crypto', currency: 'USD' },
  { id: 'h5', symbol: 'NVDA', name: 'NVIDIA Corp.', quantity: 9, avgCost: 118.6, assetType: 'stock', currency: 'USD' },
]
