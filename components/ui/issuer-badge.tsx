'use client'

import { issuerOf } from '@/lib/issuers'
import { cn } from '@/lib/utils'

const CAJA = {
  xs: 'h-6 w-6 rounded-[7px] text-[8px]',
  sm: 'h-8 w-8 rounded-[10px] text-[9px]',
  md: 'h-10 w-11 rounded-xl text-[11px]',
} as const

/**
 * Distintivo de una posición: el logotipo de la gestora del fondo si se
 * conoce, y si no el ticker en una caja neutra.
 *
 * El respaldo importa tanto como el logotipo: la mayoría de posiciones son
 * acciones sueltas, que no tienen gestora detrás, y ahí el ticker es
 * exactamente la información que hace falta.
 */
export function IssuerBadge({
  symbol, size = 'md', className,
}: {
  symbol: string
  size?: keyof typeof CAJA
  className?: string
}) {
  const issuer = issuerOf(symbol)
  const caja = CAJA[size]

  if (issuer) {
    return (
      // Imagen normal y no next/image: son PNG locales de 128 px que ya pesan
      // lo que deben, y así no pasan por el optimizador en cada despliegue.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={issuer.logo}
        alt={issuer.name}
        title={issuer.name}
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
