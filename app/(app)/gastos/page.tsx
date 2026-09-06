'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { CategoryIcon } from '@/components/ui/category-icon'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { SpendDonut } from '@/components/expenses/spend-donut'
import { TransactionList } from '@/components/expenses/transaction-list'
import { AddAccountSheet } from '@/components/accounts/add-account-sheet'
import { AccountDetailSheet } from '@/components/accounts/account-detail-sheet'
import { categoryById, CO_INSTITUTIONS } from '@/lib/categories'
import { formatMoney, formatPercent, monthName } from '@/lib/format'
import { accountTotal, useFinance, useMonthSummary, useSpendByCategory } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { Account, AccountType } from '@/lib/types'

const TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Corriente', savings: 'Ahorros', credit: 'Crédito',
  cash: 'Efectivo', investment: 'Inversión',
}

export default function ExpensesPage() {
  const [tab, setTab] = useState<'gastos' | 'cuentas'>('gastos')
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [detail, setDetail] = useState<Account | null>(null)
  const { accounts, transactions, fxRate } = useFinance()
  const { expense, income, transactions: monthTx } = useMonthSummary()
  const byCategory = useSpendByCategory()

  return (
    <div className="space-y-5 px-5">
      <PageHeader title="Gastos" subtitle={`Resumen de ${monthName()}`} />

      <Segmented
        id="expenses"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'gastos', label: 'Gastos' },
          { value: 'cuentas', label: 'Cuentas' },
        ]}
      />

      {tab === 'gastos' ? (
        <motion.div
          key="gastos"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="space-y-6"
        >
          <Card className="p-5">
            <SpendDonut data={byCategory} total={expense} />

            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hairline pt-4">
              <div>
                <div className="text-[12px] text-label-secondary">Ingresos</div>
                <div className="tnum text-[16px] font-semibold text-accent-green">{formatMoney(income)}</div>
              </div>
              <div>
                <div className="text-[12px] text-label-secondary">Balance</div>
                <div className={cn('tnum text-[16px] font-semibold', income - expense >= 0 ? 'text-label' : 'text-accent-red')}>
                  {formatMoney(income - expense)}
                </div>
              </div>
            </div>
          </Card>

          <section>
            <CardHeader title="Por categoría" />
            <Card className="divide-y divide-hairline overflow-hidden">
              {byCategory.map((row) => {
                const cat = categoryById(row.categoryId)
                const share = expense ? (row.amount / expense) * 100 : 0
                return (
                  <div key={row.categoryId} className="flex items-center gap-3 px-4 py-3">
                    <CategoryIcon icon={cat.icon} color={cat.color} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="truncate text-[15px] font-medium text-label">{cat.name}</span>
                        <span className="tnum shrink-0 text-[14px] font-semibold">{formatMoney(row.amount)}</span>
                      </div>
                      {/* Barra proporcional: comunica el peso relativo sin leer cifras */}
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${share}%` }}
                          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              {!byCategory.length && (
                <div className="p-8 text-center text-[14px] text-label-secondary">
                  Sin gastos registrados este mes.
                </div>
              )}
            </Card>
          </section>

          <section>
            <CardHeader title={`Movimientos de ${monthName()}`} />
            <TransactionList transactions={monthTx.length ? monthTx : transactions.slice(0, 20)} />
          </section>
        </motion.div>
      ) : (
        <motion.div
          key="cuentas"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="space-y-6"
        >
          {!accounts.filter((a) => a.type !== 'investment').length && (
            <Card className="p-8 text-center">
              <p className="text-[15px] font-medium text-label">Aún no tienes cuentas</p>
              <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
                Crea la primera para poder registrar movimientos.
              </p>
            </Card>
          )}

          {/* Las cuentas de inversión se gestionan en su propia pestaña: aquí
              solo el dinero disponible del día a día. */}
          <Card className="divide-y divide-hairline overflow-hidden">
            {accounts.filter((a) => a.type !== 'investment').map((acc) => {
              const total = accountTotal(acc)
              const pockets = acc.pockets?.length ?? 0
              return (
                <button
                  key={acc.id}
                  onClick={() => setDetail(acc)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/[0.04]"
                >
                  <InstitutionBadge institution={acc.institution} color={acc.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-medium text-label">{acc.name}</span>
                      {acc.currency === 'USD' && (
                        <span className="shrink-0 rounded bg-white/[0.09] px-1 py-px text-[9px] font-bold text-label-secondary">USD</span>
                      )}
                    </div>
                    <div className="truncate text-[12px] text-label-tertiary">
                      {TYPE_LABEL[acc.type]}
                      {pockets > 0 && ` · ${pockets} bolsillo${pockets > 1 ? 's' : ''}`}
                      {acc.apy ? ` · ${formatPercent(acc.apy, false, 1)} E.A.` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={cn('tnum text-[15px] font-semibold', total < 0 ? 'text-accent-red' : 'text-label')}>
                      {formatMoney(total, acc.currency)}
                    </div>
                    {acc.currency === 'USD' && (
                      <div className="tnum text-[11px] text-label-tertiary">≈ {formatMoney(total * fxRate)}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </Card>

          <button
            onClick={() => setAddAccountOpen(true)}
            className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline
                       bg-white/[0.04] py-3.5 text-[15px] font-medium text-accent-blue"
          >
            <Plus size={17} />
            Añadir cuenta
          </button>

          <section>
            <CardHeader title="Instituciones soportadas" />
            <div className="flex flex-wrap gap-2">
              {CO_INSTITUTIONS.map((inst) => (
                <span
                  key={inst.name}
                  className="flex items-center gap-2 rounded-pill border border-hairline py-1 pl-1 pr-3 text-[12px] text-label-secondary"
                >
                  <InstitutionBadge institution={inst.name} size="xs" />
                  {inst.name}
                </span>
              ))}
            </div>
          </section>
        </motion.div>
      )}

      <AddAccountSheet open={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
      <AccountDetailSheet account={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
