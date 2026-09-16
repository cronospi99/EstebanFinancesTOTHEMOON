/**
 * Bloqueo de scroll del fondo, con contador.
 *
 * Cada hoja guardaba y restauraba `body.style.overflow` por su cuenta, y con
 * dos hojas abiertas a la vez el orden de cierre importaba: si se cerraba
 * primero la de abajo, la de arriba restauraba al salir el 'hidden' que había
 * encontrado al entrar y el fondo quedaba bloqueado para siempre. La página no
 * volvía a desplazarse hasta recargar — y en una app instalada no hay barra de
 * direcciones con la que recargar.
 *
 * Con un contador compartido solo el último en salir restaura, que es lo
 * único correcto.
 *
 * Se bloquean los dos: el `body` y el contenedor del shell. El que scrollea de
 * verdad es el contenedor (ver `components/layout/app-shell.tsx`), así que
 * tocar solo el `body` dejaba el fondo corriéndose bajo la hoja abierta. El
 * `body` se sigue bloqueando porque hay pantallas fuera del shell —el login—
 * donde el que se desplaza es el documento.
 */
let bloqueos = 0
let previo = ''
let previoScroller = ''
let scroller: HTMLElement | null = null

export function bloquearScroll(): () => void {
  if (typeof document === 'undefined') return () => {}

  if (bloqueos === 0) {
    previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Se busca al bloquear y no una vez al cargar: el shell no existe en el
    // login, y el elemento cambia si el árbol se vuelve a montar.
    scroller = document.querySelector<HTMLElement>('[data-app-scroll]')
    if (scroller) {
      previoScroller = scroller.style.overflowY
      // `hidden` conserva la posición de scroll, así que el fondo sigue donde
      // estaba al cerrar la hoja.
      scroller.style.overflowY = 'hidden'
    }
  }
  bloqueos++

  // Liberar dos veces el mismo bloqueo descuadraría la cuenta; en desarrollo
  // React monta y desmonta los efectos por duplicado a propósito.
  let liberado = false
  return () => {
    if (liberado) return
    liberado = true
    bloqueos = Math.max(0, bloqueos - 1)
    if (bloqueos === 0) {
      document.body.style.overflow = previo
      if (scroller) {
        scroller.style.overflowY = previoScroller
        scroller = null
      }
    }
  }
}
