'use client'

import { ErrorScreen } from '@/components/layout/error-screen'

/** Fallo fuera de las pestañas (login, callback) o en el propio shell. */
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} />
}
