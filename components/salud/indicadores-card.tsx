'use client'

import { motion } from 'framer-motion'
import { Card, CardHeader } from '@/components/ui/card'
import { useSalud } from '@/lib/store'
import { cn } from '@/lib/utils'

const COLOR_NIVEL = {
  frágil: '#FF453A',
  ajustada: '#FF9F0A',
  estable: '#FFD60A',
  sólida: '#30D158',
} as const

/** El color de un indicador suelto, por sus puntos. */
const colorPuntos = (p: number) =>
  p >= 75 ? '#30D158' : p >= 50 ? '#FFD60A' : p >= 25 ? '#FF9F0A' : '#FF453A'

/**
 * El puntaje de salud financiera y los cinco indicadores que lo forman.
 *
 * Los cinco se enseñan siempre, no solo el total. Un 62 sobre 100 no dice qué
 * arreglar; «cubres 1,2 meses de gastos» sí, y es lo que lleva a hacer algo.
 * El puntaje está para ver si sube con los meses, que es lo único para lo que
 * sirve un número resumen.
 */
export function IndicadoresCard() {
  const { salud } = useSalud()
  const color = COLOR_NIVEL[salud.nivel]

  // Arco de 240°, que es el gesto de un medidor y no el de una tarta.
  const RADIO = 52
  const CIRCUNFERENCIA = 2 * Math.PI * RADIO
  const ARCO = CIRCUNFERENCIA * (240 / 360)

  return (
    <section>
      <CardHeader title="Salud financiera" />
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative h-[110px] w-[124px] shrink-0">
            <svg viewBox="0 0 124 124" className="h-full w-full -rotate-[210deg]">
              <circle
                cx="62" cy="62" r={RADIO}
                fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round"
                className="text-fill-2"
                strokeDasharray={`${ARCO} ${CIRCUNFERENCIA}`}
              />
              <motion.circle
                cx="62" cy="62" r={RADIO}
                fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${ARCO} ${CIRCUNFERENCIA}`}
                initial={{ strokeDashoffset: ARCO }}
                animate={{ strokeDashoffset: ARCO * (1 - salud.puntaje / 100) }}
                transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
              <span className="tnum text-[30px] font-bold leading-none tracking-[-0.02em]" style={{ color }}>
                {salud.puntaje}
              </span>
              <span className="mt-0.5 text-[12px] capitalize text-label-secondary">{salud.nivel}</span>
            </div>
          </div>

          <p className="min-w-0 text-[13px] leading-snug text-label-secondary">
            Se calcula con cinco cosas: cuánto colchón tienes, cuánto apartas, cuánto
            del sueldo se va en cuotas, cuánto pesa lo prescindible y cuánto lo
            recurrente. El colchón y el ahorro pesan más que el resto.
          </p>
        </div>

        <div className="mt-4 space-y-3 border-t border-hairline pt-3">
          {salud.indicadores.map((i) => (
            <div key={i.id}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-medium text-label">{i.nombre}</span>
                <span className="tnum shrink-0 text-[12.5px] text-label-tertiary">{i.puntos}/100</span>
              </div>
              <div className="mb-1 h-1.5 w-full overflow-hidden rounded-pill bg-fill-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${i.puntos}%` }}
                  transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                  className="h-full rounded-pill"
                  style={{ background: colorPuntos(i.puntos) }}
                />
              </div>
              <p className="text-[12.5px] leading-snug text-label-secondary">{i.lectura}</p>
              {i.consejo && (
                <p className={cn('mt-0.5 text-[12px] leading-snug text-label-tertiary')}>{i.consejo}</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </section>
  )
}
