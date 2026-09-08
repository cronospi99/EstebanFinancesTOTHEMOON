'use client'

import { useCallback, useEffect, useState } from 'react'
import { esCancelacion, fetchConTimeout } from './net'

export interface ClavesMercado {
  /** Precios en vivo. Sin ella el portafolio se queda valorado al costo. */
  finnhub: boolean
  /** Histórico. Sin ella no hay gráfico de rendimiento, pero sí precios. */
  twelveData: boolean
}

/**
 * Qué llaves de datos de mercado ve el servidor.
 *
 * Se consulta una vez al abrir Ajustes. No gasta cupo de ningún proveedor:
 * solo mira si la variable de entorno existe, para poder responder desde la
 * app a «puse la llave, ¿ha llegado?» sin tener que abrir el panel de Vercel.
 */
export function useMarketStatus() {
  const [claves, setClaves] = useState<ClavesMercado | null>(null)
  const [error, setError] = useState(false)
  const [cargando, setCargando] = useState(true)

  const refresh = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetchConTimeout('/api/market-status')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { claves: ClavesMercado } = await res.json()
      setClaves(data.claves)
      setError(false)
    } catch (e) {
      if (!esCancelacion(e)) setError(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { claves, error, cargando, refresh }
}
