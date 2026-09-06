'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils'

/**
 * Segmented control de iOS: el "thumb" blanco se desliza entre opciones
 * usando layoutId, que es exactamente el efecto del control nativo.
 */
export function Segmented<T extends string>({
  options, value, onChange, className, id = 'seg',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
  id?: string
}) {
  return (
    <div className={cn('flex rounded-pill bg-white/[0.07] p-[3px]', className)}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => {
              haptic(6)
              onChange(opt.value)
            }}
            className="relative flex-1 rounded-pill px-3 py-1.5 text-[13px] font-medium transition-colors"
          >
            {active && (
              <motion.span
                layoutId={`${id}-thumb`}
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                className="absolute inset-0 rounded-pill bg-white/[0.14] shadow-sm"
              />
            )}
            <span className={cn('relative z-10', active ? 'text-label' : 'text-label-secondary')}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
