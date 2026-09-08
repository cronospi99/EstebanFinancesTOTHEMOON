'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Search } from 'lucide-react'
import { IssuerBadge } from '@/components/ui/issuer-badge'
import { formatQuantity } from '@/lib/format'
import { nombreVisible } from '@/lib/issuers'
import { cn, haptic } from '@/lib/utils'
import type { Holding } from '@/lib/types'

/**
 * Selector de un símbolo que ya está en cartera.
 *
 * Era una tira horizontal de fichas, y no cabía: con cantidades de ocho
 * decimales cada ficha se iba a media pantalla y había que arrastrar a ciegas
 * para ver la tercera. Una lista desplegable enseña símbolo, nombre y cantidad
 * en la misma fila, cabe en vertical y se puede buscar — que es lo que ya hace
 * el selector de entidades, así que además se comporta igual.
 */
export function HoldingPicker({
  holdings, value, onChange,
}: {
  holdings: Holding[]
  /** Símbolo seleccionado, si coincide con alguno de la cartera. */
  value: string
  onChange: (symbol: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const actual = holdings.find((h) => h.symbol === value.trim().toUpperCase())
  const busca = q.trim().toUpperCase()
  const visibles = busca
    ? holdings.filter((h) =>
        h.symbol.includes(busca) || nombreVisible(h.symbol, h.name).toUpperCase().includes(busca))
    : holdings

  return (
    <div>
      <button
        onClick={() => { haptic(6); setOpen((o) => !o) }}
        className="press flex w-full items-center gap-3 rounded-xl border border-hairline bg-white/[0.05] px-3 py-2.5"
      >
        {actual ? (
          <>
            <IssuerBadge symbol={actual.symbol} size="sm" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[15px] font-semibold text-label">{actual.symbol}</span>
              <span className="block truncate text-[12px] text-label-tertiary">
                {formatQuantity(actual.quantity)} unid.
              </span>
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-left text-[15px] text-label-secondary">
            Elegir de tu portafolio
          </span>
        )}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={18} className="text-label-tertiary" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="lista"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-hairline bg-white/[0.03] p-2">
              {/* El buscador solo estorba con cuatro posiciones. */}
              {holdings.length > 6 && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-2">
                  <Search size={14} className="shrink-0 text-label-tertiary" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar símbolo"
                    className="w-full bg-transparent text-[15px] text-label placeholder:text-label-tertiary focus:outline-none"
                  />
                </div>
              )}

              <div className="max-h-[260px] overflow-y-auto overscroll-contain">
                {visibles.map((h) => {
                  const activa = h.symbol === value.trim().toUpperCase()
                  return (
                    <button
                      key={h.symbol}
                      onClick={() => { haptic(6); onChange(h.symbol); setOpen(false); setQ('') }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                        activa ? 'bg-white/[0.10]' : 'active:bg-white/[0.06]',
                      )}
                    >
                      <IssuerBadge symbol={h.symbol} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-label">{h.symbol}</span>
                        <span className="block truncate text-[12px] text-label-tertiary">
                          {nombreVisible(h.symbol, h.name)}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-[12px] text-label-secondary">
                        {formatQuantity(h.quantity)}
                      </span>
                      {activa && <Check size={16} className="shrink-0 text-accent-blue" />}
                    </button>
                  )
                })}
                {!visibles.length && (
                  <p className="px-2 py-6 text-center text-[13px] text-label-secondary">Sin resultados</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
