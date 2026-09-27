import { AppShell } from '@/components/layout/app-shell'
import { PrestamosProvider } from '@/lib/use-prestamos'

/**
 * Layout de las pestañas principales. El login vive fuera de este grupo
 * para que no herede la barra inferior.
 *
 * Los préstamos a clientes envuelven al shell y no al revés: la lateral
 * necesita saber si están desbloqueados para enseñar su entrada.
 */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrestamosProvider>
      <AppShell>{children}</AppShell>
    </PrestamosProvider>
  )
}
