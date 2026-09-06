'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BottomNav } from './bottom-nav'
import { QuickAddSheet } from '@/components/quick-add/quick-add-sheet'
import { WelcomeScreen } from './welcome-screen'

/**
 * El sheet de captura vive en el shell, no en cada página: así se puede abrir
 * desde cualquier pestaña sin desmontarse al navegar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  // null mientras no se sabe: evita el parpadeo de la bienvenida en cada
  // navegación antes de leer localStorage.
  const [mostrarBienvenida, setMostrarBienvenida] = useState<boolean | null>(null)

  useEffect(() => {
    const hoy = new Date().toDateString()
    try {
      setMostrarBienvenida(localStorage.getItem('eftm.welcome.seen') !== hoy)
    } catch {
      setMostrarBienvenida(false)
    }
  }, [])

  const empezar = () => {
    try { localStorage.setItem('eftm.welcome.seen', new Date().toDateString()) } catch { /* noop */ }
    setMostrarBienvenida(false)
  }

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-md">
      {/* Halo de color detrás del contenido: rompe el negro plano sin
          introducir una superficie visible. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[340px] opacity-60"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 0%, rgba(10,132,255,0.16) 0%, rgba(191,90,242,0.07) 42%, transparent 72%)',
        }}
      />
      <AnimatePresence>
        {mostrarBienvenida && <WelcomeScreen key="bienvenida" onStart={empezar} />}
      </AnimatePresence>

      <main className="relative pb-nav">{children}</main>
      <BottomNav onQuickAdd={() => setQuickAddOpen(true)} />
      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  )
}
