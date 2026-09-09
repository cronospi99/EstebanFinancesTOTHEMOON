/**
 * La marca: logotipo, nombre y eslogan.
 *
 * Vive en un solo sitio porque aparece en tres —el acceso, la esquina del
 * escritorio y la pantalla de bienvenida— y hasta ahora cada una escribía su
 * propia versión: dos decían «Finanzas» y una «To The Moon».
 */

/** Lo que se llama la app. Un cambio aquí llega a todas partes. */
export const APP_NAME = 'To The Moon - Finances'
export const APP_TAGLINE = 'Tus gastos, cuentas e inversiones. Sólo tuyos.'

export function BrandMark({ size = 64, className }: { size?: number; className?: string }) {
  return (
    // Imagen normal y no next/image: es el mismo PNG del icono de la PWA, ya
    // pesa lo que debe, y así no pasa por el optimizador en cada despliegue.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon-192.png"
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    />
  )
}
