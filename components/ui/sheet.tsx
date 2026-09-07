'use client'

import { motion, useDragControls, type PanInfo } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { bloquearScroll } from '@/lib/scroll-lock'
import { cn } from '@/lib/utils'

/** Margen sobre la animación de salida antes de quitar la hoja del DOM. */
const SALIDA_MS = 450

/**
 * Bottom sheet estilo iOS.
 *
 * El arrastre se inicia solo desde la cabecera (el "grabber"), no desde todo
 * el panel: con `drag` en el contenedor scrollable, cualquier intento de
 * desplazar el contenido se interpretaba como arrastre y el contenido no se
 * movía. Con el teclado del móvil abierto eso dejaba media hoja inalcanzable.
 *
 * El montaje se lleva a mano, con un temporizador, en vez de con
 * `AnimatePresence`. Esa era la causa de que la app se quedara "congelada" al
 * registrar una inversión: AnimatePresence quita el elemento cuando la
 * animación de salida le avisa de que terminó, y ese aviso se pierde si el
 * componente se vuelve a renderizar mientras sale. Al guardar una posición
 * cambia el conjunto de símbolos, se vuelven a pedir las cotizaciones, y esa
 * respuesta llegaba justo en mitad de la salida. El panel terminaba su
 * animación fuera de pantalla y se quedaba en el DOM, y con él un backdrop a
 * opacidad cero que ocupaba la pantalla entera y se comía todos los toques.
 *
 * Con un temporizador la hoja desaparece a los 450 ms pase lo que pase. Es
 * menos elegante que escuchar el final de la animación, pero no hay ningún
 * re-render capaz de dejar una capa invisible encima de la interfaz.
 */
export function Sheet({
  open, onClose, children, className,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}) {
  const dragControls = useDragControls()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [montada, setMontada] = useState(open)

  useEffect(() => {
    if (open) {
      setMontada(true)
      return
    }
    const t = setTimeout(() => setMontada(false), SALIDA_MS)
    return () => clearTimeout(t)
  }, [open])

  // El bloqueo del fondo se lleva en un contador compartido: con dos hojas
  // abiertas a la vez, cada una guardando y restaurando el estilo por su
  // cuenta, cerrar en el orden equivocado dejaba el `body` en overflow:hidden
  // para siempre y la página no volvía a desplazarse.
  useEffect(() => {
    if (!open) return
    return bloquearScroll()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // Cierra por distancia O por velocidad: un "flick" corto también cierra.
    if (info.offset.y > 120 || info.velocity.y > 600) onClose()
  }

  if (!montada) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        // Deja de recibir toques en cuanto empieza a cerrarse, sin esperar a
        // que termine la animación.
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm',
          !open && 'pointer-events-none',
        )}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ y: '100%' }}
        animate={{ y: open ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 34, stiffness: 340, mass: 0.8 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.55 }}
        onDragEnd={handleDragEnd}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col',
          'rounded-t-sheet border-t border-hairline',
          'bg-[#141416]/85 backdrop-blur-sheet shadow-sheet',
          !open && 'pointer-events-none',
          className,
        )}
      >
        {/* Única zona de arrastre. touch-none evita que el navegador
            interprete el gesto como scroll antes de que llegue a Framer. */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing"
        >
          <div className="h-[5px] w-9 rounded-full bg-white/25" />
        </div>

        {/* El contenido scrollea por su cuenta; con el teclado abierto,
            scroll-pb deja aire para alcanzar el último campo. */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe [scrollbar-width:none]"
        >
          {children}
        </div>
      </motion.div>
    </>
  )
}
