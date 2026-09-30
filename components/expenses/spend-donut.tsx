'use client'

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { categoryById } from '@/lib/categories'
import { formatCompact, formatMoney } from '@/lib/format'

/**
 * El anillo por categorías, para gastos o para ingresos.
 *
 * Las seis categorías más grandes van con su color y el resto se junta en una
 * porción: con doce colores el anillo ya no se lee. Esa porción toma el color
 * de «Otros» del mismo lado —gasto o ingreso—, que no es el mismo.
 */
export function SpendDonut({
  data, total, etiqueta = 'Gastado', vacio = 'Sin gastos en este período.', restoId = 'other',
}: {
  data: { categoryId: string; amount: number }[]
  total: number
  /** Lo que se lee sobre la cifra del centro. */
  etiqueta?: string
  /** Lo que se dice cuando no hay nada. */
  vacio?: string
  /** La categoría con la que se pinta lo que no cabe en las seis primeras. */
  restoId?: string
}) {
  const slices = data.slice(0, 6)
  const rest = data.slice(6).reduce((s, d) => s + d.amount, 0)
  const chartData = rest > 0 ? [...slices, { categoryId: restoId, amount: rest }] : slices

  if (!total) {
    return (
      <div className="flex h-[190px] items-center justify-center text-[14px] text-label-secondary">
        {vacio}
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
        <span className="text-[11px] uppercase tracking-wider text-label-tertiary">{etiqueta}</span>
        <span className="tnum text-[22px] font-bold leading-tight">{formatCompact(total)}</span>
        <span className="tnum text-[10px] text-label-tertiary">{formatMoney(total)}</span>
      </div>
    </div>
  )
}
