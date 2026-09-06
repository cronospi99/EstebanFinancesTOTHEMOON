'use client'

import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Card, CardHeader } from '@/components/ui/card'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { CHART_REST, chartColor } from '@/lib/chart-palette'
import { formatCompact, formatMoney, formatPercent } from '@/lib/format'
import { accountTotal, toCOP, useFinance, useNetWorth } from '@/lib/store'

/** Más de esto y las porciones dejan de ser legibles; el resto se agrupa. */
const MAX_SLICES = 6

export function WealthDistribution() {
  const { accounts, fxRate } = useFinance()
  const netWorth = useNetWorth()
  const [active, setActive] = useState<number | null>(null)

  const slices = useMemo(() => {
    // Solo lo que suma: una tarjeta de crédito en negativo no es una porción
    // del patrimonio, es una deuda, y mezclarla falsearía las proporciones.
    const positivos = accounts
      .map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        color: a.color,
        value: toCOP(accountTotal(a), a.currency, fxRate),
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)

    if (positivos.length <= MAX_SLICES) return positivos
    const visibles = positivos.slice(0, MAX_SLICES)
    const resto = positivos.slice(MAX_SLICES).reduce((s, r) => s + r.value, 0)
    return [...visibles, { id: '__resto', name: 'Otros', institution: '', color: CHART_REST, value: resto }]
  }, [accounts, fxRate])

  const total = slices.reduce((s, r) => s + r.value, 0)
  const deudas = netWorth - total

  if (!slices.length) return null

  return (
    <section>
      <CardHeader title="Distribución del patrimonio" />
      <Card className="p-5">
        <div className="relative h-[196px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={64}
                outerRadius={88}
                // 2px de separación entre porciones: el hueco de superficie
                // evita que dos colores contiguos se lean como uno solo.
                paddingAngle={2}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                animationDuration={800}
                onMouseEnter={(_, i) => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                {slices.map((s, i) => (
                  <Cell
                    key={s.id}
                    fill={s.id === '__resto' ? CHART_REST : chartColor(i)}
                    opacity={active === null || active === i ? 1 : 0.35}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centro: el total, o la porción señalada */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {active === null ? (
              <>
                <span className="text-[11px] uppercase tracking-wider text-label-tertiary">Total</span>
                <span className="tnum text-[22px] font-bold leading-tight">{formatCompact(total)}</span>
              </>
            ) : (
              <>
                <span className="max-w-[110px] truncate text-[11px] text-label-secondary">{slices[active].name}</span>
                <span className="tnum text-[20px] font-bold leading-tight">{formatCompact(slices[active].value)}</span>
                <span className="tnum text-[11px] text-label-tertiary">
                  {formatPercent((slices[active].value / total) * 100, false, 1)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Leyenda: la identidad la dan el logo y el nombre, no el color.
            Hace además de tabla de datos con las cifras exactas. */}
        <ul className="mt-4 space-y-2 border-t border-hairline pt-4">
          {slices.map((s, i) => (
            <li
              key={s.id}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className="flex items-center gap-2.5"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: s.id === '__resto' ? CHART_REST : chartColor(i) }}
              />
              {s.institution
                ? <InstitutionBadge institution={s.institution} color={s.color} size="xs" />
                : <span className="h-5 w-5" />}
              <span className="min-w-0 flex-1 truncate text-[14px] text-label">{s.name}</span>
              <span className="tnum shrink-0 text-[13px] text-label-tertiary">
                {formatPercent((s.value / total) * 100, false, 0)}
              </span>
              <span className="tnum w-[92px] shrink-0 text-right text-[14px] font-semibold text-label">
                {formatMoney(s.value)}
              </span>
            </li>
          ))}
        </ul>

        {deudas < -1 && (
          <p className="tnum mt-3 border-t border-hairline pt-3 text-[12px] text-label-tertiary">
            Deudas descontadas del patrimonio: {formatMoney(deudas)}
          </p>
        )}
      </Card>
    </section>
  )
}
