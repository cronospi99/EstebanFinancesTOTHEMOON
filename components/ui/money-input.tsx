'use client'

import { formatKeypad } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Currency } from '@/lib/types'

/**
 * Campo de importe.
 *
 * El mismo bloque —símbolo, `formatKeypad` al pintar, filtro de dígitos y
 * comas al escribir, tabular en la tipografía— estaba copiado en las metas,
 * los presupuestos y la tasa de cambio, y cada copia se separaba un poco de
 * las demás. El teclado va en `decimal` y no en `numeric` porque los importes
 * en pesos llevan decimales en dólares y aquí conviven las dos monedas.
 */
export function MoneyInput({
  value, onChange, currency = 'COP', placeholder = '0', autoFocus, size = 'md', className,
}: {
  /** Texto en crudo, tal cual se teclea: dígitos y comas. */
  value: string
  onChange: (raw: string) => void
  currency?: Currency
  placeholder?: string
  autoFocus?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const grande = size === 'md'
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-hairline bg-fill-2',
        grande ? 'px-4 py-3' : 'px-3 py-2',
        className,
      )}
    >
      <span className={cn('shrink-0 text-label-secondary', grande ? 'text-[18px]' : 'text-[14px]')}>
        {currency === 'USD' ? 'US$' : '$'}
      </span>
      <input
        value={value ? formatKeypad(value) : ''}
        onChange={(e) => onChange(e.target.value.replace(/[^\d,]/g, ''))}
        placeholder={placeholder}
        inputMode="decimal"
        autoFocus={autoFocus}
        className={cn(
          'tnum w-full bg-transparent font-semibold text-label placeholder:font-normal placeholder:text-label-tertiary focus:outline-none',
          grande ? 'text-[20px]' : 'text-[15px]',
        )}
      />
    </div>
  )
}
