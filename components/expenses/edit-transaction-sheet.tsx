'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Segmented } from '@/components/ui/segmented'
import { AccountPicker } from '@/components/ui/account-picker'
import { CategoryPicker } from '@/components/ui/category-picker'
import { categoryById, DEFAULT_CATEGORIES } from '@/lib/categories'
import { formatKeypad, formatMoney, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

/** El día de un ISO, en hora local. `slice(0,10)` daría el día en UTC. */
function diaLocal(iso: string) {
  const d = new Date(iso)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/**
 * Devuelve el ISO del día elegido conservando la hora original del movimiento.
 * Mover un gasto a otro día no debería reordenarlo dentro de ese día ni
 * mandarlo a las 00:00.
 */
function conNuevoDia(iso: string, dia: string) {
  const original = new Date(iso)
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(
    a, m - 1, d,
    original.getHours(), original.getMinutes(), original.getSeconds(),
  ).toISOString()
}

function etiquetaFecha(dia: string) {
  const hoy = diaLocal(new Date().toISOString())
  if (dia === hoy) return 'Hoy'
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
  if (dia === diaLocal(ayer.toISOString())) return 'Ayer'
  const [a, m, d] = dia.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(a, m - 1, d))
}

/**
 * Edición de un movimiento ya registrado.
 *
 * Todo lo que se puede equivocar al registrar en cinco toques —el valor, el
 * día, la cuenta con la que se pagó— se puede corregir aquí. El saldo de las
 * cuentas lo recuadra el store: deshace el movimiento anterior y aplica el
 * nuevo, así que cambiar de tarjeta mueve el importe de una a otra.
 */
export function EditTransactionSheet({
  transaction, onClose,
}: {
  transaction: Transaction | null
  onClose: () => void
}) {
  const { accounts, updateTransaction, deleteTransaction, fxRate } = useFinance()

  const [raw, setRaw] = useState('')
  // 'transfer' existe en el esquema pero la app no lo genera; al editar uno
  // se trata como gasto, que es como ya se contabilizaba.
  const [mode, setMode] = useState<'expense' | 'income'>('expense')
  const [categoryId, setCategoryId] = useState('food')
  const [accountId, setAccountId] = useState('')
  const [pocketId, setPocketId] = useState<string | undefined>()
  const [note, setNote] = useState('')
  const [dia, setDia] = useState('')
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  // Al abrir sobre otro movimiento, el formulario se rellena con el suyo.
  useEffect(() => {
    if (!transaction) return
    setRaw(String(transaction.amount).replace('.', ','))
    setMode(transaction.type === 'income' ? 'income' : 'expense')
    setCategoryId(transaction.categoryId)
    setAccountId(transaction.accountId)
    setPocketId(transaction.pocketId)
    setNote(transaction.description)
    setDia(diaLocal(transaction.occurredAt))
    setConfirmarBorrado(false)
  }, [transaction])

  const cuenta = accounts.find((a) => a.id === accountId)
  const currency = cuenta?.currency ?? 'COP'
  const amount = parseKeypad(raw)

  const categorias = useMemo(() => DEFAULT_CATEGORIES.filter((c) => c.kind === mode), [mode])

  // Gasto e ingreso no comparten categorías.
  useEffect(() => {
    if (!categorias.some((c) => c.id === categoryId)) setCategoryId(categorias[0]?.id ?? 'other')
  }, [categorias, categoryId])

  const puedeGuardar = Boolean(transaction) && amount > 0 && Boolean(accountId)

  function guardar() {
    if (!transaction || !puedeGuardar) return
    haptic([14, 40, 22])

    updateTransaction(transaction.id, {
      amount,
      type: mode,
      categoryId,
      accountId,
      pocketId,
      currency,
      description: note.trim() || categoryById(categoryId).name,
      occurredAt: conNuevoDia(transaction.occurredAt, dia),
    }).catch(() => {
      /* El cambio ya está en el estado en memoria — ver "cola de escrituras". */
    })

    onClose()
  }

  function borrar() {
    if (!transaction) return
    haptic([18, 30])
    deleteTransaction(transaction.id).catch(() => {})
    onClose()
  }

  return (
    <Sheet open={Boolean(transaction)} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-4 text-center text-[17px] font-semibold">Editar movimiento</h2>

        <Segmented
          id="editar-tipo" className="mx-auto mb-5 max-w-[220px]"
          value={mode} onChange={(v) => setMode(v)}
          options={[{ value: 'expense' as const, label: 'Gasto' }, { value: 'income' as const, label: 'Ingreso' }]}
        />

        {/* Valor */}
        <Etiqueta>Valor</Etiqueta>
        <div className="mb-1 flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3">
          <span className="text-[20px] text-label-secondary">{currency === 'USD' ? 'US$' : '$'}</span>
          <input
            value={raw ? formatKeypad(raw) : ''}
            placeholder="0"
            inputMode="decimal"
            onChange={(e) => {
              // Se conserva una sola coma y como mucho dos decimales.
              const limpio = e.target.value.replace(/[^\d,]/g, '')
              const [ent, ...dec] = limpio.split(',')
              setRaw(dec.length ? `${ent},${dec.join('').slice(0, 2)}` : ent)
            }}
            className={cn(
              'tnum w-full bg-transparent text-[26px] font-semibold placeholder:text-label-tertiary focus:outline-none',
              mode === 'income' ? 'text-accent-green' : 'text-label',
            )}
          />
        </div>
        <div className="mb-5 h-4 px-1">
          {currency === 'USD' && amount > 0 && fxRate > 0 && (
            <span className="tnum text-[12px] text-label-tertiary">≈ {formatMoney(amount * fxRate)}</span>
          )}
        </div>

        {/* Fecha */}
        <Etiqueta>Fecha</Etiqueta>
        <label className="press mb-5 flex cursor-pointer items-center gap-2.5 rounded-xl border border-hairline
                          bg-white/[0.05] px-4 py-3">
          <CalendarDays size={17} className="shrink-0 text-label-tertiary" />
          <span className="flex-1 text-[16px] text-label">{dia ? etiquetaFecha(dia) : '—'}</span>
          <input
            type="date" value={dia}
            onChange={(e) => { if (e.target.value) { haptic(6); setDia(e.target.value) } }}
            className="w-[26px] bg-transparent text-[15px] text-label-tertiary [color-scheme:dark] focus:outline-none"
          />
        </label>

        {/* Medio de pago */}
        <Etiqueta>Medio de pago</Etiqueta>
        <AccountPicker
          accountId={accountId}
          pocketId={pocketId}
          onChange={(c, b) => { setAccountId(c); setPocketId(b) }}
        />

        {/* Categoría */}
        <div className="mt-3">
          <Etiqueta>Categoría</Etiqueta>
        </div>
        <div className="mb-5">
          <CategoryPicker mode={mode} value={categoryId} onChange={setCategoryId} />
        </div>

        {/* Nota */}
        <Etiqueta>Descripción</Etiqueta>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={categoryById(categoryId).name}
          className="mb-6 w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3
                     text-[16px] text-label placeholder:text-label-tertiary
                     focus:border-accent-blue/50 focus:outline-none"
        />

        <motion.button
          whileTap={{ scale: puedeGuardar ? 0.97 : 1 }}
          onClick={guardar}
          disabled={!puedeGuardar}
          className={cn(
            'h-[52px] w-full rounded-2xl text-[17px] font-semibold transition-all duration-200',
            puedeGuardar
              ? 'bg-accent-blue text-white shadow-glow'
              : 'bg-white/[0.06] text-label-tertiary',
          )}
        >
          Guardar cambios
        </motion.button>

        {/* Borrar pide confirmación: aquí el dedo ya viene de tocar botones. */}
        {confirmarBorrado ? (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setConfirmarBorrado(false)}
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
            onClick={() => { haptic(6); setConfirmarBorrado(true) }}
            className="press mt-3 flex h-[46px] w-full items-center justify-center gap-2
                       text-[15px] font-medium text-accent-red"
          >
            <Trash2 size={16} /> Eliminar movimiento
          </button>
        )}
      </div>
    </Sheet>
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
      {children}
    </p>
  )
}
