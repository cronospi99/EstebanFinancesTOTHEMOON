'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Wallet } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { formatKeypad, formatMoney, formatPercent, monthlyFromApy, parseKeypad } from '@/lib/format'
import { accountTotal, useFinance } from '@/lib/store'
import type { Account } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

const POCKET_COLORS = ['#0A84FF', '#30D158', '#BF5AF2', '#FF9F0A', '#FF375F', '#40C8E0']

export function AccountDetailSheet({
  account, onClose,
}: {
  account: Account | null
  onClose: () => void
}) {
  const { addPocket, deletePocket, deleteAccount, updateAccount, fxRate } = useFinance()
  const [adding, setAdding] = useState(false)
  const [pName, setPName] = useState('')
  const [pAmount, setPAmount] = useState('')
  const [pApy, setPApy] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!account) return null

  const cur = account.currency
  const total = accountTotal(account)
  const pockets = account.pockets ?? []
  const monthly = account.apy ? account.balance * monthlyFromApy(account.apy) : 0

  async function handleAddPocket() {
    if (!pName.trim() || !account) return
    haptic([14, 40])
    await addPocket(account.id, {
      name: pName.trim(),
      balance: parseKeypad(pAmount),
      apy: pApy ? parseKeypad(pApy) : undefined,
      color: POCKET_COLORS[pockets.length % POCKET_COLORS.length],
    })
    setPName(''); setPAmount(''); setPApy(''); setAdding(false)
  }

  return (
    <Sheet open={Boolean(account)} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <div className="mb-5 flex items-center gap-3">
          <InstitutionBadge institution={account.institution} color={account.color} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[19px] font-semibold">{account.name}</h2>
            <p className="text-[13px] text-label-secondary">
              {account.institution}
              {cur === 'USD' && ' · USD'}
            </p>
          </div>
        </div>

        {/* Saldo */}
        <div className="mb-5 rounded-2xl border border-hairline bg-white/[0.04] p-4">
          <p className="mb-1 text-[12px] text-label-secondary">Saldo total</p>
          <p className={cn('tnum text-[30px] font-bold leading-none', total < 0 ? 'text-accent-red' : 'text-label')}>
            {formatMoney(total, cur)}
          </p>
          {cur === 'USD' && (
            <p className="tnum mt-1 text-[13px] text-label-tertiary">≈ {formatMoney(total * fxRate)}</p>
          )}
          {pockets.length > 0 && (
            <p className="tnum mt-2 border-t border-hairline pt-2 text-[12px] text-label-tertiary">
              General {formatMoney(account.balance, cur)} · Bolsillos{' '}
              {formatMoney(total - account.balance, cur)}
            </p>
          )}
        </div>

        {/* Rendimiento */}
        {account.apy != null && account.apy > 0 && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-accent-green/25 bg-accent-green/[0.08] px-4 py-3">
            <div>
              <p className="text-[12px] text-label-secondary">Rendimiento E.A.</p>
              <p className="tnum text-[18px] font-semibold text-accent-green">{formatPercent(account.apy, false)}</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-label-secondary">Estimado al mes</p>
              <p className="tnum text-[15px] font-semibold text-label">+{formatMoney(monthly, cur)}</p>
            </div>
          </div>
        )}

        {/* Cuotas de tarjeta */}
        {account.type === 'credit' && account.installments ? (
          <div className="mb-5 rounded-2xl border border-hairline bg-white/[0.04] p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[13px] font-medium text-label">Cuotas</p>
              <p className="tnum text-[13px] text-label-secondary">
                {account.installmentsPaid ?? 0} de {account.installments}
              </p>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((account.installmentsPaid ?? 0) / account.installments) * 100}%` }}
                transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                className="h-full rounded-full bg-accent-orange"
              />
            </div>
            <p className="tnum mb-3 text-[12px] text-label-tertiary">
              Cuota aproximada {formatMoney(Math.abs(account.balance) / account.installments, cur)} al mes
            </p>
            <button
              onClick={() => {
                haptic(10)
                updateAccount(account.id, {
                  installmentsPaid: Math.min((account.installmentsPaid ?? 0) + 1, account.installments!),
                })
              }}
              disabled={(account.installmentsPaid ?? 0) >= account.installments}
              className="press w-full rounded-xl border border-hairline bg-white/[0.05] py-2.5 text-[14px]
                         font-medium text-accent-blue disabled:opacity-40"
            >
              Marcar cuota pagada
            </button>
          </div>
        ) : null}

        {/* Bolsillos */}
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-label-tertiary">Bolsillos</h3>
          {!adding && (
            <button onClick={() => { haptic(6); setAdding(true) }} className="flex items-center gap-1 text-[13px] font-medium text-accent-blue">
              <Plus size={14} /> Añadir
            </button>
          )}
        </div>

        {pockets.length === 0 && !adding && (
          <div className="mb-4 rounded-2xl border border-hairline bg-white/[0.03] p-5 text-center">
            <Wallet size={20} className="mx-auto mb-2 text-label-tertiary" />
            <p className="text-[13px] text-label-secondary">
              Aún no hay bolsillos en esta cuenta.
            </p>
          </div>
        )}

        {pockets.length > 0 && (
          <div className="mb-4 divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-white/[0.04]">
            {pockets.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? '#98989F' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-label">{p.name}</p>
                  {p.apy ? (
                    <p className="tnum text-[12px] text-accent-green">{formatPercent(p.apy, false)} E.A.</p>
                  ) : null}
                </div>
                <span className="tnum shrink-0 text-[15px] font-semibold">{formatMoney(p.balance, cur)}</span>
                <button
                  onClick={() => { haptic([16, 30]); deletePocket(account.id, p.id) }}
                  aria-label={`Eliminar bolsillo ${p.name}`}
                  className="press shrink-0 p-1 text-label-tertiary"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {adding && (
          <div className="mb-4 space-y-2 rounded-2xl border border-hairline bg-white/[0.04] p-4">
            <input
              value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Nombre del bolsillo" autoFocus
              className="w-full rounded-xl border border-hairline bg-white/[0.05] px-3 py-2.5 text-[15px]
                         text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-hairline bg-white/[0.05] px-3 py-2.5">
                <span className="text-[15px] text-label-secondary">{cur === 'USD' ? 'US$' : '$'}</span>
                <input
                  value={pAmount ? formatKeypad(pAmount) : ''}
                  onChange={(e) => setPAmount(e.target.value.replace(/[^\d,]/g, ''))}
                  placeholder="0" inputMode="decimal"
                  className="tnum w-full bg-transparent text-[15px] font-semibold text-label placeholder:text-label-tertiary focus:outline-none"
                />
              </div>
              <div className="flex w-[110px] items-center gap-1 rounded-xl border border-hairline bg-white/[0.05] px-3 py-2.5">
                <input
                  value={pApy} onChange={(e) => setPApy(e.target.value.replace(/[^\d,]/g, '').slice(0, 5))}
                  placeholder="E.A." inputMode="decimal"
                  className="tnum w-full bg-transparent text-[15px] font-semibold text-label placeholder:text-label-tertiary focus:outline-none"
                />
                <span className="text-[14px] text-label-secondary">%</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setAdding(false); setPName(''); setPAmount(''); setPApy('') }}
                className="press flex-1 rounded-xl border border-hairline py-2.5 text-[14px] text-label-secondary">
                Cancelar
              </button>
              <button onClick={handleAddPocket} disabled={!pName.trim()}
                className="press flex-1 rounded-xl bg-accent-blue py-2.5 text-[14px] font-semibold text-white disabled:opacity-40">
                Crear bolsillo
              </button>
            </div>
          </div>
        )}

        {/* Eliminar cuenta */}
        {!confirmDelete ? (
          <button onClick={() => { haptic(8); setConfirmDelete(true) }}
            className="press w-full rounded-2xl border border-hairline py-3 text-[14px] font-medium text-accent-red">
            Eliminar cuenta
          </button>
        ) : (
          <div className="rounded-2xl border border-accent-red/30 bg-accent-red/[0.08] p-4">
            <p className="mb-3 text-center text-[13px] leading-relaxed text-label">
              Se borrarán también sus movimientos y bolsillos. No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="press flex-1 rounded-xl border border-hairline py-2.5 text-[14px] text-label-secondary">
                Cancelar
              </button>
              <button onClick={() => { haptic([20, 40]); deleteAccount(account.id); onClose() }}
                className="press flex-1 rounded-xl bg-accent-red py-2.5 text-[14px] font-semibold text-white">
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
