'use client'

import { ErrorScreen } from '@/components/layout/error-screen'

/**
 * Fallo dentro de una pestaña. El límite vive aquí, y no solo en la raíz, para
 * que el shell sobreviva: la barra inferior sigue en pantalla y basta con
 * tocar otra pestaña para seguir usando la app.
 */
export default function TabError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} alto="min-h-[70dvh]" />
}
