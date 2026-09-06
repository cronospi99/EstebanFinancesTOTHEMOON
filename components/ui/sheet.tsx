'use client'

import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Bottom sheet estilo iOS.
 *
 * El arrastre se inicia solo desde la cabecera (el "grabber"), no desde todo
 * el panel: con `drag` en el contenedor scrollable, cualquier intento de
 * desplazar el contenido se interpretaba como arrastre y el contenido no se
 * movía. Con el teclado del móvil abierto eso dejaba media hoja inalcanzable.
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

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
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
      )}
    </AnimatePresence>
  )
}
