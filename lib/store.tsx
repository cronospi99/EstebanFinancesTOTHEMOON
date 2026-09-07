'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, isSupabaseConfigured } from './supabase/client'
import { DEMO_ACCOUNTS, DEMO_BUDGETS, DEMO_GOALS, DEMO_HOLDINGS, DEMO_TRANSACTIONS } from './demo-data'
import { monthKey, monthlyFromApy } from './format'
import { useExchangeRate, type FxState } from './use-fx'
import { useQuotes } from './use-quotes'
import type { Account, Budget, Goal, Holding, Pocket, Quote, Transaction } from './types'
import { uid } from './utils'

const STORAGE_KEY = 'eftm.state.v2'

interface State {
  accounts: Account[]
  transactions: Transaction[]
  budgets: Budget[]
  holdings: Holding[]
  goals: Goal[]
}

/** Datos de ejemplo del Modo Demo. */
const INITIAL: State = {
  accounts: DEMO_ACCOUNTS,
  transactions: DEMO_TRANSACTIONS,
  budgets: DEMO_BUDGETS,
  holdings: DEMO_HOLDINGS,
  goals: DEMO_GOALS,
}

const VACIO: State = { accounts: [], transactions: [], budgets: [], holdings: [], goals: [] }

/**
 * Clave de almacenamiento local.
 *
 * Los datos de una sesión iniciada van bajo el id de su usuario. Compartir la
 * clave con el Modo Demo tenía dos consecuencias feas: si una carga remota
 * fallaba, la app caía al blob de demo y pintaba cuentas de ejemplo encima de
 * las de verdad; y dos personas en el mismo teléfono se veían los datos la una
 * a la otra.
 */
const claveEstado = (userId?: string | null) => (userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY)

function leerEstado(clave: string, base: State): State | null {
  try {
    const raw = localStorage.getItem(clave)
    if (!raw) return null
    const datos = JSON.parse(raw)
    if (!datos || typeof datos !== 'object') return null
    return { ...base, ...datos }
  } catch {
    // Storage bloqueado (modo privado) o contenido corrupto: se sigue en memoria.
    return null
  }
}

function guardarEstado(clave: string, state: State) {
  try {
    localStorage.setItem(clave, JSON.stringify(state))
  } catch {
    /* cuota llena */
  }
}

/**
 * Suma `delta` al saldo de una cuenta, o al del bolsillo indicado.
 *
 * Si el bolsillo no existe en esa cuenta —puede pasar al mover un movimiento
 * de una cuenta a otra— el importe cae al saldo general en vez de perderse.
 */
function aplicarDelta(
  accounts: Account[],
  accountId: string,
  pocketId: string | undefined,
  delta: number,
): Account[] {
  return accounts.map((a) => {
    if (a.id !== accountId) return a
    const pockets = a.pockets ?? []
    if (pocketId && pockets.some((p) => p.id === pocketId)) {
      return { ...a, pockets: pockets.map((p) => (p.id === pocketId ? { ...p, balance: p.balance + delta } : p)) }
    }
    return { ...a, balance: a.balance + delta }
  })
}

/** Lo que un movimiento le suma al saldo: los ingresos entran, los gastos salen. */
const deltaDe = (t: Pick<Transaction, 'type' | 'amount'>) => (t.type === 'income' ? t.amount : -t.amount)

/** Aplica al saldo de una cuenta todos sus movimientos, bolsillo por bolsillo. */
function aplicarMovimientos(accounts: Account[], transactions: Transaction[], accountId: string): Account[] {
  let salida = accounts
  for (const t of transactions) {
    if (t.accountId !== accountId) continue
    salida = aplicarDelta(salida, accountId, t.pocketId, deltaDe(t))
  }
  return salida
}

interface FinanceContextValue extends State {
  ready: boolean
  synced: boolean
  /** Hay sesión, pero la última lectura del servidor falló: se ve la copia local. */
  syncError: boolean
  /** Vuelve a pedir los datos al servidor. */
  reload: () => Promise<void>
  /** Tasa USD→COP vigente, con su procedencia. rate 0 = no se conoce. */
  fxRate: number
  fx: FxState & { refresh: () => Promise<void>; setManual: (r: number | null) => void }
  /** Cotizaciones vivas de todas las posiciones, compartidas por toda la app. */
  quotes: Record<string, Quote>
  quotesLoading: boolean
  refreshQuotes: () => Promise<void>
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id'>>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  addAccount: (acc: Omit<Account, 'id'>) => Promise<void>
  updateAccount: (id: string, patch: Partial<Account>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  /** Repara un saldo que quedó sin los movimientos ya registrados. */
  aplicarMovimientosAlSaldo: (accountId: string) => Promise<void>
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
  // Con Supabase configurado nunca se parte de los datos de ejemplo: quien
  // entra tiene sesión, y ver cuentas que no son suyas mientras carga se lee
  // como "se me borró todo".
  const [state, setState] = useState<State>(isSupabaseConfigured ? VACIO : INITIAL)
  const [ready, setReady] = useState(false)
  const [synced, setSynced] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [syncError, setSyncError] = useState(false)
  const fx = useExchangeRate()
  const fxRate = fx.rate

  // Las cotizaciones se piden aquí y no en la pantalla de inversiones para que
  // el patrimonio del resumen use el valor de mercado real. Antes solo las
  // conocía esa pantalla, así que el resumen ignoraba el portafolio entero.
  const simbolos = useMemo(() => [...new Set(state.holdings.map((h) => h.symbol))], [state.holdings])
  const { quotes, loading: quotesLoading, refresh: refreshQuotes } = useQuotes(simbolos)

  const vivo = useRef(true)
  const cargando = useRef(false)
  const ultimaCarga = useRef(0)
  // Espejo de userId legible desde `cargar`, que no se recrea nunca.
  const userIdRef = useRef<string | null>(null)

  useEffect(() => () => { vivo.current = false }, [])

  /**
   * Trae los datos del servidor.
   *
   * `pintarCache` solo en el arranque: al refrescar ya hay algo en pantalla y
   * volver a pintar la copia local haría parpadear la app.
   */
  const cargar = useCallback(async ({ pintarCache = false } = {}) => {
    if (cargando.current) return
    cargando.current = true

    try {
      if (isSupabaseConfigured) {
        const supabase = createClient()
        const { data } = (await supabase?.auth.getSession()) ?? { data: null }
        const sesion = data?.session

        if (supabase && sesion) {
          const uid = sesion.user.id
          if (!vivo.current) return
          userIdRef.current = uid
          setUserId(uid)

          // Se pinta de inmediato lo último que se supo de ESTE usuario, para
          // que la app no arranque en blanco mientras viaja la consulta.
          if (pintarCache) {
            const cache = leerEstado(claveEstado(uid), VACIO)
            if (cache) setState(cache)
          }

          const [accounts, transactions, holdings, budgets, goals] = await Promise.all([
            supabase.from('accounts').select('*').order('created_at'),
            supabase.from('transactions').select('*').order('occurred_at', { ascending: false }),
            supabase.from('holdings').select('*'),
            supabase.from('budgets').select('*'),
            supabase.from('goals').select('*'),
          ])
          if (!vivo.current) return

          if (accounts.error) {
            /*
             * La sesión es válida aunque la consulta fallara. Antes se caía al
             * Modo Demo, y ese era el fallo que hacía "vencer" los datos en
             * cada acceso: la app pintaba las cuentas de ejemplo, marcaba
             * synced = false, y a partir de ahí todo lo que el usuario tocaba
             * se guardaba solo en el teléfono —encima del blob de demo— sin
             * llegar nunca a Supabase. Las tarjetas de crédito, sus cupos y
             * sus cuotas desaparecían en la siguiente carga buena.
             *
             * Ahora se conserva la sesión: se sigue escribiendo contra el
             * servidor y en pantalla queda la copia local de este usuario.
             */
            setSynced(true)
            setSyncError(true)
            setReady(true)
            return
          }

          const remoto: State = {
            accounts: (accounts.data ?? []).map(rowToAccount),
            transactions: (transactions.data ?? []).map(rowToTx),
            holdings: (holdings.data ?? []).map(rowToHolding),
            budgets: (budgets.data ?? []).map((b) => ({ categoryId: b.category_id, amount: Number(b.amount) })),
            goals: (goals.data ?? []).map(rowToGoal),
          }
          setState(remoto)
          guardarEstado(claveEstado(uid), remoto)
          ultimaCarga.current = Date.now()
          setSynced(true)
          setSyncError(false)
          setReady(true)
          return
        }
      }

      if (!vivo.current) return

      /*
       * Sin sesión, pero ya la hubo en esta pestaña: no se degrada a Modo
       * Demo. Leer la cookie puede fallar de forma pasajera, y bajar aquí
       * marcaría synced = false y volcaría los datos del usuario sobre el blob
       * anónimo — la misma pérdida que este bloque existe para evitar. Un
       * cierre de sesión de verdad lo resuelve el middleware, que expulsa a
       * /login antes de que esto se ejecute.
       */
      if (userIdRef.current) {
        setSyncError(true)
        setReady(true)
        return
      }

      // Modo Demo: sin llaves de Supabase, o sin sesión desde el principio.
      setUserId(null)
      if (pintarCache) setState(leerEstado(STORAGE_KEY, INITIAL) ?? INITIAL)
      setSynced(false)
      setSyncError(false)
      setReady(true)
    } finally {
      cargando.current = false
    }
  }, [])

  useEffect(() => {
    cargar({ pintarCache: true })
  }, [cargar])

  /*
   * El estado se refleja en el dispositivo SIEMPRE, también con sesión
   * iniciada. Antes, al sincronizar, se dejaba de escribir en local: la copia
   * quedaba congelada en los datos de demo del primer día y cualquier carga
   * remota fallida retrocedía hasta ahí. La copia es además lo que se pinta
   * mientras llega la consulta al abrir la app.
   */
  useEffect(() => {
    if (!ready) return
    guardarEstado(claveEstado(userId), state)
  }, [state, ready, userId])

  /*
   * Al volver a primer plano se releen los datos. Una app instalada puede
   * pasar días abierta: sin esto, lo registrado en otro dispositivo no
   * aparecía nunca, y un fallo de carga al arrancar no se recuperaba solo.
   */
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      /*
       * No en cada vistazo: releer sustituye el estado por el del servidor, y
       * si el usuario acaba de registrar algo y sale y entra en un segundo, la
       * escritura puede seguir en vuelo. Refrescar ahí borraría de la pantalla
       * un movimiento que sí se está guardando. Un minuto deja terminar
       * cualquier escritura y sigue cubriendo el caso que importa: volver a
       * una app que llevaba horas abierta. Una carga fallida no marca la hora,
       * así que se reintenta en el siguiente regreso.
       */
      if (Date.now() - ultimaCarga.current < 60_000) return
      void cargar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [cargar])

  const remote = useCallback(() => (synced ? createClient() : null), [synced])

  // ---- Transacciones -------------------------------------------------------
  /**
   * Escribe en el servidor el saldo de las cuentas que un movimiento acaba de
   * mover.
   *
   * El saldo vive como una cifra en la fila de la cuenta, no como la suma de
   * los movimientos, así que insertar la fila del movimiento no lo cambia por
   * sí solo. Esta escritura faltaba: la app aplicaba el delta en memoria y
   * pintaba el saldo nuevo, pero en la siguiente carga volvía el de la base de
   * datos, intacto. Por eso el cupo de una tarjeta de crédito no se movía por
   * más gastos que se registraran, ni bajaba el saldo del banco, ni cambiaba
   * el patrimonio.
   */
  const persistirSaldos = useCallback(
    async (cuentas: Account[]) => {
      const supabase = remote()
      if (!supabase || !cuentas.length) return
      await Promise.all(
        cuentas.map((a) =>
          supabase.from('accounts').update({ balance: a.balance, pockets: a.pockets ?? [] }).eq('id', a.id),
        ),
      )
    },
    [remote],
  )

  const addTransaction = useCallback(
    async (tx: Omit<Transaction, 'id'>) => {
      const full: Transaction = { ...tx, id: uid() }
      // `aplicarDelta` devuelve la misma referencia para las cuentas que no
      // toca, así que comparar identidades basta para saber cuáles guardar.
      let tocadas: Account[] = []
      setState((s) => {
        // Si va a un bolsillo, el saldo se mueve ahí y no en el general.
        const accounts = aplicarDelta(s.accounts, full.accountId, full.pocketId, deltaDe(full))
        tocadas = accounts.filter((a, i) => a !== s.accounts[i])
        return { ...s, transactions: [full, ...s.transactions], accounts }
      })
      await Promise.all([
        remote()?.from('transactions').insert(txToRow(full)),
        persistirSaldos(tocadas),
      ])
    },
    [remote, persistirSaldos],
  )

  /**
   * Edita un movimiento ya registrado.
   *
   * El saldo se recalcula en dos pasos —deshacer el movimiento viejo, aplicar
   * el nuevo— en vez de sumar la diferencia. Es lo único que funciona cuando
   * la edición cambia de cuenta o de bolsillo: entonces el importe tiene que
   * salir de un sitio y entrar en otro, no ajustarse en el mismo.
   */
  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Omit<Transaction, 'id'>>) => {
      let tocadas: Account[] = []
      setState((s) => {
        const anterior = s.transactions.find((t) => t.id === id)
        if (!anterior) return s
        const nuevo: Transaction = { ...anterior, ...patch }

        let accounts = aplicarDelta(s.accounts, anterior.accountId, anterior.pocketId, -deltaDe(anterior))
        accounts = aplicarDelta(accounts, nuevo.accountId, nuevo.pocketId, deltaDe(nuevo))
        tocadas = accounts.filter((a, i) => a !== s.accounts[i])

        return {
          ...s,
          transactions: s.transactions.map((t) => (t.id === id ? nuevo : t)),
          accounts,
        }
      })
      await Promise.all([
        remote()?.from('transactions').update(txPatchToRow(patch)).eq('id', id),
        persistirSaldos(tocadas),
      ])
    },
    [remote, persistirSaldos],
  )

  const deleteTransaction = useCallback(
    async (id: string) => {
      let tocadas: Account[] = []
      setState((s) => {
        const tx = s.transactions.find((t) => t.id === id)
        if (!tx) return s
        const accounts = aplicarDelta(s.accounts, tx.accountId, tx.pocketId, -deltaDe(tx))
        tocadas = accounts.filter((a, i) => a !== s.accounts[i])
        return {
          ...s,
          transactions: s.transactions.filter((t) => t.id !== id),
          accounts,
        }
      })
      await Promise.all([
        remote()?.from('transactions').delete().eq('id', id),
        persistirSaldos(tocadas),
      ])
    },
    [remote, persistirSaldos],
  )

  /**
   * Vuelve a aplicar al saldo guardado todos los movimientos de una cuenta.
   *
   * Existe para reparar los datos anteriores a la corrección: durante un
   * tiempo los movimientos se guardaban pero no tocaban el saldo de su cuenta,
   * así que las tarjetas se quedaron con el cupo intacto y los bancos con el
   * saldo del día que se crearon.
   *
   * Es una acción manual, y tiene que serlo: no hay forma de saber desde el
   * código qué movimientos ya están reflejados en el saldo y cuáles no.
   * Aplicarla dos veces contaría los movimientos dos veces, así que la
   * interfaz enseña antes la cifra que quedaría.
   */
  const aplicarMovimientosAlSaldo = useCallback(
    async (accountId: string) => {
      let tocadas: Account[] = []
      setState((s) => {
        const accounts = aplicarMovimientos(s.accounts, s.transactions, accountId)
        tocadas = accounts.filter((a, i) => a !== s.accounts[i])
        return { ...s, accounts }
      })
      await persistirSaldos(tocadas)
    },
    [persistirSaldos],
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

  // Solo se ofrece en Modo Demo, donde la clave es la anónima; se nombra
  // explícita para que nunca pueda llevarse por delante los datos de un usuario.
  const resetDemo = useCallback(() => {
    setState(INITIAL)
    try { localStorage.removeItem(claveEstado(null)) } catch { /* noop */ }
  }, [])

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...state, ready, synced, syncError, reload: cargar, fxRate, fx, quotes, quotesLoading, refreshQuotes,
      addTransaction, updateTransaction, deleteTransaction,
      addAccount, updateAccount, deleteAccount, aplicarMovimientosAlSaldo,
      addPocket, updatePocket, deletePocket,
      addHolding, updateHolding, deleteHolding,
      setBudget, removeBudget, addGoal, updateGoal, deleteGoal, resetDemo,
    }),
    [state, ready, synced, syncError, cargar, fxRate, fx, quotes, quotesLoading, refreshQuotes,
     addTransaction, updateTransaction, deleteTransaction, addAccount,
     updateAccount, deleteAccount, aplicarMovimientosAlSaldo, addPocket, updatePocket, deletePocket, addHolding,
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
 * Vista previa de la reparación de saldo: qué hay hoy y qué quedaría al
 * aplicar los movimientos ya registrados de la cuenta.
 */
export function useSaldoConMovimientos(accountId: string | undefined) {
  const { accounts, transactions } = useFinance()
  return useMemo(() => {
    if (!accountId) return null
    const actual = accounts.find((a) => a.id === accountId)
    if (!actual) return null
    const movimientos = transactions.filter((t) => t.accountId === accountId)
    const propuesta = aplicarMovimientos(accounts, transactions, accountId).find((a) => a.id === accountId)!
    return {
      movimientos: movimientos.length,
      actual: accountTotal(actual),
      propuesto: accountTotal(propuesta),
    }
  }, [accounts, transactions, accountId])
}

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

/** Precio vigente de una posición: el de mercado si lo hay, si no el costo. */
export function precioDe(h: Holding, quotes: Record<string, { price: number; stale?: boolean }>) {
  const q = quotes[h.symbol]
  const live = Boolean(q && !q.stale && q.price > 0)
  return { precio: live ? q!.price : h.avgCost, live }
}

/**
 * Valor del portafolio, en su moneda y en pesos.
 *
 * Se devuelven las dos cifras a propósito. Antes, sin tasa de cambio, las
 * posiciones en dólares se descartaban y el portafolio aparecía en cero: "$0"
 * se lee como "no tienes nada", que engaña más que no convertir. Ahora, si
 * falta la tasa, la interfaz puede mostrar el total en dólares.
 */
export function useInvestmentsValue(quotesOverride?: Record<string, { price: number; stale?: boolean }>) {
  const { holdings, fxRate, quotes: ctxQuotes } = useFinance()
  const quotes = quotesOverride ?? ctxQuotes
  return useMemo(() => {
    let usd = 0, cop = 0, costUsd = 0, costCop = 0, sinConvertir = 0
    for (const h of holdings) {
      const { precio } = precioDe(h, quotes)
      const valor = precio * h.quantity
      const costo = h.avgCost * h.quantity
      if (h.currency === 'USD') {
        usd += valor
        costUsd += costo
        if (fxRate > 0) { cop += valor * fxRate; costCop += costo * fxRate }
        else sinConvertir++
      } else {
        cop += valor
        costCop += costo
      }
    }
    const value = cop
    const cost = costCop
    return {
      value, cost, usd, costUsd,
      pnl: value - cost,
      pnlPct: cost ? ((value - cost) / cost) * 100 : 0,
      pnlUsd: usd - costUsd,
      pnlPctUsd: costUsd ? ((usd - costUsd) / costUsd) * 100 : 0,
      incompleto: sinConvertir > 0,
    }
  }, [holdings, quotes, fxRate])
}

/** Valor de mercado de las posiciones de una cuenta, en pesos. */
export function useHoldingsValueByAccount() {
  const { holdings, quotes, fxRate } = useFinance()
  return useMemo(() => {
    const mapa = new Map<string, number>()
    for (const h of holdings) {
      if (!h.accountId) continue
      const { precio } = precioDe(h, quotes)
      const fx = h.currency === 'USD' ? fxRate : 1
      if (h.currency === 'USD' && fxRate <= 0) continue
      mapa.set(h.accountId, (mapa.get(h.accountId) ?? 0) + precio * h.quantity * fx)
    }
    return mapa
  }, [holdings, quotes, fxRate])
}

/**
 * Patrimonio neto en pesos. `incompleto` avisa de que hay cuentas en dólares
 * que no se pudieron convertir y quedaron fuera del total.
 */
export function useNetWorthDetail() {
  const rows = useAccountsInCOP()
  const inv = useInvestmentsValue()
  return useMemo(() => {
    let cuentas = 0, sinConvertir = 0
    for (const r of rows) {
      if (r.cop === null) sinConvertir++
      else cuentas += r.cop
    }
    if (inv.incompleto) sinConvertir++
    // El patrimonio incluye el portafolio: dejarlo fuera daba una cifra que no
    // era el patrimonio de nadie.
    return {
      total: cuentas + inv.value,
      cuentas,
      inversiones: inv.value,
      incompleto: sinConvertir > 0,
      sinConvertir,
    }
  }, [rows, inv])
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

/**
 * Cashback recibido en una cuenta, en total y en el mes en curso.
 *
 * Sale de los propios movimientos en vez de un contador aparte: así no puede
 * desincronizarse si se borra o edita un movimiento.
 */
export function useCashback(accountId?: string) {
  const { transactions } = useFinance()
  return useMemo(() => {
    const mes = monthKey()
    let total = 0, esteMes = 0
    for (const t of transactions) {
      if (t.categoryId !== 'cashback' || t.type !== 'income') continue
      if (accountId && t.accountId !== accountId) continue
      total += t.amount
      if (monthKey(t.occurredAt) === mes) esteMes += t.amount
    }
    return { total, esteMes }
  }, [transactions, accountId])
}

/**
 * Rendimiento desglosado por cuenta y bolsillo.
 *
 * La media ponderada del resumen dice cuánto rinde el conjunto, pero no cuál
 * de las cuentas lo está aportando. Este desglose ordena por lo que aporta al
 * mes, que es lo que permite decidir dónde mover el dinero.
 */
export function useYieldBreakdown() {
  const { accounts, fxRate } = useFinance()
  return useMemo(() => {
    const filas: {
      key: string
      nombre: string
      institution: string
      color: string
      apy: number
      base: number
      mensual: number
      esBolsillo: boolean
      cuenta: string
    }[] = []

    for (const a of accounts) {
      if (a.currency === 'USD' && fxRate <= 0) continue
      const fx = a.currency === 'USD' ? fxRate : 1
      if (a.apy && a.balance > 0) {
        filas.push({
          key: a.id, nombre: a.name, institution: a.institution, color: a.color,
          apy: a.apy, base: a.balance * fx, mensual: a.balance * fx * monthlyFromApy(a.apy),
          esBolsillo: false, cuenta: a.name,
        })
      }
      for (const p of a.pockets ?? []) {
        if (p.apy && p.balance > 0) {
          filas.push({
            key: `${a.id}:${p.id}`, nombre: p.name, institution: a.institution, color: p.color ?? a.color,
            apy: p.apy, base: p.balance * fx, mensual: p.balance * fx * monthlyFromApy(p.apy),
            esBolsillo: true, cuenta: a.name,
          })
        }
      }
    }
    return filas.sort((x, y) => y.mensual - x.mensual)
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
  creditLimit: r.credit_limit != null ? Number(r.credit_limit) : undefined,
  installments: r.installments ?? undefined,
  installmentsPaid: r.installments_paid ?? undefined,
})
const accountToRow = (a: Account) => ({
  id: a.id, name: a.name, institution: a.institution, type: a.type,
  balance: a.balance, currency: a.currency, color: a.color,
  apy: a.apy ?? null, pockets: a.pockets ?? [],
  credit_limit: a.creditLimit ?? null,
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
  if (p.creditLimit !== undefined) r.credit_limit = p.creditLimit
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
const txPatchToRow = (p: Partial<Transaction>) => {
  const r: Row = {}
  if (p.accountId !== undefined) r.account_id = p.accountId
  // pocketId se envía siempre que venga en el patch, incluido undefined: pasar
  // de un bolsillo al saldo general es precisamente borrar la referencia.
  if ('pocketId' in p) r.pocket_id = p.pocketId ?? null
  if (p.categoryId !== undefined) r.category_id = p.categoryId
  if (p.amount !== undefined) r.amount = p.amount
  if (p.type !== undefined) r.type = p.type
  if (p.description !== undefined) r.description = p.description
  if (p.occurredAt !== undefined) r.occurred_at = p.occurredAt
  if (p.currency !== undefined) r.currency = p.currency ?? null
  return r
}
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
