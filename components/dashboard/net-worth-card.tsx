'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Eye, EyeOff } from 'lucide-react'
import { BalanceChart } from './balance-chart'
import { Card } from '@/components/ui/card'
import { formatMoney, formatPercent } from '@/lib/format'
import { useBalanceSeries, useMonthSummary, useNetWorth } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

export function NetWorthCard() {
  const netWorth = useNetWorth()
  const series = useBalanceSeries(30)
  const { income, expense } = useMonthSummary()
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
          onClick={() => {
            haptic(8)
            setHidden((h) => !h)
          }}
          aria-label={hidden ? 'Mostrar saldos' : 'Ocultar saldos'}
          className="press rounded-full p-1.5 text-label-tertiary hover:text-label-secondary"
        >
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      <motion.div
        key={hidden ? 'h' : 's'}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        className="tnum mb-2 text-[38px] font-bold leading-none"
      >
        {hidden ? '••••••••' : formatMoney(netWorth)}
      </motion.div>

      <div className="mb-4 flex items-center gap-1.5">
        <span
          className={cn(
            'flex items-center gap-0.5 rounded-pill px-2 py-0.5 text-[12px] font-semibold',
            positive ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red',
          )}
        >
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {formatPercent(deltaPct)}
        </span>
        <span className="text-[12px] text-label-tertiary">últimos 30 días</span>
      </div>

      <BalanceChart data={series} positive={positive} />

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-4">
        <Flow label="Ingresos" value={income} hidden={hidden} tone="green" />
        <Flow label="Gastos" value={expense} hidden={hidden} tone="red" />
      </div>
    </Card>
  )
}

function Flow({
  label, value, hidden, tone,
}: {
  label: string
  value: number
  hidden: boolean
  tone: 'green' | 'red'
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className={cn('h-1.5 w-1.5 rounded-full', tone === 'green' ? 'bg-accent-green' : 'bg-accent-red')}
        />
        <span className="text-[12px] text-label-secondary">{label}</span>
      </div>
      <div className="tnum text-[17px] font-semibold">
        {hidden ? '••••' : formatMoney(value)}
      </div>
    </div>
  )
}
