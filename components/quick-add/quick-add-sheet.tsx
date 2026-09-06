'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Segmented } from '@/components/ui/segmented'
import { CategoryIcon } from '@/components/ui/category-icon'
import { Keypad } from './keypad'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
import { formatKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

type Mode = 'expense' | 'income'

export function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, addTransaction } = useFinance()

  const [digits, setDigits] = useState('')
  const [mode, setMode] = useState<Mode>('expense')
  const [categoryId, setCategoryId] = useState('food')
  const [accountId, setAccountId] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const categories = useMemo(() => DEFAULT_CATEGORIES.filter((c) => c.kind === mode), [mode])

  // Preselección: la cuenta más usada y una categoría válida. Sin esto el
  // usuario tendría que tocar 3 cosas antes de poder teclear el monto.
  useEffect(() => {
    if (!accountId && accounts.length) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  useEffect(() => {
    if (!categories.some((c) => c.id === categoryId)) setCategoryId(categories[0]?.id ?? 'other')
  }, [categories, categoryId])

  // Limpia el formulario al reabrir, pero solo después de que cierre la animación.
  useEffect(() => {
    if (open) return
    const t = setTimeout(() => {
      setDigits('')
      setNote('')
      setSaved(false)
      setMode('expense')
    }, 350)
    return () => clearTimeout(t)
  }, [open])

  const amount = Number(digits || '0')
  const canSave = amount > 0 && Boolean(accountId)

  async function handleSave() {
    if (!canSave) return
    haptic([14, 40, 22]) // patrón de "éxito", como el Taptic Engine de iOS
    setSaved(true)

    await addTransaction({
      accountId,
      categoryId,
      amount,
      type: mode,
      description: note.trim() || DEFAULT_CATEGORIES.find((c) => c.id === categoryId)!.name,
      occurredAt: new Date().toISOString(),
    })

    // Deja ver el check antes de cerrar: confirma sin robar tiempo.
    setTimeout(onClose, 620)
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-6 pt-1">
        <Segmented
          id="quickadd"
          className="mx-auto mb-5 max-w-[220px]"
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            { value: 'expense', label: 'Gasto' },
            { value: 'income', label: 'Ingreso' },
          ]}
        />

        {/* Monto */}
        <div className="mb-5 flex h-[68px] items-center justify-center">
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.div
                key="saved"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 380 }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-green/20 text-accent-green"
              >
                <Check size={30} strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div key="amount" className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    'text-[26px] font-light transition-colors',
                    digits ? 'text-label-secondary' : 'text-label-tertiary',
                  )}
                >
                  $
                </span>
                <span
                  className={cn(
                    'tnum text-[52px] font-semibold leading-none transition-colors',
                    digits ? (mode === 'income' ? 'text-accent-green' : 'text-label') : 'text-label-tertiary',
                  )}
                >
                  {formatKeypad(digits)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Categorías — scroll horizontal, un toque */}
        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
          {categories.map((cat) => {
            const active = cat.id === categoryId
            return (
              <button
                key={cat.id}
                onClick={() => {
                  haptic(6)
                  setCategoryId(cat.id)
                }}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-pill border py-1.5 pl-1.5 pr-3.5 transition-all duration-200',
                  active ? 'border-transparent bg-white/[0.14]' : 'border-hairline bg-transparent',
                )}
              >
                <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                <span className={cn('text-[13px] font-medium', active ? 'text-label' : 'text-label-secondary')}>
                  {cat.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Cuentas */}
        <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
          {accounts.map((acc) => {
            const active = acc.id === accountId
            return (
              <button
                key={acc.id}
                onClick={() => {
                  haptic(6)
                  setAccountId(acc.id)
                }}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-pill border px-3 py-1.5 text-[12px] font-medium transition-all',
                  active ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.color }} />
                {acc.name}
              </button>
            )
          })}
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="mb-4 w-full rounded-xl border border-hairline bg-white/[0.04] px-4 py-2.5
                     text-[15px] text-label placeholder:text-label-tertiary
                     focus:border-accent-blue/50 focus:outline-none"
        />

        <Keypad
          onDigit={(d) => setDigits((prev) => (prev === '0' ? d : (prev + d).slice(0, 12)))}
          onDelete={() => setDigits((prev) => prev.slice(0, -1))}
        />

        <motion.button
          whileTap={{ scale: canSave ? 0.97 : 1 }}
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            'mt-3 h-[52px] w-full rounded-2xl text-[17px] font-semibold transition-all duration-200',
            canSave
              ? mode === 'income'
                ? 'bg-accent-green text-black'
                : 'bg-accent-blue text-white shadow-glow'
              : 'bg-white/[0.06] text-label-tertiary',
          )}
        >
          {mode === 'income' ? 'Registrar ingreso' : 'Registrar gasto'}
        </motion.button>
      </div>
    </Sheet>
  )
}
