'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChartPie, LayoutGrid, Plus, Settings, TrendingUp } from 'lucide-react'
import { cn, haptic } from '@/lib/utils'

const TABS = [
  { href: '/', label: 'Resumen', icon: LayoutGrid },
  { href: '/gastos', label: 'Gastos', icon: ChartPie },
  { href: '/inversiones', label: 'Inversión', icon: TrendingUp },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
]

export function BottomNav({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname()

  return (
    <>
      {/* Botón de captura rápida: flotante sobre la barra, el único acento
          sólido de la interfaz. Todo lo demás es cristal. */}
      <motion.button
        onClick={() => {
          haptic(12)
          onQuickAdd()
        }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', damping: 18, stiffness: 500 }}
        aria-label="Registro rápido"
        className="fixed left-1/2 z-30 flex h-14 w-14 items-center justify-center rounded-full
                   bg-gradient-to-b from-accent-blue to-[#0060DF] text-white shadow-glow
                   ring-[6px] ring-black/85"
        // El centrado va aquí y no como clase (-translate-x-1/2) a propósito:
        // whileTap escribe un `transform` en línea que reemplazaría al de la
        // clase, y el botón saltaría media anchura a la derecha al tocarlo.
        // Con `x` en el style, Framer compone traslación y escala en el mismo
        // transform.
        style={{ bottom: 'calc(var(--sab) + 22px)', x: '-50%' }}
      >
        <Plus size={26} strokeWidth={2.6} />
      </motion.button>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-black/70 backdrop-blur-2xl pb-safe"
        style={{ height: 'calc(var(--nav-h) + var(--sab))' }}
      >
        <div className="mx-auto grid h-[var(--nav-h)] max-w-md grid-cols-5 items-center px-2">
          {TABS.map((tab, i) => {
            const active = pathname === tab.href
            const Icon = tab.icon
            // La tercera columna queda libre para el botón flotante.
            const col = i < 2 ? i + 1 : i + 2
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => haptic(6)}
                style={{ gridColumnStart: col }}
                className={cn(
                  'flex flex-col items-center gap-[3px] py-1 transition-colors duration-200',
                  active ? 'text-accent-blue' : 'text-label-tertiary',
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
