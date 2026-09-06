'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient, isSupabaseConfigured } from './supabase/client'
import { DEMO_ACCOUNTS, DEMO_BUDGETS, DEMO_HOLDINGS, DEMO_TRANSACTIONS } from './demo-data'
import { monthKey } from './format'
import type { Account, Budget, Holding, Transaction } from './types'
import { uid } from './utils'

const STORAGE_KEY = 'eftm.state.v1'

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
  /** true = persistiendo en Supabase; false = localStorage (Modo Demo) */
  synced: boolean
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  addAccount: (acc: Omit<Account, 'id'>) => Promise<void>
  addHolding: (h: Omit<Holding, 'id'>) => Promise<void>
  deleteHolding: (id: string) => Promise<void>
  setBudget: (categoryId: string, amount: number) => void
  resetDemo: () => void
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(INITIAL)
  const [ready, setReady] = useState(false)
  const [synced, setSynced] = useState(false)

  // ---- Carga inicial -------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function load() {
      // 1) Intento remoto: solo si hay credenciales Y sesión activa.
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

      // 2) Fallback local: lo que el usuario ya tenía, o la semilla de demo.
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw && !cancelled) setState({ ...INITIAL, ...JSON.parse(raw) })
      } catch {
        /* Storage bloqueado (modo privado): seguimos con los datos en memoria. */
      }
      if (!cancelled) setReady(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Persistencia local --------------------------------------------------
  useEffect(() => {
    if (!ready || synced) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* Cuota llena o storage bloqueado: no es fatal. */
    }
  }, [state, ready, synced])

  // ---- Mutaciones ----------------------------------------------------------
  const addTransaction = useCallback(
    async (tx: Omit<Transaction, 'id'>) => {
      const full: Transaction = { ...tx, id: uid() }
      // Optimista: la UI responde al instante, la red va detrás.
      setState((s) => ({
        ...s,
        transactions: [full, ...s.transactions],
        accounts: s.accounts.map((a) =>
          a.id === full.accountId
            ? { ...a, balance: a.balance + (full.type === 'income' ? full.amount : -full.amount) }
            : a,
        ),
      }))
      if (synced) {
        const supabase = createClient()
        await supabase?.from('transactions').insert(txToRow(full))
      }
    },
    [synced],
  )

  const deleteTransaction = useCallback(
    async (id: string) => {
      setState((s) => {
        const tx = s.transactions.find((t) => t.id === id)
        if (!tx) return s
        return {
          ...s,
          transactions: s.transactions.filter((t) => t.id !== id),
          accounts: s.accounts.map((a) =>
            a.id === tx.accountId
              ? { ...a, balance: a.balance - (tx.type === 'income' ? tx.amount : -tx.amount) }
              : a,
          ),
        }
      })
      if (synced) {
        const supabase = createClient()
        await supabase?.from('transactions').delete().eq('id', id)
      }
    },
    [synced],
  )

  const addAccount = useCallback(
    async (acc: Omit<Account, 'id'>) => {
      const full: Account = { ...acc, id: uid() }
      setState((s) => ({ ...s, accounts: [...s.accounts, full] }))
      if (synced) {
        const supabase = createClient()
        await supabase?.from('accounts').insert(accountToRow(full))
      }
    },
    [synced],
  )

  const addHolding = useCallback(
    async (h: Omit<Holding, 'id'>) => {
      const full: Holding = { ...h, id: uid() }
      setState((s) => ({ ...s, holdings: [...s.holdings, full] }))
      if (synced) {
        const supabase = createClient()
        await supabase?.from('holdings').insert(holdingToRow(full))
      }
    },
    [synced],
  )

  const deleteHolding = useCallback(
    async (id: string) => {
      setState((s) => ({ ...s, holdings: s.holdings.filter((h) => h.id !== id) }))
      if (synced) {
        const supabase = createClient()
        await supabase?.from('holdings').delete().eq('id', id)
      }
    },
    [synced],
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
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* noop */
    }
  }, [])

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...state,
      ready,
      synced,
      addTransaction,
      deleteTransaction,
      addAccount,
      addHolding,
      deleteHolding,
      setBudget,
      resetDemo,
    }),
    [state, ready, synced, addTransaction, deleteTransaction, addAccount, addHolding, deleteHolding, setBudget, resetDemo],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance debe usarse dentro de <FinanceProvider>')
  return ctx
}

// ---- Selectores derivados --------------------------------------------------

export function useNetWorth() {
  const { accounts } = useFinance()
  return useMemo(() => accounts.reduce((sum, a) => sum + a.balance, 0), [accounts])
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

/** Gasto acumulado por categoría en el mes, ordenado de mayor a menor. */
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

/**
 * Serie de patrimonio para los últimos N días. Reconstruye el pasado restando
 * los movimientos hacia atrás desde el saldo actual, que es el único dato
 * que conocemos con certeza.
 */
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

      // Deshacemos el efecto de las transacciones de ese día para el punto anterior.
      transactions
        .filter((t) => new Date(t.occurredAt).toDateString() === day.toDateString())
        .forEach((t) => {
          running -= t.type === 'income' ? t.amount : -t.amount
        })
    }
    return series
  }, [transactions, netWorth, days])
}

// ---- Mapeo fila <-> dominio (snake_case en Postgres, camelCase en TS) -------

type Row = Record<string, any>

const rowToAccount = (r: Row): Account => ({
  id: r.id, name: r.name, institution: r.institution, type: r.type,
  balance: Number(r.balance), currency: r.currency, color: r.color,
})
const accountToRow = (a: Account) => ({
  id: a.id, name: a.name, institution: a.institution, type: a.type,
  balance: a.balance, currency: a.currency, color: a.color,
})
const rowToTx = (r: Row): Transaction => ({
  id: r.id, accountId: r.account_id, categoryId: r.category_id, amount: Number(r.amount),
  type: r.type, description: r.description ?? '', occurredAt: r.occurred_at,
})
const txToRow = (t: Transaction) => ({
  id: t.id, account_id: t.accountId, category_id: t.categoryId, amount: t.amount,
  type: t.type, description: t.description, occurred_at: t.occurredAt,
})
const rowToHolding = (r: Row): Holding => ({
  id: r.id, symbol: r.symbol, name: r.name, quantity: Number(r.quantity),
  avgCost: Number(r.avg_cost), assetType: r.asset_type, currency: r.currency,
})
const holdingToRow = (h: Holding) => ({
  id: h.id, symbol: h.symbol, name: h.name, quantity: h.quantity,
  avg_cost: h.avgCost, asset_type: h.assetType, currency: h.currency,
})
