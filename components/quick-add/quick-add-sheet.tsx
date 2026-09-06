'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Segmented } from '@/components/ui/segmented'
import { CategoryIcon } from '@/components/ui/category-icon'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { Keypad, ThousandsKey } from './keypad'
import { categoriesByGroup, DEFAULT_CATEGORIES } from '@/lib/categories'
import { formatKeypad, formatMoney, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

type Mode = 'expense' | 'income'

export function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, transactions, addTransaction, fxRate } = useFinance()

  const [raw, setRaw] = useState('')
  const [mode, setMode] = useState<Mode>('expense')
  const [categoryId, setCategoryId] = useState('food')
  const [accountId, setAccountId] = useState('')
  const [pocketId, setPocketId] = useState<string | undefined>()
  const [note, setNote] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [saved, setSaved] = useState(false)

  const account = accounts.find((a) => a.id === accountId)
  const currency = account?.currency ?? 'COP'

  const categories = useMemo(() => DEFAULT_CATEGORIES.filter((c) => c.kind === mode), [mode])

  /** Las más usadas primero: con cincuenta categorías el orden fijo no sirve. */
  const frequent = useMemo(() => {
    const uses = new Map<string, number>()
    transactions.filter((t) => t.type === mode).forEach((t) => uses.set(t.categoryId, (uses.get(t.categoryId) ?? 0) + 1))
    return [...categories].sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0)).slice(0, 8)
  }, [categories, transactions, mode])

  useEffect(() => {
    if (!accounts.length) return
    if (!accounts.some((a) => a.id === accountId)) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  // El bolsillo pertenece a la cuenta: al cambiarla, deja de ser válido.
  useEffect(() => {
    if (pocketId && !account?.pockets?.some((p) => p.id === pocketId)) setPocketId(undefined)
  }, [account, pocketId])

  useEffect(() => {
    if (!categories.some((c) => c.id === categoryId)) setCategoryId(categories[0]?.id ?? 'other')
  }, [categories, categoryId])

  useEffect(() => {
    if (open) return
    const t = setTimeout(() => {
      setRaw(''); setNote(''); setSaved(false); setMode('expense'); setShowAll(false); setPocketId(undefined)
    }, 350)
    return () => clearTimeout(t)
  }, [open])

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

  async function handleSave() {
    if (!canSave) return
    haptic([14, 40, 22])
    setSaved(true)
    await addTransaction({
      accountId,
      pocketId,
      categoryId,
      amount,
      type: mode,
      currency,
      description: note.trim() || DEFAULT_CATEGORIES.find((c) => c.id === categoryId)!.name,
      occurredAt: new Date().toISOString(),
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

  const catChips = showAll ? [] : frequent

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
        </div>

        {/* Categorías */}
        <div className="mb-3">
          {!showAll ? (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
              {catChips.map((cat) => {
                const active = cat.id === categoryId
                return (
                  <button
                    key={cat.id}
                    onClick={() => { haptic(6); setCategoryId(cat.id) }}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-pill border py-1 pl-1 pr-3.5 transition-all duration-200',
                      active ? 'border-transparent bg-white/[0.14]' : 'border-hairline',
                    )}
                  >
                    <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                    <span className={cn('text-[13px] font-medium', active ? 'text-label' : 'text-label-secondary')}>
                      {cat.name}
                    </span>
                  </button>
                )
              })}
              <button
                onClick={() => { haptic(6); setShowAll(true) }}
                className="flex shrink-0 items-center gap-1 rounded-pill border border-hairline px-3.5 py-1
                           text-[13px] font-medium text-accent-blue"
              >
                Todas <ChevronDown size={14} />
              </button>
            </div>
          ) : (
            <div className="max-h-[210px] overflow-y-auto rounded-2xl border border-hairline bg-white/[0.03] p-3">
              {categoriesByGroup(mode).map(([group, cats]) => (
                <div key={group} className="mb-3 last:mb-0">
                  <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-label-tertiary">
                    {group}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {cats.map((cat) => {
                      const active = cat.id === categoryId
                      return (
                        <button
                          key={cat.id}
                          onClick={() => { haptic(6); setCategoryId(cat.id); setShowAll(false) }}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors',
                            active ? 'bg-white/[0.14]' : 'active:bg-white/[0.07]',
                          )}
                        >
                          <CategoryIcon icon={cat.icon} color={cat.color} size="xs" />
                          <span className="w-full truncate text-center text-[10px] leading-tight text-label-secondary">
                            {cat.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cuentas */}
        <div className="-mx-5 mb-2 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
          {accounts.map((acc) => {
            const active = acc.id === accountId
            return (
              <button
                key={acc.id}
                onClick={() => { haptic(6); setAccountId(acc.id) }}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-pill border py-1 pl-1 pr-3 text-[12px] font-medium transition-all',
                  active ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
                )}
              >
                <InstitutionBadge institution={acc.institution} color={acc.color} size="xs" />
                {acc.name}
                {acc.currency === 'USD' && <span className="text-[10px] text-label-tertiary">USD</span>}
              </button>
            )
          })}
        </div>

        {/* Bolsillos de la cuenta elegida */}
        {Boolean(account?.pockets?.length) && (
          <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
            <button
              onClick={() => { haptic(6); setPocketId(undefined) }}
              className={cn(
                'shrink-0 rounded-pill border px-3 py-1 text-[12px] font-medium transition-all',
                !pocketId ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
              )}
            >
              General
            </button>
            {account!.pockets!.map((p) => (
              <button
                key={p.id}
                onClick={() => { haptic(6); setPocketId(p.id) }}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1 text-[12px] font-medium transition-all',
                  pocketId === p.id ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color ?? '#98989F' }} />
                {p.name}
              </button>
            ))}
          </div>
        )}

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
