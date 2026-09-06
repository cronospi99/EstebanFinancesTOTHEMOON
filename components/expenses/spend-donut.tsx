'use client'

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { categoryById } from '@/lib/categories'
import { formatCompact, formatMoney } from '@/lib/format'

export function SpendDonut({
  data, total,
}: {
  data: { categoryId: string; amount: number }[]
  total: number
}) {
  const slices = data.slice(0, 6)
  const rest = data.slice(6).reduce((s, d) => s + d.amount, 0)
  const chartData = rest > 0 ? [...slices, { categoryId: 'other', amount: rest }] : slices

  if (!total) {
    return (
      <div className="flex h-[190px] items-center justify-center text-[14px] text-label-secondary">
        Sin gastos este mes.
      </div>
    )
  }

  return (
    <div className="relative h-[190px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="amount"
            nameKey="categoryId"
            innerRadius={62}
            outerRadius={84}
            paddingAngle={2.5}
            stroke="none"
            startAngle={90}
            endAngle={-270}
            animationDuration={900}
          >
            {chartData.map((d) => (
              <Cell key={d.categoryId} fill={categoryById(d.categoryId).color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* El total va en el centro del anillo: es el dato que se busca primero. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] uppercase tracking-wider text-label-tertiary">Gastado</span>
        <span className="tnum text-[22px] font-bold leading-tight">{formatCompact(total)}</span>
        <span className="tnum text-[10px] text-label-tertiary">{formatMoney(total)}</span>
      </div>
    </div>
  )
}
