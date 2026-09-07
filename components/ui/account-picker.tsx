'use client'

import { InstitutionBadge } from './institution-badge'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

/**
 * Medio de pago: la cuenta y, dentro de ella, el bolsillo.
 *
 * Elegir cuenta limpia el bolsillo en la misma llamada. El bolsillo pertenece
 * a su cuenta, así que arrastrarlo a otra dejaría el movimiento apuntando a un
 * bolsillo inexistente y el saldo se descuadraría en silencio.
 */
export function AccountPicker({
  accountId, pocketId, onChange,
}: {
  accountId: string
  pocketId?: string
  onChange: (accountId: string, pocketId?: string) => void
}) {
  const { accounts } = useFinance()
  const cuenta = accounts.find((a) => a.id === accountId)
  const bolsillos = cuenta?.pockets ?? []

  return (
    <>
      <div className="-mx-5 mb-2 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
        {accounts.map((acc) => {
          const activa = acc.id === accountId
          return (
            <button
              key={acc.id}
              onClick={() => { haptic(6); onChange(acc.id, undefined) }}
              className={cn(
                'press flex shrink-0 items-center gap-2 rounded-pill border py-1 pl-1 pr-3 text-[12px] font-medium transition-colors',
                activa ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
              )}
            >
              <InstitutionBadge institution={acc.institution} color={acc.color} size="xs" />
              {acc.name}
              {acc.currency === 'USD' && <span className="text-[10px] text-label-tertiary">USD</span>}
            </button>
          )
        })}
      </div>

      {bolsillos.length > 0 && (
        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
          <button
            onClick={() => { haptic(6); onChange(accountId, undefined) }}
            className={cn(
              'press shrink-0 rounded-pill border px-3 py-1 text-[12px] font-medium transition-colors',
              !pocketId ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
            )}
          >
            General
          </button>
          {bolsillos.map((p) => (
            <button
              key={p.id}
              onClick={() => { haptic(6); onChange(accountId, p.id) }}
              className={cn(
                'press flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1 text-[12px] font-medium transition-colors',
                pocketId === p.id ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color ?? '#98989F' }} />
              {p.name}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
