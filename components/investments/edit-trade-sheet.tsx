'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Segmented } from '@/components/ui/segmented'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { investmentPlatforms } from '@/lib/categories'
import { formatKeypad, formatMoney, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Trade } from '@/lib/types'

/** El día de un ISO en hora local. `slice(0,10)` daría el día en UTC. */
function diaLocal(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Cambia el día conservando la hora: el orden dentro del día importa. */
function conNuevoDia(iso: string, dia: string) {
  const o = new Date(iso)
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(a, m - 1, d, o.getHours(), o.getMinutes(), o.getSeconds()).toISOString()
}

function etiquetaFecha(dia: string) {
  const [a, m, d] = dia.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(a, m - 1, d))
}

/**
 * Edición de una operación de inversión.
 *
 * Cambiar aquí cualquier cifra rehace la posición entera desde el libro, así
 * que corregir la primera compra de cinco sale bien sin tocar nada más. El
 * símbolo no se edita: mover una operación a otro símbolo es borrarla de una
 * posición y crearla en otra, y eso se hace explícitamente.
 */
export function EditTradeSheet({ trade, onClose }: { trade: Trade | null; onClose: () => void }) {
  const { accounts, updateTrade, deleteTrade, asegurarPlataforma, fxRate } = useFinance()
  const plataformas = investmentPlatforms()

  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [qty, setQty] = useState('')
  const [precio, setPrecio] = useState('')
  const [dia, setDia] = useState('')
  const [plataforma, setPlataforma] = useState('')
  const [confirmar, setConfirmar] = useState(false)

  useEffect(() => {
    if (!trade) return
    setSide(trade.side)
    setQty(String(trade.quantity).replace('.', ','))
    setPrecio(String(trade.price).replace('.', ','))
    setDia(diaLocal(trade.occurredAt))
    setPlataforma(accounts.find((a) => a.id === trade.accountId)?.institution ?? plataformas[0]?.name ?? '')
    setConfirmar(false)
    // Solo al cambiar de operación: incluir `accounts` reiniciaría el
    // formulario en mitad de la edición al crearse una plataforma nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade])

  const cantidad = parseKeypad(qty)
  const precioNum = parseKeypad(precio)
  const puedeGuardar = Boolean(trade) && cantidad > 0 && precioNum > 0
  const total = cantidad * precioNum
  const cur = trade?.currency ?? 'USD'

  async function guardar() {
    if (!trade || !puedeGuardar) return
    haptic([14, 40, 22])
    const accountId = plataforma ? await asegurarPlataforma(plataforma) : trade.accountId
    updateTrade(trade.id, {
      side,
      quantity: cantidad,
      price: precioNum,
      accountId,
      occurredAt: conNuevoDia(trade.occurredAt, dia),
    }).catch(() => {})
    onClose()
  }

  function borrar() {
    if (!trade) return
    haptic([18, 30])
    deleteTrade(trade.id).catch(() => {})
    onClose()
  }

  return (
    <Sheet open={Boolean(trade)} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="text-center text-[17px] font-semibold">Editar operación</h2>
        <p className="mb-5 text-center text-[13px] text-label-secondary">
          {trade?.symbol}
          {trade?.opening && ' · posición inicial'}
        </p>

        <Segmented
          id="trade-side" className="mx-auto mb-5 max-w-[220px]"
          value={side} onChange={(v) => setSide(v)}
          options={[{ value: 'buy' as const, label: 'Compra' }, { value: 'sell' as const, label: 'Venta' }]}
        />

        <Etiqueta>Cantidad</Etiqueta>
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3">
          <input
            value={qty} inputMode="decimal" placeholder="0"
            onChange={(e) => setQty(limpiarDecimal(e.target.value, 8))}
            className="tnum w-full bg-transparent text-[22px] font-semibold text-label placeholder:text-label-tertiary focus:outline-none"
          />
          <span className="text-[14px] text-label-tertiary">unid.</span>
        </div>

        <Etiqueta>Precio por unidad</Etiqueta>
        <div className="mb-1 flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3">
          <span className="text-[18px] text-label-secondary">{cur === 'USD' ? 'US$' : '$'}</span>
          <input
            value={precio ? formatKeypad(precio) : ''} inputMode="decimal" placeholder="0"
            onChange={(e) => setPrecio(limpiarDecimal(e.target.value, 4))}
            className="tnum w-full bg-transparent text-[22px] font-semibold text-label placeholder:text-label-tertiary focus:outline-none"
          />
        </div>
        <p className="tnum mb-5 px-1 text-[12px] text-label-tertiary">
          Total {formatMoney(total, cur)}
          {cur === 'USD' && fxRate > 0 && ` · ≈ ${formatMoney(total * fxRate)}`}
        </p>

        <Etiqueta>Fecha</Etiqueta>
        <label className="press mb-5 flex cursor-pointer items-center gap-2.5 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3">
          <CalendarDays size={17} className="shrink-0 text-label-tertiary" />
          <span className="flex-1 text-[16px] text-label">{dia ? etiquetaFecha(dia) : '—'}</span>
          <input
            type="date" value={dia}
            onChange={(e) => { if (e.target.value) { haptic(6); setDia(e.target.value) } }}
            className="w-[26px] bg-transparent text-[15px] text-label-tertiary [color-scheme:dark] focus:outline-none"
          />
        </label>

        <Etiqueta>Plataforma</Etiqueta>
        <div className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
          {plataformas.map((p) => (
            <button
              key={p.name}
              onClick={() => { haptic(6); setPlataforma(p.name) }}
              className={cn(
                'press flex shrink-0 items-center gap-2 rounded-pill border py-1 pl-1 pr-3 text-[12px] font-medium transition-colors',
                p.name === plataforma ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
              )}
            >
              <InstitutionBadge institution={p.name} color={p.color} size="xs" />
              {p.name}
            </button>
          ))}
        </div>

        <motion.button
          whileTap={{ scale: puedeGuardar ? 0.97 : 1 }}
          onClick={guardar}
          disabled={!puedeGuardar}
          className={cn(
            'h-[52px] w-full rounded-2xl text-[17px] font-semibold transition-all duration-200',
            puedeGuardar ? 'bg-accent-blue text-white shadow-glow' : 'bg-white/[0.06] text-label-tertiary',
          )}
        >
          Guardar cambios
        </motion.button>

        {confirmar ? (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setConfirmar(false)}
              className="press h-[46px] flex-1 rounded-2xl border border-hairline text-[15px] font-medium text-label-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={borrar}
              className="press h-[46px] flex-1 rounded-2xl bg-accent-red text-[15px] font-semibold text-white"
            >
              Sí, eliminar
            </button>
          </div>
        ) : (
          <button
            onClick={() => { haptic(6); setConfirmar(true) }}
            className="press mt-3 flex h-[46px] w-full items-center justify-center gap-2 text-[15px] font-medium text-accent-red"
          >
            <Trash2 size={16} /> Eliminar operación
          </button>
        )}
      </div>
    </Sheet>
  )
}

/** Conserva una sola coma y como mucho `dec` decimales. */
function limpiarDecimal(valor: string, dec: number) {
  const limpio = valor.replace(/[^\d,]/g, '')
  const [ent, ...resto] = limpio.split(',')
  return resto.length ? `${ent},${resto.join('').slice(0, dec)}` : ent
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
      {children}
    </p>
  )
}
