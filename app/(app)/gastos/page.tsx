'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { CategoryIcon } from '@/components/ui/category-icon'
import { SpendDonut } from '@/components/expenses/spend-donut'
import { TransactionList } from '@/components/expenses/transaction-list'
import { AddAccountSheet } from '@/components/accounts/add-account-sheet'
import { categoryById, CO_INSTITUTIONS } from '@/lib/categories'
import { formatMoney, monthName } from '@/lib/format'
import { useFinance, useMonthSummary, useSpendByCategory } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { AccountType } from '@/lib/types'

const TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Corriente', savings: 'Ahorros', credit: 'Crédito',
  cash: 'Efectivo', investment: 'Inversión',
}

export default function ExpensesPage() {
  const [tab, setTab] = useState<'gastos' | 'cuentas'>('gastos')
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const { accounts, transactions } = useFinance()
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
          {!accounts.length && (
            <Card className="p-8 text-center">
              <p className="text-[15px] font-medium text-label">Aún no tienes cuentas</p>
              <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
                Crea la primera para poder registrar movimientos.
              </p>
            </Card>
          )}

          <Card className="divide-y divide-hairline overflow-hidden">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-10 w-10 shrink-0 rounded-xl" style={{ backgroundColor: `${acc.color}2E` }}>
                  <div className="m-[11px] h-[18px] w-[18px] rounded-md" style={{ backgroundColor: acc.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-label">{acc.name}</div>
                  <div className="truncate text-[12px] text-label-tertiary">
                    {acc.institution} · {TYPE_LABEL[acc.type]}
                  </div>
                </div>
                <div className={cn('tnum shrink-0 text-[15px] font-semibold', acc.balance < 0 ? 'text-accent-red' : 'text-label')}>
                  {formatMoney(acc.balance)}
                </div>
              </div>
            ))}
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
                  className="flex items-center gap-1.5 rounded-pill border border-hairline px-3 py-1.5 text-[12px] text-label-secondary"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: inst.color }} />
                  {inst.name}
                </span>
              ))}
            </div>
          </section>
        </motion.div>
      )}

      <AddAccountSheet open={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
    </div>
  )
}
