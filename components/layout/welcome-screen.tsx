'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { APP_NAME } from '@/components/ui/brand'
import { consejoAlAzar, consejoDelDia } from '@/lib/tips'
import { saludo, useProfileName } from '@/lib/use-profile'
import { haptic } from '@/lib/utils'

/**
 * Pantalla de entrada.
 *
 * Aparece una vez al día, no en cada navegación: un muro entre el usuario y
 * su dinero cada vez que abre una pestaña se vuelve un estorbo en dos días.
 * El consejo es determinista por fecha, así que el mismo día coincide en
 * todos sus dispositivos y no parece un aleatorio sin criterio.
 */
export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const { name } = useProfileName()
  const [consejo, setConsejo] = useState(() => consejoDelDia())

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

      <motion.button
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
        whileTap={{ scale: 0.97 }}
        onClick={() => { haptic(12); onStart() }}
        className="relative flex h-[56px] w-full items-center justify-center gap-2 rounded-2xl
                   bg-gradient-to-b from-accent-blue to-[#0060DF] text-[17px] font-semibold
                   text-white shadow-glow"
      >
        Empezar
        <ArrowRight size={19} strokeWidth={2.5} />
      </motion.button>
    </motion.div>
  )
}
