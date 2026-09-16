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
 * lee. Así que las suscripciones se alcanzan desde donde se las busca: arriba
 * del todo en Gastos, que es de lo que son, y en el resumen, que es donde se
 * aterriza.
 *
 * **Se enseña siempre, también sin ninguna suscripción registrada.** Antes se
 * escondía cuando la lista estaba vacía, y eso dejaba la función entera
 * inalcanzable en el teléfono: no se puede anotar la primera si la única puerta
 * aparece cuando ya hay una. El vacío es justo cuando más falta hace la puerta,
 * porque es cuando nadie sabe que la pantalla existe.
 */
export function SubscriptionsTeaser({ className }: { className?: string }) {
  const items = useSuscripciones()
  const { mensual, cuantas } = useSuscripcionesResumen()

  const activas = items.filter((i) => !i.sub.cancelled)
  const proximo = activas.find((i) => !i.cobraHoy) ?? activas[0]
  const deHoy = activas.filter((i) => i.cobraHoy).length
  const vacio = !activas.length

  return (
    <Link href="/suscripciones" className={cn('block', className)}>
      <Card
        className={cn(
          'press-soft flex items-center gap-3 p-4',
          // Sin nada registrado se pinta como lo que es: una invitación. Con la
          // lista llena ya no hace falta llamar la atención, los logotipos de
          // las marcas la llaman solos.
          vacio && 'border border-accent-blue/25 bg-accent-blue/[0.07]',
        )}
      >
        <span className="flex shrink-0 items-center">
          {vacio ? (
            <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-accent-blue/15 text-accent-blue">
              <Repeat size={20} strokeWidth={2.4} />
            </span>
          ) : (
            /* Las marcas, solapadas como en su pantalla: es lo que hace
               reconocible el destino antes de leer el rótulo. */
            activas.slice(0, 4).map((i, n) => (
              <ServiceBadge
                key={i.sub.id}
                sub={i.sub}
                size="sm"
                className={cn('ring-2 ring-ink-card', n > 0 && '-ml-3')}
                // La primera arriba, como una baraja recogida hacia la derecha.
                style={{ zIndex: 4 - n }}
              />
            ))
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[15px] font-semibold text-label">
            {!vacio && <Repeat size={14} className="text-label-tertiary" />}
            Suscripciones
          </span>
          {vacio ? (
            <span className="mt-0.5 block text-[12px] leading-snug text-label-secondary">
              Anota lo que se te cobra solo y mira cuánto suma al año
            </span>
          ) : (
            /* El recuento solo donde cabe: en un teléfono estrecho competía con
               el próximo cobro y las dos cosas salían cortadas. */
            <span className="tnum mt-0.5 block truncate text-[12px] text-label-secondary">
              {formatMoney(Math.round(mensual))} al mes
              {cuantas > 0 && (
                <span className="hidden sm:inline">
                  {` · ${cuantas} ${cuantas === 1 ? 'activa' : 'activas'}`}
                </span>
              )}
            </span>
          )}
        </span>

        <span className="shrink-0 text-right">
          {vacio ? (
            <span className="block text-[13px] font-semibold text-accent-blue">Abrir</span>
          ) : deHoy > 0 ? (
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
