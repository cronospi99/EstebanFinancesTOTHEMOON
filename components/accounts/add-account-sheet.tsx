'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sheet } from '@/components/ui/sheet'
import { Segmented } from '@/components/ui/segmented'
import { InstitutionPicker } from '@/components/ui/institution-picker'
import { CO_INSTITUTIONS, institutionsByGroup } from '@/lib/categories'
import { formatKeypad, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import type { AccountType, Currency } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

const TYPES: { value: AccountType; label: string }[] = [
  { value: 'savings', label: 'Ahorros' },
  { value: 'checking', label: 'Corriente' },
  { value: 'credit', label: 'Crédito' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'investment', label: 'Inversión' },
]

/** Entrada numérica con miles agrupados y coma decimal. */
function MoneyField({
  value, onChange, prefix, placeholder = '0',
}: {
  value: string
  onChange: (raw: string) => void
  prefix: string
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3">
      <span className="text-[18px] text-label-secondary">{prefix}</span>
      <input
        value={value ? formatKeypad(value) : ''}
        placeholder={placeholder}
        onChange={(e) => {
          // Conserva una sola coma y descarta el resto de caracteres.
          const limpio = e.target.value.replace(/[^\d,]/g, '')
          const [ent, ...dec] = limpio.split(',')
          onChange(dec.length ? `${ent},${dec.join('').slice(0, 2)}` : ent)
        }}
        inputMode="decimal"
        className="tnum w-full bg-transparent text-[22px] font-semibold text-label placeholder:text-label-tertiary focus:outline-none"
      />
    </div>
  )
}

export function AddAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addAccount } = useFinance()

  const [institution, setInstitution] = useState(institutionsByGroup()[0][1][0])
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('savings')
  const [currency, setCurrency] = useState<Currency>('COP')
  const [amount, setAmount] = useState('')
  const [apy, setApy] = useState('')
  const [installments, setInstallments] = useState('')
  const [cupo, setCupo] = useState('')
  const [negative, setNegative] = useState(false)
  const [saving, setSaving] = useState(false)

  const isCredit = type === 'credit'

  async function handleSave() {
    if (saving) return
    setSaving(true)
    haptic([14, 40, 22])

    const balance = parseKeypad(amount)
    await addAccount({
      name: name.trim() || institution.name,
      institution: institution.name,
      type,
      // Las tarjetas de crédito arrancan en negativo: es deuda, no saldo.
      balance: isCredit || negative ? -balance : balance,
      currency,
      color: institution.color,
      apy: apy ? parseKeypad(apy) : undefined,
      creditLimit: isCredit && cupo ? parseKeypad(cupo) : undefined,
      installments: isCredit && installments ? Number(installments) : undefined,
      installmentsPaid: isCredit && installments ? 0 : undefined,
    })

    setName(''); setAmount(''); setApy(''); setInstallments(''); setCupo(''); setNegative(false)
    setSaving(false)
    onClose()
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
      {children}
    </label>
  )

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-5 text-center text-[17px] font-semibold">Nueva cuenta</h2>

        <Label>Entidad</Label>
        <div className="mb-5">
          <InstitutionPicker value={institution} onChange={setInstitution} />
        </div>

        <Label>Nombre</Label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={institution.name}
          className="mb-5 w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3
                     text-[16px] text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />

        <Label>Tipo</Label>
        <div className="mb-5 grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => { haptic(6); setType(t.value) }}
              className={cn(
                'rounded-xl border py-2.5 text-[12px] font-medium transition-all',
                t.value === type ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Label>Moneda</Label>
        <Segmented
          id="currency" className="mb-5"
          value={currency} onChange={setCurrency}
          options={[{ value: 'COP' as Currency, label: 'Pesos (COP)' }, { value: 'USD' as Currency, label: 'Dólares (USD)' }]}
        />

        <Label>{isCredit ? 'Deuda actual' : 'Saldo inicial'}</Label>
        <div className="mb-2">
          <MoneyField
            value={amount} onChange={setAmount}
            prefix={`${isCredit || negative ? '−' : ''}${currency === 'USD' ? 'US$' : '$'}`}
          />
        </div>

        {!isCredit && (
          <button
            onClick={() => { haptic(6); setNegative((n) => !n) }}
            className={cn('mb-5 text-[13px] transition-colors', negative ? 'text-accent-red' : 'text-label-tertiary')}
          >
            {negative ? '− Saldo en negativo' : 'Marcar como saldo negativo'}
          </button>
        )}

        {isCredit && (
          <div className="mb-5">
            <Label>Cupo total</Label>
            <MoneyField value={cupo} onChange={setCupo} prefix={currency === 'USD' ? 'US$' : '$'} />
            <p className="mb-5 mt-1.5 px-1 text-[12px] text-label-tertiary">
              El aprobado por el banco. Sirve para ver cuánto te queda disponible
              y qué porcentaje llevas usado.
            </p>

            <Label>Cuotas pactadas</Label>
            <input
              value={installments}
              onChange={(e) => setInstallments(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="12"
              inputMode="numeric"
              className="w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3
                         text-[16px] text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
            />
            <p className="mt-1.5 px-1 text-[12px] text-label-tertiary">
              En cuántas cuotas está diferida la deuda. Se irá descontando a medida
              que registres los pagos.
            </p>
          </div>
        )}

        {!isCredit && (
          <div className="mb-5">
            <Label>Rendimiento E.A. (opcional)</Label>
            <div className="flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3">
              <input
                value={apy}
                onChange={(e) => {
                  const limpio = e.target.value.replace(/[^\d,]/g, '')
                  const [ent, ...dec] = limpio.split(',')
                  setApy(dec.length ? `${ent.slice(0, 3)},${dec.join('').slice(0, 2)}` : ent.slice(0, 3))
                }}
                placeholder="11,5"
                inputMode="decimal"
                className="tnum w-full bg-transparent text-[22px] font-semibold text-label placeholder:text-label-tertiary focus:outline-none"
              />
              <span className="text-[18px] text-label-secondary">%</span>
            </div>
            <p className="mt-1.5 px-1 text-[12px] text-label-tertiary">
              Tasa efectiva anual que paga la cuenta. Sirve para proyectar cuánto
              rinde al mes.
            </p>
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          className="h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white shadow-glow disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Crear cuenta'}
        </motion.button>
      </div>
    </Sheet>
  )
}
