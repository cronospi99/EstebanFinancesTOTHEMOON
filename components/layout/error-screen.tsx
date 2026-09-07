'use client'

import { useEffect } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'

/**
 * Pantalla de recuperación.
 *
 * Sin un límite de error, un fallo al renderizar cualquier pantalla desmonta
 * el árbol entero y deja un rectángulo negro. En Safari eso se arregla tirando
 * de la barra de direcciones; en la app añadida a la pantalla de inicio no hay
 * barra, así que el negro es definitivo: la app "se congela" y solo revive
 * cerrándola desde el multitarea. De ahí que haya siempre dos salidas visibles.
 */
export function ErrorScreen({
  error, reset, alto = 'min-h-dvh',
}: {
  error: Error & { digest?: string }
  reset: () => void
  /** La variante de dentro de las pestañas deja sitio a la barra inferior. */
  alto?: string
}) {
  useEffect(() => {
    console.error('[app] error de ruta:', error)
  }, [error])

  return (
    <div className={`flex ${alto} flex-col items-center justify-center px-8 text-center`}>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-orange/15 text-accent-orange">
        <TriangleAlert size={26} />
      </div>

      <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-label">Algo se atascó</h1>
      <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-label-secondary">
        No se pudo dibujar esta pantalla. Tus datos están intactos.
      </p>

      <button
        onClick={reset}
        className="press mt-7 flex h-[52px] w-full max-w-[280px] items-center justify-center gap-2
                   rounded-2xl bg-accent-blue text-[17px] font-semibold text-white shadow-glow"
      >
        <RotateCw size={18} strokeWidth={2.5} />
        Reintentar
      </button>

      <button
        onClick={() => window.location.reload()}
        className="press mt-3 py-2 text-[14px] font-medium text-label-secondary"
      >
        Recargar la app
      </button>

      {error.digest && (
        <p className="mt-6 text-[11px] text-label-tertiary">Referencia: {error.digest}</p>
      )}
    </div>
  )
}
