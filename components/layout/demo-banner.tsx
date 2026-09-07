'use client'

import Link from 'next/link'
import { CloudOff, Sparkles } from 'lucide-react'
import { useFinance } from '@/lib/store'
import { haptic } from '@/lib/utils'

/**
 * Estado de los datos, en una línea.
 *
 * Dos avisos distintos comparten el sitio porque nunca coinciden: o no hay
 * sincronización configurada, o la hay y falló. El segundo no existía, y su
 * ausencia era el problema: una lectura fallida dejaba en pantalla la copia
 * local sin decir nada, así que un saldo viejo se leía como un saldo real.
 */
export function DemoBanner() {
  const { synced, ready, syncError, reload } = useFinance()

  if (!ready) return null

  if (syncError) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-accent-orange/25 bg-accent-orange/[0.09] px-4 py-3">
        <CloudOff size={17} className="shrink-0 text-accent-orange" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-label">Sin conexión con el servidor</p>
          <p className="truncate text-[12px] text-label-secondary">
            Estás viendo la última copia de este dispositivo; puede estar desactualizada.
          </p>
        </div>
        <button
          onClick={() => { haptic(8); void reload() }}
          className="press shrink-0 rounded-pill border border-accent-orange/40 px-3 py-1
                     text-[12px] font-semibold text-accent-orange"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (synced) return null

  return (
    <Link
      href="/ajustes"
      className="flex items-center gap-3 rounded-2xl border border-accent-violet/25 bg-accent-violet/[0.09] px-4 py-3"
    >
      <Sparkles size={17} className="shrink-0 text-accent-violet" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-label">Modo Demo</p>
        <p className="truncate text-[12px] text-label-secondary">
          Datos guardados en este dispositivo. Conecta Supabase para sincronizar.
        </p>
      </div>
    </Link>
  )
}
