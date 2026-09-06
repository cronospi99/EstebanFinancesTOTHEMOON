'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Quote } from './types'

/** Símbolo de Yahoo para la tasa USD → COP. */
export const USDCOP = 'COP=X'

export function useQuotes(symbols: string[], intervalMs = 60_000) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  // Clave estable: evita relanzar el efecto en cada render por identidad del array.
  const key = [...symbols].sort().join(',')
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!key) {
      setLoading(false)
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(key)}`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data: { quotes: Quote[]; fetchedAt: string } = await res.json()
      setQuotes(Object.fromEntries(data.quotes.map((q) => [q.symbol, q])))
      setUpdatedAt(data.fetchedAt)
      setError(null)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('No se pudieron actualizar los precios')
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)

    // Al volver a la app (desbloquear el teléfono) refrescamos de inmediato:
    // ver precios de hace 20 minutos es peor que no verlos.
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      abortRef.current?.abort()
    }
  }, [refresh, intervalMs])

  return { quotes, loading, error, updatedAt, refresh }
}
