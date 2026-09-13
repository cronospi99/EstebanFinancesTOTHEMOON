'use client'

import { motion } from 'framer-motion'
import { Delete } from 'lucide-react'
import { haptic } from '@/lib/utils'

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [',', '0', 'del'],
]

export function Keypad({
  onDigit, onDelete, decimalDisabled,
}: {
  onDigit: (d: string) => void
  onDelete: () => void
  /** Bloquea la coma cuando ya hay uno o el importe no admite decimales. */
  decimalDisabled?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ROWS.flat().map((key) => {
        const isDelete = key === 'del'
        const isComma = key === ','
        const disabled = isComma && decimalDisabled
        return (
          <motion.button
            key={key}
            whileTap={disabled ? undefined : { scale: 0.94 }}
            transition={{ duration: 0.08 }}
            disabled={disabled}
            onClick={() => {
              if (disabled) return
              haptic(isDelete ? 12 : 7)
              isDelete ? onDelete() : onDigit(key)
            }}
            aria-label={isDelete ? 'Borrar' : isComma ? 'Coma decimal' : key}
            className="flex h-[56px] items-center justify-center rounded-2xl bg-fill-2
                       text-[26px] font-light tabular-nums text-label
                       transition-colors active:bg-fill-4 disabled:opacity-30"
          >
            {isDelete ? <Delete size={23} strokeWidth={2} className="text-label-secondary" /> : key}
          </motion.button>
        )
      })}
    </div>
  )
}

/**
 * Atajo de miles. En pesos casi todo se mide en miles, así que "45" + este
 * botón son dos toques en lugar de cinco. Va aparte del teclado para no
 * quitarle sitio a la coma decimal.
 */
export function ThousandsKey({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => { if (!disabled) { haptic(7); onPress() } }}
      disabled={disabled}
      className="press rounded-pill border border-hairline px-3 py-1 text-[13px] font-semibold
                 tabular-nums text-label-secondary disabled:opacity-30"
    >
      + 000
    </button>
  )
}
