import { logoDe, monograma } from '@/lib/suscripciones'
import { cn } from '@/lib/utils'
import type { Subscription } from '@/lib/types'

const BOX = {
  sm: { caja: 'h-9 w-9 rounded-[11px] text-[12px]', glifo: 'h-[22px] w-[22px]' },
  md: { caja: 'h-11 w-11 rounded-[13px] text-[14px]', glifo: 'h-[27px] w-[27px]' },
  lg: { caja: 'h-14 w-14 rounded-[17px] text-[18px]', glifo: 'h-[34px] w-[34px]' },
}

/**
 * La insignia del servicio: el logotipo blanco sobre una baldosa oscura.
 *
 * Oscura y no del color de la marca, al revés que la de las cuentas, porque va
 * encima de una tarjeta que ya es de ese color: un cuadro rojo sobre fondo rojo
 * no se distingue. Sobre la baldosa oscura el logotipo recorta limpio en
 * cualquiera de las tarjetas, claras u oscuras, y la fila entera se lee como la
 * bandeja de aplicaciones del teléfono, que es de donde el usuario reconoce
 * estas marcas.
 *
 * Los logotipos son siluetas blancas con transparencia, no imágenes a todo
 * color: pesan cuatro kilobytes cada una, se ven igual en los dos temas de la
 * app y ninguna marca choca con el color de su propia tarjeta.
 *
 * Sin logotipo, el monograma. El respaldo importa: el usuario puede escribir
 * «el parqueadero», que no está ni estará en ningún catálogo, y un hueco vacío
 * se leería como una imagen que no cargó.
 */
export function ServiceBadge({
  sub, size = 'md', className, style,
}: {
  sub: Pick<Subscription, 'name' | 'color'>
  size?: keyof typeof BOX
  className?: string
  style?: React.CSSProperties
}) {
  const { caja, glifo } = BOX[size]
  const logo = logoDe(sub.name)

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center bg-[#16161A] font-black tracking-tight',
        'text-white shadow-sm ring-1 ring-white/10',
        caja, className,
      )}
      style={style}
    >
      {logo ? (
        <img
          src={`/services/${logo}.png`}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn('object-contain', glifo)}
        />
      ) : (
        monograma(sub.name)
      )}
    </span>
  )
}
