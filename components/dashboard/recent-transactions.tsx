'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { CategoryIcon } from '@/components/ui/category-icon'
import { EditTransactionSheet } from '@/components/expenses/edit-transaction-sheet'
import { categoryById } from '@/lib/categories'
import { formatDate, formatMoney } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

export function RecentTransactions({ limit = 6 }: { limit?: number }) {
  const { transactions, accounts } = useFinance()
  const [editando, setEditando] = useState<Transaction | null>(null)

  const recent = [...transactions]
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))
    .slice(0, limit)

  if (!recent.length) {
    return (
      <section>
        <CardHeader title="Movimientos" />
        <Card className="p-8 text-center">
          <p className="text-[14px] text-label-secondary">Aún no hay movimientos.</p>
          <p className="mt-1 text-[13px] text-label-tertiary">
            Toca el botón + para registrar el primero.
          </p>
        </Card>
      </section>
    )
  }

  return (
    <section>
      <CardHeader
        title="Movimientos"
        action={
          <Link href="/gastos" className="flex items-center text-[13px] font-medium text-accent-blue">
            Ver todo <ChevronRight size={14} />
          </Link>
        }
      />
      <Card className="divide-y divide-hairline overflow-hidden">
        {recent.map((tx, i) => {
          const cat = categoryById(tx.categoryId)
          const account = accounts.find((a) => a.id === tx.accountId)
          const income = tx.type === 'income'
          return (
            <motion.button
              key={tx.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.035, duration: 0.3 }}
              onClick={() => { haptic(6); setEditando(tx) }}
              aria-label={`Editar ${tx.description}`}
              className="press-soft flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <CategoryIcon icon={cat.icon} color={cat.color} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium text-label">{tx.description}</div>
                <div className="truncate text-[12px] text-label-tertiary">
                  {account?.name ?? 'Cuenta'} · {formatDate(tx.occurredAt)}
                </div>
              </div>
              <div className={cn('tnum shrink-0 text-[15px] font-semibold', income ? 'text-accent-green' : 'text-label')}>
                {income ? '+' : '−'}
                {formatMoney(tx.amount).replace('$', '').trim()}
              </div>
            </motion.button>
          )
        })}
      </Card>

      <EditTransactionSheet transaction={editando} onClose={() => setEditando(null)} />
    </section>
  )
}
