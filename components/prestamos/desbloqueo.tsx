'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, HandCoins, KeyRound, Lock } from 'lucide-react'
import { CODIGO_DEMO, usePrestamos } from '@/lib/use-prestamos'
import { cn, haptic } from '@/lib/utils'

/**
 * La puerta de los préstamos a clientes.
 *
 * No es una función para todos: se abre con un código que da el dueño de la
 * app, y cada código sirve para las personas que él decida. Cerrada, se dice
 * qué hace y dónde pedir el código; abierta, lleva directo al tablero.
 */
export function DesbloqueoPrestamos({ className }: { className?: string }) {
  const { disponibilidad, desbloquear, esDemo } = usePrestamos()
  const [abierto, setAbierto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (disponibilidad === 'cargando') return null

  if (disponibilidad === 'desbloqueado') {
    return (
      <Link
        href="/prestamos"
        onClick={() => haptic(6)}
        className={cn('press flex items-center gap-3 rounded-2xl border border-hairline bg-fill-1 px-4 py-3.5', className)}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green">
          <HandCoins size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-label">Préstamos a clientes</span>
          <span className="block text-[12px] text-label-secondary">Desbloqueada · tu cartera, cortes y cobros</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-label-tertiary" />
      </Link>
    )
  }

  return (
    <div className={cn('rounded-2xl border border-hairline bg-fill-1 p-4', className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fill-3 text-label-secondary">
          <Lock size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-label">Préstamos a clientes</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-label-secondary">
            Lleva la plata que prestas con interés mensual fijo: cuánto debe cada
            cliente, cuándo corta y cuánto te paga el mes que viene. Se abre con
            un código.
          </p>
        </div>
      </div>

      {disponibilidad === 'sin-migracion' ? (
        <p className="mt-3 text-[12px] leading-relaxed text-accent-orange">
          Falta aplicar en Supabase la migración «prestamos_a_clientes». Hasta
          entonces no hay dónde comprobar el código.
        </p>
      ) : !abierto ? (
        <button
          onClick={() => { haptic(8); setAbierto(true) }}
          className="press mt-3 flex h-[44px] w-full items-center justify-center gap-2 rounded-xl
                     bg-gradient-to-b from-accent-blue to-[#0060DF] text-[15px] font-semibold text-white shadow-glow"
        >
          <KeyRound size={17} /> Desbloquear función
        </button>
      ) : (
        <form
          className="mt-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!codigo.trim() || enviando) return
            setEnviando(true)
            const r = await desbloquear(codigo)
            setEnviando(false)
            if (r.ok) { haptic([14, 40, 22]); setCodigo('') } else { haptic([30, 40, 30]); setError(r.error ?? 'Código inválido') }
          }}
        >
          <input
            value={codigo}
            onChange={(e) => { setCodigo(e.target.value); setError(null) }}
            placeholder="XXXX-XXXX-XXXX"
            autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false}
            className="w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-center font-mono text-[17px]
                       tracking-[0.12em] text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
          />
          {error && <p className="mt-2 px-1 text-[12px] text-accent-red">{error}</p>}
          {esDemo && (
            <p className="mt-2 px-1 text-[12px] text-label-tertiary">
              En el Modo Demo el código es «{CODIGO_DEMO}».
            </p>
          )}
          <button
            type="submit"
            disabled={!codigo.trim() || enviando}
            className="press mt-3 h-[44px] w-full rounded-xl bg-accent-blue text-[15px] font-semibold text-white
                       disabled:bg-fill-2 disabled:text-label-tertiary"
          >
            {enviando ? 'Comprobando…' : 'Desbloquear'}
          </button>
        </form>
      )}
    </div>
  )
}
