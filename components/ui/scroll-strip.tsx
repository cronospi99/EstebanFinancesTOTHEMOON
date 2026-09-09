'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useDragScroll } from '@/lib/use-drag-scroll'
import { cn } from '@/lib/utils'

/**
 * Tira horizontal de fichas que se puede recorrer con el ratón.
 *
 * En el móvil el dedo ya la desliza. En escritorio, un `overflow-x: auto` solo
 * responde a la rueda con Mayúsculas o a un trackpad: con ratón la tira
 * parecía cortada y no había forma de llegar a las entidades de la derecha.
 *
 * Vivía copiada en el selector de cuenta, en la transferencia y en apartar
 * dinero, con tres variantes distintas del mismo `div`. Ahora es una.
 */
export function ScrollStrip({
  children, className, bleed = true,
}: {
  children: React.ReactNode
  className?: string
  /** Sangrado negativo para llegar a los bordes de la pantalla en móvil. */
  bleed?: boolean
}) {
  const t = useDragScroll<HTMLDivElement>()

  const flecha = (dir: -1 | 1) => (
    <button
      type="button"
      onClick={() => t.desplazar(dir)}
      aria-label={dir === -1 ? 'Ver anteriores' : 'Ver más'}
      className={cn(
        // Solo en escritorio: en táctil serían dos objetivos que estorban.
        'absolute top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full',
        'border border-hairline bg-black/70 text-label-secondary backdrop-blur-sm lg:flex',
        dir === -1 ? 'left-0' : 'right-0',
      )}
    >
      {dir === -1 ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
    </button>
  )

  return (
    <div className="relative">
      {t.puedeIzq && flecha(-1)}
      {t.puedeDer && flecha(1)}
      <div
        ref={t.ref}
        onPointerDown={t.onPointerDown}
        className={cn(
          'flex gap-2 overflow-x-auto pb-1 no-scrollbar',
          bleed && '-mx-5 px-5 lg:mx-0 lg:px-0',
          // Mientras se arrastra, los toques no deben llegar a las fichas: si
          // no, soltar el ratón encima de una la seleccionaba.
          t.arrastrando && '[&_*]:pointer-events-none',
          'lg:cursor-grab lg:active:cursor-grabbing',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
