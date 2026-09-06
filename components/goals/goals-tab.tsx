'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Target, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { CategoryIcon } from '@/components/ui/category-icon'
import { Sheet } from '@/components/ui/sheet'
import { categoryById, DEFAULT_CATEGORIES } from '@/lib/categories'
import { formatKeypad, formatMoney, parseKeypad } from '@/lib/format'
import { useFinance, useSpendByCategory } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

const COLORES = ['#0A84FF', '#30D158', '#BF5AF2', '#FF9F0A', '#FF375F', '#40C8E0']

export function GoalsTab() {
  const { budgets, goals, setBudget, removeBudget, addGoal, updateGoal, deleteGoal } = useFinance()
  const gasto = useSpendByCategory()

  const [nuevaMeta, setNuevaMeta] = useState(false)
  const [editandoPresu, setEditandoPresu] = useState(false)
  const [gName, setGName] = useState('')
  const [gTarget, setGTarget] = useState('')
  const [gSaved, setGSaved] = useState('')
  const [gDeadline, setGDeadline] = useState('')
  const [abonoId, setAbonoId] = useState<string | null>(null)
  const [abono, setAbono] = useState('')

  const gastadoDe = (catId: string) => gasto.find((g) => g.categoryId === catId)?.amount ?? 0

  return (
    <div className="space-y-6">
      {/* ---- Metas de ahorro ------------------------------------------- */}
      <section>
        <CardHeader
          title="Metas de ahorro"
          action={
            <button onClick={() => { haptic(6); setNuevaMeta(true) }} className="flex items-center gap-1 text-[13px] font-medium text-accent-blue">
              <Plus size={14} /> Nueva
            </button>
          }
        />

        {!goals.length ? (
          <Card className="p-8 text-center">
            <Target size={22} className="mx-auto mb-2 text-label-tertiary" />
            <p className="text-[15px] font-medium text-label">Aún no tienes metas</p>
            <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
              Un viaje, un fondo de emergencia, un portátil. Ponles cifra y plazo.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {goals.map((g) => {
              const pct = g.target > 0 ? Math.min(g.saved / g.target, 1) : 0
              const falta = Math.max(g.target - g.saved, 0)
              const dias = g.deadline
                ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86_400_000)
                : null
              // Cuánto habría que apartar al mes para llegar a tiempo. Es la
              // cifra útil de una meta con plazo; el porcentaje solo no dice
              // si vas bien.
              const mensual = dias && dias > 0 ? falta / Math.max(dias / 30, 0.5) : null

              return (
                <Card key={g.id} className="p-4">
                  <div className="mb-2 flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold text-label">{g.name}</p>
                      <p className="tnum text-[12px] text-label-secondary">
                        {formatMoney(g.saved, g.currency)} de {formatMoney(g.target, g.currency)}
                      </p>
                    </div>
                    <button
                      onClick={() => { haptic([16, 30]); deleteGoal(g.id) }}
                      aria-label={`Eliminar meta ${g.name}`}
                      className="press shrink-0 p-1 text-label-tertiary"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }}
                      transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: g.color }}
                    />
                  </div>

                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="tnum text-[13px] font-semibold" style={{ color: g.color }}>
                      {Math.round(pct * 100)} %
                    </span>
                    {falta > 0 && (
                      <span className="tnum text-[12px] text-label-tertiary">
                        faltan {formatMoney(falta, g.currency)}
                      </span>
                    )}
                    {dias !== null && (
                      <span className={cn('text-[12px]', dias < 0 ? 'text-accent-red' : 'text-label-tertiary')}>
                        {dias < 0 ? 'plazo vencido' : `${dias} días`}
                      </span>
                    )}
                  </div>

                  {mensual && falta > 0 && (
                    <p className="tnum mt-2 border-t border-hairline pt-2 text-[12px] text-label-secondary">
                      Necesitas apartar {formatMoney(Math.round(mensual), g.currency)} al mes
                    </p>
                  )}

                  {abonoId === g.id ? (
                    <div className="mt-3 flex gap-2">
                      <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-hairline bg-white/[0.05] px-3 py-2">
                        <span className="text-[14px] text-label-secondary">{g.currency === 'USD' ? 'US$' : '$'}</span>
                        <input
                          autoFocus value={abono ? formatKeypad(abono) : ''}
                          onChange={(e) => setAbono(e.target.value.replace(/[^\d,]/g, ''))}
                          placeholder="0" inputMode="decimal"
                          className="tnum w-full bg-transparent text-[15px] font-semibold text-label focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => {
                          haptic([14, 30])
                          updateGoal(g.id, { saved: g.saved + parseKeypad(abono) })
                          setAbonoId(null); setAbono('')
                        }}
                        className="press rounded-xl bg-accent-blue px-4 text-[14px] font-semibold text-white"
                      >
                        Abonar
                      </button>
                      <button onClick={() => { setAbonoId(null); setAbono('') }}
                        className="press rounded-xl border border-hairline px-3 text-[14px] text-label-secondary">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { haptic(6); setAbonoId(g.id) }}
                      className="press mt-3 w-full rounded-xl border border-hairline bg-white/[0.04] py-2 text-[13px] font-medium text-accent-blue"
                    >
                      Abonar a esta meta
                    </button>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ---- Presupuestos ----------------------------------------------- */}
      <section>
        <CardHeader
          title="Presupuestos del mes"
          action={
            <button onClick={() => { haptic(6); setEditandoPresu((v) => !v) }} className="text-[13px] font-medium text-accent-blue">
              {editandoPresu ? 'Listo' : 'Editar'}
            </button>
          }
        />

        <Card className="divide-y divide-hairline overflow-hidden">
          {budgets.map((b) => {
            const cat = categoryById(b.categoryId)
            const usado = gastadoDe(b.categoryId)
            const pct = b.amount > 0 ? usado / b.amount : 0
            const pasado = pct > 1
            return (
              <div key={b.categoryId} className="flex items-center gap-3 px-4 py-3">
                <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-medium text-label">{cat.name}</span>
                    {editandoPresu ? (
                      <div className="flex items-center gap-1 rounded-lg border border-hairline bg-white/[0.06] px-2 py-1">
                        <span className="text-[12px] text-label-secondary">$</span>
                        <input
                          value={formatKeypad(String(b.amount))}
                          onChange={(e) => setBudget(b.categoryId, parseKeypad(e.target.value.replace(/[^\d,]/g, '')))}
                          inputMode="numeric"
                          className="tnum w-[86px] bg-transparent text-right text-[13px] font-semibold text-label focus:outline-none"
                        />
                      </div>
                    ) : (
                      <span className="tnum shrink-0 text-[13px] text-label-tertiary">
                        {formatMoney(usado)} / {formatMoney(b.amount)}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 1) * 100}%` }}
                      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: pasado ? '#FF453A' : cat.color }}
                    />
                  </div>
                </div>
                {editandoPresu && (
                  <button
                    onClick={() => { haptic([16, 30]); removeBudget(b.categoryId) }}
                    aria-label={`Quitar presupuesto de ${cat.name}`}
                    className="press shrink-0 p-1 text-label-tertiary"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
          {!budgets.length && (
            <p className="p-6 text-center text-[13px] text-label-secondary">
              Sin presupuestos. Añade uno para vigilar una categoría.
            </p>
          )}
        </Card>

        {editandoPresu && (
          <div className="mt-3">
            <p className="mb-2 px-1 text-[12px] text-label-tertiary">Añadir categoría</p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
              {DEFAULT_CATEGORIES
                .filter((c) => c.kind === 'expense' && !budgets.some((b) => b.categoryId === c.id))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { haptic(6); setBudget(c.id, 200_000) }}
                    className="press flex shrink-0 items-center gap-1.5 rounded-pill border border-hairline py-1 pl-1 pr-3 text-[12px] text-label-secondary"
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size="xs" />
                    {c.name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* ---- Alta de meta ------------------------------------------------ */}
      <Sheet open={nuevaMeta} onClose={() => setNuevaMeta(false)}>
        <div className="px-5 pb-8 pt-1">
          <h2 className="mb-5 text-center text-[17px] font-semibold">Nueva meta</h2>

          <input
            value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Viaje a Japón" autoFocus
            className="mb-3 w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3 text-[16px]
                       text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
          />

          <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">Objetivo</label>
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3">
            <span className="text-[18px] text-label-secondary">$</span>
            <input
              value={gTarget ? formatKeypad(gTarget) : ''}
              onChange={(e) => setGTarget(e.target.value.replace(/[^\d,]/g, ''))}
              placeholder="12.000.000" inputMode="decimal"
              className="tnum w-full bg-transparent text-[20px] font-semibold text-label placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
            />
          </div>

          <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">Ya ahorrado</label>
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3">
            <span className="text-[18px] text-label-secondary">$</span>
            <input
              value={gSaved ? formatKeypad(gSaved) : ''}
              onChange={(e) => setGSaved(e.target.value.replace(/[^\d,]/g, ''))}
              placeholder="0" inputMode="decimal"
              className="tnum w-full bg-transparent text-[20px] font-semibold text-label placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
            />
          </div>

          <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
            Fecha límite (opcional)
          </label>
          <input
            type="date" value={gDeadline} onChange={(e) => setGDeadline(e.target.value)}
            className="mb-5 w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3 text-[16px]
                       text-label focus:border-accent-blue/50 focus:outline-none [color-scheme:dark]"
          />

          <button
            onClick={() => {
              if (!gName.trim() || parseKeypad(gTarget) <= 0) return
              haptic([14, 40, 22])
              addGoal({
                name: gName.trim(),
                target: parseKeypad(gTarget),
                saved: parseKeypad(gSaved),
                currency: 'COP',
                deadline: gDeadline || undefined,
                color: COLORES[goals.length % COLORES.length],
              })
              setGName(''); setGTarget(''); setGSaved(''); setGDeadline(''); setNuevaMeta(false)
            }}
            disabled={!gName.trim() || parseKeypad(gTarget) <= 0}
            className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                       shadow-glow disabled:bg-white/[0.06] disabled:text-label-tertiary disabled:shadow-none"
          >
            Crear meta
          </button>
        </div>
      </Sheet>
    </div>
  )
}
