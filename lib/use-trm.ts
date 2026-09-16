'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchConTimeout } from './net'
import { hoyEnZona } from './zona'

/**
 * La TRM del día, y la de cualquier día pasado.
 *
 * Convive con `use-fx.ts` y no lo sustituye, porque responden a preguntas
 * distintas. La tasa de mercado sirve para pintar el patrimonio ahora mismo;
 * la TRM sirve para lo que tiene consecuencias: declarar, cuadrar con el banco,
 * y —lo que importa aquí— dejar clavada la tasa a la que se registró un
 * movimiento en dólares.
 *
 * Esa última parte es la razón de que este archivo exista. Hasta ahora una
 * compra de US$100 se guardaba en dólares y se convertía al mirarla, con la
 * tasa de ese momento. Así, el gasto de enero cambiaba de cifra cada vez que
 * el dólar se movía: el resumen de un mes cerrado no paraba quieto, y la
 * diferencia en cambio quedaba invisible porque estaba repartida entre todos
 * los movimientos en vez de ser su propia cifra.
 */

const CACHE_KEY = 'eftm.trm'

export interface TrmState {
  /** Pesos por dólar. 0 = no se conoce. */
  valor: number
  /** Día de vigencia. */
  dia: string
  fuente: string | null
  /** Es la TRM oficial y no el precio de mercado usado como respaldo. */
  oficial: boolean
  cargando: boolean
}

const VACIA: TrmState = { valor: 0, dia: '', fuente: null, oficial: false, cargando: false }

function leerCache(): TrmState | null {
  try {
    const guardada = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (guardada?.valor > 0) return { ...guardada, cargando: false }
  } catch { /* storage bloqueado */ }
  return null
}

export function useTrm() {
  const [state, setState] = useState<TrmState>(() => {
    if (typeof window === 'undefined') return VACIA
    return leerCache() ?? VACIA
  })

  const cargar = useCallback(async () => {
    setState((s) => ({ ...s, cargando: true }))
    try {
      const res = await fetchConTimeout('/api/trm')
      const datos = await res.json()
      if (datos?.valor > 0) {
        const nueva: TrmState = {
          valor: datos.valor,
          dia: datos.dia,
          fuente: datos.fuente,
          oficial: Boolean(datos.oficial),
          cargando: false,
        }
        setState(nueva)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(nueva)) } catch { /* noop */ }
        return
      }
    } catch { /* sin red: se conserva la última conocida */ }
    setState((s) => ({ ...s, cargando: false }))
  }, [])

  useEffect(() => {
    // Solo si la guardada no es de hoy. La TRM cambia una vez al día: volver a
    // pedirla en cada arranque gasta una petición para recibir lo mismo.
    const guardada = leerCache()
    if (guardada && guardada.dia >= hoyEnZona()) return
    void cargar()
  }, [cargar])

  return useMemo(() => ({ ...state, refrescar: cargar }), [state, cargar])
}

/**
 * La TRM de un día concreto, pedida una sola vez.
 *
 * Existe para rellenar la tasa de los movimientos anteriores a que se
 * guardara. Devuelve null mientras no se sabe, y el que llama decide si
 * espera o enseña la de hoy con una advertencia.
 *
 * El caché es del módulo y no del componente: una lista de movimientos pinta
 * treinta filas y no puede hacer treinta peticiones para la misma fecha.
 */
const cachePorDia = new Map<string, number>()
const enVuelo = new Map<string, Promise<number | null>>()

export async function trmDelDia(dia: string): Promise<number | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null
  const guardada = cachePorDia.get(dia)
  if (guardada) return guardada

  const yaVa = enVuelo.get(dia)
  if (yaVa) return yaVa

  const promesa = (async () => {
    try {
      const res = await fetchConTimeout(`/api/trm?dia=${dia}`)
      const datos = await res.json()
      if (datos?.valor > 0) {
        cachePorDia.set(dia, datos.valor)
        return datos.valor as number
      }
    } catch { /* se queda sin saberse */ }
    return null
  })().finally(() => enVuelo.delete(dia))

  enVuelo.set(dia, promesa)
  return promesa
}
