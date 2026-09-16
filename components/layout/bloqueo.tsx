'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ScanFace } from 'lucide-react'
import { BrandMark } from '@/components/ui/brand'
import { estaActiva, hayQuePedir, marcarActividad, verificar } from '@/lib/biometria'
import { haptic } from '@/lib/utils'

/**
 * La pantalla que tapa la app hasta que se comprueba quién está mirando.
 *
 * Va montada en el shell, por encima de todo, y se pinta antes de que nada del
 * contenido llegue a verse. Ese orden es la mitad del asunto: una pantalla de
 * bloqueo que aparece medio segundo después de los saldos no bloquea nada,
 * porque el vistazo que uno quiere evitar dura menos que eso.
 *
 * Con la biometría apagada este componente no existe y no cuesta nada.
 */
export function Bloqueo({ children }: { children: React.ReactNode }) {
  // `null` mientras no se sabe: leer localStorage en el primer render rompería
  // la hidratación, y empezar en «desbloqueado» enseñaría los saldos un
  // instante antes de taparlos.
  const [bloqueado, setBloqueado] = useState<boolean | null>(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (!estaActiva()) { setBloqueado(false); return }
    setBloqueado(hayQuePedir())
  }, [])

  const pedir = useCallback(async () => {
    setFallo(false)
    const ok = await verificar()
    if (ok) {
      haptic([12, 30])
      marcarActividad()
      setBloqueado(false)
    } else {
      setFallo(true)
    }
  }, [])

  /*
   * Se pide sola la primera vez. Obligar a tocar un botón para que luego
   * aparezca el diálogo del sistema son dos gestos donde iOS solo necesita
   * uno, y el botón se queda de todas formas para reintentar.
   */
  useEffect(() => {
    if (bloqueado === true && !fallo) void pedir()
    // Solo al pasar a bloqueado: si se reintentara en cada render, un fallo
    // volvería a abrir el diálogo en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloqueado])

  /*
   * El reloj de la inactividad se para en cuanto la app sale de pantalla y se
   * mira al volver. Es lo que hace que «a los 15 minutos» signifique quince
   * minutos fuera de la app y no quince minutos usándola.
   */
  useEffect(() => {
    if (!estaActiva()) return
    const alCambiar = () => {
      if (document.visibilityState === 'visible') {
        if (hayQuePedir()) setBloqueado(true)
        else marcarActividad()
      } else {
        marcarActividad()
      }
    }
    document.addEventListener('visibilitychange', alCambiar)
    return () => document.removeEventListener('visibilitychange', alCambiar)
  }, [])

  if (bloqueado !== true) return <>{children}</>

  return (
    <>
      {/* El contenido sigue montado detrás para no perder el estado, pero
          tapado del todo: nada de opacidad parcial ni de desenfoque suave. */}
      <div aria-hidden className="pointer-events-none select-none opacity-0">{children}</div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-ink px-8"
      >
        <BrandMark size={64} className="shadow-glow" />
        <div className="text-center">
          <p className="text-[19px] font-semibold text-label">Desbloquea para continuar</p>
          <p className="mx-auto mt-1.5 max-w-[280px] text-[14px] leading-relaxed text-label-secondary">
            {fallo
              ? 'No se pudo comprobar. Vuelve a intentarlo.'
              : 'Usa Face ID, Touch ID o tu huella.'}
          </p>
        </div>
        <button
          onClick={() => { haptic(10); void pedir() }}
          className="press flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-accent-blue
                     px-7 text-[16px] font-semibold text-white shadow-glow"
        >
          <ScanFace size={19} />
          Desbloquear
        </button>
      </motion.div>
    </>
  )
}
