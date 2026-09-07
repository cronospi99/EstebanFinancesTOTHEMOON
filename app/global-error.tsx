'use client'

/**
 * Último recurso: un fallo en el layout raíz, donde ni siquiera existe ya el
 * <body> de la app. Por eso este archivo tiene que renderizar el documento
 * entero y no puede apoyarse en las clases de Tailwind del layout.
 *
 * Existe por la misma razón que app/error.tsx: en la app instalada no hay
 * barra de direcciones, y sin un botón en pantalla no queda ninguna forma de
 * recargar.
 */
export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0, minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 32px',
          background: '#000', color: '#fff', textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
          La app no pudo arrancar
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(235,235,245,0.6)', margin: 0, maxWidth: 280 }}>
          Tus datos están guardados. Vuelve a intentarlo.
        </p>

        <button
          onClick={reset}
          style={{
            marginTop: 12, height: 52, width: '100%', maxWidth: 280, border: 0, borderRadius: 16,
            background: '#0A84FF', color: '#fff', fontSize: 17, fontWeight: 600,
          }}
        >
          Reintentar
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            height: 40, border: 0, background: 'transparent',
            color: 'rgba(235,235,245,0.6)', fontSize: 14, fontWeight: 500,
          }}
        >
          Recargar la app
        </button>

        {error.digest && (
          <p style={{ fontSize: 11, color: 'rgba(235,235,245,0.3)', margin: 0 }}>
            Referencia: {error.digest}
          </p>
        )}
      </body>
    </html>
  )
}
