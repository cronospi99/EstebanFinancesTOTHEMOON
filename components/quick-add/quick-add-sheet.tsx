'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Check, Mic } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Segmented } from '@/components/ui/segmented'
import { AccountPicker } from '@/components/ui/account-picker'
import { CategoryPicker } from '@/components/ui/category-picker'
import { Keypad, ThousandsKey } from './keypad'
import { categoryById, DEFAULT_CATEGORIES } from '@/lib/categories'
import { formatKeypad, formatMoney, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { useVoice } from '@/lib/use-voice'
import { interpretarDictado } from '@/lib/voice'
import { cn, haptic } from '@/lib/utils'

type Mode = 'expense' | 'income'

const hoyISO = () => new Date().toISOString().slice(0, 10)

/**
 * Combina el día elegido con la hora actual. Registrar algo de ayer no
 * debería fijarlo a las 00:00: se ordenaría antes que todo lo de ese día.
 */
function fechaISO(dia: string) {
  const ahora = new Date()
  const [a, m, d] = dia.split('-').map(Number)
  const fecha = new Date(a, m - 1, d, ahora.getHours(), ahora.getMinutes(), ahora.getSeconds())
  return fecha.toISOString()
}

function etiquetaFecha(dia: string) {
  if (dia === hoyISO()) return 'Hoy'
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
  if (dia === ayer.toISOString().slice(0, 10)) return 'Ayer'
  const [a, m, d] = dia.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(a, m - 1, d))
}

export function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, addTransaction, fxRate } = useFinance()

  const [raw, setRaw] = useState('')
  const [mode, setMode] = useState<Mode>('expense')
  const [categoryId, setCategoryId] = useState('food')
  const [accountId, setAccountId] = useState('')
  const [pocketId, setPocketId] = useState<string | undefined>()
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))

  const account = accounts.find((a) => a.id === accountId)
  const currency = account?.currency ?? 'COP'

  const categories = useMemo(() => DEFAULT_CATEGORIES.filter((c) => c.kind === mode), [mode])

  useEffect(() => {
    if (!accounts.length) return
    if (!accounts.some((a) => a.id === accountId)) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  // Gasto e ingreso no comparten categorías: al cambiar de modo, la elegida
  // puede dejar de existir.
  useEffect(() => {
    if (!categories.some((c) => c.id === categoryId)) setCategoryId(categories[0]?.id ?? 'other')
  }, [categories, categoryId])

  useEffect(() => {
    if (open) return
    const t = setTimeout(() => {
      setRaw(''); setNote(''); setSaved(false); setMode('expense'); setPocketId(undefined)
      setFecha(new Date().toISOString().slice(0, 10))
    }, 350)
    return () => clearTimeout(t)
  }, [open])

  /** Dictado: rellena monto, categoría y tipo de una sola frase. */
  const voz = useVoice((texto) => {
    const d = interpretarDictado(texto)
    haptic([12, 30])
    if (d.amount !== null) {
      // Se guarda con la coma decimal que espera el resto del formulario.
      setRaw(String(d.amount).replace('.', ','))
    }
    if (d.categoryId) setCategoryId(d.categoryId)
    setMode(d.type)
    if (d.note) setNote(d.note)
  })

  const amount = parseKeypad(raw)
  const canSave = amount > 0 && Boolean(accountId)

  function pushDigit(d: string) {
    setRaw((prev) => {
      if (d === ',') return prev.includes(',') ? prev : (prev || '0') + ','
      const [, dec] = prev.split(',')
      if (dec !== undefined && dec.length >= 2) return prev // dos decimales bastan
      if (prev === '0') return d
      return (prev + d).slice(0, 15)
    })
  }

  function handleSave() {
    if (!canSave) return
    haptic([14, 40, 22])
    setSaved(true)

    // El cierre no espera a la escritura remota. El movimiento ya está en
    // pantalla y guardado en el dispositivo; si la petición tarda —o no vuelve
    // nunca, que es lo que pasa al reanudar la app en iOS— la hoja se quedaba
    // abierta con el visto puesto y el fondo bloqueado detrás. Se ve idéntico
    // a una app colgada, y sin barra de direcciones no había cómo salir.
    addTransaction({
      accountId,
      pocketId,
      categoryId,
      amount,
      type: mode,
      currency,
      description: note.trim() || categoryById(categoryId).name,
      occurredAt: fechaISO(fecha),
    }).catch(() => {
      /* El movimiento ya está en el estado en memoria. La escritura remota no
         se reintenta todavía — ver "cola de escrituras" en el README. */
    })

    setTimeout(onClose, 620)
  }

  if (open && !accounts.length) {
    return (
      <Sheet open={open} onClose={onClose}>
        <div className="px-5 pb-8 pt-4 text-center">
          <h2 className="text-[17px] font-semibold text-label">Primero crea una cuenta</h2>
          <p className="mx-auto mt-2 max-w-[260px] text-[14px] leading-relaxed text-label-secondary">
            Todo movimiento pertenece a una cuenta, así que necesitas al menos una
            antes de registrar gastos.
          </p>
          <Link
            href="/gastos" onClick={onClose}
            className="mt-5 inline-flex h-[48px] items-center justify-center rounded-2xl bg-accent-blue
                       px-6 text-[16px] font-semibold text-white shadow-glow"
          >
            Ir a Cuentas
          </Link>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-6 pt-1">
        <Segmented
          id="quickadd" className="mx-auto mb-4 max-w-[220px]"
          value={mode} onChange={(v) => setMode(v)}
          options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]}
        />

        {/* Monto */}
        <div className="mb-1 flex h-[62px] items-center justify-center">
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.div
                key="saved"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 380 }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-green/20 text-accent-green"
              >
                <Check size={30} strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div key="amount" className="flex items-baseline gap-1.5">
                <span className={cn('text-[24px] font-light', raw ? 'text-label-secondary' : 'text-label-tertiary')}>
                  {currency === 'USD' ? 'US$' : '$'}
                </span>
                <span
                  className={cn(
                    'tnum text-[50px] font-semibold leading-none transition-colors',
                    raw ? (mode === 'income' ? 'text-accent-green' : 'text-label') : 'text-label-tertiary',
                  )}
                >
                  {formatKeypad(raw)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Equivalencia y atajo de miles */}
        <div className="mb-4 flex h-6 items-center justify-center gap-3">
          {currency === 'USD' && amount > 0 && (
            <span className="tnum text-[12px] text-label-tertiary">≈ {formatMoney(amount * fxRate)}</span>
          )}
          {!saved && <ThousandsKey onPress={() => setRaw((p) => (p && !p.includes(',') ? p + '000' : p))} disabled={!raw || raw.includes(',')} />}
          {!saved && voz.soportado && (
            <button
              onClick={() => { haptic(10); voz.estado === 'escuchando' ? voz.stop() : voz.start() }}
              aria-label={voz.estado === 'escuchando' ? 'Detener dictado' : 'Dictar movimiento'}
              className={cn(
                'press flex items-center gap-1.5 rounded-pill border px-3 py-1 text-[13px] font-semibold transition-colors',
                voz.estado === 'escuchando'
                  ? 'border-transparent bg-accent-red text-white'
                  : 'border-hairline text-label-secondary',
              )}
            >
              <Mic size={13} />
              {voz.estado === 'escuchando' ? 'Escuchando' : 'Dictar'}
            </button>
          )}
        </div>

        {/* Lo que se va entendiendo, para que el usuario vea si acertó. */}
        {voz.estado === 'escuchando' && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="mb-3 min-h-[18px] text-center text-[13px] italic text-label-secondary"
          >
            {voz.parcial || 'Di por ejemplo: cuarenta y cinco mil en comida'}
          </motion.p>
        )}
        {voz.estado === 'error' && (
          <p className="mb-3 text-center text-[12px] text-accent-orange">
            No se pudo escuchar. Revisa el permiso del micrófono.
          </p>
        )}

        {/* Categorías */}
        <div className="mb-3">
          <CategoryPicker mode={mode} value={categoryId} onChange={setCategoryId} />
        </div>

        {/* Medio de pago */}
        <AccountPicker
          accountId={accountId}
          pocketId={pocketId}
          onChange={(cuenta, bolsillo) => { setAccountId(cuenta); setPocketId(bolsillo) }}
          // Solo en el gasto: un ingreso puede entrar en una cuenta a cero, y
          // ahí esconderla sería esconder justo la que hace falta.
          soloConSaldo={mode === 'expense'}
        />

        {/* Fecha: por defecto hoy, para no estorbar el caso rápido. */}
        <label className="press mb-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-hairline
                          bg-white/[0.04] px-4 py-2.5">
          <CalendarDays size={16} className="shrink-0 text-label-tertiary" />
          <span className="flex-1 text-[15px] text-label">{etiquetaFecha(fecha)}</span>
          <input
            type="date" value={fecha} max={hoyISO()}
            onChange={(e) => { haptic(6); setFecha(e.target.value || hoyISO()) }}
            className="w-[26px] bg-transparent text-[15px] text-label-tertiary [color-scheme:dark]
                       focus:outline-none"
          />
        </label>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="mb-3 w-full rounded-xl border border-hairline bg-white/[0.04] px-4 py-2.5
                     text-[16px] text-label placeholder:text-label-tertiary
                     focus:border-accent-blue/50 focus:outline-none"
        />

        <Keypad
          onDigit={pushDigit}
          onDelete={() => setRaw((p) => p.slice(0, -1))}
          decimalDisabled={raw.includes(',')}
        />

        <motion.button
          whileTap={{ scale: canSave ? 0.97 : 1 }}
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            'mt-3 h-[52px] w-full rounded-2xl text-[17px] font-semibold transition-all duration-200',
            canSave
              ? mode === 'income' ? 'bg-accent-green text-black' : 'bg-accent-blue text-white shadow-glow'
              : 'bg-white/[0.06] text-label-tertiary',
          )}
        >
          {mode === 'income' ? 'Registrar ingreso' : 'Registrar gasto'}
        </motion.button>
      </div>
    </Sheet>
  )
}
