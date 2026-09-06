'use client'

import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { formatMoney, formatPercent, formatQuantity } from '@/lib/format'
import type { Holding, Quote } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

const TYPE_BADGE: Record<Holding['assetType'], string> = {
  stock: 'Acción', etf: 'ETF', crypto: 'Cripto', fx: 'Divisa', cdt: 'CDT',
}

export function HoldingRow({
  holding, quote, usdCop, onEdit, onDelete,
}: {
  holding: Holding
  quote?: Quote
  usdCop: number
  onEdit?: () => void
  onDelete?: () => void
}) {
  // Solo un precio real y fresco cuenta como "en vivo": sin esto mostraríamos
  // un 0,00 % en verde que se lee como sesión plana cuando no hay ni un dato.
  const live = Boolean(quote && !quote.stale && quote.price > 0)

  const fx = holding.currency === 'USD' ? usdCop : 1
  const price = live ? quote!.price : holding.avgCost
  const marketValue = price * holding.quantity * fx
  const cost = holding.avgCost * holding.quantity * fx
  const pnlPct = cost ? ((marketValue - cost) / cost) * 100 : 0
  const up = pnlPct >= 0
  const dayUp = (quote?.changePercent ?? 0) >= 0

  return (
    <motion.div
      layout
      drag={onDelete ? 'x' : false}
      dragConstraints={{ left: -72, right: 0 }}
      dragElastic={{ left: 0.12, right: 0 }}
      className="relative"
    >
      {onDelete && (
        <button
          onClick={() => { haptic([18, 30]); onDelete() }}
          aria-label={`Eliminar ${holding.symbol}`}
          className="absolute inset-y-0 right-0 flex w-[72px] items-center justify-center bg-accent-red/85 text-white"
        >
          <Trash2 size={18} />
        </button>
      )}

      <button
        onClick={onEdit}
        className="relative flex w-full items-center gap-3 bg-[#0E0E10] px-4 py-3.5 text-left active:bg-white/[0.03]"
      >
        <div className="flex h-10 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-[11px] font-bold tracking-tight text-label">
          {holding.symbol.replace('-USD', '').slice(0, 5)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-label">{holding.name}</div>
          <div className="tnum truncate text-[12px] text-label-tertiary">
            {formatQuantity(holding.quantity)} · {TYPE_BADGE[holding.assetType]}
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
              <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-medium text-label-tertiary">
                sin precio
              </span>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  )
}
