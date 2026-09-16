'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { BottomNav } from './bottom-nav'
import { SideNav } from './side-nav'
import { QuickAddSheet } from '@/components/quick-add/quick-add-sheet'
import { Bloqueo } from './bloqueo'
import { EstadoCola } from './estado-cola'
import { Recordatorios } from './recordatorios'
import { WelcomeScreen } from './welcome-screen'

/**
 * El sheet de captura vive en el shell, no en cada página: así se puede abrir
 * desde cualquier pestaña sin desmontarse al navegar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const pathname = usePathname()
  const scroller = useRef<HTMLElement>(null)
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

  /*
   * Al cambiar de pestaña hay que volver arriba a mano. Next lo hace solo,
   * pero sobre el scroll del documento, y aquí el que se desplaza es el
   * contenedor (ver el comentario del marco, más abajo): sin esto se entraba
   * en Ajustes a la altura a la que se había quedado el Resumen.
   */
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    /*
     * El cerrojo biométrico envuelve a todo y va antes que nada: una pantalla
     * de bloqueo que aparece medio segundo después de los saldos no bloquea
     * nada. Con la biometría apagada no existe y no cuesta nada. Ver
     * `bloqueo.tsx`.
     *
     * Móvil: una columna estrecha centrada, como siempre.
     * Escritorio: barra lateral fija y el contenido corrido hacia la derecha,
     * con un ancho máximo mayor para que la ventana no quede vacía a los lados
     * sin que las líneas se hagan ilegibles de largas.
     *
     * El marco mide exactamente una pantalla y no se desplaza: quien se
     * desplaza es el `main` de dentro. Es lo que mantiene quieta la barra de
     * abajo. Cuando el que scrollea es el documento, WebKit lleva el scroll
     * fuera del hilo principal y tiene que ir recolocando las capas `fixed`
     * a contrapelo; con un elemento con `backdrop-filter` encima —la barra,
     * que es de cristal— no puede seguirle el ritmo y la barra flota por la
     * mitad de la pantalla durante todo el impulso del dedo, hasta que el
     * scroll se para y pega el salto de vuelta abajo. Sin scroll en el
     * documento no hay nada que recolocar, y `fixed` vuelve a significar
     * quieto.
     */
    <Bloqueo>
    <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden lg:max-w-none lg:pl-[248px]">
      {/* Halo de color detrás del contenido: rompe el negro plano sin
          introducir una superficie visible. Va `absolute` contra el marco,
          que ya no se mueve; `fixed` aquí solo añadiría otra capa que
          recolocar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[340px] opacity-60"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 0%, rgba(10,132,255,0.16) 0%, rgba(191,90,242,0.07) 42%, transparent 72%)',
        }}
      />
      <AnimatePresence>
        {mostrarBienvenida && <WelcomeScreen key="bienvenida" onStart={empezar} />}
      </AnimatePresence>

      <SideNav onQuickAdd={() => setQuickAddOpen(true)} />

      {/* El único que se desplaza. `min-h-0` no es decorativo: sin él un hijo
          de flex se niega a encoger por debajo de su contenido y el marco
          crecería con la página, que es justo lo que se quiere evitar.

          `overscroll-contain` corta el encadenado: al llegar al final de la
          lista, el tirón de más no pasa al documento.

          `data-app-scroll` es la marca por la que lo encuentra el bloqueo de
          fondo de las hojas (ver `lib/scroll-lock.ts`).

          En escritorio, `lg:w-full` acompaña a `lg:mx-auto`: los márgenes
          automáticos anulan el estirado que trae por defecto un hijo de flex,
          y la columna se quedaría del ancho de su contenido. */}
      <main
        ref={scroller}
        data-app-scroll
        className="momentum relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-nav
                   lg:mx-auto lg:w-full lg:max-w-5xl lg:px-6 lg:pb-16 lg:pt-4"
      >
        {children}
      </main>

      {/* La barra inferior solo existe donde manda el pulgar. */}
      <div className="lg:hidden">
        <BottomNav onQuickAdd={() => setQuickAddOpen(true)} />
      </div>
      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />

      {/* Lo que quedó sin enviar por falta de señal. Ver `estado-cola.tsx`. */}
      <EstadoCola />

      {/* Los recordatorios que salen con la app abierta, para cuando el
          servidor no puede mandarlos. No pinta nada. */}
      <Recordatorios />
    </div>
    </Bloqueo>
  )
}
