'use client'

import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Card, CardHeader } from '@/components/ui/card'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { CHART_REST, chartColor } from '@/lib/chart-palette'
import { formatCompact, formatMoney, formatPercent } from '@/lib/format'
import {
  accountTotal, toCOP, useFinance, useHoldingsValueByAccount, useInvestmentsValue, useNetWorth,
} from '@/lib/store'

/** Más de esto y las porciones dejan de ser legibles; el resto se agrupa. */
const MAX_SLICES = 6

export function WealthDistribution() {
  const { accounts, fxRate } = useFinance()
  const netWorth = useNetWorth()
  const porCuenta = useHoldingsValueByAccount()
  const inversiones = useInvestmentsValue()
  const [active, setActive] = useState<number | null>(null)

  const slices = useMemo(() => {
    /*
     * Cada porción es una plataforma, no una cuenta de efectivo.
     *
     * El donut sumaba solo los saldos y el patrimonio de arriba ya incluía el
     * portafolio, así que las dos cifras no cuadraban: en ARQ o Trii conviven
     * el efectivo sin invertir y las posiciones, y enseñar solo la mitad hacía
     * parecer que la plataforma no tenía casi nada. Ahora el valor de mercado
     * de las posiciones se suma a su plataforma, que además es de quien es el
     * logotipo que se ve en la leyenda.
     */
    const positivos = accounts
      .map((a) => {
        // null cuando es una cuenta en dólares y no se conoce la tasa.
        const efectivo = toCOP(accountTotal(a), a.currency, fxRate)
        const invertido = porCuenta.get(a.id) ?? 0
        return {
          id: a.id,
          name: a.name,
          institution: a.institution,
          color: a.color,
          invertido,
          value: efectivo === null ? (invertido > 0 ? invertido : null) : efectivo + invertido,
        }
      })
      .filter((r): r is typeof r & { value: number } => r.value !== null && r.value > 0)

    // Lo que se compró sin decir en qué plataforma. Sin esto se perdería del
    // donut y el total volvería a no cuadrar con el patrimonio.
    const conCuenta = [...porCuenta.values()].reduce((t, v) => t + v, 0)
    const sueltas = inversiones.value - conCuenta
    if (sueltas > 1) {
      positivos.push({
        id: '__inversiones', name: 'Inversiones', institution: '', color: CHART_REST,
        invertido: sueltas, value: sueltas,
      })
    }

    positivos.sort((a, b) => b.value - a.value)

    if (positivos.length <= MAX_SLICES) return positivos
    const visibles = positivos.slice(0, MAX_SLICES)
    const resto = positivos.slice(MAX_SLICES).reduce((s, r) => s + r.value, 0)
    return [...visibles, {
      id: '__resto', name: 'Otros', institution: '', color: CHART_REST, invertido: 0, value: resto,
    }]
  }, [accounts, fxRate, porCuenta, inversiones.value])

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
              {/* Fuera del nombre y sin encoger: dentro se truncaba a «$ 20,3 M
                  inv…», que es justo la palabra que le daba sentido. Que una
                  porción lleve inversiones cambia cómo se lee — no es dinero
                  disponible, es valor de mercado. */}
              {s.invertido > 0 && (
                <span className="tnum shrink-0 text-[11px] text-label-tertiary">
                  {formatCompact(s.invertido)} inv.
                </span>
              )}
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
