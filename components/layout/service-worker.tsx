'use client'

import { useEffect } from 'react'

/**
 * Registra el service worker en producción.
 *
 * Antes esperaba al evento `load` con addEventListener, pero cuando React
 * ejecuta el efecto ese evento ya suele haberse disparado, así que el
 * listener no corría nunca. El resultado era peor que no registrar nada: en
 * red rápida el SW no existía y en un móvil lento —donde `load` aún no había
 * terminado de cargar imágenes cuando React hidrataba— sí se registraba. El
 * mismo build se comportaba de dos maneras según la red.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    let quitarVisibilidad = () => {}

    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => {
          // Una app instalada puede pasar semanas sin cerrarse nunca. Sin
          // preguntar por versiones nuevas se queda anclada a la compilación
          // del día que se instaló, pidiendo ficheros que el servidor ya
          // borró. Se comprueba al volver a primer plano, que es cuando el
          // usuario está a punto de tocar algo.
          const comprobar = () => {
            if (document.visibilityState === 'visible') reg.update().catch(() => {})
          }
          document.addEventListener('visibilitychange', comprobar)
          quitarVisibilidad = () => document.removeEventListener('visibilitychange', comprobar)
        },
        () => {
          /* Sin SW la app funciona igual; solo se pierde la caché de estáticos. */
        },
      )
    }

    if (document.readyState === 'complete') {
      registrar()
      return () => quitarVisibilidad()
    }
    window.addEventListener('load', registrar, { once: true })
    return () => {
      window.removeEventListener('load', registrar)
      quitarVisibilidad()
    }
  }, [])

  return null
}
