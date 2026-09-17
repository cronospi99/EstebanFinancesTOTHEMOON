'use client'

import Link from 'next/link'
import { Activity, ChevronRight, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import { fechaCobro } from '@/lib/suscripciones'
import { useAnomalias, useLiquidez, useSalud } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * La puerta a Salud. Se usa en dos sitios: el resumen y Metas.
 *
 * Igual que las suscripciones, y por el mismo motivo: en el móvil la barra de
 * abajo va llena con seis destinos y el botón de captura, así que un séptimo
 * dejaría las etiquetas ilegibles. La pantalla se alcanza desde donde se
 * necesita: desde el resumen cuando uno va a mirar cómo va el mes, y desde
 * Metas cuando va a poner un tope y necesita saber qué le va a quedar.
 *
 * Lo que se enseña aquí es el mínimo proyectado y no el puntaje de salud. El
 * puntaje es un resumen que se mira una vez al mes; el mínimo de los próximos
 * treinta días es el dato que hace abrir la pantalla, porque es el que cambia
 * lo que uno hace hoy.
 */
export function SaludTeaser({ className }: { className?: string }) {
  const p = useLiquidez(30)
  const { salud } = useSalud()
  const anomalias = useAnomalias()

  const enRojo = p.minimo.saldo < 0
  const hoyEsElMinimo = p.minimo.dia === p.serie[0]?.dia

  return (
    <Link href="/salud" className={cn('block', className)}>
      <Card className={cn('press-soft flex items-center gap-3 p-4', enRojo && 'border border-accent-red/25 bg-accent-red/[0.06]')}>
        <span className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]',
          enRojo ? 'bg-accent-red/15 text-accent-red' : 'bg-accent-blue/15 text-accent-blue',
        )}>
          {enRojo ? <TrendingDown size={20} strokeWidth={2.4} /> : <Activity size={20} strokeWidth={2.4} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-label">Salud financiera</span>
          <span className="tnum mt-0.5 block truncate text-[12px] leading-snug text-label-secondary">
            {enRojo ? (
              <>Te quedarías corto el {fechaCobro(p.minimo.dia)}</>
            ) : hoyEsElMinimo ? (
              <>De aquí a 30 días tu saldo solo sube</>
            ) : (
              <>Lo más bajo en 30 días: {formatMoney(p.minimo.saldo)} el {fechaCobro(p.minimo.dia)}</>
            )}
          </span>
        </span>

        <span className="shrink-0 text-right">
          {anomalias.length > 0 ? (
            <span className="block text-[12px] font-semibold text-accent-orange">
              {anomalias.length === 1 ? '1 revisión' : `${anomalias.length} revisiones`}
            </span>
          ) : (
            <>
              <span className="tnum block text-[15px] font-bold leading-none text-label">{salud.puntaje}</span>
              <span className="block text-[10.5px] capitalize text-label-tertiary">{salud.nivel}</span>
            </>
          )}
        </span>
        <ChevronRight size={16} className="shrink-0 text-label-tertiary" />
      </Card>
    </Link>
  )
}
