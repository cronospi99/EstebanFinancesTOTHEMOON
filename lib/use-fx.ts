'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchConTimeout } from './net'

const CACHE_KEY = 'eftm.fx.usdcop'
const OVERRIDE_KEY = 'eftm.fx.manual'

export interface FxState {
  rate: number
  /** 'live' de una fuente en vivo, 'cached' de la última conocida, 'manual' fijada por el usuario. */
  origin: 'live' | 'cached' | 'manual' | 'none'
  source: string | null
  updatedAt: string | null
}

/**
 * Tasa USD→COP.
 *
 * Sin dato en vivo NO se inventa una cifra: se usa la última conocida, y si
 * tampoco la hay, la app lo dice. Además el usuario puede fijar la tasa a
 * mano, que manda sobre todo lo demás: es su dinero y puede que conozca
 * mejor la tasa a la que él compra.
 */
export function useExchangeRate() {
  const [state, setState] = useState<FxState>(() => {
    if (typeof window === 'undefined') return { rate: 0, origin: 'none', source: null, updatedAt: null }
    try {
      const manual = Number(localStorage.getItem(OVERRIDE_KEY))
      if (manual > 0) return { rate: manual, origin: 'manual', source: 'manual', updatedAt: null }
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
      if (cached?.rate > 0) return { rate: cached.rate, origin: 'cached', source: cached.source, updatedAt: cached.at }
    } catch { /* storage bloqueado */ }
    return { rate: 0, origin: 'none', source: null, updatedAt: null }
  })

  const load = useCallback(async () => {
    // Una tasa fijada a mano no se pisa con la de la red.
    try {
      if (Number(localStorage.getItem(OVERRIDE_KEY)) > 0) return
    } catch { /* noop */ }

    try {
      const res = await fetchConTimeout('/api/fx')
      const data = await res.json()
      if (data?.rate > 0) {
        const at = new Date().toISOString()
        setState({ rate: data.rate, origin: data.stale ? 'cached' : 'live', source: data.source, updatedAt: at })
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: data.rate, source: data.source, at })) } catch { /* noop */ }
      }
    } catch { /* sin red: se conserva lo que hubiera */ }
  }, [])

  useEffect(() => {
    load()
    // El sondeo no dispara con la app en segundo plano. iOS congela los
    // temporizadores de una app instalada al salir de pantalla y los suelta
    // todos de golpe al volver: sin esta guarda, reanudar la app lanza una
    // ráfaga de peticiones simultáneas que agota el cupo de conexiones de
    // Safari justo cuando el usuario está tocando la pantalla.
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 10 * 60_000)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  const setManual = useCallback((rate: number | null) => {
    try {
      if (rate && rate > 0) {
        localStorage.setItem(OVERRIDE_KEY, String(rate))
        setState({ rate, origin: 'manual', source: 'manual', updatedAt: null })
      } else {
        localStorage.removeItem(OVERRIDE_KEY)
        load()
      }
    } catch { /* noop */ }
  }, [load])

  // Objeto estable: el store lo mete en la lista de dependencias del contexto,
  // y devolver uno nuevo en cada render obligaba a redibujar toda la app cada
  // vez que cambiaba cualquier cosa, por pequeña que fuera.
  return useMemo(
    () => ({ ...state, refresh: load, setManual }),
    [state, load, setManual],
  )
}
