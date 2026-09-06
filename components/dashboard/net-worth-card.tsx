'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Eye, EyeOff, TrendingUp, TriangleAlert } from 'lucide-react'
import { BalanceChart } from './balance-chart'
import { RangePicker } from './range-picker'
import { Card } from '@/components/ui/card'
import { formatMoney, formatPercent } from '@/lib/format'
import { RANGE_LABEL, useBalanceSeries, useExpectedYield, useMonthSummary, useNetWorthDetail, type RangeKey } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

export function NetWorthCard() {
  const { total: netWorth, incompleto, sinConvertir } = useNetWorthDetail()
  const [range, setRange] = useState<RangeKey>('1M')
  const series = useBalanceSeries(range)
  const { income, expense } = useMonthSummary()
  const { monthly, weightedApy } = useExpectedYield()
  const [hidden, setHidden] = useState(false)

  const first = series[0]?.value ?? netWorth
  const delta = netWorth - first
  const deltaPct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0
  const positive = delta >= 0

  return (
    <Card className="overflow-hidden p-5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[13px] font-medium text-label-secondary">Patrimonio neto</span>
        <button
          onClick={() => { haptic(8); setHidden((h) => !h) }}
          aria-label={hidden ? 'Mostrar saldos' : 'Ocultar saldos'}
          className="press rounded-full p-1.5 text-label-tertiary hover:text-label-secondary"
        >
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      <motion.div
        key={hidden ? 'h' : 's'}
        initial={{ opacity: 0.4 }} animate={{ opacity: 1 }}
        className="tnum mb-2 text-[38px] font-bold leading-none tracking-[-0.02em]"
      >
        {hidden ? '••••••••' : formatMoney(netWorth)}
      </motion.div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'flex items-center gap-0.5 rounded-pill px-2 py-0.5 text-[12px] font-semibold',
            positive ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red',
          )}
        >
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {formatPercent(deltaPct)}
        </span>
        <span className="text-[12px] text-label-tertiary">{RANGE_LABEL[range]}</span>
      </div>

      <div className="mb-2">
        <RangePicker value={range} onChange={setRange} />
      </div>

      {incompleto && (
        <Link
          href="/ajustes"
          className="mb-3 flex items-center gap-2 rounded-xl border border-accent-orange/25 bg-accent-orange/[0.08] px-3 py-2"
        >
          <TriangleAlert size={15} className="shrink-0 text-accent-orange" />
          <span className="text-[12px] leading-snug text-accent-orange">
            {sinConvertir === 1 ? 'Una cuenta en dólares queda' : `${sinConvertir} cuentas en dólares quedan`}{' '}
            fuera del total: falta la tasa de cambio. Tócalo para fijarla.
          </span>
        </Link>
      )}

      <BalanceChart data={series} positive={positive} />

      {/* Rendimiento proyectado por las tasas E.A. configuradas */}
      {weightedApy > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent-green/20 bg-accent-green/[0.07] px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green">
            <TrendingUp size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-label-secondary">Rendimiento esperado</p>
            <p className="tnum text-[15px] font-semibold text-label">
              {/* Redondeado: los céntimos de una proyección son precisión que no existe. */}
              {hidden ? '••••' : `+${formatMoney(Math.round(monthly))}`}
              <span className="ml-1 text-[12px] font-normal text-label-tertiary">al mes</span>
            </p>
          </div>
          <span className="tnum shrink-0 rounded-pill bg-accent-green/15 px-2.5 py-1 text-[13px] font-bold text-accent-green">
            {formatPercent(weightedApy, false, 2)}
          </span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-4">
        <Flow label="Ingresos" value={income} hidden={hidden} tone="green" />
        <Flow label="Gastos" value={expense} hidden={hidden} tone="red" />
      </div>
    </Card>
  )
}

function Flow({
  label, value, hidden, tone,
}: { label: string; value: number; hidden: boolean; tone: 'green' | 'red' }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', tone === 'green' ? 'bg-accent-green' : 'bg-accent-red')} />
        <span className="text-[12px] text-label-secondary">{label}</span>
      </div>
      <div className="tnum text-[17px] font-semibold">{hidden ? '••••' : formatMoney(value)}</div>
    </div>
  )
}
