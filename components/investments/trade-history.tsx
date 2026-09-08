'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, Flag } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { IssuerBadge } from '@/components/ui/issuer-badge'
import { EditTradeSheet } from './edit-trade-sheet'
import { formatMoney, formatQuantity } from '@/lib/format'
import { useFinance, useOperacionesPorSimbolo } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Trade } from '@/lib/types'

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))

/**
 * Historial de operaciones, agrupado por símbolo.
 *
 * Agrupar por símbolo y no por fecha es lo que responde la pregunta que uno se
 * hace de verdad: «¿a cuánto he ido comprando esto?». La cabecera de cada
 * grupo lleva la posición que resulta de sus operaciones, así que se ve de un
 * vistazo si el libro cuadra con lo que se tiene.
 */
export function TradeHistory() {
  const { accounts } = useFinance()
  const grupos = useOperacionesPorSimbolo()
  const [editando, setEditando] = useState<Trade | null>(null)

  if (!grupos.length) {
    return (
      <Card className="p-8 text-center">
        <p className="text-[15px] font-medium text-label">Sin operaciones registradas</p>
        <p className="mx-auto mt-1 max-w-[280px] text-[13px] leading-relaxed text-label-secondary">
          Cada compra o venta que registres queda aquí, con su fecha y su precio.
          Las posiciones que ya tenías se incorporan al historial la primera vez
          que registres algo sobre ellas.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <section key={g.symbol}>
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <IssuerBadge symbol={g.symbol} size="sm" />
              <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-label">{g.symbol}</h2>
              {/* Sin nombre propio, repetir el símbolo debajo solo hace ruido. */}
              {g.nombre !== g.symbol && (
                <p className="truncate text-[12px] text-label-tertiary">{g.nombre}</p>
              )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="tnum text-[13px] font-semibold text-label">
                {formatQuantity(g.quantity)} unid.
              </p>
              <p className="tnum text-[11px] text-label-tertiary">
                promedio {formatMoney(g.avgCost, g.operaciones[0].currency)}
              </p>
            </div>
          </div>

          <Card className="divide-y divide-hairline overflow-hidden">
            {g.operaciones.map((t, i) => {
              const compra = t.side === 'buy'
              const cuenta = accounts.find((a) => a.id === t.accountId)
              return (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.25 }}
                  onClick={() => { haptic(6); setEditando(t) }}
                  aria-label={`Editar operación de ${t.symbol}`}
                  className="press-soft flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      t.opening
                        ? 'bg-white/[0.07] text-label-tertiary'
                        : compra ? 'bg-accent-green/[0.18] text-accent-green' : 'bg-accent-red/[0.18] text-accent-red',
                    )}
                  >
                    {t.opening ? <Flag size={15} /> : compra ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-label">
                      {t.opening ? 'Posición inicial' : compra ? 'Compra' : 'Venta'}
                      <span className="tnum ml-1.5 text-[13px] font-normal text-label-secondary">
                        {formatQuantity(t.quantity)}
                      </span>
                    </p>
                    <p className="truncate text-[12px] text-label-tertiary">
                      {fecha(t.occurredAt)}
                      {cuenta && ' · '}
                      {cuenta?.name}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tnum text-[15px] font-semibold text-label">
                      {formatMoney(t.quantity * t.price, t.currency)}
                    </p>
                    <p className="tnum text-[11px] text-label-tertiary">
                      a {formatMoney(t.price, t.currency)}
                    </p>
                  </div>

                  {cuenta && (
                    <InstitutionBadge institution={cuenta.institution} color={cuenta.color} size="xs" />
                  )}
                </motion.button>
              )
            })}
          </Card>
        </section>
      ))}

      <EditTradeSheet trade={editando} onClose={() => setEditando(null)} />
    </div>
  )
}
