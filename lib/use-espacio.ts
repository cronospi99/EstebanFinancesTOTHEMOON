'use client'

import { useSyncExternalStore } from 'react'
import { escucharEspacios, espacioActual, servidorConEspacios, type Espacio } from './espacio'

const nada = () => () => {}

/**
 * El espacio abierto, para pintar.
 *
 * Con `useSyncExternalStore` y no leyéndolo a secas: en el servidor no hay
 * localStorage y todo sale «personal», y un componente que en el teléfono
 * dijera «Negocio» desde el primer render descuadraría la hidratación. Así
 * React pinta lo del servidor al hidratar y corrige justo después.
 */
export function useEspacio(): Espacio {
  return useSyncExternalStore(nada, espacioActual, () => 'personal')
}

/** ¿Se puede abrir el negocio? No, si el servidor aún no tiene la migración. */
export function useNegocioDisponible(): boolean {
  return useSyncExternalStore(escucharEspacios, servidorConEspacios, () => true)
}
