'use client'

import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useFinance } from '@/lib/store'

/**
 * Se muestra solo mientras no haya Supabase conectado, para que quede claro
 * que los datos viven en este dispositivo y no en la nube.
 */
export function DemoBanner() {
  const { synced, ready } = useFinance()
  if (!ready || synced) return null

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
