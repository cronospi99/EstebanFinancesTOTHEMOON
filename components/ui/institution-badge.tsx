import { institutionByName } from '@/lib/categories'
import { cn } from '@/lib/utils'

/**
 * Identificador visual de una entidad financiera: monograma sobre el color de
 * marca. Sustituye al cuadro de color plano, que no distinguía entre dos
 * bancos del mismo tono (Davivienda y Daviplata comparten el rojo, por ejemplo).
 */
export function InstitutionBadge({
  institution, color, size = 'md', className,
}: {
  institution: string
  /** Color guardado en la cuenta; manda sobre el de la lista si difiere. */
  color?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const known = institutionByName(institution)
  const bg = color ?? known?.color ?? '#98989F'
  const fg = known?.fg ?? '#FFFFFF'
  const short = known?.short ?? institution.slice(0, 2)

  const box = {
    xs: 'h-5 w-5 rounded-[6px] text-[8px]',
    sm: 'h-8 w-8 rounded-[9px] text-[11px]',
    md: 'h-10 w-10 rounded-xl text-[13px]',
    lg: 'h-12 w-12 rounded-2xl text-[15px]',
  }[size]

  return (
    <div
      className={cn('flex shrink-0 items-center justify-center font-bold tracking-tight', box, className)}
      style={{ backgroundColor: bg, color: fg }}
      aria-hidden
    >
      {short}
    </div>
  )
}
