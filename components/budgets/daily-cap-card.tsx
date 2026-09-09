'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Gauge, X } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { MoneyInput } from '@/components/ui/money-input'
import { formatMoney, parseKeypad } from '@/lib/format'
import { useFinance, useSpendToday } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

/**
 * Tope de gasto del día, para todo junto.
 *
 * Convive con los presupuestos del mes y no los repite: el del mes dice cuánto
 * cabe, este dice si hoy conviene parar. Un mes entero se puede fundir en tres
 * días sin que ningún presupuesto mensual se queje hasta que ya es tarde.
 *
 * Nunca bloquea un gasto. Solo lo cuenta y lo dice.
 */
export function DailyCapCard() {
  const { settings, setDailyCap } = useFinance()
  const { total } = useSpendToday()
  const [editando, setEditando] = useState(false)
  const [draft, setDraft] = useState('')

  const tope = settings.dailyCap ?? 0
  useEffect(() => { setDraft(tope ? String(Math.round(tope)) : '') }, [tope])

  const pct = tope > 0 ? total / tope : 0
  const pasado = tope > 0 && total > tope
  const restante = Math.max(tope - total, 0)

  const guardar = () => {
    haptic([14, 30])
    const v = parseKeypad(draft)
    setDailyCap(v > 0 ? v : null)
    setEditando(false)
  }

  return (
    <section>
      <CardHeader
        title="Tope diario"
        action={
          !editando && (
            <button
              onClick={() => { haptic(6); setEditando(true) }}
              className="text-[13px] font-medium text-accent-blue"
            >
              {tope > 0 ? 'Cambiar' : 'Poner tope'}
            </button>
          )
        }
      />

      <Card className="p-4">
        {editando ? (
          <div className="flex items-center gap-2">
            <MoneyInput
              value={draft} onChange={setDraft} autoFocus size="sm"
              placeholder="Sin tope" className="flex-1"
            />
            <button
              onClick={guardar} aria-label="Guardar tope diario"
              className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-blue text-white"
            >
              <Check size={17} />
            </button>
            <button
              onClick={() => { setEditando(false); setDraft(tope ? String(Math.round(tope)) : '') }}
              aria-label="Cancelar"
              className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline text-label-secondary"
            >
              <X size={17} />
            </button>
          </div>
        ) : tope > 0 ? (
          <>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="tnum text-[22px] font-bold text-label">{formatMoney(total)}</span>
              <span className="tnum text-[13px] text-label-tertiary">de {formatMoney(tope)}</span>
            </div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pct, 1) * 100}%` }}
                transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                className="h-full rounded-full"
                style={{ backgroundColor: pasado ? '#FF453A' : '#30D158' }}
              />
            </div>
            <p className={cn('text-[13px]', pasado ? 'text-accent-red' : 'text-label-secondary')}>
              {pasado
                ? `Te pasaste ${formatMoney(total - tope)} hoy.`
                : `Te quedan ${formatMoney(restante)} para hoy.`}
            </p>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Gauge size={18} className="shrink-0 text-label-tertiary" />
            <p className="text-[13px] leading-relaxed text-label-secondary">
              Sin tope diario. Hoy llevas <span className="tnum font-semibold text-label">{formatMoney(total)}</span>.
            </p>
          </div>
        )}
      </Card>
    </section>
  )
}
