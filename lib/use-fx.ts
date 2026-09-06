'use client'

import { useEffect, useState } from 'react'
import { USDCOP } from './use-quotes'

/** Respaldo si no hay red. Orden de magnitud correcto para no dejar la UI en 0. */
const FALLBACK = 4100
const CACHE_KEY = 'eftm.fx.usdcop'

/**
 * Tasa USD→COP en vivo, vía el proxy del servidor.
 *
 * Guarda la última tasa conocida en localStorage: al abrir la app sin red,
 * una tasa de ayer es mucho mejor que un patrimonio calculado a 4100 fijo.
 */
export function useExchangeRate() {
  const [rate, setRate] = useState<number>(() => {
    if (typeof window === 'undefined') return FALLBACK
    try {
      const cached = Number(localStorage.getItem(CACHE_KEY))
      return cached > 0 ? cached : FALLBACK
    } catch {
      return FALLBACK
    }
  })
  const [live, setLive] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(USDCOP)}`)
        if (!res.ok) return
        const { quotes } = await res.json()
        const q = quotes?.[0]
        if (!cancelled && q?.price > 0 && !q.stale) {
          setRate(q.price)
          setLive(true)
          try { localStorage.setItem(CACHE_KEY, String(q.price)) } catch { /* cuota llena */ }
        }
      } catch {
        /* sin red: nos quedamos con la tasa cacheada */
      }
    }

    load()
    const id = setInterval(load, 10 * 60_000) // la divisa no se mueve tan rápido
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return { rate, live }
}
