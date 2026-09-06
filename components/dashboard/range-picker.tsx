'use client'

import { motion } from 'framer-motion'
import { RANGE_DAYS, type RangeKey } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

const ORDEN: RangeKey[] = ['1D', '5D', '1S', '1M', '3M', '6M', '1A', '5A']

/** Selector de rango al estilo de la app Bolsa: el activo se subraya. */
export function RangePicker({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <div className="-mx-1 flex gap-0.5 overflow-x-auto px-1 no-scrollbar">
      {ORDEN.map((r) => {
        const activo = r === value
        return (
          <button
            key={r}
            onClick={() => { haptic(6); onChange(r) }}
            aria-label={`Rango ${r} (${RANGE_DAYS[r]} días)`}
            className={cn(
              'relative shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold tabular-nums transition-colors',
              activo ? 'text-label' : 'text-label-tertiary',
            )}
          >
            {activo && (
              <motion.span
                layoutId="range-thumb"
                transition={{ type: 'spring', damping: 30, stiffness: 420 }}
                className="absolute inset-0 rounded-lg bg-white/[0.12]"
              />
            )}
            <span className="relative z-10">{r}</span>
          </button>
        )
      })}
    </div>
  )
}
