'use client'

import { motion } from 'framer-motion'
import { ChevronRight, Clock, Users } from 'lucide-react'
import { ServiceBadge } from './service-badge'
import {
  colorDe, cuandoCobra, cuantosComparten, frasePagos, textoSobre,
} from '@/lib/suscripciones'
import { formatMoney } from '@/lib/format'
import { cn, haptic } from '@/lib/utils'
import type { SubConCobro } from '@/lib/store'

/**
 * Una suscripción, del color de su marca.
 *
 * El color no es decoración: en una lista de nueve servicios es lo que se
 * reconoce antes de leer, igual que en la bandeja de aplicaciones del
 * teléfono. Una lista gris de nueve filas idénticas obliga a leerlas todas
 * para encontrar la de Netflix.
 *
 * Cambia de forma con el ancho, y no solo de tamaño. En el móvil es una fila
 * —marca, nombre, cuándo cobran— que se despliega al tocarla, porque apiladas
 * como una baraja caben siete en una pantalla. En escritorio la píldora baja a
 * su propio renglón y el detalle va siempre abierto: en una rejilla de dos
 * columnas la fila dejaba el nombre en «S..» y la píldora se salía por el
 * borde, y de todas formas ahí sobra sitio para enseñarlo todo sin pedir un
 * clic.
 *
 * El plegado va con `grid-template-rows` y no con altura: es lo que permite
 * que la misma marca esté cerrada en el móvil y abierta en el escritorio sin
 * preguntarle a JavaScript por el ancho de la ventana —que es lo que provoca
 * el parpadeo al hidratar— y deja el detalle siempre en el DOM, así que un
 * lector de pantalla lo encuentra en los dos tamaños.
 */
export function SubscriptionCard({
  item, abierta, onToggle, onEditar, className, style,
}: {
  item: SubConCobro
  abierta: boolean
  onToggle: () => void
  onEditar: () => void
  className?: string
  style?: React.CSSProperties
}) {
  const { sub, cobro, prueba, compartida, cobraHoy, mensual, anual } = item
  const fondo = colorDe(sub)
  const tinta = textoSobre(sub)
  const cancelada = Boolean(sub.cancelled)

  const importe = (v: number) => formatMoney(Math.round(v), sub.currency)
  const pildora = cancelada ? 'Sin cobros' : cuandoCobra(cobro)

  return (
    <motion.article
      layout
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className={cn(
        'overflow-hidden rounded-[26px] shadow-card',
        // En la rejilla la tarjeta llena su celda: sin esto, dos tarjetas de
        // la misma fila acaban a distinta altura según cuántas líneas traiga
        // el detalle, y la rejilla se ve descuadrada.
        'lg:flex lg:h-full lg:flex-col',
        cancelada && 'opacity-45 saturate-[0.35]',
        className,
      )}
      style={{ backgroundColor: fondo, color: tinta, ...style }}
    >
      {/* La cabecera entera es el botón: en el móvil, un objetivo de toque del
          ancho de la pantalla no se falla nunca. */}
      <button
        onClick={() => { haptic(6); onToggle() }}
        aria-label={`${sub.name}: abrir o cerrar el detalle`}
        className="press-soft flex w-full flex-wrap items-center gap-x-3 gap-y-0 px-4 py-3.5 text-left"
      >
        <ServiceBadge sub={sub} />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[19px] font-bold tracking-[-0.02em]">{sub.name}</span>
            {compartida && (
              <span
                className="flex shrink-0 items-center gap-0.5 rounded-pill px-1.5 py-px text-[10px] font-bold"
                style={{ backgroundColor: 'rgba(255,255,255,0.28)' }}
              >
                <Users size={9} strokeWidth={3} />{cuantosComparten(sub)}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-medium opacity-70">
            {cancelada ? 'Cancelada' : prueba ? 'Prueba gratis' : `Se cobra en ${sub.currency}`}
          </span>
        </span>

        {/*
          La píldora: lo único que hay que leer con la tarjeta cerrada.

          `lg:w-full` la manda a su propio renglón en pantalla ancha. Es la
          pieza más larga de la fila y, en una columna de rejilla, era la que
          se comía el nombre.
        */}
        <span className="shrink-0 lg:mt-2.5 lg:w-full">
          <span
            className={cn(
              'inline-block rounded-pill px-3 py-2 text-[13px] font-semibold tracking-[-0.01em]',
              // El día del cobro, un anillo: es la única de la lista que hay
              // que mirar hoy.
              cobraHoy && 'ring-2 ring-white/70',
            )}
            style={{ backgroundColor: 'rgba(255,255,255,0.94)', color: '#1C1C1E' }}
          >
            {pildora}
          </span>
        </span>
      </button>

      {/* Cerrado en móvil mientras nadie lo toque; abierto siempre a partir de
          `lg`, donde sobra sitio y un clic de más solo estorba. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-ios lg:grid-rows-[1fr] lg:flex-1',
          abierta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        {/*
          Plegado quiere decir plegado también para el teclado.

          Recortar a cero con `overflow-hidden` esconde el detalle a la vista
          pero no lo saca del recorrido del tabulador: el botón «Ver detalle»
          de una tarjeta cerrada seguía recibiendo el foco —y el clic— desde
          debajo de la tarjeta siguiente, que la tapa. `visibility` sí lo saca
          de la navegación y de los lectores de pantalla, y se deja revertir
          por ancho, que es lo que hace falta aquí: cerrado en el móvil y
          abierto a partir de `lg` sin preguntarle a JavaScript por el tamaño
          de la ventana.
        */}
        <div className={cn(
          'overflow-hidden lg:visible lg:flex lg:flex-col',
          abierta ? 'visible' : 'invisible',
        )}>
          <div className="px-4 pb-4 pt-1 lg:flex lg:flex-1 lg:flex-col">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-60">Pagas</p>
            <p className="tnum -mt-0.5 text-[34px] font-black leading-none tracking-[-0.03em]">
              {importe(sub.amount)}
              <span className="ml-1.5 text-[15px] font-bold opacity-60">{sub.currency}</span>
            </p>

            {/* El prorrateo mensual y el ciclo, juntos: «219.000 al año» no se
                compara con nada hasta que alguien lo divide entre doce. */}
            <p className="mt-1.5 text-[13px] font-medium opacity-75">
              {sub.cycle === 'mensual'
                ? `${importe(anual)} al año`
                : `${importe(mensual)} al mes en promedio`}
              {' · '}{frasePagos(sub.cycle)}
            </p>

            {compartida && (
              <p className="mt-1 text-[13px] font-medium opacity-75">
                Entre {cuantosComparten(sub)}: te toca {importe(mensual / cuantosComparten(sub))} al mes.
              </p>
            )}

            {prueba && sub.trialEndsAt && (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold">
                <Clock size={13} strokeWidth={2.6} />
                Gratis hasta el {cuandoCobra(sub.trialEndsAt).replace('Cobra el ', '')}
              </p>
            )}

            <button
              onClick={onEditar}
              className="press mt-3 ml-auto flex items-center gap-1 rounded-pill px-3.5 py-2 text-[13px] font-bold lg:mt-auto lg:pt-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.94)', color: '#1C1C1E' }}
            >
              Ver detalle <ChevronRight size={14} strokeWidth={2.8} />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  )
}
