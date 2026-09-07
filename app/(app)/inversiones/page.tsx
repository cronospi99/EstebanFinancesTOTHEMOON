'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Plus, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { HoldingRow } from '@/components/investments/holding-row'
import { AddHoldingSheet } from '@/components/investments/add-holding-sheet'
import { TradeHistory } from '@/components/investments/trade-history'
import { formatMoney, formatPercent } from '@/lib/format'
import { accountTotal, precioDe, useFinance, useInvestmentsValue } from '@/lib/store'
import type { Currency, Holding } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

const MONEDA_KEY = 'eftm.inv.moneda'

export default function InvestmentsPage() {
  const {
    holdings, accounts, deleteHolding, fxRate, fx, quotes, quotesLoading, quotesFallos, refreshQuotes,
  } = useFinance()
  const [adding, setAdding] = useState(false)
  const [tab, setTab] = useState<'posiciones' | 'historial'>('posiciones')

  /*
   * Moneda en la que se enseña el portafolio. Se recuerda entre visitas: quien
   * lleva la cabeza en dólares no quiere volver a cambiarlo cada vez.
   */
  const [moneda, setMoneda] = useState<Currency>('COP')
  useEffect(() => {
    try {
      if (localStorage.getItem(MONEDA_KEY) === 'USD') setMoneda('USD')
    } catch { /* storage bloqueado */ }
  }, [])

  const cambiarMoneda = (m: Currency) => {
    haptic(8)
    setMoneda(m)
    try { localStorage.setItem(MONEDA_KEY, m) } catch { /* noop */ }
  }

  // Sin tasa de cambio no hay pesos que enseñar: todo va en dólares.
  const enUSD = moneda === 'USD' || fxRate <= 0
  /** Convierte un importe ya calculado en pesos a la moneda elegida. */
  const enMoneda = (cop: number) => (enUSD ? (fxRate > 0 ? cop / fxRate : cop) : cop)
  const divisa: Currency = enUSD ? 'USD' : 'COP'
  const [editing, setEditing] = useState<Holding | null>(null)

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

  const up = (fxRate > 0 ? portfolio.pnl : portfolio.pnlUsd) >= 0

  return (
    <div className="space-y-6 px-5">
      <PageHeader title="Inversiones" subtitle="Portafolio en tiempo real" />

      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-label-secondary">Valor del portafolio</span>
          <div className="flex items-center gap-1">
            {/* Cambio de moneda. Sin tasa no hay nada que elegir: se desactiva
                en vez de ofrecer un botón que no haría nada. */}
            <div className="flex overflow-hidden rounded-pill border border-hairline">
              {(['COP', 'USD'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => cambiarMoneda(m)}
                  disabled={fxRate <= 0}
                  aria-pressed={divisa === m}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    divisa === m ? 'bg-white/[0.14] text-label' : 'text-label-tertiary',
                    fxRate <= 0 && 'opacity-40',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={() => { haptic(8); refreshQuotes() }}
              aria-label="Actualizar precios"
              className="press rounded-full p-1.5 text-label-tertiary"
            >
              <RefreshCw size={15} className={cn(quotesLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="tnum mb-2 text-[36px] font-bold leading-none tracking-[-0.02em]">
          {/* Sin tasa se muestra en dólares. Antes se descartaban las
              posiciones en USD y el total salía en cero, que se lee como
              "no tienes nada". */}
          {fxRate > 0 ? formatMoney(enMoneda(portfolio.value), divisa) : formatMoney(portfolio.usd, 'USD')}
        </div>
        {fxRate <= 0 && portfolio.usd > 0 && (
          <p className="mb-2 text-[12px] text-accent-orange">
            En dólares: falta la tasa de cambio para convertirlo a pesos.
          </p>
        )}

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
                {formatPercent(fxRate > 0 ? portfolio.pnlPct : portfolio.pnlPctUsd)}
              </span>
              <span className={cn('tnum text-[12px] font-medium', up ? 'text-accent-green' : 'text-accent-red')}>
                {up ? '+' : '−'}
                {fxRate > 0
                  ? formatMoney(Math.abs(enMoneda(portfolio.pnl)), divisa)
                  : formatMoney(Math.abs(portfolio.pnlUsd), 'USD')}
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
                {dayChange >= 0 ? '+' : '−'}{formatMoney(Math.abs(enMoneda(dayChange)), divisa)}
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

        {!hasMarketData && !quotesLoading && holdings.length > 0 && (
          <p className="mt-3 rounded-lg bg-accent-orange/10 px-3 py-2 text-[12px] leading-relaxed text-accent-orange">
            Sin cotizaciones disponibles. Las posiciones se muestran a su precio de
            compra, no a valor de mercado.
            {/* Con el detalle a la vista se distingue «el símbolo no existe» de
                «el proveedor nos está bloqueando», que se veían igual. */}
            {quotesFallos.length > 0 && (
              <span className="mt-1.5 block text-[11px] leading-relaxed text-accent-orange/70">
                {quotesFallos.slice(0, 3).join(' · ')}
              </span>
            )}
          </p>
        )}
        {hasMarketData && (
          <p className="mt-3 text-[11px] text-label-tertiary">Se refresca cada minuto</p>
        )}
      </Card>

      {/* Las posiciones dicen qué tienes; el historial, cómo llegaste ahí. */}
      <Segmented
        id="inversiones"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'posiciones' as const, label: 'Posiciones' },
          { value: 'historial' as const, label: 'Historial' },
        ]}
      />

      {tab === 'posiciones' ? (
        <>
        {byAccount.map(([accId, items]) => {
          const acc = accounts.find((a) => a.id === accId)
          // Suma las posiciones y el efectivo que haya en la propia cuenta: en
          // ARQ o Trii conviven las participaciones y el saldo sin invertir, y
          // ver solo una mitad no dice cuánto tienes ahí.
          const posiciones = items.reduce((s, h) => {
            const { precio } = precioDe(h, quotes)
            const fx = h.currency === 'USD' ? fxRate : 1
            if (h.currency === 'USD' && fxRate <= 0) return s
            return s + precio * h.quantity * fx
          }, 0)
          const efectivo = acc ? (acc.currency === 'USD' ? (fxRate > 0 ? accountTotal(acc) * fxRate : 0) : accountTotal(acc)) : 0
          const subtotal = posiciones + efectivo

          return (
            <section key={accId}>
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  {acc && <InstitutionBadge institution={acc.institution} color={acc.color} size="sm" />}
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-label-tertiary">
                    {acc?.name ?? 'Sin plataforma'}
                  </h2>
                </div>
                <span className="tnum text-[13px] font-semibold text-label-secondary">{formatMoney(enMoneda(subtotal), divisa)}</span>
              </div>
              <Card className="divide-y divide-hairline overflow-hidden">
                {acc && accountTotal(acc) !== 0 && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-10 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-[10px] font-bold text-label-secondary">
                      EFVO
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-label">Efectivo sin invertir</p>
                      <p className="text-[12px] text-label-tertiary">Saldo disponible en {acc.name}</p>
                    </div>
                    <span className="tnum shrink-0 text-[15px] font-semibold text-label">
                      {formatMoney(enMoneda(efectivo), divisa)}
                    </span>
                  </div>
                )}
                {items.map((h, i) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <HoldingRow
                      holding={h}
                      quote={quotes[h.symbol]}
                      usdCop={fxRate}
                      moneda={divisa}
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
        </>
      ) : (
        <TradeHistory />
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
