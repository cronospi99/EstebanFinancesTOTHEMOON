'use client'

import { cn } from '@/lib/utils'
import type { FxState } from '@/lib/use-fx'

/** Pasadas estas horas, una tasa guardada ya no describe el mercado. */
const VIEJA_H = 24

/** Hace cuánto se supo la tasa, en horas. `null` si no consta. */
export function horasDeTasa(fx: Pick<FxState, 'updatedAt'>): number | null {
  if (!fx.updatedAt) return null
  const ms = Date.now() - new Date(fx.updatedAt).getTime()
  return Number.isFinite(ms) ? ms / 3_600_000 : null
}

/** True cuando la tasa dejó de seguir al mercado: fijada a mano o rancia. */
export function tasaCongelada(fx: Pick<FxState, 'origin' | 'updatedAt'>): boolean {
  if (fx.origin === 'manual') return true
  const h = horasDeTasa(fx)
  return h !== null && h > VIEJA_H
}

function hace(h: number): string {
  if (h < 1 / 30) return 'ahora mismo'
  if (h < 1) return `hace ${Math.round(h * 60)} min`
  if (h < 24) return `hace ${Math.round(h)} h`
  const d = Math.round(h / 24)
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`
}

/**
 * De dónde salió la tasa y de cuándo es.
 *
 * El dólar mueve el patrimonio entero de esta app, así que una tasa que dejó
 * de seguir al mercado no puede parecer una que sí. Y hay dos maneras de que
 * eso pase sin que nadie se entere: una tasa fijada a mano no se vuelve a
 * consultar nunca, y una guardada sobrevive a días sin red. Las dos se
 * enseñaban igual que la de hoy —un número a secas— y las dos se marcan aquí.
 */
export function FxNote({
  fx, onAutomatica, className,
}: {
  fx: FxState
  /** Vuelve a la tasa del mercado. Sin esto, la nota solo avisa. */
  onAutomatica?: () => void
  className?: string
}) {
  if (fx.rate <= 0) return null

  const h = horasDeTasa(fx)
  const congelada = tasaCongelada(fx)

  return (
    <p className={cn('text-[11px] leading-snug', congelada ? 'text-accent-orange' : 'text-label-tertiary', className)}>
      {fx.origin === 'manual' ? (
        <>
          Fijada por ti, no sigue al mercado.
          {onAutomatica && (
            <button onClick={onAutomatica} className="ml-1 font-medium text-accent-blue underline-offset-2 hover:underline">
              Usar la del mercado
            </button>
          )}
        </>
      ) : (
        <>
          {fx.origin === 'live' ? 'En vivo' : 'Última conocida'}
          {fx.source && fx.origin === 'live' && ` · ${fx.source}`}
          {h !== null && ` · ${hace(h)}`}
          {congelada && ' · puede estar desactualizada'}
        </>
      )}
    </p>
  )
}
