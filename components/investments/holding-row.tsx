'use client'

import { formatMoney, formatPercent } from '@/lib/format'
import type { Holding, Quote } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPE_BADGE: Record<Holding['assetType'], string> = {
  stock: 'Acción',
  etf: 'ETF',
  crypto: 'Cripto',
  fx: 'Divisa',
}

export function HoldingRow({
  holding, quote, usdCop,
}: {
  holding: Holding
  quote?: Quote
  usdCop: number
}) {
  // Solo consideramos "en vivo" un precio real y fresco. Sin esto mostraríamos
  // un 0,00 % en verde que se lee como "la sesión cerró plana" cuando en
  // realidad no tenemos ni un dato: en finanzas eso es peor que no mostrar nada.
  const live = Boolean(quote && !quote.stale && quote.price > 0)

  const fx = holding.currency === 'USD' ? usdCop : 1
  const price = live ? quote!.price : holding.avgCost
  const marketValue = price * holding.quantity * fx
  const cost = holding.avgCost * holding.quantity * fx
  const pnlPct = cost ? ((marketValue - cost) / cost) * 100 : 0
  const up = pnlPct >= 0
  const dayUp = (quote?.changePercent ?? 0) >= 0

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {/* Ticker como "logo": monoespaciado y en caja, al estilo de la app Bolsa */}
      <div className="flex h-10 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-[11px] font-bold tracking-tight text-label">
        {holding.symbol.replace('-USD', '').slice(0, 5)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-label">{holding.name}</div>
        <div className="tnum truncate text-[12px] text-label-tertiary">
          {holding.quantity.toLocaleString('es-CO', { maximumFractionDigits: 4 })} ·{' '}
          {TYPE_BADGE[holding.assetType]}
          {!live && ' · al costo'}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="tnum text-[15px] font-semibold text-label">{formatMoney(marketValue)}</div>
        <div className="flex items-center justify-end gap-1.5">
          {live ? (
            <>
              <span className={cn('tnum text-[11px]', dayUp ? 'text-accent-green' : 'text-accent-red')}>
                {formatPercent(quote!.changePercent)}
              </span>
              <span
                className={cn(
                  'tnum rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                  up ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red',
                )}
              >
                {formatPercent(pnlPct)}
              </span>
            </>
          ) : (
            // Estado neutro y explícito: sin precio no hay rendimiento que mostrar.
            <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-medium text-label-tertiary">
              sin precio
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
