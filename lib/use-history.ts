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
 *
 * La única excepción es un reintento, y viene del cupo del proveedor. El plan
 * gratuito de Twelve Data da ocho llamadas por minuto: con más de ocho
 * posiciones y la caché del servidor fría, las últimas vuelven con 429 y el
 * gráfico sale incompleto. Como el servidor guarda por separado cada serie que
 * sí llegó, pedirlo otra vez pasado el minuto completa lo que faltaba en vez
 * de repetir lo que ya está. Se reintenta una vez, no en bucle.
 */
const REINTENTO_MS = 65_000
export function useHistory(symbols: string[], days: number) {
  const [series, setSeries] = useState<Record<string, PuntoHistorico[]>>({})
  const [loading, setLoading] = useState(false)
  const [fallos, setFallos] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)
  /** Marca de que el reintento por cupo ya se gastó para esta consulta. */
  const reintentadoRef = useRef(false)

  const key = [...symbols].sort().join(',')

  const refresh = useCallback(async () => {
    if (!key) { setSeries({}); return [] }
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
      return data.fallos ?? []
    } catch (e) {
      if (!esCancelacion(e)) setFallos([`histórico: ${(e as Error).message}`])
    } finally {
      setLoading(false)
    }
    return []
  }, [key, days])

  useEffect(() => {
    reintentadoRef.current = false
    let temporizador: ReturnType<typeof setTimeout> | undefined

    refresh().then((fallidos) => {
      // Solo si faltó algo, y solo una vez: pasado el minuto el cupo del
      // proveedor se renueva y las series que sí llegaron ya están en caché.
      if (!fallidos.length || reintentadoRef.current) return
      reintentadoRef.current = true
      temporizador = setTimeout(() => {
        if (document.visibilityState === 'visible') refresh()
      }, REINTENTO_MS)
    })

    return () => clearTimeout(temporizador)
  }, [refresh])

  return { series, loading, fallos, refresh }
}
