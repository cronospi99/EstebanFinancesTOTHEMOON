'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, ChevronDown, Eye, EyeOff, TrendingUp, TriangleAlert } from 'lucide-react'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { tasaCongelada } from '@/components/ui/fx-note'
import { BalanceChart } from './balance-chart'
import { RangePicker } from './range-picker'
import { Card } from '@/components/ui/card'
import { formatMoney, formatPercent } from '@/lib/format'
import { RANGE_LABEL, useBalanceSeries, useExpectedYield, useFinance, useMonthSummary, useNetWorthDetail, useYieldBreakdown, type RangeKey } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

export function NetWorthCard() {
  const { total: netWorth, incompleto, sinConvertir } = useNetWorthDetail()
  const { fx } = useFinance()
  const [range, setRange] = useState<RangeKey>('1M')
  const series = useBalanceSeries(range)
  const { income, expense } = useMonthSummary()
  const { monthly, weightedApy } = useExpectedYield()
  const [hidden, setHidden] = useState(false)
  const [verDesglose, setVerDesglose] = useState(false)
  const desglose = useYieldBreakdown()

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

      {/*
        Una tasa congelada mueve esta cifra entera y en silencio.

        Todo lo que está en dólares —el portafolio, las cuentas en USD— se
        convierte con la misma tasa, así que si dejó de seguir al mercado el
        patrimonio de arriba es de otro día. Con la tasa en vivo no se dice
        nada: lo normal no necesita aviso.
      */}
      {!incompleto && tasaCongelada(fx) && (
        <Link
          href="/ajustes"
          className="mb-3 flex items-center gap-2 rounded-xl border border-accent-orange/25 bg-accent-orange/[0.08] px-3 py-2"
        >
          <TriangleAlert size={15} className="shrink-0 text-accent-orange" />
          <span className="text-[12px] leading-snug text-accent-orange">
            {fx.origin === 'manual'
              ? 'La tasa USD/COP está fijada a mano, así que este total no sigue al mercado.'
              : 'La tasa USD/COP no se ha podido actualizar; este total puede estar desfasado.'}
          </span>
        </Link>
      )}

      <BalanceChart data={series} positive={positive} />

      {/* Rendimiento proyectado por las tasas E.A. configuradas */}
      {weightedApy > 0 && (
        <div className="mt-4 rounded-2xl border border-accent-green/20 bg-accent-green/[0.07] px-4 py-3">
          <button
            onClick={() => { haptic(6); setVerDesglose((v) => !v) }}
            className="flex w-full items-center gap-3 text-left"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green">
              <TrendingUp size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[12px] text-label-secondary">
                Rendimiento esperado
                <motion.span animate={{ rotate: verDesglose ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={12} className="text-label-tertiary" />
                </motion.span>
              </p>
              <p className="tnum text-[15px] font-semibold text-label">
                {/* Redondeado: los céntimos de una proyección son precisión que no existe. */}
                {hidden ? '••••' : `+${formatMoney(Math.round(monthly))}`}
                <span className="ml-1 text-[12px] font-normal text-label-tertiary">al mes</span>
              </p>
            </div>
            <span className="tnum shrink-0 rounded-pill bg-accent-green/15 px-2.5 py-1 text-[13px] font-bold text-accent-green">
              {formatPercent(weightedApy, false, 2)}
            </span>
          </button>

          {/* Desglose: la media ponderada dice cuánto rinde el conjunto, no
              cuál de las cuentas lo aporta. */}
          <AnimatePresence initial={false}>
            {verDesglose && desglose.length > 0 && (
              <motion.div
                key="desglose"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <ul className="mt-3 space-y-2 border-t border-accent-green/15 pt-3">
                  {desglose.map((f) => (
                    <li key={f.key} className="flex items-center gap-2.5">
                      <InstitutionBadge institution={f.institution} color={f.color} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-label">{f.nombre}</p>
                        {f.esBolsillo && (
                          <p className="truncate text-[11px] text-label-tertiary">bolsillo de {f.cuenta}</p>
                        )}
                      </div>
                      <span className="tnum shrink-0 text-[11px] text-label-tertiary">
                        {formatPercent(f.apy, false, 1)}
                      </span>
                      <span className="tnum w-[86px] shrink-0 text-right text-[13px] font-semibold text-accent-green">
                        {hidden ? '••••' : `+${formatMoney(Math.round(f.mensual))}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
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
