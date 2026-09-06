'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from './supabase/client'
import { DEMO_ACCOUNTS, DEMO_BUDGETS, DEMO_GOALS, DEMO_HOLDINGS, DEMO_TRANSACTIONS } from './demo-data'
import { monthKey, monthlyFromApy } from './format'
import { useExchangeRate, type FxState } from './use-fx'
import type { Account, Budget, Goal, Holding, Pocket, Transaction } from './types'
import { uid } from './utils'

const STORAGE_KEY = 'eftm.state.v2'

interface State {
  accounts: Account[]
  transactions: Transaction[]
  budgets: Budget[]
  holdings: Holding[]
  goals: Goal[]
}

const INITIAL: State = {
  accounts: DEMO_ACCOUNTS,
  transactions: DEMO_TRANSACTIONS,
  budgets: DEMO_BUDGETS,
  holdings: DEMO_HOLDINGS,
  goals: DEMO_GOALS,
}

interface FinanceContextValue extends State {
  ready: boolean
  synced: boolean
  /** Tasa USD→COP vigente, con su procedencia. rate 0 = no se conoce. */
  fxRate: number
  fx: FxState & { refresh: () => Promise<void>; setManual: (r: number | null) => void }
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  addAccount: (acc: Omit<Account, 'id'>) => Promise<void>
  updateAccount: (id: string, patch: Partial<Account>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  addPocket: (accountId: string, pocket: Omit<Pocket, 'id'>) => Promise<void>
  updatePocket: (accountId: string, pocketId: string, patch: Partial<Pocket>) => Promise<void>
  deletePocket: (accountId: string, pocketId: string) => Promise<void>
  addHolding: (h: Omit<Holding, 'id'>) => Promise<void>
  updateHolding: (id: string, patch: Partial<Holding>) => Promise<void>
  deleteHolding: (id: string) => Promise<void>
  setBudget: (categoryId: string, amount: number) => void
  removeBudget: (categoryId: string) => void
  addGoal: (g: Omit<Goal, 'id'>) => Promise<void>
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  resetDemo: () => void
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(INITIAL)
  const [ready, setReady] = useState(false)
  const [synced, setSynced] = useState(false)
  const fx = useExchangeRate()
  const fxRate = fx.rate

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isSupabaseConfigured) {
        const supabase = createClient()
        const { data: { session } = { session: null } } = (await supabase?.auth.getSession()) ?? {}
        if (supabase && session) {
          const [accounts, transactions, holdings, budgets, goals] = await Promise.all([
            supabase.from('accounts').select('*').order('created_at'),
            supabase.from('transactions').select('*').order('occurred_at', { ascending: false }),
            supabase.from('holdings').select('*'),
            supabase.from('budgets').select('*'),
            supabase.from('goals').select('*'),
          ])
          if (!cancelled && !accounts.error) {
            setState({
              accounts: (accounts.data ?? []).map(rowToAccount),
              transactions: (transactions.data ?? []).map(rowToTx),
              holdings: (holdings.data ?? []).map(rowToHolding),
              budgets: (budgets.data ?? []).map((b) => ({ categoryId: b.category_id, amount: Number(b.amount) })),
              goals: (goals.data ?? []).map(rowToGoal),
            })
            setSynced(true)
            setReady(true)
            return
          }
        }
      }

      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw && !cancelled) setState({ ...INITIAL, ...JSON.parse(raw) })
      } catch {
        /* Storage bloqueado (modo privado): seguimos en memoria. */
      }
      if (!cancelled) setReady(true)
    }

    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!ready || synced) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* cuota llena */
    }
  }, [state, ready, synced])

  const remote = useCallback(() => (synced ? createClient() : null), [synced])

  // ---- Transacciones -------------------------------------------------------
  const addTransaction = useCallback(
    async (tx: Omit<Transaction, 'id'>) => {
      const full: Transaction = { ...tx, id: uid() }
      const delta = full.type === 'income' ? full.amount : -full.amount

      setState((s) => ({
        ...s,
        transactions: [full, ...s.transactions],
        accounts: s.accounts.map((a) => {
          if (a.id !== full.accountId) return a
          // Si va a un bolsillo, el saldo se mueve ahí y no en el general.
          if (full.pocketId) {
            return {
              ...a,
              pockets: (a.pockets ?? []).map((p) =>
                p.id === full.pocketId ? { ...p, balance: p.balance + delta } : p,
              ),
            }
          }
          return { ...a, balance: a.balance + delta }
        }),
      }))
      await remote()?.from('transactions').insert(txToRow(full))
    },
    [remote],
  )

  const deleteTransaction = useCallback(
    async (id: string) => {
      setState((s) => {
        const tx = s.transactions.find((t) => t.id === id)
        if (!tx) return s
        const delta = tx.type === 'income' ? tx.amount : -tx.amount
        return {
          ...s,
          transactions: s.transactions.filter((t) => t.id !== id),
          accounts: s.accounts.map((a) => {
            if (a.id !== tx.accountId) return a
            if (tx.pocketId) {
              return {
                ...a,
                pockets: (a.pockets ?? []).map((p) =>
                  p.id === tx.pocketId ? { ...p, balance: p.balance - delta } : p,
                ),
              }
            }
            return { ...a, balance: a.balance - delta }
          }),
        }
      })
      await remote()?.from('transactions').delete().eq('id', id)
    },
    [remote],
  )

  // ---- Cuentas -------------------------------------------------------------
  const addAccount = useCallback(
    async (acc: Omit<Account, 'id'>) => {
      const full: Account = { ...acc, id: uid() }
      setState((s) => ({ ...s, accounts: [...s.accounts, full] }))
      await remote()?.from('accounts').insert(accountToRow(full))
    },
    [remote],
  )

  const updateAccount = useCallback(
    async (id: string, patch: Partial<Account>) => {
      setState((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
      await remote()?.from('accounts').update(accountPatchToRow(patch)).eq('id', id)
    },
    [remote],
  )

  const deleteAccount = useCallback(
    async (id: string) => {
      setState((s) => ({
        ...s,
        accounts: s.accounts.filter((a) => a.id !== id),
        transactions: s.transactions.filter((t) => t.accountId !== id),
      }))
      await remote()?.from('accounts').delete().eq('id', id)
    },
    [remote],
  )

  // ---- Bolsillos -----------------------------------------------------------
  // Viven dentro de la cuenta (columna jsonb): son subdivisiones suyas, no
  // entidades propias, y así se mueven y se borran con ella.
  const persistPockets = useCallback(
    async (accountId: string, pockets: Pocket[]) => {
      await remote()?.from('accounts').update({ pockets }).eq('id', accountId)
    },
    [remote],
  )

  const addPocket = useCallback(
    async (accountId: string, pocket: Omit<Pocket, 'id'>) => {
      const full: Pocket = { ...pocket, id: uid() }
      let next: Pocket[] = []
      setState((s) => ({
        ...s,
        accounts: s.accounts.map((a) => {
          if (a.id !== accountId) return a
          next = [...(a.pockets ?? []), full]
          return { ...a, pockets: next }
        }),
      }))
      await persistPockets(accountId, next)
    },
    [persistPockets],
  )

  const updatePocket = useCallback(
    async (accountId: string, pocketId: string, patch: Partial<Pocket>) => {
      let next: Pocket[] = []
      setState((s) => ({
        ...s,
        accounts: s.accounts.map((a) => {
          if (a.id !== accountId) return a
          next = (a.pockets ?? []).map((p) => (p.id === pocketId ? { ...p, ...patch } : p))
          return { ...a, pockets: next }
        }),
      }))
      await persistPockets(accountId, next)
    },
    [persistPockets],
  )

  const deletePocket = useCallback(
    async (accountId: string, pocketId: string) => {
      let next: Pocket[] = []
      setState((s) => ({
        ...s,
        accounts: s.accounts.map((a) => {
          if (a.id !== accountId) return a
          next = (a.pockets ?? []).filter((p) => p.id !== pocketId)
          return { ...a, pockets: next }
        }),
      }))
      await persistPockets(accountId, next)
    },
    [persistPockets],
  )

  // ---- Inversiones ---------------------------------------------------------
  const addHolding = useCallback(
    async (h: Omit<Holding, 'id'>) => {
      const full: Holding = { ...h, id: uid() }
      setState((s) => ({ ...s, holdings: [...s.holdings, full] }))
      await remote()?.from('holdings').insert(holdingToRow(full))
    },
    [remote],
  )

  const updateHolding = useCallback(
    async (id: string, patch: Partial<Holding>) => {
      setState((s) => ({ ...s, holdings: s.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)) }))
      await remote()?.from('holdings').update(holdingPatchToRow(patch)).eq('id', id)
    },
    [remote],
  )

  const deleteHolding = useCallback(
    async (id: string) => {
      setState((s) => ({ ...s, holdings: s.holdings.filter((h) => h.id !== id) }))
      await remote()?.from('holdings').delete().eq('id', id)
    },
    [remote],
  )

  const setBudget = useCallback(
    (categoryId: string, amount: number) => {
      setState((s) => ({
        ...s,
        budgets: s.budgets.some((b) => b.categoryId === categoryId)
          ? s.budgets.map((b) => (b.categoryId === categoryId ? { ...b, amount } : b))
          : [...s.budgets, { categoryId, amount }],
      }))
      remote()?.from('budgets').upsert(
        { category_id: categoryId, amount },
        { onConflict: 'user_id,category_id' },
      ).then(() => {}, () => {})
    },
    [remote],
  )

  const removeBudget = useCallback(
    (categoryId: string) => {
      setState((s) => ({ ...s, budgets: s.budgets.filter((b) => b.categoryId !== categoryId) }))
      remote()?.from('budgets').delete().eq('category_id', categoryId).then(() => {}, () => {})
    },
    [remote],
  )

  // ---- Metas de ahorro -----------------------------------------------------
  const addGoal = useCallback(
    async (g: Omit<Goal, 'id'>) => {
      const full: Goal = { ...g, id: uid() }
      setState((s) => ({ ...s, goals: [...s.goals, full] }))
      await remote()?.from('goals').insert(goalToRow(full))
    },
    [remote],
  )

  const updateGoal = useCallback(
    async (id: string, patch: Partial<Goal>) => {
      setState((s) => ({ ...s, goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
      await remote()?.from('goals').update(goalPatchToRow(patch)).eq('id', id)
    },
    [remote],
  )

  const deleteGoal = useCallback(
    async (id: string) => {
      setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }))
      await remote()?.from('goals').delete().eq('id', id)
    },
    [remote],
  )

  const resetDemo = useCallback(() => {
    setState(INITIAL)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  }, [])

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...state, ready, synced, fxRate, fx,
      addTransaction, deleteTransaction,
      addAccount, updateAccount, deleteAccount,
      addPocket, updatePocket, deletePocket,
      addHolding, updateHolding, deleteHolding,
      setBudget, removeBudget, addGoal, updateGoal, deleteGoal, resetDemo,
    }),
    [state, ready, synced, fxRate, fx, addTransaction, deleteTransaction, addAccount,
     updateAccount, deleteAccount, addPocket, updatePocket, deletePocket, addHolding,
     updateHolding, deleteHolding, setBudget, removeBudget, addGoal, updateGoal, deleteGoal, resetDemo],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance debe usarse dentro de <FinanceProvider>')
  return ctx
}

// ---- Selectores derivados --------------------------------------------------

/** Saldo total de una cuenta: el general más el de sus bolsillos. */
export const accountTotal = (a: Account) =>
  a.balance + (a.pockets ?? []).reduce((s, p) => s + p.balance, 0)

/**
 * Convierte a pesos. Devuelve null si la cuenta está en dólares y no se
 * conoce la tasa: multiplicar por un número inventado falsearía el
 * patrimonio, y sumar los dólares como si fueran pesos sería peor todavía.
 */
export const toCOP = (amount: number, currency: Account['currency'], fx: number) =>
  currency === 'USD' ? (fx > 0 ? amount * fx : null) : amount

export function useAccountsInCOP() {
  const { accounts, fxRate } = useFinance()
  return useMemo(
    () => accounts.map((a) => ({ account: a, cop: toCOP(accountTotal(a), a.currency, fxRate) })),
    [accounts, fxRate],
  )
}

/** Valor de mercado del portafolio en pesos. */
export function useInvestmentsValue(quotes: Record<string, { price: number; stale?: boolean }> = {}) {
  const { holdings, fxRate } = useFinance()
  return useMemo(() => {
    let value = 0, cost = 0
    for (const h of holdings) {
      const q = quotes[h.symbol]
      const live = Boolean(q && !q.stale && q.price > 0)
      // Sin tasa, una posición en dólares no puede expresarse en pesos.
      const fx = h.currency === 'USD' ? fxRate : 1
      if (h.currency === 'USD' && fxRate <= 0) continue
      value += (live ? q!.price : h.avgCost) * h.quantity * fx
      cost += h.avgCost * h.quantity * fx
    }
    return { value, cost, pnl: value - cost, pnlPct: cost ? ((value - cost) / cost) * 100 : 0 }
  }, [holdings, quotes, fxRate])
}

/**
 * Patrimonio neto en pesos. `incompleto` avisa de que hay cuentas en dólares
 * que no se pudieron convertir y quedaron fuera del total.
 */
export function useNetWorthDetail() {
  const rows = useAccountsInCOP()
  return useMemo(() => {
    let total = 0, sinConvertir = 0
    for (const r of rows) {
      if (r.cop === null) sinConvertir++
      else total += r.cop
    }
    return { total, incompleto: sinConvertir > 0, sinConvertir }
  }, [rows])
}

export function useNetWorth() {
  return useNetWorthDetail().total
}

/**
 * Rendimiento mensual esperado por las tasas E.A. declaradas.
 * Es una proyección a partir de lo que el usuario configuró, no dinero ya
 * recibido: se etiqueta como "esperado" en la interfaz por eso mismo.
 */
export function useExpectedYield() {
  const { accounts, fxRate } = useFinance()
  return useMemo(() => {
    let monthly = 0, base = 0
    for (const a of accounts) {
      if (a.currency === 'USD' && fxRate <= 0) continue
      const fx = a.currency === 'USD' ? fxRate : 1
      if (a.apy && a.balance > 0) {
        monthly += a.balance * fx * monthlyFromApy(a.apy)
        base += a.balance * fx
      }
      for (const p of a.pockets ?? []) {
        if (p.apy && p.balance > 0) {
          monthly += p.balance * fx * monthlyFromApy(p.apy)
          base += p.balance * fx
        }
      }
    }
    // Tasa media ponderada por saldo: promediar las E.A. a secas daría el
    // mismo peso a un bolsillo de mil pesos que a una cuenta de diez millones.
    const weightedApy = base > 0 ? (Math.pow(1 + monthly / base, 12) - 1) * 100 : 0
    return { monthly, base, weightedApy }
  }, [accounts, fxRate])
}

export function useMonthSummary(month = monthKey()) {
  const { transactions } = useFinance()
  return useMemo(() => {
    const inMonth = transactions.filter((t) => monthKey(t.occurredAt) === month)
    const income = inMonth.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = inMonth.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income, expense, net: income - expense, count: inMonth.length, transactions: inMonth }
  }, [transactions, month])
}

export function useSpendByCategory(month = monthKey()) {
  const { transactions } = useFinance()
  return useMemo(() => {
    const map = new Map<string, number>()
    transactions
      .filter((t) => t.type === 'expense' && monthKey(t.occurredAt) === month)
      .forEach((t) => map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount))
    return [...map.entries()]
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, month])
}

export type RangeKey = '1D' | '5D' | '1S' | '1M' | '3M' | '6M' | '1A' | '5A'

export const RANGE_DAYS: Record<RangeKey, number> = {
  '1D': 1, '5D': 5, '1S': 7, '1M': 30, '3M': 90, '6M': 180, '1A': 365, '5A': 1825,
}

export const RANGE_LABEL: Record<RangeKey, string> = {
  '1D': 'hoy', '5D': '5 días', '1S': 'la semana', '1M': '30 días',
  '3M': '3 meses', '6M': '6 meses', '1A': 'el año', '5A': '5 años',
}

/**
 * Serie de patrimonio para un rango.
 *
 * Reconstruye el pasado restando los movimientos hacia atrás desde el saldo
 * actual, que es el único dato conocido con certeza. Agrupa en como mucho 60
 * puntos: cinco años en puntos diarios serían 1.825, ilegibles en un móvil y
 * lentos de dibujar.
 *
 * Los tramos anteriores al primer movimiento salen planos, y es correcto: no
 * hay información para dibujar otra cosa, e inventar una curva sería mentir.
 */
export function useBalanceSeries(range: RangeKey = '1M') {
  const { transactions } = useFinance()
  const netWorth = useNetWorth()

  return useMemo(() => {
    const days = RANGE_DAYS[range]
    const puntos = Math.min(days, 60)
    const paso = days / puntos

    // Movimientos ordenados de más reciente a más antiguo, con su marca de tiempo.
    const movs = transactions
      .map((t) => ({ at: new Date(t.occurredAt).getTime(), delta: t.type === 'income' ? t.amount : -t.amount }))
      .sort((a, b) => b.at - a.at)

    const ahora = Date.now()
    const serie: { date: string; value: number }[] = []
    let running = netWorth
    let i = 0

    for (let k = 0; k < puntos; k++) {
      const corte = ahora - k * paso * 86_400_000
      // Deshacemos todo lo ocurrido después del corte.
      while (i < movs.length && movs[i].at > corte) {
        running -= movs[i].delta
        i++
      }
      serie.unshift({ date: new Date(corte).toISOString(), value: Math.round(running) })
    }
    return serie
  }, [transactions, netWorth, range])
}

// ---- Mapeo fila <-> dominio ------------------------------------------------

type Row = Record<string, any>

const rowToAccount = (r: Row): Account => ({
  id: r.id, name: r.name, institution: r.institution, type: r.type,
  balance: Number(r.balance), currency: r.currency, color: r.color,
  apy: r.apy != null ? Number(r.apy) : undefined,
  pockets: Array.isArray(r.pockets) ? r.pockets : [],
  installments: r.installments ?? undefined,
  installmentsPaid: r.installments_paid ?? undefined,
})
const accountToRow = (a: Account) => ({
  id: a.id, name: a.name, institution: a.institution, type: a.type,
  balance: a.balance, currency: a.currency, color: a.color,
  apy: a.apy ?? null, pockets: a.pockets ?? [],
  installments: a.installments ?? null, installments_paid: a.installmentsPaid ?? null,
})
const accountPatchToRow = (p: Partial<Account>) => {
  const r: Row = {}
  if (p.name !== undefined) r.name = p.name
  if (p.institution !== undefined) r.institution = p.institution
  if (p.type !== undefined) r.type = p.type
  if (p.balance !== undefined) r.balance = p.balance
  if (p.currency !== undefined) r.currency = p.currency
  if (p.color !== undefined) r.color = p.color
  if (p.apy !== undefined) r.apy = p.apy
  if (p.pockets !== undefined) r.pockets = p.pockets
  if (p.installments !== undefined) r.installments = p.installments
  if (p.installmentsPaid !== undefined) r.installments_paid = p.installmentsPaid
  return r
}
const rowToTx = (r: Row): Transaction => ({
  id: r.id, accountId: r.account_id, pocketId: r.pocket_id ?? undefined,
  categoryId: r.category_id, amount: Number(r.amount), type: r.type,
  description: r.description ?? '', occurredAt: r.occurred_at, currency: r.currency ?? undefined,
})
const txToRow = (t: Transaction) => ({
  id: t.id, account_id: t.accountId, pocket_id: t.pocketId ?? null,
  category_id: t.categoryId, amount: t.amount, type: t.type,
  description: t.description, occurred_at: t.occurredAt, currency: t.currency ?? null,
})
const rowToHolding = (r: Row): Holding => ({
  id: r.id, symbol: r.symbol, name: r.name, quantity: Number(r.quantity),
  avgCost: Number(r.avg_cost), assetType: r.asset_type, currency: r.currency,
  accountId: r.account_id ?? undefined,
})
const holdingToRow = (h: Holding) => ({
  id: h.id, symbol: h.symbol, name: h.name, quantity: h.quantity,
  avg_cost: h.avgCost, asset_type: h.assetType, currency: h.currency,
  account_id: h.accountId ?? null,
})
const holdingPatchToRow = (p: Partial<Holding>) => {
  const r: Row = {}
  if (p.symbol !== undefined) r.symbol = p.symbol
  if (p.name !== undefined) r.name = p.name
  if (p.quantity !== undefined) r.quantity = p.quantity
  if (p.avgCost !== undefined) r.avg_cost = p.avgCost
  if (p.assetType !== undefined) r.asset_type = p.assetType
  if (p.currency !== undefined) r.currency = p.currency
  if (p.accountId !== undefined) r.account_id = p.accountId
  return r
}

const rowToGoal = (r: Row): Goal => ({
  id: r.id, name: r.name, target: Number(r.target), saved: Number(r.saved),
  currency: r.currency ?? 'COP', deadline: r.deadline ?? undefined, color: r.color,
  accountId: r.account_id ?? undefined, pocketId: r.pocket_id ?? undefined,
})
const goalToRow = (g: Goal) => ({
  id: g.id, name: g.name, target: g.target, saved: g.saved, currency: g.currency,
  deadline: g.deadline ?? null, color: g.color,
  account_id: g.accountId ?? null, pocket_id: g.pocketId ?? null,
})
const goalPatchToRow = (p: Partial<Goal>) => {
  const r: Row = {}
  if (p.name !== undefined) r.name = p.name
  if (p.target !== undefined) r.target = p.target
  if (p.saved !== undefined) r.saved = p.saved
  if (p.currency !== undefined) r.currency = p.currency
  if (p.deadline !== undefined) r.deadline = p.deadline ?? null
  if (p.color !== undefined) r.color = p.color
  if (p.accountId !== undefined) r.account_id = p.accountId ?? null
  if (p.pocketId !== undefined) r.pocket_id = p.pocketId ?? null
  return r
}
