'use client'

import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'

/**
 * Bottom sheet estilo iOS.
 * Dos detalles hacen que se sienta "nativo" y no como un modal web:
 *  1. La curva de salida es más rápida que la de entrada (spring, no tween).
 *  2. Arrastrar hacia abajo lo cierra, pero arrastrar hacia arriba topa (elastic 0).
 */
export function Sheet({
  open, onClose, children, className,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}) {
  // Bloquea el scroll del fondo mientras el sheet está abierto.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Cerrar con Escape (desktop).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // Cierra por distancia O por velocidad: un "flick" corto también debe cerrar.
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
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 rounded-t-sheet border-t border-hairline',
              'bg-[#141416]/85 backdrop-blur-sheet shadow-sheet',
              'pb-safe max-h-[92dvh] overflow-y-auto',
              className,
            )}
          >
            {/* Grabber: la barrita gris que invita a arrastrar */}
            <div className="sticky top-0 z-10 flex justify-center pb-1 pt-2.5">
              <div className="h-[5px] w-9 rounded-full bg-white/25" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
