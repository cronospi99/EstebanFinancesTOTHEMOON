'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, isSupabaseConfigured } from './supabase/client'
import {
  DEMO_ACCOUNTS, DEMO_ALLOCATIONS, DEMO_BUDGETS, DEMO_DEBTS, DEMO_DEBT_PAYMENTS, DEMO_GOALS,
  DEMO_HOLDINGS, DEMO_SETTINGS, DEMO_TRANSACTIONS,
} from './demo-data'
import { institutionByName } from './categories'
import { nombreVisible } from './issuers'
import { saldoDeuda, type SaldoDeuda } from './deudas'
import { monthKey, monthlyFromApy } from './format'
import { olvidarNombreGuardado } from './use-profile'
import { useExchangeRate, type FxState } from './use-fx'
import { useQuotes } from './use-quotes'
import type {
  Account, Budget, BudgetAllocation, Currency, Debt, DebtPayment, Goal, Holding, Pocket, Quote,
  Settings, Trade, Transaction,
} from './types'
import { uid } from './utils'

const STORAGE_KEY = 'eftm.state.v2'

interface State {
  accounts: Account[]
  transactions: Transaction[]
  budgets: Budget[]
  /** Dinero de cada cuenta apartado en un presupuesto. Ver types.ts. */
  allocations: BudgetAllocation[]
  holdings: Holding[]
  goals: Goal[]
  /** Libro de operaciones de inversión; la posición se deriva de él. */
  trades: Trade[]
  /** Préstamos entre personas: lo que le debes a alguien. */
  debts: Debt[]
  /** Abonos a esas deudas; el saldo se deriva de ellos. */
  debtPayments: DebtPayment[]
  settings: Settings
}

/** Datos de ejemplo del Modo Demo. */
const INITIAL: State = {
  accounts: DEMO_ACCOUNTS,
  transactions: DEMO_TRANSACTIONS,
  budgets: DEMO_BUDGETS,
  allocations: DEMO_ALLOCATIONS,
  holdings: DEMO_HOLDINGS,
  goals: DEMO_GOALS,
  trades: [],
  debts: DEMO_DEBTS,
  debtPayments: DEMO_DEBT_PAYMENTS,
  settings: DEMO_SETTINGS,
}

const VACIO: State = {
  accounts: [], transactions: [], budgets: [], allocations: [],
  holdings: [], goals: [], trades: [], debts: [], debtPayments: [], settings: {},
}

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

/** Lo que un movimiento le suma al saldo de su cuenta de origen. */
const deltaDe = (t: Pick<Transaction, 'type' | 'amount'>) => (t.type === 'income' ? t.amount : -t.amount)

/**
 * Aplica —o deshace, con `signo` a -1— un movimiento sobre los saldos.
 *
 * Existe por las transferencias, que tienen dos puntas. Antes cada mutación
 * llamaba a `aplicarDelta` una sola vez con la cuenta de origen, así que una
 * transferencia restaba de una cuenta y no sumaba en ninguna: el dinero
 * desaparecía del patrimonio. Ahora el movimiento se aplica entero o no se
 * aplica, y deshacerlo es el mismo camino con el signo cambiado.
 */
function aplicarMovimiento(accounts: Account[], t: Transaction, signo: 1 | -1): Account[] {
  let res = aplicarDelta(accounts, t.accountId, t.pocketId, signo * deltaDe(t))
  if (t.type === 'transfer' && t.toAccountId) {
    res = aplicarDelta(res, t.toAccountId, t.toPocketId, signo * t.amount)
  }
  return res
}

/**
 * Reconstruye una posición a partir de sus operaciones.
 *
 * Promedio ponderado, que es como lo calculan las corredoras: una compra suma
 * cantidad y coste; una venta baja la cantidad y retira coste al promedio
 * vigente, sin mover ese promedio. Se ordena por fecha porque el promedio
 * depende del orden: dos compras al mismo precio dan igual, pero una venta
 * entre ellas no.
 *
 * Recalcular entero en vez de aplicar deltas es lo que hace que editar una
 * operación cualquiera —incluso la primera de cinco— salga bien sin más.
 */
export function posicionDesdeOperaciones(ops: Trade[]) {
  let quantity = 0
  let costo = 0

  for (const t of [...ops].sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt))) {
    if (t.side === 'buy') {
      quantity += t.quantity
      costo += t.quantity * t.price
    } else {
      const promedio = quantity > 0 ? costo / quantity : 0
      // No se puede vender más de lo que hay: el exceso se ignora en vez de
      // dejar la posición en negativo, que no significaría nada.
      const vendida = Math.min(t.quantity, quantity)
      quantity -= vendida
      costo -= vendida * promedio
    }
  }

  // Redondeo de la basura de coma flotante: 3 − 1 − 2 debe dar 0, no 4e-16.
  if (Math.abs(quantity) < 1e-8) quantity = 0
  return { quantity, avgCost: quantity > 0 ? costo / quantity : 0 }
}

/**
 * Deja la posición de un símbolo de acuerdo con su libro de operaciones.
 *
 * Los datos descriptivos —nombre, plataforma, tipo de activo, moneda— salen de
 * la operación más reciente: si la última compra fue en Trii, la posición vive
 * en Trii. Si el libro se queda sin operaciones la posición baja a cero en vez
 * de borrarse, para no perder el rastro de algo que sí se tuvo.
 */
function sincronizarPosicion(holdings: Holding[], trades: Trade[], symbol: string): Holding[] {
  const ops = trades.filter((t) => t.symbol === symbol)
  const { quantity, avgCost } = posicionDesdeOperaciones(ops)
  const ultima = [...ops].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))[0]
  const i = holdings.findIndex((h) => h.symbol === symbol)

  if (i === -1) {
    if (!ultima || quantity <= 0) return holdings
    return [...holdings, {
      id: uid(),
      symbol,
      name: ultima.name || symbol,
      quantity,
      avgCost,
      assetType: ultima.assetType,
      currency: ultima.currency,
      accountId: ultima.accountId,
    }]
  }

  return holdings.map((h, k) => (k === i
    ? {
        ...h,
        quantity,
        avgCost,
        // El nombre solo se pisa si la operación trae uno de verdad: cuando la
        // búsqueda del ticker falla se guarda el propio símbolo, y eso no debe
        // borrar un «Vanguard S&P 500 ETF» que ya estaba bien.
        ...(ultima
          ? {
              name: ultima.name && ultima.name !== symbol ? ultima.name : h.name,
              assetType: ultima.assetType,
              currency: ultima.currency,
              accountId: ultima.accountId,
            }
          : null),
      }
    : h))
}

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
  /** Proveedores que fallaron en la última consulta de precios. */
  quotesFallos: string[]
  refreshQuotes: () => Promise<void>
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id'>>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  addAccount: (acc: Omit<Account, 'id'>) => Promise<void>
  updateAccount: (id: string, patch: Partial<Account>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  /** Repara un saldo que quedó sin los movimientos ya registrados. */
  aplicarMovimientosAlSaldo: (accountId: string) => Promise<void>
  /** Id de la cuenta de una plataforma de inversión; la crea si hace falta. */
  asegurarPlataforma: (institution: string) => Promise<string>
  /** Id de la cuenta de efectivo de una moneda; la crea si hace falta. */
  asegurarEfectivo: (currency: Currency) => Promise<string>
  addPocket: (accountId: string, pocket: Omit<Pocket, 'id'>) => Promise<void>
  updatePocket: (accountId: string, pocketId: string, patch: Partial<Pocket>) => Promise<void>
  deletePocket: (accountId: string, pocketId: string) => Promise<void>
  addHolding: (h: Omit<Holding, 'id'>) => Promise<void>
  updateHolding: (id: string, patch: Partial<Holding>) => Promise<void>
  deleteHolding: (id: string) => Promise<void>
  /** Registra una compra o una venta y recalcula la posición. */
  registrarOperacion: (op: Omit<Trade, 'id'>) => Promise<void>
  updateTrade: (id: string, patch: Partial<Omit<Trade, 'id'>>) => Promise<void>
  deleteTrade: (id: string) => Promise<void>
  setBudget: (categoryId: string, amount: number, dailyCap?: number | null) => void
  removeBudget: (categoryId: string) => void
  /**
   * Aparta dinero de una cuenta en un presupuesto, o lo devuelve con un
   * importe negativo. No mueve el saldo de la cuenta: solo deja de estar libre.
   */
  asignarABolsillo: (a: { categoryId: string; accountId?: string; amount: number; note?: string }) => Promise<void>
  /** Deshace una asignación concreta. */
  quitarAsignacion: (id: string) => Promise<void>
  /** Tope de gasto diario global. `null` lo quita. */
  setDailyCap: (amount: number | null) => void
  addGoal: (g: Omit<Goal, 'id'>) => Promise<void>
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  addDebt: (d: Omit<Debt, 'id'>) => Promise<void>
  updateDebt: (id: string, patch: Partial<Debt>) => Promise<void>
  /** Borra la deuda y, con ella, sus abonos. */
  deleteDebt: (id: string) => Promise<void>
  abonarDeuda: (a: Omit<DebtPayment, 'id'>) => Promise<void>
  deleteDebtPayment: (id: string) => Promise<void>
  resetDemo: () => void
  /** Cierra la sesión y borra de este dispositivo lo que era del usuario. */
  signOut: () => Promise<void>
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
  const { quotes, loading: quotesLoading, fallos: quotesFallos, refresh: refreshQuotes } = useQuotes(simbolos)

  // Espejo del estado para los callbacks estables, que no lo tienen en su
  // clausura pero necesitan consultarlo (no para renderizar).
  const stateRef = useRef(state)
  stateRef.current = state

  const vivo = useRef(true)
  const cargando = useRef(false)
  // Se levanta al cerrar sesión: a partir de ahí nada vuelve a escribir la
  // copia local, que es justo lo que se acaba de borrar.
  const cerrandoSesion = useRef(false)
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

          const [accounts, transactions, holdings, budgets, goals, trades, allocations, settings,
                 debts, debtPayments] =
            await Promise.all([
              supabase.from('accounts').select('*').order('created_at'),
              supabase.from('transactions').select('*').order('occurred_at', { ascending: false }),
              supabase.from('holdings').select('*'),
              supabase.from('budgets').select('*'),
              supabase.from('goals').select('*'),
              supabase.from('trades').select('*').order('occurred_at', { ascending: false }),
              supabase.from('budget_allocations').select('*').order('created_at'),
              supabase.from('settings').select('*').maybeSingle(),
              supabase.from('debts').select('*').order('started_at'),
              supabase.from('debt_payments').select('*').order('occurred_at'),
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
            budgets: (budgets.data ?? []).map((b) => ({
              categoryId: b.category_id,
              amount: Number(b.amount),
              dailyCap: b.daily_cap == null ? undefined : Number(b.daily_cap),
            })),
            goals: (goals.data ?? []).map(rowToGoal),
            // Si la tabla `trades` aún no existe en el proyecto, la consulta
            // falla sola y el resto de la app sigue funcionando sin historial.
            trades: trades.error ? [] : (trades.data ?? []).map(rowToTrade),
            // Igual con las dos últimas: quien no haya corrido todavía la
            // migración de bolsillos ve la app entera menos los bolsillos, en
            // vez de una pantalla en blanco.
            allocations: allocations.error ? [] : (allocations.data ?? []).map(rowToAllocation),
            // Y con las deudas: quien no haya corrido todavía su migración ve
            // la app entera menos las deudas.
            debts: debts.error ? [] : (debts.data ?? []).map(rowToDebt),
            debtPayments: debtPayments.error ? [] : (debtPayments.data ?? []).map(rowToDebtPayment),
            settings: settings.error || !settings.data
              ? {}
              : { dailyCap: settings.data.daily_cap == null ? undefined : Number(settings.data.daily_cap) },
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
    if (!ready || cerrandoSesion.current) return
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
        // Si va a un bolsillo, el saldo se mueve ahí y no en el general. Y si
        // es una transferencia, se mueve también en la cuenta de destino.
        const accounts = aplicarMovimiento(s.accounts, full, 1)
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

        let accounts = aplicarMovimiento(s.accounts, anterior, -1)
        accounts = aplicarMovimiento(accounts, nuevo, 1)
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
        const accounts = aplicarMovimiento(s.accounts, tx, -1)
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

  /**
   * Id de la cuenta de una plataforma de inversión, creándola si no existe.
   *
   * Una posición apunta a una cuenta, pero exigir que el usuario cree a mano
   * la cuenta de ARQ antes de poder registrar lo que tiene en ARQ es papeleo
   * sin motivo: la plataforma se elige de una lista cerrada y su cuenta
   * aparece sola. Nace con saldo cero porque el valor lo llevan las
   * posiciones; el saldo es el efectivo sin invertir, y ese lo pone el usuario
   * si quiere.
   */
  const asegurarPlataforma = useCallback(
    async (institution: string) => {
      const ya = stateRef.current.accounts.find(
        (a) => a.type === 'investment' && a.institution === institution,
      )
      if (ya) return ya.id

      const full: Account = {
        id: uid(),
        name: institution,
        institution,
        type: 'investment',
        balance: 0,
        currency: 'COP',
        color: institutionByName(institution)?.color ?? '#0A84FF',
        pockets: [],
      }
      setState((s) => ({ ...s, accounts: [...s.accounts, full] }))
      await remote()?.from('accounts').insert(accountToRow(full))
      return full.id
    },
    [remote],
  )

  /**
   * Id de la cuenta de efectivo, creándola si no existe.
   *
   * Sacar plata del banco es de lo más corriente que hay, y hasta ahora no se
   * podía registrar sin antes ir a Cuentas, crear a mano una cuenta llamada
   * «Efectivo» y volver. La cuenta de efectivo no tiene banco detrás ni datos
   * que pedir —es el bolsillo del pantalón—, así que no hay nada que preguntar:
   * aparece sola al primer retiro.
   *
   * Una por moneda: los dólares en efectivo no son los mismos pesos en
   * efectivo, y mezclarlos en una sola cuenta daría un saldo que no es de nadie.
   */
  const asegurarEfectivo = useCallback(
    async (currency: Currency) => {
      const ya = stateRef.current.accounts.find((a) => a.type === 'cash' && a.currency === currency)
      if (ya) return ya.id

      const full: Account = {
        id: uid(),
        name: currency === 'USD' ? 'Efectivo USD' : 'Efectivo',
        institution: 'Efectivo',
        type: 'cash',
        balance: 0,
        currency,
        color: institutionByName('Efectivo')?.color ?? '#30D158',
        pockets: [],
      }
      setState((s) => ({ ...s, accounts: [...s.accounts, full] }))
      await remote()?.from('accounts').insert(accountToRow(full))
      return full.id
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

  const persistirPosicion = useCallback(
    async (holding: Holding | undefined) => {
      if (!holding) return
      await remote()?.from('holdings').upsert(holdingToRow(holding))
    },
    [remote],
  )

  /**
   * Registra una compra o una venta y deja la posición al día.
   *
   * Si el símbolo ya tenía posición pero ninguna operación —porque se creó
   * antes de que existiera el libro— se añade primero una operación de
   * apertura que la explique. Sin ella el recálculo arrancaría de cero y la
   * posición encogería hasta el tamaño de lo que se acaba de registrar.
   */
  const registrarOperacion = useCallback(
    async (op: Omit<Trade, 'id'>) => {
      const previo = stateRef.current
      const nuevas: Trade[] = []

      const sinLibro = !previo.trades.some((t) => t.symbol === op.symbol)
      const posicion = previo.holdings.find((h) => h.symbol === op.symbol)
      if (sinLibro && posicion && posicion.quantity > 0) {
        nuevas.push({
          id: uid(),
          symbol: posicion.symbol,
          name: posicion.name,
          side: 'buy',
          quantity: posicion.quantity,
          price: posicion.avgCost,
          currency: posicion.currency,
          assetType: posicion.assetType,
          accountId: posicion.accountId,
          // Un segundo antes de lo que se registra ahora, para que el
          // recálculo la vea primero pase lo que pase con la fecha elegida.
          occurredAt: new Date(Date.parse(op.occurredAt) - 1000).toISOString(),
          opening: true,
        })
      }
      nuevas.push({ ...op, id: uid() })

      let posicionFinal: Holding | undefined
      setState((s) => {
        const trades = [...nuevas, ...s.trades]
        const holdings = sincronizarPosicion(s.holdings, trades, op.symbol)
        posicionFinal = holdings.find((h) => h.symbol === op.symbol)
        return { ...s, trades, holdings }
      })

      await Promise.all([
        remote()?.from('trades').insert(nuevas.map(tradeToRow)),
        persistirPosicion(posicionFinal),
      ])
    },
    [remote, persistirPosicion],
  )

  const updateTrade = useCallback(
    async (id: string, patch: Partial<Omit<Trade, 'id'>>) => {
      let posicionFinal: Holding | undefined
      let symbol = ''
      setState((s) => {
        const anterior = s.trades.find((t) => t.id === id)
        if (!anterior) return s
        symbol = anterior.symbol
        const trades = s.trades.map((t) => (t.id === id ? { ...t, ...patch } : t))
        // Editar no puede cambiar de símbolo: sería mover la operación a otra
        // posición, y eso es borrarla de una y crearla en la otra.
        const holdings = sincronizarPosicion(s.holdings, trades, symbol)
        posicionFinal = holdings.find((h) => h.symbol === symbol)
        return { ...s, trades, holdings }
      })
      if (!symbol) return
      await Promise.all([
        remote()?.from('trades').update(tradePatchToRow(patch)).eq('id', id),
        persistirPosicion(posicionFinal),
      ])
    },
    [remote, persistirPosicion],
  )

  const deleteTrade = useCallback(
    async (id: string) => {
      let posicionFinal: Holding | undefined
      let symbol = ''
      setState((s) => {
        const anterior = s.trades.find((t) => t.id === id)
        if (!anterior) return s
        symbol = anterior.symbol
        const trades = s.trades.filter((t) => t.id !== id)
        const holdings = sincronizarPosicion(s.holdings, trades, symbol)
        posicionFinal = holdings.find((h) => h.symbol === symbol)
        return { ...s, trades, holdings }
      })
      if (!symbol) return
      await Promise.all([
        remote()?.from('trades').delete().eq('id', id),
        persistirPosicion(posicionFinal),
      ])
    },
    [remote, persistirPosicion],
  )

  /**
   * Crea o cambia el presupuesto de una categoría.
   *
   * `dailyCap` sin pasar deja el tope diario como estaba; `null` lo quita. Con
   * `undefined` a secas no se podría distinguir «no lo toques» de «bórralo», y
   * editar solo el importe del mes se llevaría por delante el tope del día.
   */
  const setBudget = useCallback(
    (categoryId: string, amount: number, dailyCap?: number | null) => {
      let capFinal: number | undefined
      setState((s) => {
        const previo = s.budgets.find((b) => b.categoryId === categoryId)
        capFinal = dailyCap === undefined ? previo?.dailyCap : (dailyCap ?? undefined)
        const actualizado: Budget = { categoryId, amount, dailyCap: capFinal }
        return {
          ...s,
          budgets: previo
            ? s.budgets.map((b) => (b.categoryId === categoryId ? actualizado : b))
            : [...s.budgets, actualizado],
        }
      })
      remote()?.from('budgets').upsert(
        { category_id: categoryId, amount, daily_cap: capFinal ?? null },
        { onConflict: 'user_id,category_id' },
      ).then(() => {}, () => {})
    },
    [remote],
  )

  const removeBudget = useCallback(
    (categoryId: string) => {
      // Se van también sus asignaciones: dejarlas huérfanas seguiría restando
      // del disponible de las cuentas por un bolsillo que ya no existe.
      setState((s) => ({
        ...s,
        budgets: s.budgets.filter((b) => b.categoryId !== categoryId),
        allocations: s.allocations.filter((a) => a.categoryId !== categoryId),
      }))
      remote()?.from('budgets').delete().eq('category_id', categoryId).then(() => {}, () => {})
      remote()?.from('budget_allocations').delete().eq('category_id', categoryId).then(() => {}, () => {})
    },
    [remote],
  )

  // ---- Bolsillos virtuales -------------------------------------------------

  const asignarABolsillo = useCallback(
    async (a: { categoryId: string; accountId?: string; amount: number; note?: string }) => {
      if (!a.amount) return
      const fila: BudgetAllocation = { ...a, id: uid(), createdAt: new Date().toISOString() }
      setState((s) => ({ ...s, allocations: [...s.allocations, fila] }))
      await remote()?.from('budget_allocations').insert(allocationToRow(fila))
    },
    [remote],
  )

  const quitarAsignacion = useCallback(
    async (id: string) => {
      setState((s) => ({ ...s, allocations: s.allocations.filter((a) => a.id !== id) }))
      await remote()?.from('budget_allocations').delete().eq('id', id)
    },
    [remote],
  )

  const setDailyCap = useCallback(
    (amount: number | null) => {
      setState((s) => ({ ...s, settings: { ...s.settings, dailyCap: amount ?? undefined } }))
      remote()?.from('settings').upsert(
        { daily_cap: amount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      ).then(() => {}, () => {})
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

  // ---- Deudas personales ---------------------------------------------------
  const addDebt = useCallback(
    async (d: Omit<Debt, 'id'>) => {
      const full: Debt = { ...d, id: uid() }
      setState((s) => ({ ...s, debts: [...s.debts, full] }))
      await remote()?.from('debts').insert(debtToRow(full))
    },
    [remote],
  )

  const updateDebt = useCallback(
    async (id: string, patch: Partial<Debt>) => {
      setState((s) => ({ ...s, debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) }))
      await remote()?.from('debts').update(debtPatchToRow(patch)).eq('id', id)
    },
    [remote],
  )

  const deleteDebt = useCallback(
    async (id: string) => {
      // Los abonos se van con ella también en local: en el servidor lo hace la
      // clave foránea en cascada, y si aquí se quedaran, volverían a aparecer
      // al crear otra deuda que reutilizara el id.
      setState((s) => ({
        ...s,
        debts: s.debts.filter((d) => d.id !== id),
        debtPayments: s.debtPayments.filter((p) => p.debtId !== id),
      }))
      await remote()?.from('debts').delete().eq('id', id)
    },
    [remote],
  )

  const abonarDeuda = useCallback(
    async (a: Omit<DebtPayment, 'id'>) => {
      const full: DebtPayment = { ...a, id: uid() }
      setState((s) => ({ ...s, debtPayments: [...s.debtPayments, full] }))
      await remote()?.from('debt_payments').insert(debtPaymentToRow(full))
    },
    [remote],
  )

  const deleteDebtPayment = useCallback(
    async (id: string) => {
      setState((s) => ({ ...s, debtPayments: s.debtPayments.filter((p) => p.id !== id) }))
      await remote()?.from('debt_payments').delete().eq('id', id)
    },
    [remote],
  )

  // Solo se ofrece en Modo Demo, donde la clave es la anónima; se nombra
  // explícita para que nunca pueda llevarse por delante los datos de un usuario.
  const resetDemo = useCallback(() => {
    setState(INITIAL)
    try { localStorage.removeItem(claveEstado(null)) } catch { /* noop */ }
  }, [])

  /**
   * Cerrar sesión.
   *
   * Además de invalidar el token, se lleva del teléfono la copia local de este
   * usuario y su nombre: en un dispositivo compartido, dejar ahí las cuentas y
   * los movimientos convertiría "salir" en un gesto sin efecto. En la cuenta
   * no se toca nada, así que al volver a entrar está todo.
   *
   * No cambia el estado de React a propósito: quien llama navega a /login con
   * una carga completa, y vaciar la pantalla antes solo enseñaría un resumen
   * en ceros durante el trayecto.
   */
  const signOut = useCallback(async () => {
    cerrandoSesion.current = true
    // Nada de lo que siga en vuelo puede volver a pintar ni a guardar.
    vivo.current = false

    // No se llama `uid`: ese nombre ya es el generador de identificadores.
    const usuario = userIdRef.current
    userIdRef.current = null

    try {
      // 'local' cierra solo este dispositivo: los demás donde haya sesión
      // iniciada siguen como estaban.
      await createClient()?.auth.signOut({ scope: 'local' })
    } catch {
      /* Sin red el token sigue vivo en el servidor, pero las cookies y el
         almacenamiento del cliente se limpian igual, que es lo que decide si
         esta app te reconoce. El middleware mandará a /login. */
    }

    try {
      if (usuario) localStorage.removeItem(claveEstado(usuario))
    } catch { /* noop */ }
    olvidarNombreGuardado()
  }, [])

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...state, ready, synced, syncError, reload: cargar, fxRate, fx, quotes, quotesLoading, quotesFallos, refreshQuotes,
      addTransaction, updateTransaction, deleteTransaction,
      addAccount, updateAccount, deleteAccount, aplicarMovimientosAlSaldo, asegurarPlataforma,
      asegurarEfectivo,
      addPocket, updatePocket, deletePocket,
      addHolding, updateHolding, deleteHolding,
      registrarOperacion, updateTrade, deleteTrade,
      setBudget, removeBudget, asignarABolsillo, quitarAsignacion, setDailyCap,
      addGoal, updateGoal, deleteGoal, resetDemo, signOut,
      addDebt, updateDebt, deleteDebt, abonarDeuda, deleteDebtPayment,
    }),
    [state, ready, synced, syncError, cargar, fxRate, fx, quotes, quotesLoading, quotesFallos, refreshQuotes,
     addTransaction, updateTransaction, deleteTransaction, addAccount,
     updateAccount, deleteAccount, aplicarMovimientosAlSaldo, asegurarPlataforma, asegurarEfectivo,
     addPocket, updatePocket, deletePocket, addHolding,
     updateHolding, deleteHolding, registrarOperacion, updateTrade, deleteTrade,
     setBudget, removeBudget, asignarABolsillo, quitarAsignacion, setDailyCap,
     addGoal, updateGoal, deleteGoal, resetDemo, signOut,
     addDebt, updateDebt, deleteDebt, abonarDeuda, deleteDebtPayment],
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

/**
 * Historial de operaciones agrupado por símbolo.
 *
 * Cada grupo va de la operación más reciente a la más antigua, y los grupos se
 * ordenan por su última operación: lo que se acaba de mover, primero.
 */
export function useOperacionesPorSimbolo() {
  const { trades, holdings } = useFinance()
  return useMemo(() => {
    const mapa = new Map<string, Trade[]>()
    for (const t of trades) mapa.set(t.symbol, [...(mapa.get(t.symbol) ?? []), t])

    return [...mapa.entries()]
      .map(([symbol, ops]) => {
        const operaciones = [...ops].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))
        return {
          symbol,
          nombre: nombreVisible(symbol, holdings.find((h) => h.symbol === symbol)?.name || operaciones[0].name),
          operaciones,
          ...posicionDesdeOperaciones(ops),
        }
      })
      .sort((a, b) => +new Date(b.operaciones[0].occurredAt) - +new Date(a.operaciones[0].occurredAt))
  }, [trades, holdings])
}

/** Operaciones de un símbolo, de más reciente a más antigua. */
export function useOperacionesDe(symbol: string | undefined) {
  const { trades } = useFinance()
  return useMemo(
    () => (symbol
      ? trades.filter((t) => t.symbol === symbol).sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))
      : []),
    [trades, symbol],
  )
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

/** Null se propaga: una deuda en dólares sin tasa no se puede convertir. */
const redondeaPesos = (v: number | null) => (v === null ? null : Math.round(v))

export interface DeudaConSaldo extends SaldoDeuda {
  deuda: Debt
  /** Sus abonos, del más reciente al más antiguo. */
  abonos: DebtPayment[]
  /** El saldo pendiente en pesos, o null si está en dólares y falta la tasa. */
  saldoCOP: number | null
}

/**
 * Las deudas con su saldo ya calculado, las saldadas al final.
 *
 * El cálculo vive aquí y no en cada pantalla porque el saldo de una deuda con
 * interés no es una resta: depende de las fechas de los abonos. Ver `deudas.ts`.
 */
export function useDeudas(): DeudaConSaldo[] {
  const { debts, debtPayments, fxRate } = useFinance()
  return useMemo(() => {
    const porDeuda = new Map<string, DebtPayment[]>()
    for (const p of debtPayments) {
      const lista = porDeuda.get(p.debtId)
      if (lista) lista.push(p)
      else porDeuda.set(p.debtId, [p])
    }

    return debts
      .map((deuda) => {
        const abonos = porDeuda.get(deuda.id) ?? []
        const saldo = saldoDeuda(deuda, abonos)
        return {
          deuda,
          ...saldo,
          abonos: [...abonos].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
          // A pesos enteros: el interés sale con decimales y de aquí pasa al
          // patrimonio, que es una cifra que nadie quiere ver con centavos.
          saldoCOP: redondeaPesos(toCOP(saldo.saldo, deuda.currency, fxRate)),
        }
      })
      // Lo que aún se debe primero y por tamaño; lo saldado baja al fondo, que
      // es donde se consulta y no donde estorba.
      .sort((a, b) => Number(a.saldada) - Number(b.saldada) || b.saldo - a.saldo)
  }, [debts, debtPayments, fxRate])
}

/** Lo que se debe en total, en pesos. */
export function useDeudaTotal() {
  const deudas = useDeudas()
  return useMemo(() => {
    let total = 0, sinConvertir = 0
    for (const d of deudas) {
      if (d.saldoCOP === null) sinConvertir++
      else total += d.saldoCOP
    }
    return { total, sinConvertir, cuantas: deudas.filter((d) => !d.saldada).length }
  }, [deudas])
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
    /*
     * El patrimonio incluye el portafolio: dejarlo fuera daba una cifra que no
     * era el patrimonio de nadie.
     *
     * Lo que se debe a personas NO se descuenta aquí, y es a propósito. Son dos
     * preguntas distintas: cuánto tienes y cuánto debes. Restarlas mezcla el
     * dinero que está en las cuentas con una obligación que se irá pagando
     * desde esas mismas cuentas —cada abono ya baja el saldo de la cuenta de la
     * que sale, así que descontarlo además del total lo contaría dos veces por
     * el camino—. La deuda se enseña como su propio bloque, en el resumen y en
     * Cuentas, para que se vea sin quedar enterrada en una resta.
     */
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

/** Día local en formato YYYY-MM-DD, que es como se comparan dos fechas aquí. */
const diaKey = (iso: string | Date = new Date()) => {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Gasto de hoy, en total y por categoría.
 *
 * Es lo que miden los topes diarios. Va aparte de `useSpendByCategory` porque
 * el mes y el día responden a preguntas distintas: uno dice si el presupuesto
 * aguanta, el otro si hoy ya conviene parar.
 */
export function useSpendToday() {
  const { transactions } = useFinance()
  return useMemo(() => {
    const hoy = diaKey()
    const porCategoria = new Map<string, number>()
    let total = 0
    for (const t of transactions) {
      if (t.type !== 'expense' || diaKey(t.occurredAt) !== hoy) continue
      total += t.amount
      porCategoria.set(t.categoryId, (porCategoria.get(t.categoryId) ?? 0) + t.amount)
    }
    return { total, porCategoria }
  }, [transactions])
}

/**
 * Cuánto tiene apartado cada cuenta en bolsillos.
 *
 * Es lo que separa el saldo total del disponible. Las asignaciones que
 * perdieron su cuenta —porque se borró— no cuentan para ninguna: siguen siendo
 * dinero del presupuesto, pero ya no restan de ningún saldo.
 */
export function useAllocatedByAccount() {
  const { allocations } = useFinance()
  return useMemo(() => {
    const mapa = new Map<string, number>()
    for (const a of allocations) {
      if (!a.accountId) continue
      mapa.set(a.accountId, (mapa.get(a.accountId) ?? 0) + a.amount)
    }
    return mapa
  }, [allocations])
}

/**
 * Saldo disponible de una cuenta: el total menos lo que tiene apartado.
 *
 * El total no se toca nunca al asignar —tiene que seguir cuadrando con el
 * banco al céntimo—, así que la parte apartada se descuenta aquí, al mirar.
 */
export function useAccountsAvailable() {
  const { accounts } = useFinance()
  const apartado = useAllocatedByAccount()
  return useMemo(() => {
    const mapa = new Map<string, { total: number; apartado: number; libre: number }>()
    for (const a of accounts) {
      const total = accountTotal(a)
      const ap = apartado.get(a.id) ?? 0
      mapa.set(a.id, { total, apartado: ap, libre: total - ap })
    }
    return mapa
  }, [accounts, apartado])
}

export interface Bolsillo {
  categoryId: string
  /** Tope del mes. */
  amount: number
  dailyCap?: number
  /** Dinero apartado desde cuentas. */
  asignado: number
  /** Gasto del mes en la categoría. */
  gastado: number
  /** Gasto de hoy, para el tope diario. */
  hoy: number
  /** Lo que queda del dinero apartado. Negativo = se gastó más de lo apartado. */
  disponible: number
  /** De qué cuentas salió, con cuánto de cada una. */
  origenes: { accountId?: string; amount: number }[]
}

/**
 * Los presupuestos con su bolsillo: cuánto se apartó, de dónde y qué queda.
 *
 * Un gasto consume el bolsillo de su categoría sin que nadie lo registre
 * aquí: `disponible` se deriva restando el gasto del mes a lo asignado. Así no
 * hay dos verdades que puedan discrepar, y una transacción borrada devuelve
 * su dinero al bolsillo sola.
 */
export function useBolsillos(): Bolsillo[] {
  const { budgets, allocations } = useFinance()
  const mes = useSpendByCategory()
  const { porCategoria: hoy } = useSpendToday()

  return useMemo(() => {
    const porCategoria = new Map<string, BudgetAllocation[]>()
    for (const a of allocations) {
      porCategoria.set(a.categoryId, [...(porCategoria.get(a.categoryId) ?? []), a])
    }

    return budgets.map((b) => {
      const filas = porCategoria.get(b.categoryId) ?? []
      const asignado = filas.reduce((t, a) => t + a.amount, 0)
      const gastado = mes.find((m) => m.categoryId === b.categoryId)?.amount ?? 0

      // Agrupado por cuenta: cinco abonos desde Nequi son una línea, no cinco.
      const porCuenta = new Map<string, number>()
      for (const a of filas) {
        const clave = a.accountId ?? '__sin'
        porCuenta.set(clave, (porCuenta.get(clave) ?? 0) + a.amount)
      }

      return {
        categoryId: b.categoryId,
        amount: b.amount,
        dailyCap: b.dailyCap,
        asignado,
        gastado,
        hoy: hoy.get(b.categoryId) ?? 0,
        disponible: asignado - gastado,
        origenes: [...porCuenta.entries()]
          .filter(([, amount]) => amount !== 0)
          .map(([k, amount]) => ({ accountId: k === '__sin' ? undefined : k, amount }))
          .sort((a, b2) => b2.amount - a.amount),
      }
    })
  }, [budgets, allocations, mes, hoy])
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
  toAccountId: r.to_account_id ?? undefined, toPocketId: r.to_pocket_id ?? undefined,
  categoryId: r.category_id, amount: Number(r.amount), type: r.type,
  description: r.description ?? '', occurredAt: r.occurred_at, currency: r.currency ?? undefined,
})
const txToRow = (t: Transaction) => ({
  id: t.id, account_id: t.accountId, pocket_id: t.pocketId ?? null,
  to_account_id: t.toAccountId ?? null, to_pocket_id: t.toPocketId ?? null,
  category_id: t.categoryId, amount: t.amount, type: t.type,
  description: t.description, occurred_at: t.occurredAt, currency: t.currency ?? null,
})
const txPatchToRow = (p: Partial<Transaction>) => {
  const r: Row = {}
  if (p.accountId !== undefined) r.account_id = p.accountId
  // pocketId se envía siempre que venga en el patch, incluido undefined: pasar
  // de un bolsillo al saldo general es precisamente borrar la referencia.
  if ('pocketId' in p) r.pocket_id = p.pocketId ?? null
  if ('toAccountId' in p) r.to_account_id = p.toAccountId ?? null
  if ('toPocketId' in p) r.to_pocket_id = p.toPocketId ?? null
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

const rowToTrade = (r: Row): Trade => ({
  id: r.id, symbol: r.symbol, name: r.name ?? '', side: r.side,
  quantity: Number(r.quantity), price: Number(r.price),
  currency: r.currency, assetType: r.asset_type,
  accountId: r.account_id ?? undefined,
  occurredAt: r.occurred_at, opening: Boolean(r.opening),
})
const tradeToRow = (t: Trade) => ({
  id: t.id, symbol: t.symbol, name: t.name, side: t.side,
  quantity: t.quantity, price: t.price, currency: t.currency, asset_type: t.assetType,
  account_id: t.accountId ?? null, opening: t.opening ?? false, occurred_at: t.occurredAt,
})
const tradePatchToRow = (p: Partial<Trade>) => {
  const r: Row = {}
  if (p.symbol !== undefined) r.symbol = p.symbol
  if (p.name !== undefined) r.name = p.name
  if (p.side !== undefined) r.side = p.side
  if (p.quantity !== undefined) r.quantity = p.quantity
  if (p.price !== undefined) r.price = p.price
  if (p.currency !== undefined) r.currency = p.currency
  if (p.assetType !== undefined) r.asset_type = p.assetType
  if ('accountId' in p) r.account_id = p.accountId ?? null
  if (p.occurredAt !== undefined) r.occurred_at = p.occurredAt
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

const rowToDebt = (r: Row): Debt => ({
  id: r.id, person: r.person, principal: Number(r.principal),
  currency: r.currency ?? 'COP',
  rate: r.rate == null ? undefined : Number(r.rate),
  startedAt: String(r.started_at).slice(0, 10),
  dueDate: r.due_date ?? undefined,
  note: r.note ?? undefined,
  color: r.color,
})
const debtToRow = (d: Debt) => ({
  id: d.id, person: d.person, principal: d.principal, currency: d.currency,
  rate: d.rate ?? null, started_at: d.startedAt, due_date: d.dueDate ?? null,
  note: d.note ?? null, color: d.color,
})
const debtPatchToRow = (p: Partial<Debt>) => {
  const r: Row = {}
  if (p.person !== undefined) r.person = p.person
  if (p.principal !== undefined) r.principal = p.principal
  if (p.currency !== undefined) r.currency = p.currency
  // `rate` con 'in' y no con !== undefined: quitarle el interés a una deuda es
  // ponerlo a undefined, y eso tiene que llegar al servidor como null.
  if ('rate' in p) r.rate = p.rate ?? null
  if (p.startedAt !== undefined) r.started_at = p.startedAt
  if ('dueDate' in p) r.due_date = p.dueDate ?? null
  if ('note' in p) r.note = p.note ?? null
  if (p.color !== undefined) r.color = p.color
  return r
}

const rowToDebtPayment = (r: Row): DebtPayment => ({
  id: r.id, debtId: r.debt_id, amount: Number(r.amount),
  occurredAt: String(r.occurred_at).slice(0, 10), note: r.note ?? undefined,
})
const debtPaymentToRow = (p: DebtPayment) => ({
  id: p.id, debt_id: p.debtId, amount: p.amount,
  occurred_at: p.occurredAt, note: p.note ?? null,
})

const rowToAllocation = (r: Row): BudgetAllocation => ({
  id: r.id,
  categoryId: r.category_id,
  accountId: r.account_id ?? undefined,
  amount: Number(r.amount),
  note: r.note ?? undefined,
  createdAt: r.created_at,
})
const allocationToRow = (a: BudgetAllocation) => ({
  id: a.id,
  category_id: a.categoryId,
  account_id: a.accountId ?? null,
  amount: a.amount,
  note: a.note ?? null,
  created_at: a.createdAt,
})
