'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CategoryIcon } from './category-icon'
import { categoriesByGroup, DEFAULT_CATEGORIES } from '@/lib/categories'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

/**
 * Selector de categoría.
 *
 * Arranca en una tira con las ocho más usadas —con cincuenta categorías, un
 * orden fijo obliga a buscar cada vez— y se despliega a la rejilla completa
 * agrupada solo si hace falta.
 */
export function CategoryPicker({
  mode, value, onChange,
}: {
  mode: 'expense' | 'income'
  value: string
  onChange: (categoryId: string) => void
}) {
  const { transactions } = useFinance()
  const [todas, setTodas] = useState(false)

  const categories = useMemo(() => DEFAULT_CATEGORIES.filter((c) => c.kind === mode), [mode])

  const frecuentes = useMemo(() => {
    const usos = new Map<string, number>()
    transactions.filter((t) => t.type === mode).forEach((t) => usos.set(t.categoryId, (usos.get(t.categoryId) ?? 0) + 1))
    return [...categories].sort((a, b) => (usos.get(b.id) ?? 0) - (usos.get(a.id) ?? 0)).slice(0, 8)
  }, [categories, transactions, mode])

  if (todas) {
    return (
      <div className="max-h-[210px] overflow-y-auto rounded-2xl border border-hairline bg-fill-1 p-3">
        {categoriesByGroup(mode).map(([group, cats]) => (
          <div key={group} className="mb-3 last:mb-0">
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-label-tertiary">
              {group}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {cats.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { haptic(6); onChange(cat.id); setTodas(false) }}
                  className={cn(
                    'press flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors',
                    cat.id === value ? 'bg-fill-4' : 'active:bg-fill-3',
                  )}
                >
                  <CategoryIcon icon={cat.icon} color={cat.color} size="xs" />
                  <span className="w-full truncate text-center text-[10px] leading-tight text-label-secondary">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
      {frecuentes.map((cat) => {
        const activa = cat.id === value
        return (
          <button
            key={cat.id}
            onClick={() => { haptic(6); onChange(cat.id) }}
            className={cn(
              'press flex shrink-0 items-center gap-2 rounded-pill border py-1 pl-1 pr-3.5 transition-colors duration-200',
              activa ? 'border-transparent bg-fill-4' : 'border-hairline',
            )}
          >
            <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
            <span className={cn('text-[13px] font-medium', activa ? 'text-label' : 'text-label-secondary')}>
              {cat.name}
            </span>
          </button>
        )
      })}
      <button
        onClick={() => { haptic(6); setTodas(true) }}
        className="flex shrink-0 items-center gap-1 rounded-pill border border-hairline px-3.5 py-1
                   text-[13px] font-medium text-accent-blue"
      >
        Todas <ChevronDown size={14} />
      </button>
    </div>
  )
}
