import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/** Favicon generado: el mismo degradado del icono de la PWA. */
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
          color: 'white',
          fontSize: 21,
          fontWeight: 700,
        }}
      >
        ↗
      </div>
    ),
    size,
  )
}
