'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CardHeader } from '@/components/ui/card'
import { CategoryIcon } from '@/components/ui/category-icon'
import { AllocateSheet } from '@/components/budgets/allocate-sheet'
import { BudgetSheet } from '@/components/budgets/budget-sheet'
import { categoryById } from '@/lib/categories'
import { formatCompact } from '@/lib/format'
import { useBolsillos } from '@/lib/store'
import { haptic } from '@/lib/utils'
import type { Bolsillo } from '@/lib/store'

/**
 * Anillo de progreso tipo Actividad de Apple, con dos arcos.
 *
 * El de dentro es lo apartado y el de fuera lo gastado. Con uno solo, un
 * presupuesto de 287 K con sus 287 K ya apartados y nada gastado se veía
 * exactamente igual que uno vacío y sin fondear: un aro gris al 0 %. Y son
 * dos situaciones opuestas — en la primera el dinero está listo y en la
 * segunda no existe.
 */
function Ring({
  gastado, apartado, color, size = 78,
}: {
  /** Fracción gastada del tope, 0..1+. */
  gastado: number
  /** Fracción del tope que ya está apartada, 0..1+. */
  apartado: number
  color: string
  size?: number
}) {
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.14} strokeWidth={stroke} />
      {/* Lo apartado: el mismo color, apagado. Es el suelo sobre el que se
          lee el gasto, no una segunda métrica que compita con él. */}
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeOpacity={0.42} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(apartado, 1)) }}
        transition={{ duration: 1, ease: [0.32, 0.72, 0, 1] }}
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(gastado, 1)) }}
        transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
      />
    </svg>
  )
}

export function BudgetRings() {
  const bolsillos = useBolsillos()
  const [editando, setEditando] = useState<Bolsillo | null>(null)
  const [asignandoA, setAsignandoA] = useState<string | null>(null)

  if (!bolsillos.length) return null

  const rows = bolsillos
    .map((b) => ({ ...b, progress: b.amount > 0 ? b.gastado / b.amount : 0 }))
    .sort((a, b) => b.progress - a.progress)

  return (
    <section>
      <CardHeader title="Presupuestos del mes" />
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 no-scrollbar lg:mx-0 lg:px-0">
        {rows.map((row) => {
          const cat = categoryById(row.categoryId)
          const over = row.progress > 1
          // Rojo al pasarse: el color comunica el estado antes que el número.
          const color = over ? '#FF453A' : cat.color
          const fondeado = row.amount > 0 ? row.asignado / row.amount : 0

          return (
            // Un botón, no un div: el presupuesto se abre desde aquí en las
            // dos versiones. Antes había que ir a Metas para tocar nada.
            <button
              key={row.categoryId}
              onClick={() => { haptic(6); setEditando(row) }}
              className="glass press-soft flex w-[128px] shrink-0 flex-col items-center rounded-card px-3 py-4 text-center"
            >
              <div className="relative flex items-center justify-center">
                <Ring gastado={row.progress} apartado={fondeado} color={color} />
                <div className="absolute">
                  <CategoryIcon icon={cat.icon} color={color} size="sm" />
                </div>
              </div>
              <div className="mt-2.5 w-full">
                <div className="text-[13px] font-semibold text-label">{cat.name}</div>

                {/*
                  Con dinero apartado, la cifra de arriba es cuánto llevas del
                  tope. «$ 0 / $ 287 K» con los 287 K ya guardados se leía como
                  «no tienes nada», que es lo contrario de lo que pasa: eran
                  cero de gasto, no cero de ahorro. Cada línea lleva su palabra
                  para que ninguna se pueda leer como la otra.
                */}
                {row.asignado > 0 ? (
                  <>
                    <div className="tnum mt-1 text-[11px] leading-tight">
                      <span className="font-semibold text-label">{formatCompact(row.asignado)}</span>
                      <span className="text-label-tertiary"> / {formatCompact(row.amount)}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-label-tertiary">apartado</div>
                    <div
                      className="tnum mt-1 text-[11px] font-medium"
                      style={{ color: row.disponible < 0 ? '#FF453A' : '#30D158' }}
                    >
                      {formatCompact(row.gastado)} gastado
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tnum mt-1 text-[11px] leading-tight">
                      <span className="font-semibold text-label">{formatCompact(row.gastado)}</span>
                      <span className="text-label-tertiary"> / {formatCompact(row.amount)}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-label-tertiary">gastado</div>
                    <div
                      className="tnum mt-1 text-[12px] font-semibold"
                      style={{ color: over ? '#FF453A' : '#98989F' }}
                    >
                      {Math.round(row.progress * 100)} %
                    </div>
                  </>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <BudgetSheet
        bolsillo={editando}
        onClose={() => setEditando(null)}
        onApartar={(categoryId) => { setEditando(null); setAsignandoA(categoryId) }}
      />
      <AllocateSheet categoryId={asignandoA} onClose={() => setAsignandoA(null)} />
    </section>
  )
}
