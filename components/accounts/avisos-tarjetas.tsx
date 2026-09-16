'use client'

import { AlertOctagon, CalendarClock, Scissors, Sparkles } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { fechaCobro } from '@/lib/suscripciones'
import { formatMoney } from '@/lib/format'
import type { UrgenciaTarjeta } from '@/lib/tarjetas'
import { useTarjetas } from '@/lib/store'
import { cn } from '@/lib/utils'

const ESTILO: Record<Exclude<UrgenciaTarjeta, 'nada'>, { color: string; fondo: string; icono: typeof Scissors }> = {
  mora: { color: 'text-accent-red', fondo: 'bg-accent-red/10', icono: AlertOctagon },
  pago: { color: 'text-accent-orange', fondo: 'bg-accent-orange/10', icono: CalendarClock },
  corte: { color: 'text-accent-blue', fondo: 'bg-accent-blue/10', icono: Scissors },
  ventana: { color: 'text-accent-green', fondo: 'bg-accent-green/10', icono: Sparkles },
}

/**
 * Corte y fecha límite, cada uno dicho como lo que es.
 *
 * Son dos avisos de naturaleza distinta y mezclarlos es lo que hace que la
 * gente los confunda. El límite es una tarea con consecuencias —si se pasa,
 * corren intereses— y el corte es información que abre una oportunidad. Por
 * eso llevan colores distintos y por eso el límite va siempre primero cuando
 * los dos caen cerca.
 *
 * Solo salen las tarjetas que piden algo. Una lista con las cinco tarjetas
 * diciendo «no hay nada que hacer» es una lista que se deja de leer, y con
 * ella se pierde el día en que sí había algo.
 */
export function AvisosTarjetas({ titulo = 'Tus tarjetas' }: { titulo?: string }) {
  const tarjetas = useTarjetas()
  const conAviso = tarjetas.filter((t) => t.urgencia !== 'nada')

  if (!conAviso.length) return null

  return (
    <section>
      <CardHeader title={titulo} />
      <div className="space-y-2">
        {conAviso.map((t) => {
          const estilo = ESTILO[t.urgencia as Exclude<UrgenciaTarjeta, 'nada'>]
          const Icono = estilo.icono
          return (
            <Card key={t.cuenta.id} className={cn('flex items-start gap-3 p-4', estilo.fondo)}>
              <InstitutionBadge institution={t.cuenta.institution} color={t.cuenta.color} size="sm" />

              <div className="min-w-0 flex-1">
                <p className={cn('flex items-center gap-1.5 text-[14.5px] font-semibold', estilo.color)}>
                  <Icono size={14} className="shrink-0" />
                  <span className="truncate">{t.titulo}</span>
                </p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-label-secondary">
                  {t.cuenta.name} · {t.detalle}
                </p>
                <p className="mt-0.5 text-[11.5px] text-label-tertiary">
                  Corta el {fechaCobro(t.ciclo.corteProximo)} · se paga el {fechaCobro(t.ciclo.limiteEnCurso)}
                </p>
              </div>

              {t.deuda > 0 && (
                <div className="shrink-0 text-right">
                  <p className="tnum text-[15px] font-semibold text-label">
                    {formatMoney(t.deuda, t.cuenta.currency)}
                  </p>
                  <p className="text-[10.5px] text-label-tertiary">pendiente</p>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </section>
  )
}
