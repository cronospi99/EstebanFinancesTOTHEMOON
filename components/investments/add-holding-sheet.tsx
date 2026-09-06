'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sheet } from '@/components/ui/sheet'
import { Segmented } from '@/components/ui/segmented'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { formatKeypad, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import type { AssetType, Currency, Holding } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

const ASSETS: { value: AssetType; label: string }[] = [
  { value: 'etf', label: 'ETF' },
  { value: 'stock', label: 'Acción' },
  { value: 'crypto', label: 'Cripto' },
  { value: 'cdt', label: 'CDT' },
]

export function AddHoldingSheet({
  open, onClose, editing,
}: {
  open: boolean
  onClose: () => void
  /** Si viene, el formulario edita en lugar de crear. */
  editing?: Holding | null
}) {
  const { accounts, addHolding, updateHolding } = useFinance()
  const investAccounts = accounts.filter((a) => a.type === 'investment' || a.type === 'savings')

  const [symbol, setSymbol] = useState(editing?.symbol ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [qty, setQty] = useState(editing ? String(editing.quantity).replace('.', ',') : '')
  const [cost, setCost] = useState(editing ? String(editing.avgCost).replace('.', ',') : '')
  const [assetType, setAssetType] = useState<AssetType>(editing?.assetType ?? 'etf')
  const [currency, setCurrency] = useState<Currency>(editing?.currency ?? 'USD')
  const [accountId, setAccountId] = useState(editing?.accountId ?? investAccounts[0]?.id)
  const [saving, setSaving] = useState(false)

  const quantity = parseKeypad(qty)
  const avgCost = parseKeypad(cost)
  const canSave = symbol.trim().length > 0 && quantity > 0

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    haptic([14, 40, 22])

    const payload = {
      symbol: symbol.trim().toUpperCase(),
      name: name.trim() || symbol.trim().toUpperCase(),
      quantity, avgCost, assetType, currency, accountId,
    }
    if (editing) await updateHolding(editing.id, payload)
    else await addHolding(payload)

    setSymbol(''); setName(''); setQty(''); setCost('')
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
        <h2 className="mb-5 text-center text-[17px] font-semibold">
          {editing ? 'Editar posición' : 'Nueva posición'}
        </h2>

        <Label>Símbolo</Label>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="VOO, AAPL, BTC-USD"
          autoCapitalize="characters"
          className="mb-1.5 w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3
                     text-[16px] font-semibold tracking-wide text-label placeholder:font-normal
                     placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />
        <p className="mb-5 px-1 text-[12px] text-label-tertiary">
          El símbolo de Yahoo Finance. Las criptos llevan sufijo: BTC-USD, ETH-USD.
        </p>

        <Label>Nombre (opcional)</Label>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Vanguard S&P 500 ETF"
          className="mb-5 w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3
                     text-[16px] text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />

        <Label>Tipo de activo</Label>
        <div className="mb-5 grid grid-cols-4 gap-2">
          {ASSETS.map((a) => (
            <button
              key={a.value}
              onClick={() => { haptic(6); setAssetType(a.value) }}
              className={cn(
                'rounded-xl border py-2.5 text-[12px] font-medium transition-all',
                a.value === assetType ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        <Label>Cantidad</Label>
        <input
          value={qty}
          onChange={(e) => {
            // Fracciones de acción y de cripto: hasta ocho decimales.
            const limpio = e.target.value.replace(/[^\d,]/g, '')
            const [ent, ...dec] = limpio.split(',')
            setQty(dec.length ? `${ent},${dec.join('').slice(0, 8)}` : ent)
          }}
          placeholder="12,4"
          inputMode="decimal"
          className="tnum mb-1.5 w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3
                     text-[22px] font-semibold text-label placeholder:font-normal
                     placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />
        <p className="mb-5 px-1 text-[12px] text-label-tertiary">
          Admite fracciones: 0,0852 BTC o 12,4 participaciones.
        </p>

        <Label>Precio promedio de compra</Label>
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3">
          <span className="text-[18px] text-label-secondary">{currency === 'USD' ? 'US$' : '$'}</span>
          <input
            value={cost ? formatKeypad(cost) : ''}
            onChange={(e) => {
              const limpio = e.target.value.replace(/[^\d,]/g, '')
              const [ent, ...dec] = limpio.split(',')
              setCost(dec.length ? `${ent},${dec.join('').slice(0, 4)}` : ent)
            }}
            placeholder="465,20" inputMode="decimal"
            className="tnum w-full bg-transparent text-[22px] font-semibold text-label placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
          />
        </div>

        <Label>Moneda</Label>
        <Segmented
          id="holding-cur" className="mb-5"
          value={currency} onChange={setCurrency}
          options={[{ value: 'USD' as Currency, label: 'Dólares' }, { value: 'COP' as Currency, label: 'Pesos' }]}
        />

        {investAccounts.length > 0 && (
          <>
            <Label>Plataforma</Label>
            <div className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
              {investAccounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { haptic(6); setAccountId(a.id) }}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-pill border py-1 pl-1 pr-3 text-[12px] font-medium transition-all',
                    a.id === accountId ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
                  )}
                >
                  <InstitutionBadge institution={a.institution} color={a.color} size="xs" />
                  {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <motion.button
          whileTap={{ scale: canSave ? 0.97 : 1 }}
          onClick={handleSave}
          disabled={!canSave || saving}
          className={cn(
            'h-[52px] w-full rounded-2xl text-[17px] font-semibold transition-all',
            canSave ? 'bg-accent-blue text-white shadow-glow' : 'bg-white/[0.06] text-label-tertiary',
          )}
        >
          {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Añadir posición'}
        </motion.button>
      </div>
    </Sheet>
  )
}
