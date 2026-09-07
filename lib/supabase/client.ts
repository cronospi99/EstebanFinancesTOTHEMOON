'use client'

import { createBrowserClient } from '@supabase/ssr'
import { normalizeSupabaseUrl } from './url'
import { fetchConTimeout } from '../net'

export const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * La app arranca sin Supabase (Modo Demo). Todo lo que toca la red pregunta
 * primero por esta bandera, así el prototipo es usable antes de configurar nada.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** Plazo para hacerse con el candado de sesión antes de seguir sin él. */
const ESPERA_CANDADO_MS = 5_000

/**
 * Candado de sesión que se rinde en vez de esperar para siempre.
 *
 * supabase-js serializa el acceso al token con la Web Locks API, porque dos
 * pestañas refrescando a la vez podrían pisarse. El problema es que iOS
 * congela el proceso de una app instalada en cuanto sale de pantalla, y si la
 * congela justo mientras el candado está tomado, al volver no queda nadie que
 * lo suelte. A partir de ahí *toda* consulta se queda esperando —todas piden
 * el token antes de salir a la red—, así que la app se ve viva pero no carga
 * ni guarda nada. Ese es el bloqueo que aparece "después de varios toques":
 * los toques que suspendieron y reanudaron la app por el camino.
 *
 * Aquí el candado se pide con plazo. Si no llega, se sigue sin él: dos
 * refrescos simultáneos del token son un problema mucho menor —y que
 * supabase-js ya resuelve reintentando— que una app tomada sin salida.
 */
async function candadoConPlazo<R>(name: string, _espera: number, fn: () => Promise<R>): Promise<R> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) return fn()

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ESPERA_CANDADO_MS)

  // Marca si la función llegó a ejecutarse: sin esto, un AbortError lanzado
  // desde dentro de `fn` (una petición cancelada, por ejemplo) se confundiría
  // con "no se consiguió el candado" y la ejecutaríamos por segunda vez.
  let ejecutada = false

  try {
    return await locks.request(name, { signal: ctrl.signal }, async () => {
      ejecutada = true
      return fn()
    })
  } catch (e) {
    if (ejecutada || (e as Error | undefined)?.name !== 'AbortError') throw e
    return fn()
  } finally {
    clearTimeout(timer)
  }
}

let cliente: ReturnType<typeof createBrowserClient> | null = null

/**
 * Cliente del navegador. Uno solo por pestaña: cada instancia trae su propio
 * temporizador de refresco y su propio oyente de visibilidad, y varias a la
 * vez se disputan el mismo candado sin ganar nada.
 */
export function createClient() {
  if (!isSupabaseConfigured) return null
  if (cliente) return cliente

  cliente = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { lock: candadoConPlazo },
    // Ninguna consulta puede quedarse colgada ocupando una de las seis
    // conexiones que Safari concede por dominio.
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => fetchConTimeout(input, init ?? {}),
    },
  })
  return cliente
}
