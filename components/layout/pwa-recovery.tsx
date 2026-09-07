'use client'

import { useEffect } from 'react'

const MARCA = 'eftm.recarga'
/** Ventana mínima entre recargas automáticas: corta cualquier bucle. */
const TREGUA_MS = 60_000

/** Recarga como mucho una vez por minuto, pase lo que pase. */
function recargar(motivo: string) {
  try {
    const ultima = Number(sessionStorage.getItem(MARCA) ?? 0)
    if (Date.now() - ultima < TREGUA_MS) return
    sessionStorage.setItem(MARCA, String(Date.now()))
  } catch {
    /* Sin sessionStorage no hay memoria del intento: se recarga y punto. */
  }
  console.warn(`[pwa] recargando: ${motivo}`)
  window.location.reload()
}

/** Errores que significan "el JavaScript de esta ruta no llegó". */
const esFalloDeChunk = (texto: string) =>
  /ChunkLoadError|Loading chunk \S+ failed|Importing a module script failed|error loading dynamically imported module|Failed to fetch dynamically imported module/i
    .test(texto)

/**
 * Rescate para la app instalada en la pantalla de inicio.
 *
 * En Safari, cuando algo se rompe, siempre queda la barra de direcciones para
 * recargar. En una app añadida al inicio no hay barra: un fallo transitorio se
 * convierte en una app muerta que solo se arregla cerrándola desde el
 * multitarea, y la mayoría de la gente no lo intenta — la app "se congeló" y
 * ya está.
 *
 * Este componente cubre las dos formas en que eso pasa de verdad:
 *
 *  1. **Un chunk que no carga.** El App Router trae el código de cada pestaña
 *     bajo demanda. Si esa descarga falla —red intermitente, o un despliegue
 *     nuevo que borró el fichero que este documento, abierto desde hace días,
 *     todavía pide— el router se queda sin la ruta y deja de responder a los
 *     toques. No se recupera solo.
 *
 *  2. **Un service worker nuevo tomando el mando.** El SW hace skipWaiting()
 *     y clients.claim(), así que releva al anterior con la página abierta. A
 *     partir de ahí el documento en pantalla es de una compilación y el SW de
 *     otra: el siguiente chunk que pida puede no existir ya. Recargar en el
 *     relevo lo evita.
 */
export function PwaRecovery() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (esFalloDeChunk(String(e.message ?? ''))) recargar('chunk no disponible')
    }
    const onRechazo = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string } | undefined
      if (esFalloDeChunk(`${r?.name ?? ''} ${r?.message ?? ''}`)) recargar('chunk no disponible')
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRechazo)

    let quitarRelevo = () => {}
    if ('serviceWorker' in navigator) {
      // Si al arrancar no hay controlador, el primer 'controllerchange' es el
      // SW estrenándose sobre esta misma página: no hay nada viejo que tirar y
      // recargar ahí solo haría parpadear la app en cada primera visita.
      let controlada = Boolean(navigator.serviceWorker.controller)
      const onRelevo = () => {
        if (!controlada) { controlada = true; return }
        recargar('service worker actualizado')
      }
      navigator.serviceWorker.addEventListener('controllerchange', onRelevo)
      quitarRelevo = () => navigator.serviceWorker.removeEventListener('controllerchange', onRelevo)
    }

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRechazo)
      quitarRelevo()
    }
  }, [])

  return null
}
