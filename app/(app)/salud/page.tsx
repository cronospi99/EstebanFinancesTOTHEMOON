'use client'

import { motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { LiquidezCard } from '@/components/salud/liquidez-card'
import { IngresosCard } from '@/components/salud/ingresos-card'
import { ProyeccionCard } from '@/components/salud/proyeccion-card'
// La gestión de los ingresos fijos es la misma tarjeta que hay en Ajustes, no
// una copia: se ve donde se configura y donde se usa, y como salen del mismo
// store no pueden decir cosas distintas.
import { IngresosRecurrentesCard } from '@/components/settings/ingresos-card'
import { IndicadoresCard } from '@/components/salud/indicadores-card'
import { ReglaCard } from '@/components/salud/regla-card'
import { AnomaliasCard } from '@/components/salud/anomalias-card'
import { FireCard } from '@/components/salud/fire-card'
import { DolarCard } from '@/components/salud/dolar-card'
import { AvisosTarjetas } from '@/components/accounts/avisos-tarjetas'
import { RecomendadorTarjeta } from '@/components/accounts/recomendador-tarjeta'

const stagger = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i, 5) * 0.06, duration: 0.42, ease: [0.32, 0.72, 0, 1] as const },
  }),
}

/**
 * Salud financiera.
 *
 * El orden de la pantalla es el de las preguntas, de la más inmediata a la más
 * lejana: ¿llego a fin de mes? ¿a dónde llego en un año? ¿hay algo que vence?
 * ¿con cuál pago? ¿de dónde sale lo que entra? ¿estoy bien en general? ¿en qué
 * se me va? ¿hay algo raro? ¿cuánto falta para no depender del sueldo?
 *
 * La liquidez va primero porque es la única que se consulta en mitad de una
 * fila para pagar. Los doce meses van justo detrás: es la misma pregunta con
 * el plazo largo, y ponerla al lado hace evidente que son dos plazos de lo
 * mismo y no dos cosas.
 *
 * Los ingresos abren la segunda columna porque son la base de todo lo que hay
 * encima: la proyección de arriba no se sostiene sin saber qué parte de lo que
 * entra es previsible, y ese es justo el dato que el resto de la app daba por
 * supuesto. Lo de la independencia financiera va último porque es lo único que
 * no cambia nada de lo que se haga hoy.
 */
export default function SaludPage() {
  const bloques = [
    <LiquidezCard key="liquidez" />,
    <ProyeccionCard key="proyeccion" />,
    <AvisosTarjetas key="tarjetas" titulo="Cortes y pagos" />,
    <RecomendadorTarjeta key="recomendador" />,
    <IngresosCard key="ingresos" />,
    <IngresosRecurrentesCard key="fijos" />,
    <IndicadoresCard key="indicadores" />,
    <ReglaCard key="regla" />,
    <AnomaliasCard key="anomalias" />,
    <DolarCard key="dolar" />,
    <FireCard key="fire" />,
  ]

  return (
    <div className="space-y-6 px-5 pb-4">
      <PageHeader
        title="Salud"
        subtitle="Si llegas a fin de mes, en qué se te va y qué conviene hacer hoy"
      />

      {/*
        En escritorio pasa a dos columnas, igual que el resumen. La liquidez
        ocupa la columna ancha: es un gráfico y necesita anchura para que los
        noventa puntos se distingan. Los doce meses la acompañan por lo mismo,
        que son doce filas con barra y cifra.
      */}
      <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-6">
          {bloques.slice(0, 4).map((b, i) => (
            <motion.div key={i} custom={i} variants={stagger} initial="hidden" animate="show">
              {b}
            </motion.div>
          ))}
        </div>
        <div className="space-y-6">
          {bloques.slice(4).map((b, i) => (
            <motion.div key={i} custom={i + 1} variants={stagger} initial="hidden" animate="show">
              {b}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
