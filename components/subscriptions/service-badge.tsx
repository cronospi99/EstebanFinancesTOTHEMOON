import { colorDe, monograma } from '@/lib/suscripciones'
import { cn } from '@/lib/utils'
import type { Subscription } from '@/lib/types'

const BOX = {
  sm: 'h-9 w-9 rounded-[11px] text-[12px]',
  md: 'h-11 w-11 rounded-[13px] text-[14px]',
  lg: 'h-14 w-14 rounded-[17px] text-[18px]',
}

/**
 * La insignia del servicio: un cuadro claro con el monograma en el color de
 * la marca.
 *
 * Claro y no del color de la marca, al revés que la de las cuentas, porque
 * aquí va encima de una tarjeta que ya es de ese color: un cuadro rojo sobre
 * fondo rojo no se distingue. Sobre el cuadro claro el monograma recupera el
 * color y la tarjeta entera se lee como una sola marca.
 *
 * Monograma y no logotipo a propósito: treinta PNG de marcas registradas son
 * un problema de licencias y doscientos kilobytes que se descargan para ver
 * una lista.
 */
export function ServiceBadge({
  sub, size = 'md', className, style,
}: {
  sub: Pick<Subscription, 'name' | 'color'>
  size?: keyof typeof BOX
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center bg-white/95 font-black tracking-tight shadow-sm',
        BOX[size], className,
      )}
      style={{ color: colorDe(sub), ...style }}
    >
      {monograma(sub.name)}
    </span>
  )
}
