'use client'

import { motion } from 'framer-motion'
import { CardHeader } from '@/components/ui/card'
import { CategoryIcon } from '@/components/ui/category-icon'
import { categoryById } from '@/lib/categories'
import { formatCompact } from '@/lib/format'
import { useFinance, useSpendByCategory } from '@/lib/store'

/** Anillo de progreso tipo Actividad de Apple. */
function Ring({ progress, color, size = 78 }: { progress: number; color: string; size?: number }) {
  const stroke = 7
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const clamped = Math.min(progress, 1)

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={stroke}
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - clamped) }}
        transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
      />
    </svg>
  )
}

export function BudgetRings() {
  const { budgets } = useFinance()
  const spend = useSpendByCategory()

  if (!budgets.length) return null

  const rows = budgets
    .map((b) => {
      const spent = spend.find((s) => s.categoryId === b.categoryId)?.amount ?? 0
      return { ...b, spent, progress: b.amount > 0 ? spent / b.amount : 0 }
    })
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

          return (
            <div
              key={row.categoryId}
              className="glass flex w-[128px] shrink-0 flex-col items-center rounded-card px-3 py-4"
            >
              <div className="relative flex items-center justify-center">
                <Ring progress={row.progress} color={color} />
                <div className="absolute">
                  <CategoryIcon icon={cat.icon} color={color} size="sm" />
                </div>
              </div>
              <div className="mt-2.5 text-center">
                <div className="text-[13px] font-semibold text-label">{cat.name}</div>
                <div className="tnum mt-0.5 text-[11px] text-label-tertiary">
                  {formatCompact(row.spent)} / {formatCompact(row.amount)}
                </div>
                <div
                  className="tnum mt-1 text-[12px] font-semibold"
                  style={{ color: over ? '#FF453A' : '#98989F' }}
                >
                  {Math.round(row.progress * 100)} %
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
