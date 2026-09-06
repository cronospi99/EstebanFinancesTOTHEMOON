'use client'

import { motion } from 'framer-motion'
import { NetWorthCard } from '@/components/dashboard/net-worth-card'
import { AccountsStrip } from '@/components/dashboard/accounts-strip'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { BudgetRings } from '@/components/dashboard/budget-rings'
import { WealthDistribution } from '@/components/dashboard/wealth-distribution'
import { DemoBanner } from '@/components/layout/demo-banner'
import { monthName } from '@/lib/format'

const stagger = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.32, 0.72, 0, 1] as const },
  }),
}

export default function DashboardPage() {
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  return (
    <div className="space-y-6 px-5">
      <header className="pt-safe pt-6">
        <p className="text-[14px] text-label-secondary">{greeting}</p>
        <h1 className="text-[30px] font-bold capitalize leading-tight tracking-[-0.02em]">
          {monthName()}
        </h1>
      </header>

      <DemoBanner />

      {[
        <NetWorthCard key="nw" />,
        <AccountsStrip key="acc" />,
        <WealthDistribution key="dist" />,
        <BudgetRings key="bud" />,
        <RecentTransactions key="tx" />,
      ].map((child, i) => (
        <motion.div key={i} custom={i} variants={stagger} initial="hidden" animate="show">
          {child}
        </motion.div>
      ))}
    </div>
  )
}
