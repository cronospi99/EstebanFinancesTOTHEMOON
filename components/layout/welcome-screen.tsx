'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RefreshCw, Store, Wallet, type LucideIcon } from 'lucide-react'
import { APP_NAME } from '@/components/ui/brand'
import { AVISO_SIN_MIGRACION } from './selector-espacio'
import { ESPACIOS, type Espacio } from '@/lib/espacio'
import { useEspacio, useNegocioDisponible } from '@/lib/use-espacio'
import { consejoAlAzar, consejoDelDia } from '@/lib/tips'
import { saludo, useProfileName } from '@/lib/use-profile'
import { cn, haptic } from '@/lib/utils'

const ICONO: Record<Espacio, LucideIcon> = { personal: Wallet, negocio: Store }

/**
 * Pantalla de entrada.
 *
 * Aparece una vez al día, no en cada navegación: un muro entre el usuario y
 * su dinero cada vez que abre una pestaña se vuelve un estorbo en dos días.
 * El consejo es determinista por fecha, así que el mismo día coincide en
 * todos sus dispositivos y no parece un aleatorio sin criterio.
 *
 * Es también la puerta de los dos espacios: lo primero que se decide al abrir
 * es si se viene a mirar el dinero propio o la caja del negocio. El que se usó
 * la última vez va destacado, porque casi siempre es el que se quiere otra vez.
 */
export function WelcomeScreen({ onStart }: { onStart: (espacio: Espacio) => void }) {
  const { name } = useProfileName()
  const [consejo, setConsejo] = useState(() => consejoDelDia())
  const actual = useEspacio()
  const negocioDisponible = useNegocioDisponible()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-between overflow-hidden bg-ink px-7 pb-10 pt-safe"
    >
      {/* Halo de color: el mismo lenguaje visual del resumen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 0%, rgba(10,132,255,0.22) 0%, rgba(191,90,242,0.10) 45%, transparent 75%)',
        }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 220, delay: 0.05 }}
          className="mb-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png" alt=""
            className="h-[88px] w-[88px] rounded-[22px] shadow-glow"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
          className="text-balance text-[30px] font-bold leading-tight tracking-[-0.03em]"
        >
          {APP_NAME}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
          className="mt-1.5 text-[16px] text-label-secondary"
        >
          {saludo()}{name ? `, ${name}` : ''}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          className="glass mt-9 w-full rounded-card p-5"
        >
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-label-tertiary">
            Consejo del día
          </p>
          <motion.p
            key={consejo}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-[16px] leading-relaxed text-label"
          >
            {consejo}
          </motion.p>
          <button
            onClick={() => { haptic(6); setConsejo(consejoAlAzar()) }}
            className="press mt-4 flex items-center gap-1.5 text-[13px] font-medium text-label-tertiary"
          >
            <RefreshCw size={12} /> Otro consejo
          </button>
        </motion.div>
      </div>

      <div className="relative w-full space-y-2.5">
        {(['personal', 'negocio'] as const).map((e, i) => {
          const Icono = ICONO[e]
          const principal = e === actual
          const apagado = e === 'negocio' && !negocioDisponible
          return (
            <motion.button
              key={e}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42 + i * 0.06, duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              whileTap={apagado ? undefined : { scale: 0.97 }}
              disabled={apagado}
              onClick={() => { haptic(12); onStart(e) }}
              className={cn(
                'relative flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left disabled:opacity-50',
                principal
                  ? 'bg-gradient-to-b from-accent-blue to-[#0060DF] text-white shadow-glow'
                  : 'glass text-label',
              )}
            >
              <span className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                principal ? 'bg-white/15' : e === 'negocio' ? 'bg-accent-violet/15 text-accent-violet' : 'bg-fill-3',
              )}>
                <Icono size={20} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold leading-tight">{ESPACIOS[e].nombre}</span>
                <span className={cn('mt-0.5 block text-[12.5px] leading-snug', principal ? 'text-white/75' : 'text-label-secondary')}>
                  {apagado ? AVISO_SIN_MIGRACION : ESPACIOS[e].descripcion}
                </span>
              </span>
              {!apagado && <ArrowRight size={18} strokeWidth={2.5} className="shrink-0" />}
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}
