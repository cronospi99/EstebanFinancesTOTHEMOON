'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from './supabase/client'
import { DEMO_ACCOUNTS, DEMO_BUDGETS, DEMO_HOLDINGS, DEMO_TRANSACTIONS } from './demo-data'
import { monthKey, monthlyFromApy } from './format'
import { useExchangeRate } from './use-fx'
import type { Account, Budget, Holding, Pocket, Transaction } from './types'
import { uid } from './utils'

const STORAGE_KEY = 'eftm.state.v2'

interface State {
  accounts: Account[]
  transactions: Transaction[]
  budgets: Budget[]
  holdings: Holding[]
}

const INITIAL: State = {
  accounts: DEMO_ACCOUNTS,
  transactions: DEMO_TRANSACTIONS,
  budgets: DEMO_BUDGETS,
  holdings: DEMO_HOLDINGS,
}

interface FinanceContextValue extends State {
  ready: boolean
  synced: boolean
  /** Tasa USD→COP vigente y si viene de datos en vivo. */
  fxRate: number
  fxLive: boolean
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
  resetDemo: () => void
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(INITIAL)
  const [ready, setReady] = useState(false)
  const [synced, setSynced] = useState(false)
  const { rate: fxRate, live: fxLive } = useExchangeRate()

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isSupabaseConfigured) {
        const supabase = createClient()
        const { data: { session } = { session: null } } = (await supabase?.auth.getSession()) ?? {}
        if (supabase && session) {
          const [accounts, transactions, holdings, budgets] = await Promise.all([
            supabase.from('accounts').select('*').order('created_at'),
            supabase.from('transactions').select('*').order('occurred_at', { ascending: false }),
            supabase.from('holdings').select('*'),
            supabase.from('budgets').select('*'),
          ])
          if (!cancelled && !accounts.error) {
            setState({
              accounts: (accounts.data ?? []).map(rowToAccount),
              transactions: (transactions.data ?? []).map(rowToTx),
              holdings: (holdings.data ?? []).map(rowToHolding),
              budgets: (budgets.data ?? []).map((b) => ({ categoryId: b.category_id, amount: Number(b.amount) })),
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

  const setBudget = useCallback((categoryId: string, amount: number) => {
    setState((s) => ({
      ...s,
      budgets: s.budgets.some((b) => b.categoryId === categoryId)
        ? s.budgets.map((b) => (b.categoryId === categoryId ? { ...b, amount } : b))
        : [...s.budgets, { categoryId, amount }],
    }))
  }, [])

  const resetDemo = useCallback(() => {
    setState(INITIAL)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  }, [])

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...state, ready, synced, fxRate, fxLive,
      addTransaction, deleteTransaction,
      addAccount, updateAccount, deleteAccount,
      addPocket, updatePocket, deletePocket,
      addHolding, updateHolding, deleteHolding,
      setBudget, resetDemo,
    }),
    [state, ready, synced, fxRate, fxLive, addTransaction, deleteTransaction, addAccount,
     updateAccount, deleteAccount, addPocket, updatePocket, deletePocket, addHolding,
     updateHolding, deleteHolding, setBudget, resetDemo],
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

/** Convierte a pesos según la moneda de la cuenta. */
export const toCOP = (amount: number, currency: Account['currency'], fx: number) =>
  currency === 'USD' ? amount * fx : amount

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
      const fx = h.currency === 'USD' ? fxRate : 1
      value += (live ? q!.price : h.avgCost) * h.quantity * fx
      cost += h.avgCost * h.quantity * fx
    }
    return { value, cost, pnl: value - cost, pnlPct: cost ? ((value - cost) / cost) * 100 : 0 }
  }, [holdings, quotes, fxRate])
}

/** Patrimonio neto: cuentas y bolsillos, todo en pesos. */
export function useNetWorth() {
  const rows = useAccountsInCOP()
  return useMemo(() => rows.reduce((s, r) => s + r.cop, 0), [rows])
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

export function useBalanceSeries(days = 30) {
  const { transactions } = useFinance()
  const netWorth = useNetWorth()

  return useMemo(() => {
    const series: { date: string; value: number }[] = []
    let running = netWorth

    for (let i = 0; i < days; i++) {
      const day = new Date()
      day.setHours(23, 59, 59, 999)
      day.setDate(day.getDate() - i)
      series.unshift({ date: day.toISOString(), value: Math.round(running) })
      transactions
        .filter((t) => new Date(t.occurredAt).toDateString() === day.toDateString())
        .forEach((t) => { running -= t.type === 'income' ? t.amount : -t.amount })
    }
    return series
  }, [transactions, netWorth, days])
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
