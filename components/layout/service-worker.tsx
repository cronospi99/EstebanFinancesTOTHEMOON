'use client'

import { useEffect } from 'react'

/** Registra el service worker solo en producción para no interferir con el HMR. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {})
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
