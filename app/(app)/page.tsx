'use client'

import { motion } from 'framer-motion'
import { NetWorthCard } from '@/components/dashboard/net-worth-card'
import { AccountsStrip } from '@/components/dashboard/accounts-strip'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { BudgetRings } from '@/components/dashboard/budget-rings'
import { WealthDistribution } from '@/components/dashboard/wealth-distribution'
import { DemoBanner } from '@/components/layout/demo-banner'
import { monthName } from '@/lib/format'
import { saludo, useProfileName } from '@/lib/use-profile'

const stagger = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.32, 0.72, 0, 1] as const },
  }),
}

export default function DashboardPage() {
  const { name } = useProfileName()

  return (
    <div className="space-y-6 px-5">
      <header className="pt-safe pt-6">
        <p className="text-[14px] text-label-secondary">
          {saludo()}{name ? `, ${name}` : ''}
        </p>
        <h1 className="text-[30px] font-bold capitalize leading-tight tracking-[-0.02em]">
          {monthName()}
        </h1>
      </header>

      <DemoBanner />

      {/*
        En escritorio el resumen pasa a dos columnas. Apiladas en una ventana
        ancha, estas tarjetas obligaban a bajar por una tira estrecha con medio
        monitor en negro; el patrimonio y las cuentas mandan, y ocupan la
        columna ancha.

        Las columnas van con `minmax(0, …)` y no con `1.35fr` a secas: un `fr`
        pelado no baja del tamaño mínimo de su contenido, así que la tira de
        cuentas —que se desplaza en horizontal— estiraba su columna hasta
        1.220 px dentro de un contenedor de 936 y el resumen se salía de la
        pantalla por la derecha.
      */}
      <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-6">
          {[
            <NetWorthCard key="nw" />,
            <AccountsStrip key="acc" />,
            <RecentTransactions key="tx" />,
          ].map((child, i) => (
            <motion.div key={i} custom={i} variants={stagger} initial="hidden" animate="show">
              {child}
            </motion.div>
          ))}
        </div>
        <div className="space-y-6">
          {[
            <WealthDistribution key="dist" />,
            <BudgetRings key="bud" />,
          ].map((child, i) => (
            <motion.div key={i} custom={i + 1} variants={stagger} initial="hidden" animate="show">
              {child}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
