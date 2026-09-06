'use client'

import { motion } from 'framer-motion'
import { Delete } from 'lucide-react'
import { haptic } from '@/lib/utils'

/**
 * Teclado numérico. La tecla "000" existe porque en pesos colombianos casi
 * todo se mide en miles: escribir 45.000 son 3 pulsaciones, no 5.
 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const

export function Keypad({
  onDigit, onDelete,
}: {
  onDigit: (d: string) => void
  onDelete: () => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => {
        const isDelete = key === 'del'
        return (
          <motion.button
            key={key}
            whileTap={{ scale: 0.94, backgroundColor: 'rgba(255,255,255,0.14)' }}
            transition={{ duration: 0.08 }}
            onClick={() => {
              haptic(isDelete ? 12 : 7)
              isDelete ? onDelete() : onDigit(key)
            }}
            // onPointerDown además de onClick: elimina el retardo de ~100ms
            // que algunos navegadores móviles añaden antes del click.
            aria-label={isDelete ? 'Borrar' : key}
            className="flex h-[58px] items-center justify-center rounded-2xl bg-white/[0.06]
                       text-[26px] font-light tabular-nums text-label
                       transition-colors active:bg-white/[0.14]"
          >
            {isDelete ? <Delete size={23} strokeWidth={2} className="text-label-secondary" /> : key}
          </motion.button>
        )
      })}
    </div>
  )
}
