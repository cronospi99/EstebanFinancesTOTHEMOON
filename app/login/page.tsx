'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Mail } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { cn, haptic } from '@/lib/utils'

/**
 * Enlace mágico en lugar de contraseña: es una app de una sola persona,
 * y una contraseña más es una superficie de ataque más sin beneficio real.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    if (!supabase) return

    haptic(10)
    setStatus('sending')

    // Leemos `next` de la URL en el submit (y no con useSearchParams) para no
    // obligar a envolver la página en un <Suspense> solo por esto.
    const next = new URLSearchParams(window.location.search).get('next')
    const callback = new URL('/auth/callback', window.location.origin)
    if (next?.startsWith('/')) callback.searchParams.set('next', next)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback.toString() },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 h-16 w-16 rounded-[18px] bg-gradient-to-br from-accent-blue to-accent-violet shadow-glow" />
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Finanzas</h1>
          <p className="mt-1 text-[14px] text-label-secondary">
            Tus gastos, cuentas e inversiones. Solo tuyos.
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <Card className="p-5 text-center">
            <p className="text-[14px] text-label">Supabase no está configurado.</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-label-secondary">
              La app funciona en Modo Demo con datos locales. Añade tus llaves en
              <code className="mx-1 rounded bg-white/10 px-1 py-0.5 text-[12px]">.env.local</code>
              para activar el acceso privado.
            </p>
            <a
              href="/"
              className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-accent-blue"
            >
              Continuar en Modo Demo <ArrowUpRight size={15} />
            </a>
          </Card>
        ) : status === 'sent' ? (
          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-green/20 text-accent-green">
              <Mail size={22} />
            </div>
            <p className="text-[15px] font-semibold">Revisa tu correo</p>
            <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
              Enviamos un enlace de acceso a <span className="text-label">{email}</span>.
            </p>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              inputMode="email"
              className="w-full rounded-2xl border border-hairline bg-white/[0.05] px-4 py-3.5
                         text-[16px] text-label placeholder:text-label-tertiary
                         focus:border-accent-blue/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === 'sending' || !email}
              className={cn(
                'h-[52px] w-full rounded-2xl text-[17px] font-semibold transition-all',
                email && status !== 'sending'
                  ? 'bg-accent-blue text-white shadow-glow'
                  : 'bg-white/[0.06] text-label-tertiary',
              )}
            >
              {status === 'sending' ? 'Enviando…' : 'Enviar enlace de acceso'}
            </button>
            {status === 'error' && (
              <p className="text-center text-[13px] text-accent-red">{message}</p>
            )}
          </form>
        )}
      </motion.div>
    </div>
  )
}
