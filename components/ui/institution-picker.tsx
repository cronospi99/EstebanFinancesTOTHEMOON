'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Search } from 'lucide-react'
import { InstitutionBadge } from './institution-badge'
import { institutionsByGroup, type Institution } from '@/lib/categories'
import { cn, haptic } from '@/lib/utils'

/**
 * Selector de entidad: lista desplegable agrupada por categoría y ordenada
 * alfabéticamente dentro de cada grupo.
 *
 * Sustituye a la tira horizontal, que con más de veinte entidades obligaba a
 * arrastrar a ciegas sin saber cuántas quedaban ni dónde estaba cada una.
 */
export function InstitutionPicker({
  value, onChange,
}: {
  value: Institution
  onChange: (i: Institution) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const grupos = institutionsByGroup()
    .map(([g, items]) => [g, items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))] as const)
    .filter(([, items]) => items.length > 0)

  return (
    <div>
      <button
        onClick={() => { haptic(6); setOpen((o) => !o) }}
        className="press flex w-full items-center gap-3 rounded-xl border border-hairline bg-fill-2 px-3 py-2.5"
      >
        <InstitutionBadge institution={value.name} size="sm" />
        <span className="min-w-0 flex-1 truncate text-left text-[16px] font-medium text-label">{value.name}</span>
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
            <div className="mt-2 rounded-xl border border-hairline bg-fill-1 p-2">
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-fill-2 px-2.5 py-2">
                <Search size={14} className="shrink-0 text-label-tertiary" />
                <input
                  value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar entidad"
                  className="w-full bg-transparent text-[15px] text-label placeholder:text-label-tertiary focus:outline-none"
                />
              </div>

              <div className="max-h-[260px] overflow-y-auto overscroll-contain">
                {grupos.map(([grupo, items]) => (
                  <div key={grupo} className="mb-2 last:mb-0">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-label-tertiary">
                      {grupo}
                    </p>
                    {items.map((inst) => {
                      const activa = inst.name === value.name
                      return (
                        <button
                          key={inst.name}
                          onClick={() => { haptic(6); onChange(inst); setOpen(false); setQ('') }}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                            activa ? 'bg-fill-3' : 'active:bg-fill-2',
                          )}
                        >
                          <InstitutionBadge institution={inst.name} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-[15px] text-label">{inst.name}</span>
                          {activa && <Check size={16} className="shrink-0 text-accent-blue" />}
                        </button>
                      )
                    })}
                  </div>
                ))}
                {!grupos.length && (
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
