'use client'

import { motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { CategoryIcon } from '@/components/ui/category-icon'
import { SpendDonut } from '@/components/expenses/spend-donut'
import { TransactionList } from '@/components/expenses/transaction-list'
import { categoryById } from '@/lib/categories'
import { formatMoney, monthName } from '@/lib/format'
import { useFinance, useMonthSummary, useSpendByCategory } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Gastos del mes, y nada más.
 *
 * Tenía tres pestañas —gastos, cuentas y metas— y las dos últimas se fueron a
 * su propia sección: cada una es una idea distinta y ninguna es un gasto.
 */
export default function ExpensesPage() {
  const { transactions } = useFinance()
  const { expense, income, transactions: monthTx } = useMonthSummary()
  const byCategory = useSpendByCategory()

  return (
    <div className="space-y-5 px-5">
      <PageHeader title="Gastos" subtitle={`Resumen de ${monthName()}`} />

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

    </div>
  )
}
