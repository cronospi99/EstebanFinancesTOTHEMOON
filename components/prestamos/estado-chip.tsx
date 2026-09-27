import type { EstadoCliente } from '@/lib/prestamos'
import { cn } from '@/lib/utils'

/** Al día, vence hoy, en mora (con los días) o saldado, de un vistazo. */
export function EstadoChip({ estado, diasMora = 0, className }: { estado: EstadoCliente; diasMora?: number; className?: string }) {
  const [texto, tono] = {
    'al-dia': ['Al día', 'bg-accent-green/15 text-accent-green'],
    'vence-hoy': ['Vence hoy', 'bg-accent-orange/15 text-accent-orange'],
    mora: [`Mora ${diasMora} d`, 'bg-accent-red/15 text-accent-red'],
    saldado: ['Saldado', 'bg-fill-3 text-label-secondary'],
  }[estado]
  return (
    <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-2 py-0.5 text-[11px] font-semibold', tono, className)}>
      {texto}
    </span>
  )
}
