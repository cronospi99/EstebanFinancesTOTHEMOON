'use client'

import { useCallback, useEffect, useState } from 'react'

/** Lo que el usuario eligió. `sistema` sigue al ajuste del teléfono. */
export type Tema = 'oscuro' | 'claro' | 'sistema'

export const TEMA_KEY = 'eftm.tema'

/**
 * El tema, aplicado al documento.
 *
 * Vive en un atributo del `<html>` y no en una clase de React porque tiene que
 * estar puesto antes del primer pintado: el guion de `layout.tsx` lo lee de
 * localStorage y lo escribe antes de que baje el CSS, que es lo que evita el
 * fogonazo blanco al abrir la app. Aquí solo se cambia cuando el usuario toca
 * el ajuste.
 *
 * Se guarda en una clave sin usuario, como el nombre del saludo: el tema es
 * del teléfono, no de la cuenta. Quien entre después en el mismo aparato
 * hereda el tema, que es lo que espera cualquiera.
 */
export function aplicarTema(tema: Tema) {
  if (typeof document === 'undefined') return
  const oscuro = tema === 'oscuro'
    || (tema === 'sistema' && !window.matchMedia('(prefers-color-scheme: light)').matches)
  document.documentElement.dataset.theme = oscuro ? 'dark' : 'light'
  // La barra de estado de iOS y la de direcciones de Android siguen a esta
  // etiqueta; sin actualizarla, el modo claro deja una franja negra arriba.
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', oscuro ? '#000000' : '#F2F2F7')
}

export function useTheme() {
  const [tema, setTema] = useState<Tema>('oscuro')

  useEffect(() => {
    let guardado: Tema = 'oscuro'
    try {
      const v = localStorage.getItem(TEMA_KEY)
      if (v === 'claro' || v === 'oscuro' || v === 'sistema') guardado = v
    } catch { /* storage bloqueado */ }
    setTema(guardado)

    // Siguiendo al sistema, un cambio del teléfono se refleja al momento y sin
    // recargar: es lo que hace cualquier app nativa al anochecer.
    if (guardado !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const alCambiar = () => aplicarTema('sistema')
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])

  const elegir = useCallback((nuevo: Tema) => {
    setTema(nuevo)
    try { localStorage.setItem(TEMA_KEY, nuevo) } catch { /* noop */ }
    aplicarTema(nuevo)
  }, [])

  return { tema, elegir }
}
