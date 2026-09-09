'use client'

import { useState } from 'react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { CategoryIcon } from '@/components/ui/category-icon'
import { categoryById } from '@/lib/categories'
import { formatMoney, parseKeypad } from '@/lib/format'
import { useAccountsAvailable, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

/**
 * Apartar dinero de una cuenta en un presupuesto, o devolverlo.
 *
 * Es un bolsillo virtual: el saldo de la cuenta no se mueve —tiene que seguir
 * cuadrando con el banco— y lo único que cambia es cuánto de ese saldo queda
 * libre. Por eso la cuenta se elige por su saldo **disponible** y no por el
 * total: apartar dos veces el mismo dinero es el error que esto evita.
 */
export function AllocateSheet({
  categoryId, onClose,
}: {
  /** Categoría del presupuesto, o `null` con la hoja cerrada. */
  categoryId: string | null
  onClose: () => void
}) {
  const { accounts, asignarABolsillo } = useFinance()
  const disponible = useAccountsAvailable()

  const [cuentaId, setCuentaId] = useState('')
  const [monto, setMonto] = useState('')
  const [modo, setModo] = useState<'apartar' | 'devolver'>('apartar')

  const cat = categoryId ? categoryById(categoryId) : null
  // Solo cuentas en pesos: los presupuestos son mensuales y en pesos, y
  // apartar dólares obligaría a fijar a qué tasa quedó apartado.
  const elegibles = accounts.filter((a) => a.currency === 'COP')
  const cuenta = elegibles.find((a) => a.id === cuentaId)
  const libre = cuenta ? disponible.get(cuenta.id)?.libre ?? 0 : 0
  const importe = parseKeypad(monto)
  // Devolver no tiene tope: se devuelve lo que se apartó, no lo que hay libre.
  const excede = modo === 'apartar' && cuenta ? importe > libre : false
  const listo = Boolean(cuenta) && importe > 0 && !excede

  const cerrar = () => { setMonto(''); setModo('apartar'); onClose() }

  return (
    <Sheet open={Boolean(categoryId)} onClose={cerrar}>
      <div className="px-5 pb-8 pt-1">
        <div className="mb-5 flex items-center justify-center gap-2">
          {cat && <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />}
          <h2 className="text-[17px] font-semibold">{cat?.name ?? 'Presupuesto'}</h2>
        </div>

        <div className="mb-4 flex overflow-hidden rounded-xl border border-hairline">
          {(['apartar', 'devolver'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { haptic(6); setModo(m) }}
              className={cn(
                'flex-1 py-2 text-[14px] font-medium transition-colors',
                modo === m ? 'bg-white/[0.12] text-label' : 'text-label-tertiary',
              )}
            >
              {m === 'apartar' ? 'Apartar' : 'Devolver'}
            </button>
          ))}
        </div>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          {modo === 'apartar' ? 'De qué cuenta sale' : 'A qué cuenta vuelve'}
        </label>
        <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
          {elegibles.map((acc) => {
            const activa = acc.id === cuentaId
            const saldo = disponible.get(acc.id)
            return (
              <button
                key={acc.id}
                onClick={() => { haptic(6); setCuentaId(acc.id) }}
                className={cn(
                  'press flex shrink-0 items-center gap-2 rounded-xl border py-2 pl-2 pr-3 text-left transition-colors',
                  activa ? 'border-transparent bg-white/[0.14]' : 'border-hairline',
                )}
              >
                <InstitutionBadge institution={acc.institution} color={acc.color} size="xs" />
                <span>
                  <span className="block text-[13px] font-medium text-label">{acc.name}</span>
                  {/* El libre, no el total: es lo que de verdad se puede apartar. */}
                  <span className="tnum block text-[11px] text-label-tertiary">
                    {formatMoney(saldo?.libre ?? 0)} libre
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Cuánto
        </label>
        <MoneyInput value={monto} onChange={setMonto} placeholder="200.000" className="mb-2" />

        {excede && (
          <p className="mb-2 px-1 text-[12px] text-accent-orange">
            {cuenta?.name} solo tiene {formatMoney(libre)} sin apartar.
          </p>
        )}

        <p className="mb-5 px-1 text-[12px] leading-relaxed text-label-tertiary">
          El saldo de la cuenta no cambia: sigue siendo el del banco. Lo que
          cambia es cuánto de ese saldo queda libre.
        </p>

        <button
          onClick={() => {
            if (!listo || !categoryId || !cuenta) return
            haptic([14, 40, 22])
            asignarABolsillo({
              categoryId,
              accountId: cuenta.id,
              amount: modo === 'apartar' ? importe : -importe,
            })
            cerrar()
          }}
          disabled={!listo}
          className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                     shadow-glow disabled:bg-white/[0.06] disabled:text-label-tertiary disabled:shadow-none"
        >
          {modo === 'apartar' ? 'Apartar' : 'Devolver'}
        </button>
      </div>
    </Sheet>
  )
}
