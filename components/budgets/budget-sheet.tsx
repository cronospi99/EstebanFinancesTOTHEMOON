'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { CategoryIcon } from '@/components/ui/category-icon'
import { categoryById } from '@/lib/categories'
import { formatMoney, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { haptic } from '@/lib/utils'
import type { Bolsillo } from '@/lib/store'

/**
 * Editar un presupuesto: el tope del mes y el del día.
 *
 * Antes solo se podía cambiar el importe, y desde un campo diminuto dentro de
 * la fila que aparecía al pulsar «Editar». Los dos topes viven juntos porque
 * son la misma decisión a dos plazos: cuánto cabe en el mes y cuánto conviene
 * gastar de una sentada.
 */
export function BudgetSheet({
  bolsillo, onClose,
}: {
  /** El presupuesto a editar, o `null` con la hoja cerrada. */
  bolsillo: Bolsillo | null
  onClose: () => void
}) {
  const { setBudget, removeBudget } = useFinance()
  const [mes, setMes] = useState('')
  const [dia, setDia] = useState('')

  // Al abrir con otro presupuesto hay que recargar los campos: la hoja se
  // reutiliza y si no, se editaría el nuevo con las cifras del anterior.
  useEffect(() => {
    if (!bolsillo) return
    setMes(String(Math.round(bolsillo.amount)))
    setDia(bolsillo.dailyCap ? String(Math.round(bolsillo.dailyCap)) : '')
  }, [bolsillo])

  const cat = bolsillo ? categoryById(bolsillo.categoryId) : null
  const importe = parseKeypad(mes)

  return (
    <Sheet open={Boolean(bolsillo)} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <div className="mb-5 flex items-center justify-center gap-2">
          {cat && <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />}
          <h2 className="text-[17px] font-semibold">{cat?.name ?? 'Presupuesto'}</h2>
        </div>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Tope del mes
        </label>
        <MoneyInput value={mes} onChange={setMes} placeholder="500.000" className="mb-4" />

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Tope diario (opcional)
        </label>
        <MoneyInput value={dia} onChange={setDia} placeholder="Sin tope" className="mb-2" />
        <p className="mb-5 px-1 text-[12px] leading-relaxed text-label-tertiary">
          {parseKeypad(dia) > 0
            ? `Avisa al pasar de ${formatMoney(parseKeypad(dia))} en un solo día en esta categoría.`
            : 'Sin tope diario solo se vigila el total del mes.'}
        </p>

        <button
          onClick={() => {
            if (!bolsillo || importe <= 0) return
            haptic([14, 40, 22])
            // `null` y no `undefined`: uno borra el tope diario y el otro
            // significaría «déjalo como estaba», que aquí sería un error.
            setBudget(bolsillo.categoryId, importe, parseKeypad(dia) > 0 ? parseKeypad(dia) : null)
            onClose()
          }}
          disabled={importe <= 0}
          className="press mb-3 h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                     shadow-glow disabled:bg-white/[0.06] disabled:text-label-tertiary disabled:shadow-none"
        >
          Guardar
        </button>

        <button
          onClick={() => {
            if (!bolsillo) return
            haptic([16, 30])
            removeBudget(bolsillo.categoryId)
            onClose()
          }}
          className="press flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-hairline
                     text-[15px] font-medium text-accent-red"
        >
          <Trash2 size={16} />
          Quitar presupuesto
        </button>
        {Boolean(bolsillo?.asignado) && (
          <p className="mt-2 px-1 text-center text-[12px] leading-relaxed text-label-tertiary">
            Se devolverán {formatMoney(bolsillo!.asignado)} al saldo libre de sus cuentas.
          </p>
        )}
      </div>
    </Sheet>
  )
}
