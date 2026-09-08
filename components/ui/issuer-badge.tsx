'use client'

import { logotipoDe } from '@/lib/issuers'
import { cn } from '@/lib/utils'

const CAJA = {
  xs: 'h-6 w-6 rounded-[7px] text-[8px]',
  sm: 'h-8 w-8 rounded-[10px] text-[9px]',
  md: 'h-10 w-11 rounded-xl text-[11px]',
} as const

/**
 * Distintivo de una posición: su logotipo si se conoce, y si no el ticker en
 * una caja neutra.
 *
 * El logotipo puede venir de dos sitios —la gestora del fondo o la propia
 * empresa, si es una acción— y aquí da igual cuál de los dos: `logotipoDe`
 * resuelve esa pregunta y la insignia solo pinta lo que le den.
 *
 * El respaldo sigue importando tanto como el logotipo: de la mayoría de las
 * acciones no se tiene ninguno, y ahí el ticker es exactamente la información
 * que hace falta.
 */
export function IssuerBadge({
  symbol, size = 'md', className,
}: {
  symbol: string
  size?: keyof typeof CAJA
  className?: string
}) {
  const marca = logotipoDe(symbol)
  const caja = CAJA[size]

  if (marca) {
    return (
      // Imagen normal y no next/image: son PNG locales de 128 px que ya pesan
      // lo que deben, y así no pasan por el optimizador en cada despliegue.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={marca.logo}
        alt={marca.name}
        title={marca.name}
        loading="lazy"
        className={cn('shrink-0 object-cover', caja, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-white/[0.07] font-bold tracking-tight text-label',
        caja,
        className,
      )}
    >
      {symbol.replace('-USD', '').slice(0, 5)}
    </div>
  )
}
