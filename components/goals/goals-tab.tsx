'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Plus, Target, Wallet } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { CategoryIcon } from '@/components/ui/category-icon'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { MoneyInput } from '@/components/ui/money-input'
import { AllocateSheet } from '@/components/budgets/allocate-sheet'
import { BudgetSheet } from '@/components/budgets/budget-sheet'
import { DailyCapCard } from '@/components/budgets/daily-cap-card'
import { NewBudgetSheet } from '@/components/budgets/new-budget-sheet'
import { GoalSheet } from '@/components/goals/goal-sheet'
import { categoryById } from '@/lib/categories'
import { formatMoney, parseKeypad } from '@/lib/format'
import { useBolsillos, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Bolsillo } from '@/lib/store'
import type { Goal } from '@/lib/types'

export function GoalsTab() {
  const { accounts, goals, updateGoal } = useFinance()
  const bolsillos = useBolsillos()

  const [hojaMeta, setHojaMeta] = useState(false)
  const [metaEditando, setMetaEditando] = useState<Goal | null>(null)
  const [presuEditando, setPresuEditando] = useState<Bolsillo | null>(null)
  const [asignandoA, setAsignandoA] = useState<string | null>(null)
  const [nuevoPresu, setNuevoPresu] = useState(false)
  const [abonoId, setAbonoId] = useState<string | null>(null)
  const [abono, setAbono] = useState('')

  const cuentaDe = (id?: string) => accounts.find((a) => a.id === id)

  return (
    <div className="space-y-6">
      {/* ---- Tope del día ------------------------------------------------ */}
      <DailyCapCard />

      {/* ---- Metas de ahorro --------------------------------------------- */}
      <section>
        <CardHeader
          title="Metas de ahorro"
          action={
            <button
              onClick={() => { haptic(6); setMetaEditando(null); setHojaMeta(true) }}
              className="flex items-center gap-1 text-[13px] font-medium text-accent-blue"
            >
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
                    {/* Editar en vez de borrar: borrar era lo único que se
                        podía hacer, y con ello se perdía lo abonado. */}
                    <button
                      onClick={() => { haptic(6); setMetaEditando(g); setHojaMeta(true) }}
                      aria-label={`Editar meta ${g.name}`}
                      className="press shrink-0 p-1 text-label-tertiary"
                    >
                      <Pencil size={15} />
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
                      <MoneyInput
                        value={abono} onChange={setAbono} currency={g.currency}
                        autoFocus size="sm" className="flex-1"
                      />
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
                      <button
                        onClick={() => { setAbonoId(null); setAbono('') }}
                        className="press rounded-xl border border-hairline px-3 text-[14px] text-label-secondary"
                      >
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

      {/* ---- Presupuestos, con su bolsillo -------------------------------- */}
      <section>
        <CardHeader
          title="Presupuestos del mes"
          action={
            <button
              onClick={() => { haptic(6); setNuevoPresu(true) }}
              className="flex items-center gap-1 text-[13px] font-medium text-accent-blue"
            >
              <Plus size={14} /> Nuevo
            </button>
          }
        />

        {!bolsillos.length ? (
          <Card className="p-6 text-center">
            <Wallet size={22} className="mx-auto mb-2 text-label-tertiary" />
            <p className="text-[15px] font-medium text-label">Sin presupuestos</p>
            <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
              Crea uno para vigilar una categoría y apartarle dinero.
            </p>
            <button
              onClick={() => { haptic(6); setNuevoPresu(true) }}
              className="press mt-3 rounded-xl border border-hairline bg-white/[0.04] px-4 py-2 text-[14px] font-medium text-accent-blue"
            >
              Crear presupuesto
            </button>
          </Card>
        ) : (
          <div className="space-y-3">
            {bolsillos.map((b) => {
              const cat = categoryById(b.categoryId)
              const pct = b.amount > 0 ? b.gastado / b.amount : 0
              const pasado = pct > 1
              // Gastar más de lo apartado no se bloquea: el dinero salió de la
              // cuenta igual. Se marca, que es lo que hace falta saber.
              const sobregiro = b.asignado > 0 && b.disponible < 0
              const diaPasado = Boolean(b.dailyCap && b.hoy > b.dailyCap)

              return (
                <Card key={b.categoryId} className="p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-label">{cat.name}</p>
                      <p className="tnum text-[12px] text-label-tertiary">
                        {formatMoney(b.gastado)} de {formatMoney(b.amount)}
                      </p>
                    </div>
                    <button
                      onClick={() => { haptic(6); setPresuEditando(b) }}
                      aria-label={`Editar presupuesto de ${cat.name}`}
                      className="press shrink-0 p-1 text-label-tertiary"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>

                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 1) * 100}%` }}
                      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: pasado ? '#FF453A' : cat.color }}
                    />
                  </div>

                  {/* El bolsillo: cuánto hay apartado y qué queda de ello. */}
                  <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl bg-white/[0.04] p-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-label-tertiary">Apartado</p>
                      <p className="tnum text-[15px] font-semibold text-label">{formatMoney(b.asignado)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-label-tertiary">Queda</p>
                      <p className={cn('tnum text-[15px] font-semibold', sobregiro ? 'text-accent-red' : 'text-accent-green')}>
                        {formatMoney(b.disponible)}
                      </p>
                    </div>
                  </div>

                  {/* De dónde salió: la pregunta que el bolsillo tiene que
                      responder para que apartar signifique algo. */}
                  {b.origenes.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {b.origenes.map((o) => {
                        const acc = cuentaDe(o.accountId)
                        return (
                          <span
                            key={o.accountId ?? '__sin'}
                            className="flex items-center gap-1.5 rounded-pill border border-hairline py-1 pl-1 pr-2.5 text-[11px] text-label-secondary"
                          >
                            {acc
                              ? <InstitutionBadge institution={acc.institution} color={acc.color} size="xs" />
                              : <span className="h-5 w-5 rounded-md bg-white/[0.07]" />}
                            <span className="max-w-[92px] truncate">{acc?.name ?? 'Cuenta borrada'}</span>
                            <span className="tnum font-semibold text-label">{formatMoney(o.amount)}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {sobregiro && (
                    <p className="mb-3 rounded-lg bg-accent-red/10 px-3 py-2 text-[12px] leading-relaxed text-accent-red">
                      Has gastado {formatMoney(-b.disponible)} más de lo apartado. El dinero salió de
                      la cuenta igual; aparta más o sube el tope.
                    </p>
                  )}

                  {b.dailyCap ? (
                    <p className={cn('mb-3 text-[12px]', diaPasado ? 'text-accent-orange' : 'text-label-tertiary')}>
                      Hoy: {formatMoney(b.hoy)} de {formatMoney(b.dailyCap)}
                      {diaPasado && ' · tope diario superado'}
                    </p>
                  ) : null}

                  <button
                    onClick={() => { haptic(6); setAsignandoA(b.categoryId) }}
                    className="press w-full rounded-xl border border-hairline bg-white/[0.04] py-2 text-[13px] font-medium text-accent-blue"
                  >
                    Apartar dinero
                  </button>
                </Card>
              )
            })}
          </div>
        )}

      </section>

      <GoalSheet
        open={hojaMeta}
        meta={metaEditando}
        indice={goals.length}
        onClose={() => { setHojaMeta(false); setMetaEditando(null) }}
      />
      <BudgetSheet
        bolsillo={presuEditando}
        onClose={() => setPresuEditando(null)}
        onApartar={(categoryId) => { setPresuEditando(null); setAsignandoA(categoryId) }}
      />
      <NewBudgetSheet open={nuevoPresu} onClose={() => setNuevoPresu(false)} />
      <AllocateSheet categoryId={asignandoA} onClose={() => setAsignandoA(null)} />
    </div>
  )
}
