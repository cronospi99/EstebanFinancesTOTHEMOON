'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChartPie, LayoutGrid, Plus, Settings, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/', label: 'Resumen', icon: LayoutGrid },
  { href: '/gastos', label: 'Gastos', icon: ChartPie },
  { href: '/inversiones', label: 'Inversión', icon: TrendingUp },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
]

/**
 * Navegación lateral del escritorio.
 *
 * En un móvil la barra inferior está donde llega el pulgar; en una pantalla
 * ancha esa misma barra queda a un palmo del ratón y desperdicia el alto. La
 * lateral aprovecha el espacio que sobra a los lados y deja el contenido
 * centrado en una columna legible.
 *
 * Convive con la barra inferior en el mismo árbol: cada una se muestra en su
 * tamaño con `lg:`. Decidirlo con CSS y no leyendo el user-agent evita el
 * parpadeo de renderizar una y cambiar a la otra al hidratar, y acierta con
 * una ventana estrecha en un portátil, que es un caso real y no un móvil.
 */
export function SideNav({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-hairline bg-black/40 px-4 py-6 backdrop-blur-2xl lg:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="h-9 w-9 rounded-[11px] bg-gradient-to-br from-accent-blue to-accent-violet shadow-glow" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">Finanzas</p>
          <p className="truncate text-[11px] text-label-tertiary">Gastos e inversiones</p>
        </div>
      </div>

      <button
        onClick={onQuickAdd}
        className="press mb-6 flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl
                   bg-gradient-to-b from-accent-blue to-[#0060DF] text-[15px] font-semibold text-white shadow-glow"
      >
        <Plus size={19} strokeWidth={2.6} />
        Registrar
      </button>

      <nav className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors',
                active
                  ? 'bg-white/[0.09] text-label'
                  : 'text-label-secondary hover:bg-white/[0.05] hover:text-label',
              )}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} className={cn(active && 'text-accent-blue')} />
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <p className="mt-auto px-3 text-[11px] leading-relaxed text-label-tertiary">
        Tus datos son solo tuyos.
      </p>
    </aside>
  )
}
