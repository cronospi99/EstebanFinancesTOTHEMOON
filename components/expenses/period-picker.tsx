'use client'

import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PERIODOS, type Periodo } from '@/lib/periodos'
import { cn, haptic } from '@/lib/utils'

/**
 * Con qué vara se miden los gastos, y cuál de esas varas.
 *
 * Dos controles y no uno: arriba el tipo de período —semana, mes, trimestre…—
 * y debajo cuál, con flechas. Elegir «trimestre» sin poder retroceder al
 * anterior deja la mitad de la pregunta sin responder: lo interesante casi
 * siempre es comparar con el de antes.
 *
 * Hacia delante no se pasa del actual: no hay gastos en el futuro, y una
 * pantalla vacía que se puede alcanzar tocando parece un error.
 */
export function PeriodPicker({
  periodo, onPeriodo, desplazamiento, onDesplazamiento, etiqueta,
}: {
  periodo: Periodo
  onPeriodo: (p: Periodo) => void
  desplazamiento: number
  onDesplazamiento: (d: number) => void
  etiqueta: string
}) {
  return (
    <div>
      <div className="-mx-1 mb-2 flex gap-0.5 overflow-x-auto px-1 no-scrollbar">
        {PERIODOS.map((p) => {
          const activo = p.value === periodo
          return (
            <button
              key={p.value}
              onClick={() => { haptic(6); onPeriodo(p.value); onDesplazamiento(0) }}
              className={cn(
                'relative shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors',
                activo ? 'text-label' : 'text-label-tertiary',
              )}
            >
              {activo && (
                <motion.span
                  layoutId="periodo-thumb"
                  transition={{ type: 'spring', damping: 30, stiffness: 420 }}
                  className="absolute inset-0 rounded-lg bg-white/[0.12]"
                />
              )}
              <span className="relative z-10">{p.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => { haptic(6); onDesplazamiento(desplazamiento - 1) }}
          aria-label="Período anterior"
          className="press flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-label-secondary"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="text-[15px] font-semibold capitalize text-label">{etiqueta}</span>

        <button
          onClick={() => { haptic(6); onDesplazamiento(desplazamiento + 1) }}
          disabled={desplazamiento >= 0}
          aria-label="Período siguiente"
          className="press flex h-8 w-8 items-center justify-center rounded-full border border-hairline
                     text-label-secondary transition-opacity disabled:opacity-25"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
