import { AppShell } from '@/components/layout/app-shell'

/**
 * Layout de las pestañas principales. El login vive fuera de este grupo
 * para que no herede la barra inferior.
 */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
