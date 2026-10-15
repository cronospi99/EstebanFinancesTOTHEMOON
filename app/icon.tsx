import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/**
 * Favicon generado: el mismo degradado del icono de la PWA.
 *
 * La flecha va dibujada en SVG y no como el carácter «↗»: la fuente que trae
 * `next/og` no tiene ese glifo, y para pintarlo descargaba otra de
 * cdn.jsdelivr.net durante el build. Sin red —o con el CDN caído— el build
 * entero fallaba por un favicon.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0A84FF, #BF5AF2)',
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </div>
    ),
    size,
  )
}
