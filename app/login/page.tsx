'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowUpRight, Mail, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { APP_NAME, APP_TAGLINE, BrandMark } from '@/components/ui/brand'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { cn, haptic } from '@/lib/utils'

const EMAIL_KEY = 'eftm.login.email'

/**
 * Acceso por enlace mágico, con código de respaldo.
 *
 * El enlace usa el flujo PKCE, que guarda un verificador en el navegador que
 * hizo la petición. Si el correo se abre en otro navegador —lo habitual: se
 * pide desde Safari y el enlace lo abre el navegador por defecto, o el visor
 * interno de Gmail— el verificador no está y el intercambio falla. Por eso
 * existe la segunda vía: un código de seis dígitos que se escribe en el mismo
 * navegador donde se pidió, y que por tanto no depende de dónde se abra el
 * correo.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  // El estado del envío y el del código van por separado a propósito: si se
  // mezclan, un código incorrecto devuelve al usuario al formulario de correo
  // y pierde lo que había escrito.
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [message, setMessage] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [falloEnlace, setFalloEnlace] = useState(false)

  // El callback rebota aquí con ?error=auth cuando el intercambio falla.
  // Antes no se leía y el usuario volvía al login sin explicación alguna.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) {
      setFalloEnlace(true)
      // Se limpia la URL para que no reaparezca el aviso al recargar.
      window.history.replaceState({}, '', window.location.pathname)
    }
    try {
      const guardado = localStorage.getItem(EMAIL_KEY)
      if (guardado) setEmail(guardado)
    } catch { /* storage bloqueado */ }
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    if (!supabase) return

    haptic(10)
    setStatus('sending')
    setFalloEnlace(false)

    const next = new URLSearchParams(window.location.search).get('next')
    const callback = new URL('/auth/callback', window.location.origin)
    if (next?.startsWith('/')) callback.searchParams.set('next', next)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback.toString() },
    })

    if (error) {
      setStatus('idle')
      setMessage(error.message)
    } else {
      try { localStorage.setItem(EMAIL_KEY, email.trim()) } catch { /* noop */ }
      setMessage('')
      setStatus('sent')
    }
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    if (!supabase) return

    haptic(10)
    setVerificando(true)
    setCodeError('')
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })

    setVerificando(false)
    if (error) {
      setCodeError(
        error.message.toLowerCase().includes('expired')
          ? 'El código caducó. Pide uno nuevo.'
          : 'Código incorrecto. Revisa los seis dígitos.',
      )
    } else {
      haptic([14, 40, 22])
      // refresh() hace que el middleware vea la cookie recién puesta.
      router.replace('/')
      router.refresh()
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <BrandMark size={64} className="mx-auto mb-5 shadow-glow" />
          {/* El nombre va con guion y en una sola línea: partirlo en dos deja
              «To The Moon» arriba y «Finances» suelto debajo, que se lee como
              dos productos. */}
          <h1 className="text-balance text-[26px] font-bold leading-tight tracking-[-0.02em]">
            {APP_NAME}
          </h1>
          <p className="mt-1.5 text-[14px] text-label-secondary">{APP_TAGLINE}</p>
        </div>

        {falloEnlace && (
          <div className="mb-4 flex gap-2.5 rounded-2xl border border-accent-orange/25 bg-accent-orange/[0.08] px-4 py-3">
            <TriangleAlert size={17} className="mt-0.5 shrink-0 text-accent-orange" />
            <div>
              <p className="text-[13px] font-semibold text-accent-orange">El enlace no pudo abrirse aquí</p>
              <p className="mt-1 text-[12px] leading-relaxed text-label-secondary">
                Pasa cuando el correo se abre en un navegador distinto al que pidió
                el acceso. Pide un código y escríbelo en esta misma pantalla.
              </p>
            </div>
          </div>
        )}

        {!isSupabaseConfigured ? (
          <Card className="p-5 text-center">
            <p className="text-[14px] text-label">Supabase no está configurado.</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-label-secondary">
              La app funciona en Modo Demo con datos locales.
            </p>
            <a href="/" className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-accent-blue">
              Continuar en Modo Demo <ArrowUpRight size={15} />
            </a>
          </Card>
        ) : status === 'sent' ? (
          <Card className="p-6">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-green/20 text-accent-green">
                <Mail size={22} />
              </div>
              <p className="text-[15px] font-semibold">Revisa tu correo</p>
              <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
                Enviado a <span className="text-label">{email}</span>. Toca el enlace,
                o escribe aquí el código de seis dígitos.
              </p>
            </div>

            <form onSubmit={verificar}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="tnum mb-3 w-full rounded-2xl border border-hairline bg-fill-2 px-4 py-3.5
                           text-center text-[26px] font-semibold tracking-[0.3em] text-label
                           placeholder:tracking-[0.3em] placeholder:font-normal placeholder:text-label-tertiary
                           focus:border-accent-blue/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={code.length !== 6 || verificando}
                className={cn(
                  'press h-[52px] w-full rounded-2xl text-[17px] font-semibold transition-colors',
                  code.length === 6 && !verificando
                    ? 'bg-accent-blue text-white shadow-glow'
                    : 'bg-fill-2 text-label-tertiary',
                )}
              >
                {verificando ? 'Comprobando…' : 'Entrar con el código'}
              </button>
            </form>

            {codeError && (
              <p className="mt-3 text-center text-[13px] text-accent-red">{codeError}</p>
            )}

            <button
              onClick={() => { setStatus('idle'); setCode(''); setCodeError('') }}
              className="press mt-3 w-full py-2 text-center text-[13px] text-label-secondary"
            >
              Usar otro correo
            </button>
          </Card>
        ) : (
          <form onSubmit={enviar} className="space-y-3">
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com" autoComplete="email" inputMode="email"
              className="w-full rounded-2xl border border-hairline bg-fill-2 px-4 py-3.5
                         text-[16px] text-label placeholder:text-label-tertiary
                         focus:border-accent-blue/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === 'sending' || !email}
              className={cn(
                'press h-[52px] w-full rounded-2xl text-[17px] font-semibold transition-colors',
                email && status !== 'sending' ? 'bg-accent-blue text-white shadow-glow' : 'bg-fill-2 text-label-tertiary',
              )}
            >
              {status === 'sending' ? 'Enviando…' : 'Enviar acceso'}
            </button>
            {message && (
              <p className="text-center text-[13px] text-accent-red">{message}</p>
            )}
            <p className="px-2 text-center text-[12px] leading-relaxed text-label-tertiary">
              Recibirás un enlace y un código. Si abres el correo en otro navegador,
              usa el código.
            </p>
          </form>
        )}
      </motion.div>
    </div>
  )
}
