'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sheet } from '@/components/ui/sheet'
import { CO_INSTITUTIONS } from '@/lib/categories'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { formatKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import type { AccountType } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

const TYPES: { value: AccountType; label: string }[] = [
  { value: 'savings', label: 'Ahorros' },
  { value: 'checking', label: 'Corriente' },
  { value: 'credit', label: 'Crédito' },
  { value: 'cash', label: 'Efectivo' },
]

export function AddAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addAccount } = useFinance()

  const [institution, setInstitution] = useState(CO_INSTITUTIONS[0])
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('savings')
  const [digits, setDigits] = useState('')
  const [negative, setNegative] = useState(false)
  const [saving, setSaving] = useState(false)

  // El nombre puede quedarse vacío: la institución ya identifica la cuenta.
  const finalName = name.trim() || institution.name

  async function handleSave() {
    if (saving) return
    setSaving(true)
    haptic([14, 40, 22])

    const amount = Number(digits || '0')
    await addAccount({
      name: finalName,
      institution: institution.name,
      type,
      // Las tarjetas de crédito arrancan en negativo: es deuda, no saldo.
      balance: type === 'credit' || negative ? -amount : amount,
      currency: 'COP',
      color: institution.color,
    })

    setName('')
    setDigits('')
    setNegative(false)
    setSaving(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-6 pt-1">
        <h2 className="mb-5 text-center text-[17px] font-semibold">Nueva cuenta</h2>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Entidad
        </label>
        <div className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
          {CO_INSTITUTIONS.map((inst) => {
            const active = inst.name === institution.name
            return (
              <button
                key={inst.name}
                onClick={() => {
                  haptic(6)
                  setInstitution(inst)
                }}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-pill border py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium transition-all',
                  active ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
                )}
              >
                <InstitutionBadge institution={inst.name} size="sm" />
                {inst.name}
              </button>
            )
          })}
        </div>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Nombre
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={institution.name}
          className="mb-5 w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3
                     text-[16px] text-label placeholder:text-label-tertiary
                     focus:border-accent-blue/50 focus:outline-none"
        />

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Tipo
        </label>
        <div className="mb-5 grid grid-cols-4 gap-2">
          {TYPES.map((t) => {
            const active = t.value === type
            return (
              <button
                key={t.value}
                onClick={() => {
                  haptic(6)
                  setType(t.value)
                }}
                className={cn(
                  'rounded-xl border py-2.5 text-[12px] font-medium transition-all',
                  active ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          {type === 'credit' ? 'Deuda actual' : 'Saldo inicial'}
        </label>
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3">
          <span className="text-[18px] text-label-secondary">{type === 'credit' || negative ? '−' : ''}$</span>
          <input
            value={formatKeypad(digits)}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 12))}
            inputMode="numeric"
            className="tnum w-full bg-transparent text-[22px] font-semibold text-label focus:outline-none"
          />
        </div>

        {type !== 'credit' && (
          <button
            onClick={() => {
              haptic(6)
              setNegative((n) => !n)
            }}
            className={cn(
              'mb-5 text-[13px] transition-colors',
              negative ? 'text-accent-red' : 'text-label-tertiary',
            )}
          >
            {negative ? '− Saldo en negativo' : 'Marcar como saldo negativo'}
          </button>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          className="mt-2 h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white shadow-glow
                     disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Crear cuenta'}
        </motion.button>
      </div>
    </Sheet>
  )
}
