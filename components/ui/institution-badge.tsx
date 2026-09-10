import { institutionByName } from '@/lib/categories'
import { cn } from '@/lib/utils'

const BOX = {
  xs: { cls: 'h-5 w-5 rounded-[6px] text-[8px]', px: 20 },
  sm: { cls: 'h-8 w-8 rounded-[9px] text-[11px]', px: 32 },
  md: { cls: 'h-10 w-10 rounded-xl text-[13px]', px: 40 },
  lg: { cls: 'h-12 w-12 rounded-2xl text-[15px]', px: 48 },
}

/**
 * Identificador visual de una entidad financiera.
 *
 * Usa el logotipo cuando existe y cae al monograma sobre el color de marca
 * cuando no. El fallback importa: el usuario puede escribir una entidad que
 * no esté en la lista, y un hueco vacío se vería como un fallo de carga.
 */
export function InstitutionBadge({
  institution, color, size = 'md', className,
}: {
  institution: string
  /** Color guardado en la cuenta; manda sobre el de la lista si difiere. */
  color?: string
  size?: keyof typeof BOX
  className?: string
}) {
  const known = institutionByName(institution)
  const { cls } = BOX[size]

  if (known?.logo) {
    return (
      <img
        src={`/institutions/${known.logo}.png`}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        // Los archivos vienen recortados a sangre y con el fondo en
        // transparente, así que `object-cover` llena el cuadro entero y el
        // redondeo del contenedor da la silueta que se espera en iOS.
        className={cn('shrink-0 object-cover', cls, className)}
      />
    )
  }

  const bg = color ?? known?.color ?? '#98989F'
  const fg = known?.fg ?? '#FFFFFF'
  const short = known?.short ?? institution.slice(0, 2)

  return (
    <div
      className={cn('flex shrink-0 items-center justify-center font-bold tracking-tight', cls, className)}
      style={{ backgroundColor: bg, color: fg }}
      aria-hidden
    >
      {short}
    </div>
  )
}
