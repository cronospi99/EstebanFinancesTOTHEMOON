'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { esCancelacion, fetchConTimeout } from './net'

export interface PuntoHistorico { d: string; c: number }

/**
 * Series históricas de cierre de varios símbolos.
 *
 * Los cierres pasados no cambian, así que el servidor los guarda seis horas y
 * aquí basta con pedirlos al montar y al cambiar de rango. No hay sondeo: no
 * tendría a quién avisar de nada.
 */
export function useHistory(symbols: string[], days: number) {
  const [series, setSeries] = useState<Record<string, PuntoHistorico[]>>({})
  const [loading, setLoading] = useState(false)
  const [fallos, setFallos] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const key = [...symbols].sort().join(',')

  const refresh = useCallback(async () => {
    if (!key) { setSeries({}); return }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const res = await fetchConTimeout(
        `/api/history?symbols=${encodeURIComponent(key)}&days=${days}`,
        { signal: ctrl.signal },
        20_000,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { series: Record<string, PuntoHistorico[]>; fallos?: string[] } = await res.json()
      setSeries(data.series ?? {})
      setFallos(data.fallos ?? [])
    } catch (e) {
      if (!esCancelacion(e)) setFallos([`histórico: ${(e as Error).message}`])
    } finally {
      setLoading(false)
    }
  }, [key, days])

  useEffect(() => { refresh() }, [refresh])

  return { series, loading, fallos, refresh }
}
