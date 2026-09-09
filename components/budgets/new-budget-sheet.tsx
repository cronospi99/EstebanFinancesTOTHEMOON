'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { CategoryIcon } from '@/components/ui/category-icon'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
import { formatMoney, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Category } from '@/lib/types'

/** Sin dato previo hay que proponer algo; se cambia en el mismo paso. */
const SUGERENCIA = 200_000

/**
 * Crear un presupuesto.
 *
 * Antes era una tira horizontal de fichas debajo de la lista: había que
 * arrastrarla a ciegas entre cuarenta categorías para encontrar la que se
 * quería, y al tocarla se creaba con 200.000 fijos que luego tocaba editar
 * en otra hoja. Dos pasos y una cifra inventada.
 *
 * Ahora es una hoja propia con buscador, las categorías agrupadas como en el
 * resto de la app, y el importe y el tope diario en el mismo sitio.
 */
export function NewBudgetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { budgets, setBudget } = useFinance()
  const [q, setQ] = useState('')
  const [elegida, setElegida] = useState<Category | null>(null)
  const [mes, setMes] = useState(String(SUGERENCIA))
  const [dia, setDia] = useState('')

  const disponibles = useMemo(
    () => DEFAULT_CATEGORIES.filter((c) => c.kind === 'expense' && !budgets.some((b) => b.categoryId === c.id)),
    [budgets],
  )

  const busca = q.trim().toLowerCase()
  const grupos = useMemo(() => {
    const filtradas = busca
      ? disponibles.filter((c) => c.name.toLowerCase().includes(busca))
      : disponibles
    const mapa = new Map<string, Category[]>()
    for (const c of filtradas) mapa.set(c.group, [...(mapa.get(c.group) ?? []), c])
    return [...mapa.entries()]
  }, [disponibles, busca])

  const importe = parseKeypad(mes)
  const cerrar = () => { setQ(''); setElegida(null); setMes(String(SUGERENCIA)); setDia(''); onClose() }

  return (
    <Sheet open={open} onClose={cerrar}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-5 text-center text-[17px] font-semibold">
          {elegida ? 'Cuánto al mes' : 'Nuevo presupuesto'}
        </h2>

        {/* Un paso cada vez: primero qué, después cuánto. Las dos preguntas
            juntas en una hoja larga hacen que no se conteste ninguna. */}
        {!elegida ? (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-3 py-2.5">
              <Search size={16} className="shrink-0 text-label-tertiary" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} autoFocus
                placeholder="Buscar categoría"
                className="w-full bg-transparent text-[16px] text-label placeholder:text-label-tertiary focus:outline-none"
              />
            </div>

            <div className="max-h-[52vh] space-y-4 overflow-y-auto overscroll-contain">
              {grupos.map(([grupo, cats]) => (
                <div key={grupo}>
                  <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-label-tertiary">
                    {grupo}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {cats.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { haptic(6); setElegida(c) }}
                        className="press flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.04] p-2 text-left"
                      >
                        <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                        <span className="min-w-0 truncate text-[14px] text-label">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!grupos.length && (
                <p className="py-8 text-center text-[13px] text-label-secondary">
                  {disponibles.length
                    ? 'Ninguna categoría coincide.'
                    : 'Todas las categorías de gasto ya tienen presupuesto.'}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => { haptic(6); setElegida(null) }}
              className="press mb-4 flex w-full items-center gap-2.5 rounded-xl border border-hairline bg-white/[0.04] p-3 text-left"
            >
              <CategoryIcon icon={elegida.icon} color={elegida.color} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-label">{elegida.name}</span>
              <span className="shrink-0 text-[13px] text-accent-blue">Cambiar</span>
            </button>

            <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              Tope del mes
            </label>
            <MoneyInput value={mes} onChange={setMes} autoFocus placeholder="500.000" className="mb-4" />

            <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              Tope diario (opcional)
            </label>
            <MoneyInput value={dia} onChange={setDia} placeholder="Sin tope" className="mb-2" />
            <p className="mb-5 px-1 text-[12px] leading-relaxed text-label-tertiary">
              {parseKeypad(dia) > 0
                ? `Avisa al pasar de ${formatMoney(parseKeypad(dia))} en un solo día.`
                : 'Puedes ponerlo después. Sin él solo se vigila el total del mes.'}
            </p>

            <button
              onClick={() => {
                if (importe <= 0) return
                haptic([14, 40, 22])
                setBudget(elegida.id, importe, parseKeypad(dia) > 0 ? parseKeypad(dia) : null)
                cerrar()
              }}
              disabled={importe <= 0}
              className={cn(
                'press h-[52px] w-full rounded-2xl text-[17px] font-semibold text-white shadow-glow',
                'bg-accent-blue disabled:bg-white/[0.06] disabled:text-label-tertiary disabled:shadow-none',
              )}
            >
              Crear presupuesto
            </button>
          </>
        )}
      </div>
    </Sheet>
  )
}
