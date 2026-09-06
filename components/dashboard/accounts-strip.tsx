'use client'

import { motion } from 'framer-motion'
import { CardHeader } from '@/components/ui/card'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { formatMoney } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { AccountType } from '@/lib/types'

const TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Corriente',
  savings: 'Ahorros',
  credit: 'Crédito',
  cash: 'Efectivo',
  investment: 'Inversión',
}

/**
 * Tira horizontal estilo Apple Wallet: las tarjetas se deslizan y cada una
 * lleva el color de su banco como firma visual.
 */
export function AccountsStrip() {
  const { accounts } = useFinance()

  return (
    <section>
      <CardHeader title="Cuentas" />
      <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 no-scrollbar">
        {accounts.map((acc, i) => (
          <motion.div
            key={acc.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="glass relative w-[164px] shrink-0 snap-start overflow-hidden rounded-card p-4"
          >
            {/* Lavado de color de la marca en la esquina */}
            <div
              aria-hidden
              className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl"
              style={{ backgroundColor: acc.color }}
            />
            <div className="relative">
              <InstitutionBadge institution={acc.institution} color={acc.color} size="sm" className="mb-3" />
              <div className="truncate text-[13px] font-semibold text-label">{acc.name}</div>
              <div className="mb-2.5 text-[11px] text-label-tertiary">{TYPE_LABEL[acc.type]}</div>
              <div
                className={cn(
                  'tnum text-[16px] font-bold',
                  acc.balance < 0 ? 'text-accent-red' : 'text-label',
                )}
              >
                {formatMoney(acc.balance)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
