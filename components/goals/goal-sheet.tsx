'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Goal } from '@/lib/types'

export const COLORES_META = ['#0A84FF', '#30D158', '#BF5AF2', '#FF9F0A', '#FF375F', '#40C8E0']

/**
 * Alta y edición de una meta, en la misma hoja.
 *
 * Antes solo se podía crear, abonar y borrar: una meta con la cifra mal puesta
 * o la fecha cambiada había que rehacerla desde cero, perdiendo lo abonado.
 * Con `meta` a `null` la hoja crea; con una meta, edita.
 */
export function GoalSheet({
  open, meta, indice, onClose,
}: {
  open: boolean
  /** La meta a editar, o `null` para crear una nueva. */
  meta: Goal | null
  /** Cuántas metas hay ya, para elegir color al crear. */
  indice: number
  onClose: () => void
}) {
  const { addGoal, updateGoal, deleteGoal } = useFinance()

  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [deadline, setDeadline] = useState('')
  const [color, setColor] = useState(COLORES_META[0])

  // Se recargan al abrir: la hoja se reutiliza entre metas y entre crear y
  // editar, así que sin esto se editaría una meta con los datos de otra.
  useEffect(() => {
    if (!open) return
    setName(meta?.name ?? '')
    setTarget(meta ? String(Math.round(meta.target)) : '')
    setSaved(meta ? String(Math.round(meta.saved)) : '')
    setDeadline(meta?.deadline ?? '')
    setColor(meta?.color ?? COLORES_META[indice % COLORES_META.length])
  }, [open, meta, indice])

  const objetivo = parseKeypad(target)
  const listo = Boolean(name.trim()) && objetivo > 0

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-5 text-center text-[17px] font-semibold">
          {meta ? 'Editar meta' : 'Nueva meta'}
        </h2>

        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Viaje a Japón" autoFocus={!meta}
          className="mb-3 w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-[16px]
                     text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">Objetivo</label>
        <MoneyInput value={target} onChange={setTarget} placeholder="12.000.000" className="mb-3" />

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">Ya ahorrado</label>
        <MoneyInput value={saved} onChange={setSaved} className="mb-3" />

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Fecha límite (opcional)
        </label>
        <input
          type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          className="mb-4 w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-[16px]
                     text-label focus:border-accent-blue/50 focus:outline-none [color-scheme:dark]"
        />

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">Color</label>
        <div className="mb-5 flex gap-2">
          {COLORES_META.map((c) => (
            <button
              key={c}
              onClick={() => { haptic(6); setColor(c) }}
              aria-label={`Color ${c}`}
              className={cn(
                'h-9 w-9 rounded-full transition-transform',
                color === c ? 'scale-110 ring-2 ring-ring-sel' : 'opacity-70',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          onClick={() => {
            if (!listo) return
            haptic([14, 40, 22])
            const campos = {
              name: name.trim(),
              target: objetivo,
              saved: parseKeypad(saved),
              deadline: deadline || undefined,
              color,
            }
            if (meta) updateGoal(meta.id, campos)
            else addGoal({ ...campos, currency: 'COP' })
            onClose()
          }}
          disabled={!listo}
          className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                     shadow-glow disabled:bg-fill-2 disabled:text-label-tertiary disabled:shadow-none"
        >
          {meta ? 'Guardar' : 'Crear meta'}
        </button>

        {meta && (
          <button
            onClick={() => { haptic([16, 30]); deleteGoal(meta.id); onClose() }}
            className="press mt-3 flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl
                       border border-hairline text-[15px] font-medium text-accent-red"
          >
            <Trash2 size={16} />
            Eliminar meta
          </button>
        )}
      </div>
    </Sheet>
  )
}
