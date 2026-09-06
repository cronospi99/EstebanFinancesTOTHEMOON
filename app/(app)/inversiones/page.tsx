'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Plus, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { HoldingRow } from '@/components/investments/holding-row'
import { AddHoldingSheet } from '@/components/investments/add-holding-sheet'
import { formatMoney, formatPercent } from '@/lib/format'
import { useFinance, useInvestmentsValue } from '@/lib/store'
import type { Holding } from '@/lib/types'
import { USDCOP, useQuotes } from '@/lib/use-quotes'
import { cn, haptic } from '@/lib/utils'

export default function InvestmentsPage() {
  const { holdings, accounts, deleteHolding, fxRate, fx } = useFinance()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Holding | null>(null)

  const symbols = useMemo(() => [...holdings.map((h) => h.symbol), USDCOP], [holdings])
  const { quotes, loading, error, updatedAt, refresh } = useQuotes(symbols)

  const hasMarketData = useMemo(
    () => holdings.some((h) => {
      const q = quotes[h.symbol]
      return Boolean(q && !q.stale && q.price > 0)
    }),
    [holdings, quotes],
  )

  const portfolio = useInvestmentsValue(quotes)

  const dayChange = useMemo(() => {
    let d = 0
    for (const h of holdings) {
      const q = quotes[h.symbol]
      const live = Boolean(q && !q.stale && q.price > 0)
      d += (live ? q!.change : 0) * h.quantity * (h.currency === 'USD' ? fxRate : 1)
    }
    return d
  }, [holdings, quotes, fxRate])

  /** Agrupa por plataforma: ver "cuánto tengo en ARQ" es la pregunta natural. */
  const byAccount = useMemo(() => {
    const map = new Map<string, Holding[]>()
    holdings.forEach((h) => {
      const key = h.accountId ?? '__sin'
      map.set(key, [...(map.get(key) ?? []), h])
    })
    return [...map.entries()]
  }, [holdings])

  const up = portfolio.pnl >= 0

  return (
    <div className="space-y-6 px-5">
      <PageHeader title="Inversiones" subtitle="Portafolio en tiempo real" />

      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[13px] font-medium text-label-secondary">Valor del portafolio</span>
          <button
            onClick={() => { haptic(8); refresh() }}
            aria-label="Actualizar precios"
            className="press rounded-full p-1.5 text-label-tertiary"
          >
            <RefreshCw size={15} className={cn(loading && 'animate-spin')} />
          </button>
        </div>

        <div className="tnum mb-2 text-[36px] font-bold leading-none tracking-[-0.02em]">
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
                {up ? '+' : '−'}{formatMoney(Math.abs(portfolio.pnl))}
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
              <div className={cn('tnum text-[15px] font-semibold', dayChange >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                {dayChange >= 0 ? '+' : '−'}{formatMoney(Math.abs(dayChange))}
              </div>
            ) : (
              <div className="text-[15px] font-semibold text-label-tertiary">—</div>
            )}
          </div>
          <div>
            <div className="mb-0.5 text-[12px] text-label-secondary">USD / COP</div>
            {fxRate > 0 ? (
              <div className="tnum text-[15px] font-semibold">
                {fxRate.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                {fx.origin !== 'live' && (
                  <span className="ml-1 text-[11px] font-normal text-label-tertiary">
                    {fx.origin === 'manual' ? 'fijada' : 'guardada'}
                  </span>
                )}
              </div>
            ) : (
              <Link href="/ajustes" className="text-[13px] font-medium text-accent-orange">
                Sin tasa · fijar
              </Link>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-accent-orange/10 px-3 py-2 text-[12px] text-accent-orange">
            {error}. Mostrando los últimos valores conocidos.
          </p>
        )}
        {!error && !hasMarketData && !loading && holdings.length > 0 && (
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

      {byAccount.map(([accId, items]) => {
        const acc = accounts.find((a) => a.id === accId)
        const subtotal = items.reduce((s, h) => {
          const q = quotes[h.symbol]
          const live = Boolean(q && !q.stale && q.price > 0)
          return s + (live ? q!.price : h.avgCost) * h.quantity * (h.currency === 'USD' ? fxRate : 1)
        }, 0)

        return (
          <section key={accId}>
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                {acc && <InstitutionBadge institution={acc.institution} color={acc.color} size="sm" />}
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-label-tertiary">
                  {acc?.name ?? 'Sin plataforma'}
                </h2>
              </div>
              <span className="tnum text-[13px] font-semibold text-label-secondary">{formatMoney(subtotal)}</span>
            </div>
            <Card className="divide-y divide-hairline overflow-hidden">
              {items.map((h, i) => (
                <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <HoldingRow
                    holding={h}
                    quote={quotes[h.symbol]}
                    usdCop={fxRate}
                    onEdit={() => { haptic(6); setEditing(h) }}
                    onDelete={() => deleteHolding(h.id)}
                  />
                </motion.div>
              ))}
            </Card>
          </section>
        )
      })}

      {!holdings.length && (
        <Card className="p-8 text-center">
          <p className="text-[15px] font-medium text-label">Aún no tienes posiciones</p>
          <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
            Añade tus ETFs, acciones o cripto con la cantidad exacta que tengas.
          </p>
        </Card>
      )}

      <button
        onClick={() => { haptic(8); setAdding(true) }}
        className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline
                   bg-white/[0.04] py-3.5 text-[15px] font-medium text-accent-blue"
      >
        <Plus size={17} />
        Añadir posición
      </button>

      <AddHoldingSheet open={adding} onClose={() => setAdding(false)} />
      {editing && (
        <AddHoldingSheet
          key={editing.id}
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          editing={editing}
        />
      )}
    </div>
  )
}
