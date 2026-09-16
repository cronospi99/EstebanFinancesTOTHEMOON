'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Copy, Ghost, TrendingUp, X, Zap } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { formatDate, formatMoney } from '@/lib/format'
import { descartar, type Anomalia, type TipoAnomalia } from '@/lib/anomalias'
import { useAnomalias } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

const ICONO: Record<TipoAnomalia, typeof Copy> = {
  duplicado: Copy,
  disparada: TrendingUp,
  fantasma: Ghost,
  subida: Zap,
  atipico: AlertTriangle,
}

const COLOR = {
  alta: 'text-accent-red',
  media: 'text-accent-orange',
  baja: 'text-label-secondary',
} as const

/**
 * Lo que conviene mirar y nadie iba a mirar.
 *
 * Cada aviso se puede descartar, y esa es la pieza que hace que el resto
 * funcione. Sin ella, un aviso que ya se revisó —el duplicado que sí era real,
 * porque se compraron dos cafés iguales— se queda en la pantalla para siempre
 * y en tres semanas nadie lee esta tarjeta.
 *
 * Al descartar no se enseña ningún «¿seguro?»: es un aviso, no un dato, y el
 * detector lo volverá a encontrar si vuelve a ocurrir.
 */
export function AnomaliasCard() {
  const anomalias = useAnomalias()
  const [ocultas, setOcultas] = useState<Set<string>>(new Set())

  const visibles = anomalias.filter((a) => !ocultas.has(a.id))

  if (!visibles.length) {
    return (
      <section>
        <CardHeader title="Revisiones" />
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green">
            <Zap size={17} />
          </div>
          <p className="text-[13.5px] leading-snug text-label-secondary">
            Nada raro en tus movimientos recientes. Se revisan cobros duplicados,
            categorías disparadas, cargos que se repiten sin estar registrados y
            subidas de precio.
          </p>
        </Card>
      </section>
    )
  }

  const quitar = (a: Anomalia) => {
    haptic(10)
    descartar(a.id)
    setOcultas((prev) => new Set(prev).add(a.id))
  }

  return (
    <section>
      <CardHeader title={`Revisiones · ${visibles.length}`} />
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {visibles.map((a) => {
            const Icono = ICONO[a.tipo]
            return (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
              >
                <Card className="flex gap-3 p-4">
                  <div className={cn('mt-0.5 shrink-0', COLOR[a.severidad])}>
                    <Icono size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold leading-snug text-label">{a.titulo}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-label-secondary">{a.detalle}</p>

                    {a.accion && (
                      <p className="mt-1.5 text-[12.5px] leading-snug text-label-tertiary">{a.accion}</p>
                    )}

                    {a.transacciones.length > 0 && (
                      <div className="mt-2 space-y-0.5 border-t border-hairline pt-2">
                        {a.transacciones.slice(0, 3).map((t) => (
                          <div key={t.id} className="flex items-baseline gap-2 text-[12px]">
                            <span className="w-[50px] shrink-0 tabular-nums text-label-tertiary">
                              {formatDate(t.occurredAt)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-label-secondary">
                              {t.merchant || t.description}
                            </span>
                            <span className="tnum shrink-0 text-label">
                              {formatMoney(t.amount, t.currency ?? 'COP')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => quitar(a)}
                    aria-label="Descartar aviso"
                    className="press -mr-1 -mt-1 h-7 w-7 shrink-0 self-start rounded-full text-label-tertiary"
                  >
                    <X size={15} className="mx-auto" />
                  </button>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </section>
  )
}
