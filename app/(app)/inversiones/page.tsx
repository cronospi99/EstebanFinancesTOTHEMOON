'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { HoldingRow } from '@/components/investments/holding-row'
import { formatMoney, formatPercent } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { USDCOP, useQuotes } from '@/lib/use-quotes'
import { cn, haptic } from '@/lib/utils'

export default function InvestmentsPage() {
  const { holdings } = useFinance()

  const symbols = useMemo(
    () => [...holdings.map((h) => h.symbol), USDCOP],
    [holdings],
  )
  const { quotes, loading, error, updatedAt, refresh } = useQuotes(symbols)

  // Sin tasa en vivo usamos un valor de respaldo para no dejar la pantalla vacía.
  const usdCop = quotes[USDCOP]?.price || 4100

  // ¿Tenemos al menos un precio real y fresco? De eso depende que podamos
  // hablar de "rendimiento": sin datos, cualquier porcentaje sería inventado.
  const hasMarketData = useMemo(
    () => holdings.some((h) => {
      const q = quotes[h.symbol]
      return Boolean(q && !q.stale && q.price > 0)
    }),
    [holdings, quotes],
  )

  const portfolio = useMemo(() => {
    let value = 0
    let cost = 0
    let dayChange = 0

    for (const h of holdings) {
      const q = quotes[h.symbol]
      const live = Boolean(q && !q.stale && q.price > 0)
      const fx = h.currency === 'USD' ? usdCop : 1
      const price = live ? q!.price : h.avgCost // sin precio: el costo es la mejor estimación
      value += price * h.quantity * fx
      cost += h.avgCost * h.quantity * fx
      dayChange += (live ? q!.change : 0) * h.quantity * fx
    }

    const pnl = value - cost
    return {
      value,
      cost,
      pnl,
      pnlPct: cost ? (pnl / cost) * 100 : 0,
      dayChange,
      dayChangePct: value - dayChange ? (dayChange / (value - dayChange)) * 100 : 0,
    }
  }, [holdings, quotes, usdCop])

  const up = portfolio.pnl >= 0

  return (
    <div className="space-y-6 px-5">
      <PageHeader title="Inversiones" subtitle="Portafolio en tiempo real" />

      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[13px] font-medium text-label-secondary">Valor del portafolio</span>
          <button
            onClick={() => {
              haptic(8)
              refresh()
            }}
            aria-label="Actualizar precios"
            className="press rounded-full p-1.5 text-label-tertiary"
          >
            <RefreshCw size={15} className={cn(loading && 'animate-spin')} />
          </button>
        </div>

        <div className="tnum mb-2 text-[36px] font-bold leading-none">
          {formatMoney(portfolio.value)}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {hasMarketData ? (
            <>
              <span
                className={cn(
                  'flex items-center gap-0.5 rounded-pill px-2 py-0.5 text-[12px] font-semibold',
                  up ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red',
                )}
              >
                {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {formatPercent(portfolio.pnlPct)}
              </span>
              <span className={cn('tnum text-[12px] font-medium', up ? 'text-accent-green' : 'text-accent-red')}>
                {up ? '+' : '−'}
                {formatMoney(Math.abs(portfolio.pnl))}
              </span>
              <span className="text-[12px] text-label-tertiary">total</span>
            </>
          ) : (
            <span className="rounded-pill bg-white/[0.07] px-2.5 py-1 text-[12px] font-medium text-label-secondary">
              Valorado al costo · sin datos de mercado
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-4">
          <div>
            <div className="mb-0.5 text-[12px] text-label-secondary">Hoy</div>
            {hasMarketData ? (
              <div
                className={cn(
                  'tnum text-[15px] font-semibold',
                  portfolio.dayChange >= 0 ? 'text-accent-green' : 'text-accent-red',
                )}
              >
                {portfolio.dayChange >= 0 ? '+' : '−'}
                {formatMoney(Math.abs(portfolio.dayChange))}
              </div>
            ) : (
              <div className="text-[15px] font-semibold text-label-tertiary">—</div>
            )}
          </div>
          <div>
            <div className="mb-0.5 text-[12px] text-label-secondary">USD / COP</div>
            <div className="tnum text-[15px] font-semibold">
              {usdCop.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              {!quotes[USDCOP]?.price && (
                <span className="ml-1 text-[11px] font-normal text-label-tertiary">aprox.</span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-accent-orange/10 px-3 py-2 text-[12px] text-accent-orange">
            {error}. Mostrando los últimos valores conocidos.
          </p>
        )}
        {!error && !hasMarketData && !loading && (
          <p className="mt-3 rounded-lg bg-accent-orange/10 px-3 py-2 text-[12px] leading-relaxed text-accent-orange">
            Sin cotizaciones disponibles. Las posiciones se muestran a su precio de
            compra, no a valor de mercado.
          </p>
        )}
        {updatedAt && !error && hasMarketData && (
          <p className="mt-3 text-[11px] text-label-tertiary">
            Actualizado {new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(updatedAt))}
            {' · '}se refresca cada minuto
          </p>
        )}
      </Card>

      <section>
        <CardHeader title="Posiciones" />
        <Card className="divide-y divide-hairline overflow-hidden">
          {holdings.map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
            >
              <HoldingRow holding={h} quote={quotes[h.symbol]} usdCop={usdCop} />
            </motion.div>
          ))}
          {!holdings.length && (
            <div className="p-8 text-center text-[14px] text-label-secondary">
              Aún no tienes posiciones registradas.
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
