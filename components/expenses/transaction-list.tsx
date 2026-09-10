'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { CategoryIcon } from '@/components/ui/category-icon'
import { EditTransactionSheet } from './edit-transaction-sheet'
import { categoryById } from '@/lib/categories'
import { formatDayLabel, formatMoney } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

/** Agrupa por día, como la app de Salud: el contexto temporal antes del dato. */
function groupByDay(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>()
  for (const tx of [...transactions].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))) {
    const key = new Date(tx.occurredAt).toDateString()
    groups.set(key, [...(groups.get(key) ?? []), tx])
  }
  return [...groups.entries()]
}

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const { accounts, deleteTransaction } = useFinance()
  const [editando, setEditando] = useState<Transaction | null>(null)

  // Deslizar para borrar y tocar para editar comparten el mismo dedo. Framer
  // dispara el click igual al soltar tras arrastrar, así que se marca el
  // arrastre y se deja caer ese click; el flag se limpia en el siguiente turno
  // del bucle de eventos, cuando el click ya pasó.
  const arrastrando = useRef(false)

  if (!transactions.length) {
    return (
      <Card className="p-8 text-center">
        <p className="text-[14px] text-label-secondary">Sin movimientos en este período.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {groupByDay(transactions).map(([day, txs]) => {
        const dayTotal = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
        return (
          <div key={day}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="text-[13px] font-semibold capitalize text-label-secondary">
                {formatDayLabel(txs[0].occurredAt)}
              </h3>
              <span className={cn('tnum text-[12px] font-medium', dayTotal >= 0 ? 'text-accent-green' : 'text-label-tertiary')}>
                {dayTotal >= 0 ? '+' : '−'}
                {formatMoney(Math.abs(dayTotal))}
              </span>
            </div>

            <Card className="divide-y divide-hairline overflow-hidden">
              {txs.map((tx) => {
                const cat = categoryById(tx.categoryId)
                const account = accounts.find((a) => a.id === tx.accountId)
                const income = tx.type === 'income'
                return (
                  <div key={tx.id} className="relative overflow-hidden">
                    {/*
                      El botón de borrar va FUERA del elemento que se arrastra.
                      Estaba dentro, así que al deslizar se movía con la fila y
                      quedaba flotando a media pantalla en vez de asomar por el
                      borde derecho: el gesto de iOS es la fila deslizándose
                      sobre un botón quieto, no los dos viajando juntos.
                    */}
                    <button
                      onClick={() => {
                        haptic([18, 30])
                        deleteTransaction(tx.id)
                      }}
                      aria-label={`Eliminar ${tx.description}`}
                      className="absolute inset-y-0 right-0 flex w-[72px] items-center justify-center bg-accent-red/85 text-white"
                    >
                      <Trash2 size={18} />
                    </button>

                    <motion.div
                      drag="x"
                      /*
                       * El eje se fija al empezar el gesto: sin esto, el desvío
                       * horizontal de un scroll normal arrastraba la fila y los
                       * botones rojos se iban abriendo solos al bajar por la
                       * lista. Y sin inercia, que abría filas de un golpe seco.
                       */
                      dragDirectionLock
                      dragMomentum={false}
                      dragConstraints={{ left: -72, right: 0 }}
                      dragElastic={{ left: 0.12, right: 0 }}
                      onDragStart={() => { arrastrando.current = true }}
                      onDragEnd={() => { setTimeout(() => { arrastrando.current = false }, 0) }}
                      className="relative bg-[#0E0E10]"
                    >
                    <button
                      onClick={() => {
                        if (arrastrando.current) return
                        haptic(6)
                        setEditando(tx)
                      }}
                      aria-label={`Editar ${tx.description}`}
                      className="press-soft relative flex w-full items-center gap-3 bg-[#0E0E10] px-4 py-3 text-left"
                    >
                      <CategoryIcon icon={cat.icon} color={cat.color} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium text-label">{tx.description}</div>
                        <div className="truncate text-[12px] text-label-tertiary">
                          {cat.name} · {account?.name ?? 'Cuenta'}
                        </div>
                      </div>
                      <div className={cn('tnum shrink-0 text-[15px] font-semibold', income ? 'text-accent-green' : 'text-label')}>
                        {income ? '+' : '−'}
                        {formatMoney(tx.amount).replace('$', '').trim()}
                      </div>
                    </button>
                    </motion.div>
                  </div>
                )
              })}
            </Card>
          </div>
        )
      })}

      <EditTransactionSheet transaction={editando} onClose={() => setEditando(null)} />
    </div>
  )
}
