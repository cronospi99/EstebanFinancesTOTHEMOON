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
 */
let bloqueos = 0
let previo = ''

export function bloquearScroll(): () => void {
  if (typeof document === 'undefined') return () => {}

  if (bloqueos === 0) {
    previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  bloqueos++

  // Liberar dos veces el mismo bloqueo descuadraría la cuenta; en desarrollo
  // React monta y desmonta los efectos por duplicado a propósito.
  let liberado = false
  return () => {
    if (liberado) return
    liberado = true
    bloqueos = Math.max(0, bloqueos - 1)
    if (bloqueos === 0) document.body.style.overflow = previo
  }
}
