'use client'

import Link from 'next/link'
import { ChevronRight, Repeat } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ServiceBadge } from './service-badge'
import { cuandoCobra } from '@/lib/suscripciones'
import { formatMoney } from '@/lib/format'
import { useSuscripciones, useSuscripcionesResumen } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * La puerta a las suscripciones desde otras pantallas.
 *
 * En el móvil la barra de abajo ya va llena —seis destinos y el botón de
 * captura—, y meter un séptimo dejaría las etiquetas en un tamaño que no se
 * lee. Así que las suscripciones se alcanzan desde donde se las busca: en
 * Gastos, que es de lo que son, y en el resumen, que es donde se aterriza.
 *
 * Enseña las dos cifras que hacen entrar: lo que suma al mes y cuál es el
 * próximo cobro. Un simple enlace que dijera «Suscripciones» no lo abriría
 * nadie.
 */
export function SubscriptionsTeaser({ className }: { className?: string }) {
  const items = useSuscripciones()
  const { mensual, cuantas } = useSuscripcionesResumen()

  const activas = items.filter((i) => !i.sub.cancelled)
  const proximo = activas.find((i) => !i.cobraHoy) ?? activas[0]
  const deHoy = activas.filter((i) => i.cobraHoy).length

  if (!activas.length) return null

  return (
    <Link href="/suscripciones" className={cn('block', className)}>
      <Card className="press-soft flex items-center gap-3 p-4">
        {/* Las marcas, solapadas como en su pantalla: es lo que hace
            reconocible el destino antes de leer el rótulo. */}
        <span className="flex shrink-0 items-center">
          {activas.slice(0, 4).map((i, n) => (
            <ServiceBadge
              key={i.sub.id}
              sub={i.sub}
              size="sm"
              className={cn('ring-2 ring-ink-card', n > 0 && '-ml-3')}
              // La primera arriba, como una baraja recogida hacia la derecha.
              style={{ zIndex: 4 - n }}
            />
          ))}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[15px] font-semibold text-label">
            <Repeat size={14} className="text-label-tertiary" />
            Suscripciones
          </span>
          {/* El recuento solo donde cabe: en un teléfono estrecho competía con
              el próximo cobro y las dos cosas salían cortadas. */}
          <span className="tnum mt-0.5 block truncate text-[12px] text-label-secondary">
            {formatMoney(Math.round(mensual))} al mes
            {cuantas > 0 && (
              <span className="hidden sm:inline">
                {` · ${cuantas} ${cuantas === 1 ? 'activa' : 'activas'}`}
              </span>
            )}
          </span>
        </span>

        <span className="shrink-0 text-right">
          {deHoy > 0 ? (
            <span className="block text-[12px] font-semibold text-accent-orange">
              {deHoy === 1 ? 'Una cobra hoy' : `${deHoy} cobran hoy`}
            </span>
          ) : proximo ? (
            <>
              <span className="block truncate text-[12px] font-medium text-label">{proximo.sub.name}</span>
              <span className="block text-[11px] text-label-tertiary">
                {cuandoCobra(proximo.cobro).replace('Cobra el ', '')}
              </span>
            </>
          ) : null}
        </span>
        <ChevronRight size={16} className="shrink-0 text-label-tertiary" />
      </Card>
    </Link>
  )
}
