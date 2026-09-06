'use client'

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { formatCompact } from '@/lib/format'

/**
 * Gráfico de patrimonio. Deliberadamente sin ejes, sin grid y sin leyenda:
 * en móvil la forma de la curva comunica la tendencia, y el número exacto
 * ya está en el titular de arriba. Igual que la app Bolsa de Apple.
 */
export function BalanceChart({
  data, positive = true,
}: {
  data: { date: string; value: number }[]
  positive?: boolean
}) {
  const stroke = positive ? '#30D158' : '#FF453A'
  // El dominio ajustado al rango real (no a 0) es lo que revela el movimiento;
  // con dominio desde 0 una variación del 2% se vería como una línea plana.
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min) * 0.18 || Math.abs(max) * 0.05 || 1

  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.34} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[min - pad, max + pad]} />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.22)', strokeWidth: 1 }}
            contentStyle={{
              background: 'rgba(28,28,30,0.92)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              fontSize: 12,
              padding: '6px 10px',
            }}
            labelFormatter={(_, p) =>
              p?.[0]
                ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(
                    new Date(p[0].payload.date),
                  )
                : ''
            }
            formatter={(v: number) => [formatCompact(v), 'Patrimonio']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2.2}
            fill="url(#balanceFill)"
            // Sin puntos: aparecen solo al hacer hover/touch vía activeDot.
            dot={false}
            activeDot={{ r: 4, fill: stroke, stroke: '#000', strokeWidth: 2 }}
            isAnimationActive
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
