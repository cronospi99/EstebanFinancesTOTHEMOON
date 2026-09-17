'use client'

import { PageHeader } from '@/components/layout/page-header'
import { GoalsTab } from '@/components/goals/goals-tab'
import { SaludTeaser } from '@/components/dashboard/salud-teaser'

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

      {/* La segunda puerta a Salud, la misma tarjeta que hay en el resumen.
          En el móvil la barra de abajo va llena y Salud no tiene pestaña
          propia, así que se llega desde donde hace falta; y hace falta aquí
          porque un tope o una meta se ponen mirando lo que va a quedar, que
          es justo lo que proyecta Salud. Desde el resumen se llega cuando uno
          va a mirar; desde aquí, cuando va a decidir. */}
      <SaludTeaser />

      <GoalsTab />
    </div>
  )
}
