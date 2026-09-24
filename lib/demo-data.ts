import type {
  Account, Budget, BudgetAllocation, Debt, DebtPayment, Goal, Holding, RecurringIncome, Settings,
  Subscription, Transaction,
} from './types'

const daysAgo = (n: number, hour = 12) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, (n * 7) % 59, 0, 0)
  return d.toISOString()
}

export const DEMO_ACCOUNTS: Account[] = [
  {
    id: 'acc_banco', name: 'Cuenta de Ahorros', institution: 'Bancolombia', type: 'savings',
    balance: 14_820_000, currency: 'COP', color: '#FDDA24', apy: 0.5,
  },
  {
    id: 'acc_nequi', name: 'Nequi', institution: 'Nequi', type: 'checking',
    balance: 845_000, currency: 'COP', color: '#DA0081',
    pockets: [
      { id: 'p_viaje', name: 'Viaje', balance: 2_400_000, apy: 8.5, color: '#40C8E0' },
      { id: 'p_emergencia', name: 'Emergencias', balance: 3_000_000, apy: 8.5, color: '#30D158' },
    ],
  },
  {
    id: 'acc_lulo', name: 'Lulo Ahorros', institution: 'Lulo Bank', type: 'savings',
    balance: 6_500_000, currency: 'COP', color: '#00D1B0', apy: 11.5,
  },
  {
    id: 'acc_rappicard', name: 'RappiCard', institution: 'RappiCard', type: 'credit',
    balance: -2_380_000, currency: 'COP', color: '#141414',
    creditLimit: 8_000_000, installments: 12, installmentsPaid: 4,
    // Corta el 15 y se paga el 5 del mes siguiente: veinte días entre una
    // fecha y otra, que es lo normal en Colombia.
    statementDay: 15, dueDay: 5,
  },
  {
    id: 'acc_littio', name: 'Littio USD', institution: 'Littio', type: 'savings',
    balance: 1_250.40, currency: 'USD', color: '#1B2A4A', apy: 5.2,
  },
  {
    id: 'acc_arq', name: 'ARQ', institution: 'ARQ', type: 'investment',
    balance: 320.75, currency: 'USD', color: '#EFEDE3',
  },
  {
    id: 'acc_cash', name: 'Efectivo', institution: 'Efectivo', type: 'cash',
    balance: 320_000, currency: 'COP', color: '#30D158',
  },
]

export const DEMO_TRANSACTIONS: Transaction[] = [
  { id: 't1', accountId: 'acc_nequi', categoryId: 'food', amount: 38_500, type: 'expense', description: 'Almuerzo — Crepes', occurredAt: daysAgo(0, 13) },
  { id: 't2', accountId: 'acc_rappicard', categoryId: 'transport', amount: 14_200, type: 'expense', description: 'Uber a la oficina', occurredAt: daysAgo(0, 8) },
  { id: 't3', accountId: 'acc_banco', categoryId: 'market', amount: 264_800, type: 'expense', description: 'Éxito — mercado semanal', occurredAt: daysAgo(1, 19) },
  { id: 't4', accountId: 'acc_rappicard', categoryId: 'subs', amount: 26_900, type: 'expense', description: 'Spotify Premium', occurredAt: daysAgo(1, 9) },
  { id: 't5', accountId: 'acc_nequi', categoryId: 'delivery', amount: 45_600, type: 'expense', description: 'Rappi', occurredAt: daysAgo(2, 20) },
  { id: 't6', accountId: 'acc_banco', categoryId: 'salary', amount: 8_400_000, type: 'income', description: 'Nómina — quincena', occurredAt: daysAgo(3, 7) },
  { id: 't7', accountId: 'acc_banco', categoryId: 'utilities', amount: 189_000, type: 'expense', description: 'EPM — energía y agua', occurredAt: daysAgo(4, 11) },
  { id: 't8', accountId: 'acc_rappicard', categoryId: 'clothes', amount: 349_900, type: 'expense', description: 'Zara', occurredAt: daysAgo(5, 16) },
  { id: 't9', accountId: 'acc_cash', categoryId: 'coffee', amount: 12_000, type: 'expense', description: 'Café', occurredAt: daysAgo(5, 10) },
  { id: 't10', accountId: 'acc_banco', categoryId: 'home', amount: 2_100_000, type: 'expense', description: 'Arriendo', occurredAt: daysAgo(6, 9) },
  { id: 't11', accountId: 'acc_nequi', categoryId: 'transit', amount: 9_800, type: 'expense', description: 'Recarga cívica', occurredAt: daysAgo(7, 7) },
  { id: 't12', accountId: 'acc_lulo', categoryId: 'returns', amount: 78_400, type: 'income', description: 'Rendimientos Lulo', occurredAt: daysAgo(8, 0) },
  { id: 't13', accountId: 'acc_rappicard', categoryId: 'pharmacy', amount: 145_000, type: 'expense', description: 'Farmatodo', occurredAt: daysAgo(9, 18) },
  { id: 't14', accountId: 'acc_banco', categoryId: 'education', amount: 420_000, type: 'expense', description: 'Curso de inglés', occurredAt: daysAgo(11, 15) },
  { id: 't15', accountId: 'acc_nequi', categoryId: 'gym', amount: 120_000, type: 'expense', description: 'Smart Fit', occurredAt: daysAgo(12, 21) },
  { id: 't16', accountId: 'acc_rappicard', categoryId: 'installment', amount: 198_000, type: 'expense', description: 'Cuota 4/12 — portátil', occurredAt: daysAgo(14, 9) },
  { id: 't17', accountId: 'acc_banco', categoryId: 'internet', amount: 89_900, type: 'expense', description: 'Claro Hogar', occurredAt: daysAgo(16, 17) },
  { id: 't18', accountId: 'acc_banco', categoryId: 'freelance', amount: 3_200_000, type: 'income', description: 'Proyecto freelance', occurredAt: daysAgo(18, 12) },
  { id: 't19', accountId: 'acc_rappicard', categoryId: 'cashback', amount: 32_400, type: 'income', description: 'Cashback RappiCard', occurredAt: daysAgo(2, 10) },
  { id: 't20', accountId: 'acc_lulo', categoryId: 'cashback', amount: 18_900, type: 'income', description: 'Cashback Lulo', occurredAt: daysAgo(10, 14) },
]

export const DEMO_BUDGETS: Budget[] = [
  { categoryId: 'food', amount: 900_000, dailyCap: 45_000 },
  { categoryId: 'market', amount: 1_200_000 },
  { categoryId: 'transport', amount: 400_000, dailyCap: 20_000 },
  { categoryId: 'delivery', amount: 300_000, dailyCap: 25_000 },
  { categoryId: 'subs', amount: 150_000 },
  { categoryId: 'clothes', amount: 600_000 },
]

/**
 * Bolsillos virtuales de ejemplo: dinero de una cuenta apartado para una
 * categoría. Ninguno mueve el saldo de su cuenta — solo lo deja de dejar
 * libre— así que los saldos de arriba siguen siendo los del banco.
 */
export const DEMO_ALLOCATIONS: BudgetAllocation[] = [
  { id: 'al1', categoryId: 'food', accountId: 'acc_banco', amount: 700_000, createdAt: daysAgo(6, 9) },
  { id: 'al2', categoryId: 'food', accountId: 'acc_nequi', amount: 200_000, createdAt: daysAgo(2, 18) },
  { id: 'al3', categoryId: 'market', accountId: 'acc_banco', amount: 1_200_000, createdAt: daysAgo(6, 9) },
  { id: 'al4', categoryId: 'transport', accountId: 'acc_nequi', amount: 250_000, createdAt: daysAgo(5, 11) },
  { id: 'al5', categoryId: 'delivery', accountId: 'acc_rappicard', amount: 300_000, createdAt: daysAgo(4, 20) },
]

/** Tope diario global de ejemplo. */
export const DEMO_SETTINGS: Settings = { dailyCap: 120_000 }

export const DEMO_HOLDINGS: Holding[] = [
  { id: 'h1', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', quantity: 12.4, avgCost: 465.2, assetType: 'etf', currency: 'USD', accountId: 'acc_arq' },
  { id: 'h2', symbol: 'AAPL', name: 'Apple Inc.', quantity: 18, avgCost: 198.4, assetType: 'stock', currency: 'USD', accountId: 'acc_arq' },
  { id: 'h3', symbol: 'MSFT', name: 'Microsoft Corp.', quantity: 6.25, avgCost: 402.15, assetType: 'stock', currency: 'USD', accountId: 'acc_arq' },
  { id: 'h4', symbol: 'BTC-USD', name: 'Bitcoin', quantity: 0.0852, avgCost: 61_200, assetType: 'crypto', currency: 'USD', accountId: 'acc_littio' },
  { id: 'h5', symbol: 'NVDA', name: 'NVIDIA Corp.', quantity: 9, avgCost: 118.6, assetType: 'stock', currency: 'USD', accountId: 'acc_arq' },
]

export const DEMO_GOALS: Goal[] = [
  { id: 'g1', name: 'Viaje a Japón', target: 12_000_000, saved: 2_400_000, currency: 'COP', deadline: '2027-03-01', color: '#40C8E0', accountId: 'acc_nequi', pocketId: 'p_viaje' },
  { id: 'g2', name: 'Fondo de emergencia', target: 18_000_000, saved: 3_000_000, currency: 'COP', color: '#30D158', accountId: 'acc_nequi', pocketId: 'p_emergencia' },
  { id: 'g3', name: 'Portátil nuevo', target: 6_500_000, saved: 1_200_000, currency: 'COP', deadline: '2026-12-15', color: '#BF5AF2' },
]

/** Solo día, que es como se guardan las fechas de una deuda. */
const diaAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

/**
 * Deudas de ejemplo, elegidas para enseñar los casos que existen: con interés
 * pactado y sin él —lo normal entre conocidos— y de los dos lados, porque
 * prestar pasa tanto como que le presten a uno.
 */
export const DEMO_DEBTS: Debt[] = [
  {
    id: 'd1', person: 'Mamá', direction: 'owe', principal: 3_000_000, currency: 'COP',
    startedAt: diaAtras(120), color: '#FF9F0A',
    note: 'Para la cuota inicial de la moto',
  },
  {
    id: 'd2', person: 'Andrés', direction: 'owe', principal: 1_500_000, currency: 'COP',
    // 2 % mensual, la forma en que se pacta esto por aquí, en su equivalente anual.
    rate: 26.824, startedAt: diaAtras(75), dueDate: diaAtras(-45), color: '#FF453A',
  },
  {
    // El otro lado: plata que prestaste tú y te van devolviendo.
    id: 'd3', person: 'Juli', direction: 'lent', principal: 800_000, currency: 'COP',
    startedAt: diaAtras(50), dueDate: diaAtras(-10), color: '#30D158',
    note: 'El vuelo a Cartagena',
  },
]

export const DEMO_DEBT_PAYMENTS: DebtPayment[] = [
  { id: 'dp1', debtId: 'd1', amount: 500_000, occurredAt: diaAtras(90) },
  { id: 'dp2', debtId: 'd1', amount: 500_000, occurredAt: diaAtras(60) },
  { id: 'dp3', debtId: 'd1', amount: 400_000, occurredAt: diaAtras(20) },
  { id: 'dp4', debtId: 'd2', amount: 300_000, occurredAt: diaAtras(40) },
  { id: 'dp5', debtId: 'd3', amount: 300_000, occurredAt: diaAtras(25) },
]

/**
 * Suscripciones de ejemplo, elegidas para que se vea de qué va la pantalla:
 * un ciclo de cada tipo, una compartida, una prueba a punto de empezar a
 * cobrar y una en dólares. Con cinco mensuales iguales no se entendería por
 * qué la cifra del año es la que importa.
 */
export const DEMO_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 's1', name: 'Netflix', amount: 44_900, currency: 'COP', cycle: 'mensual',
    anchorAt: diaAtras(-3), accountId: 'acc_rappicard', color: '#E50914',
    // El plan que se reparte entre cuatro: la factura dice 44.900 y de tu
    // bolsillo salen 11.225.
    sharedWith: 4, note: 'Plan familiar con los primos',
  },
  {
    id: 's2', name: 'Spotify', amount: 16_900, currency: 'COP', cycle: 'mensual',
    anchorAt: diaAtras(-9), accountId: 'acc_nequi', color: '#1DB954',
  },
  {
    id: 's3', name: 'iCloud+', amount: 3_900, currency: 'COP', cycle: 'mensual',
    anchorAt: diaAtras(-16), accountId: 'acc_rappicard', color: '#3693F3',
  },
  {
    // En dólares: el filtro de «Otra moneda» existe por estas.
    id: 's4', name: 'ChatGPT Plus', amount: 20, currency: 'USD', cycle: 'mensual',
    anchorAt: diaAtras(-21), accountId: 'acc_rappicard', color: '#10A37F',
  },
  {
    // La anual: 219.000 de golpe son 18.250 al mes, y esa es la cuenta que
    // nadie hace.
    id: 's5', name: 'Duolingo', amount: 219_000, currency: 'COP', cycle: 'anual',
    anchorAt: diaAtras(-99), accountId: 'acc_banco', color: '#58CC02',
  },
  {
    // La prueba que todavía no cobra: lo que aparece en «Podrías ahorrar».
    id: 's6', name: 'Max', amount: 26_900, currency: 'COP', cycle: 'mensual',
    anchorAt: diaAtras(-11), trialEndsAt: diaAtras(-11), accountId: 'acc_rappicard',
    color: '#002BE7', note: 'Prueba de un mes',
  },
  {
    id: 's7', name: 'Gimnasio', amount: 129_000, currency: 'COP', cycle: 'trimestral',
    anchorAt: diaAtras(-34), accountId: 'acc_banco', color: '#FF9F0A',
  },
]

/**
 * Lo que entra todos los meses en el Modo Demo.
 *
 * Una quincena y un arriendo, que es la mezcla que hace interesante la
 * proyección de liquidez: el sueldo llega en dos tandas y el arriendo cae el
 * día 5, así que hay un tramo del mes en que la cuerda se tensa y otro en que
 * sobra. Sin ingresos, la proyección de la demo solo podría bajar.
 */
export const DEMO_INGRESOS: RecurringIncome[] = [
  {
    id: 'in1', name: 'Salario', amount: 4_200_000, currency: 'COP', cycle: 'quincenal',
    anchorAt: diaAtras(-2), accountId: 'acc_banco', color: '#30D158',
    note: 'Quincena del 15 y del 30',
  },
  {
    id: 'in2', name: 'Arriendo del apartaestudio', amount: 1_150_000, currency: 'COP',
    cycle: 'mensual', anchorAt: diaAtras(-6), accountId: 'acc_nequi', color: '#40C8E0',
  },
]

/**
 * Un negocio pequeño de ejemplo, para el espacio «Empresa / Negocio».
 *
 * Una tienda con un par de empleados: vende, compra a proveedores, paga
 * nómina, arriendo y el IVA del bimestre. Lo justo para que las pantallas
 * tengan algo que enseñar sin que parezca la contabilidad de una multinacional.
 */
export const DEMO_NEGOCIO: {
  accounts: Account[]
  transactions: Transaction[]
  budgets: Budget[]
  goals: Goal[]
  subscriptions: Subscription[]
} = {
  accounts: [
    {
      id: 'neg_banco', name: 'Cuenta empresarial', institution: 'Bancolombia', type: 'checking',
      balance: 23_450_000, currency: 'COP', color: '#FDDA24',
      // El IVA cobrado no es del negocio: es de la DIAN hasta que se paga.
      // Apartarlo en un bolsillo es la costumbre que evita el susto del bimestre.
      pockets: [{ id: 'neg_p_iva', name: 'IVA por pagar', balance: 3_120_000, color: '#98989F' }],
    },
    { id: 'neg_caja', name: 'Caja menor', institution: 'Efectivo', type: 'cash', balance: 640_000, currency: 'COP', color: '#30D158' },
    {
      id: 'neg_tarjeta', name: 'Tarjeta empresarial', institution: 'Davivienda', type: 'credit',
      balance: -1_870_000, currency: 'COP', color: '#ED1C27', creditLimit: 15_000_000, statementDay: 20, dueDay: 8,
    },
  ],
  transactions: [
    { id: 'nt1', accountId: 'neg_banco', categoryId: 'sales', amount: 4_380_000, type: 'income', description: 'Ventas de la semana', occurredAt: daysAgo(0, 18) },
    { id: 'nt2', accountId: 'neg_banco', categoryId: 'biz-suppliers', amount: 2_940_000, type: 'expense', description: 'Distribuidora del Norte — pedido', occurredAt: daysAgo(1, 10) },
    { id: 'nt3', accountId: 'neg_tarjeta', categoryId: 'biz-marketing', amount: 450_000, type: 'expense', description: 'Pauta en Instagram', occurredAt: daysAgo(2, 21) },
    { id: 'nt4', accountId: 'neg_caja', categoryId: 'shipping', amount: 86_000, type: 'expense', description: 'Envíos con mensajería', occurredAt: daysAgo(2, 15) },
    { id: 'nt5', accountId: 'neg_banco', categoryId: 'biz-services', amount: 1_800_000, type: 'income', description: 'Instalación a cliente corporativo', occurredAt: daysAgo(3, 11) },
    { id: 'nt6', accountId: 'neg_banco', categoryId: 'biz-payroll', amount: 5_200_000, type: 'expense', description: 'Nómina — quincena', occurredAt: daysAgo(4, 8) },
    { id: 'nt7', accountId: 'neg_banco', categoryId: 'biz-social', amount: 1_310_000, type: 'expense', description: 'PILA — seguridad social', occurredAt: daysAgo(5, 9) },
    { id: 'nt8', accountId: 'neg_banco', categoryId: 'biz-rent', amount: 2_600_000, type: 'expense', description: 'Arriendo del local', occurredAt: daysAgo(6, 9) },
    { id: 'nt9', accountId: 'neg_banco', categoryId: 'sales', amount: 6_120_000, type: 'income', description: 'Ventas de la semana', occurredAt: daysAgo(7, 18) },
    { id: 'nt10', accountId: 'neg_banco', categoryId: 'biz-iva', amount: 2_480_000, type: 'expense', description: 'IVA — bimestre anterior', occurredAt: daysAgo(9, 10) },
    { id: 'nt11', accountId: 'neg_tarjeta', categoryId: 'biz-software', amount: 89_900, type: 'expense', description: 'Siigo', occurredAt: daysAgo(10, 7) },
    { id: 'nt12', accountId: 'neg_banco', categoryId: 'biz-owner-draw', amount: 3_000_000, type: 'expense', description: 'Retiro del dueño', occurredAt: daysAgo(12, 16) },
    { id: 'nt13', accountId: 'neg_banco', categoryId: 'sales', amount: 5_940_000, type: 'income', description: 'Ventas de la semana', occurredAt: daysAgo(14, 18) },
    { id: 'nt14', accountId: 'neg_caja', categoryId: 'sales', amount: 1_260_000, type: 'income', description: 'Ventas en efectivo', occurredAt: daysAgo(16, 17) },
    { id: 'nt15', accountId: 'neg_banco', categoryId: 'sales', amount: 5_480_000, type: 'income', description: 'Ventas de la semana', occurredAt: daysAgo(21, 18) },
  ],
  budgets: [
    { categoryId: 'biz-marketing', amount: 1_500_000 },
    { categoryId: 'biz-suppliers', amount: 12_000_000 },
    { categoryId: 'shipping', amount: 400_000 },
  ],
  goals: [
    // Lo que se recomienda tener a mano: tres meses de nómina y arriendo.
    { id: 'ng1', name: 'Reserva de 3 meses', target: 39_000_000, saved: 12_500_000, currency: 'COP', color: '#30D158' },
  ],
  subscriptions: [
    { id: 'ns1', name: 'Siigo', amount: 89_900, currency: 'COP', cycle: 'mensual', anchorAt: diaAtras(-20), accountId: 'neg_tarjeta', color: '#0A84FF' },
  ],
}
