'use client'

import { PageHeader } from '@/components/layout/page-header'
import { GoalsTab } from '@/components/goals/goals-tab'

/**
 * Metas, presupuestos y topes, en su propia sección.
 *
 * Estaban como tercera pestaña de Gastos. Son lo que uno decide, no lo que ya
 * gastó, así que compartir sitio con el resumen del mes las escondía detrás
 * de una pestaña que nadie tocaba.
 */
export default function GoalsPage() {
  return (
    <div className="space-y-5 px-5">
      <PageHeader title="Metas" subtitle="Presupuestos, topes y ahorro" />
      <GoalsTab />
    </div>
  )
}
