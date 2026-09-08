'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { IssuerBadge } from '@/components/ui/issuer-badge'
import { formatMoney, formatPercent, formatQuantity } from '@/lib/format'
import type { Currency, Holding, Quote } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

const TYPE_BADGE: Record<Holding['assetType'], string> = {
  stock: 'Acción', etf: 'ETF', crypto: 'Cripto', fx: 'Divisa', cdt: 'CDT',
}

export function HoldingRow({
  holding, quote, usdCop, moneda = 'COP', onEdit, onDelete,
}: {
  holding: Holding
  quote?: Quote
  usdCop: number
  /** Moneda en la que se enseñan los importes de la fila. */
  moneda?: Currency
  onEdit?: () => void
  onDelete?: () => void
}) {
  /*
   * Deslizar para borrar y tocar para editar comparten el mismo dedo. Framer
   * dispara el click igual al soltar tras arrastrar, así que al intentar
   * borrar se abría el editor de la posición encima. Se marca el arrastre y se
   * deja caer ese click; el flag se limpia en el siguiente turno del bucle de
   * eventos, cuando el click ya pasó.
   */
  const arrastrando = useRef(false)

  // Solo un precio real y fresco cuenta como "en vivo": sin esto mostraríamos
  // un 0,00 % en verde que se lee como sesión plana cuando no hay ni un dato.
  const live = Boolean(quote && !quote.stale && quote.price > 0)

  const fx = holding.currency === 'USD' ? usdCop : 1
  const price = live ? quote!.price : holding.avgCost
  // Todo se calcula en pesos y se convierte al final: mezclar monedas por el
  // camino es como se cuelan los totales que no son de nadie.
  const valorCOP = price * holding.quantity * fx
  const costeCOP = holding.avgCost * holding.quantity * fx
  const aMoneda = (cop: number) => (moneda === 'USD' && usdCop > 0 ? cop / usdCop : cop)
  const marketValue = aMoneda(valorCOP)
  const pnlPct = costeCOP ? ((valorCOP - costeCOP) / costeCOP) * 100 : 0
  const up = pnlPct >= 0
  const dayUp = (quote?.changePercent ?? 0) >= 0

  return (
    /*
     * El botón de borrar vive FUERA del elemento que se arrastra.
     * Estaba dentro, así que al deslizar se movía con la fila y quedaba
     * flotando a media pantalla en vez de asomar por el borde derecho: el
     * gesto de iOS es la fila deslizándose sobre un botón quieto, no los dos
     * viajando juntos.
     */
    <div className="relative overflow-hidden">
      {onDelete && (
        <button
          onClick={() => { haptic([18, 30]); onDelete() }}
          aria-label={`Eliminar ${holding.symbol}`}
          className="absolute inset-y-0 right-0 flex w-[72px] items-center justify-center bg-accent-red/85 text-white"
        >
          <Trash2 size={18} />
        </button>
      )}

      <motion.div
        drag={onDelete ? 'x' : false}
        dragConstraints={{ left: -72, right: 0 }}
        dragElastic={{ left: 0.12, right: 0 }}
        onDragStart={() => { arrastrando.current = true }}
        onDragEnd={() => { setTimeout(() => { arrastrando.current = false }, 0) }}
        className="relative bg-[#0E0E10]"
      >
      <button
        onClick={() => { if (!arrastrando.current) onEdit?.() }}
        className="press-soft relative flex w-full items-center gap-3 bg-[#0E0E10] px-4 py-3.5 text-left active:bg-white/[0.03]"
      >
        <IssuerBadge symbol={holding.symbol} />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-label">{holding.name}</div>
          <div className="tnum truncate text-[12px] text-label-tertiary">
            {formatQuantity(holding.quantity)} · {TYPE_BADGE[holding.assetType]}
            {/* El precio unitario en vivo: es el dato que uno mira para saber
                si entrar o salir, y hasta ahora solo se veía el total. */}
            {live
              ? ` · ${formatMoney(quote!.price, holding.currency)}`
              : ' · al costo'}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="tnum text-[15px] font-semibold text-label">
            {formatMoney(marketValue, moneda)}
          </div>
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
    </div>
  )
}
