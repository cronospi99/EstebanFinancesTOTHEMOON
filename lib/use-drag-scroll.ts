'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Arrastrar con el ratón una tira que se desplaza en horizontal.
 *
 * En el móvil se desliza con el dedo y no hace falta nada. En escritorio, un
 * `overflow-x: auto` solo responde a la rueda con Mayúsculas o a un trackpad,
 * así que con ratón la tira de cuentas parecía cortada y sin más contenido:
 * no había forma de saber que seguía.
 *
 * Además del arrastre expone `puedeIzq`/`puedeDer` para pintar flechas, que es
 * la parte que de verdad dice «aquí hay más».
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [puedeIzq, setPuedeIzq] = useState(false)
  const [puedeDer, setPuedeDer] = useState(false)

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    // Un píxel de margen: los navegadores redondean el scroll y sin él la
    // flecha derecha se queda encendida para siempre al final de la tira.
    setPuedeIzq(el.scrollLeft > 1)
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', medir); ro.disconnect() }
  }, [medir])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Solo ratón: en táctil el desplazamiento nativo ya es mejor que esto, y
    // capturar el puntero le quitaría la inercia.
    const el = ref.current
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return

    const inicioX = e.clientX
    const inicioScroll = el.scrollLeft
    let movido = false

    const mover = (ev: PointerEvent) => {
      const dx = ev.clientX - inicioX
      // Un umbral antes de considerarlo arrastre: sin él, un clic con
      // temblor de mano se comía el toque sobre la tarjeta.
      if (!movido && Math.abs(dx) < 4) return
      movido = true
      setArrastrando(true)
      el.scrollLeft = inicioScroll - dx
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      // En el siguiente turno: el click del ratón llega después de pointerup,
      // y hasta entonces hay que poder distinguirlo de un arrastre.
      setTimeout(() => setArrastrando(false), 0)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }, [])

  /** Desplaza una pantalla larga, para las flechas. */
  const desplazar = useCallback((dir: -1 | 1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 180), behavior: 'smooth' })
  }, [])

  return { ref, onPointerDown, arrastrando, puedeIzq, puedeDer, desplazar }
}
