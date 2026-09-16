'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CloudOff, RefreshCw } from 'lucide-react'
import { useFinance } from '@/lib/store'
import { haptic } from '@/lib/utils'

/**
 * «Hay cosas sin guardar».
 *
 * Aparece solo cuando la cola tiene algo dentro, que en condiciones normales
 * es nunca. Su trabajo es cerrar la duda que se abre cuando se registra un
 * gasto sin señal: lo que acabo de anotar, ¿se perdió?
 *
 * Dice que no se perdió y dice cuántas cosas esperan. La alternativa —no
 * enseñar nada— deja a alguien registrando a ciegas en el sótano de un
 * parqueadero sin saber si tendrá que volver a hacerlo.
 */
export function EstadoCola() {
  const { colaPendientes, sincronizarPendientes } = useFinance()

  return (
    <AnimatePresence>
      {colaPendientes > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          onClick={() => { haptic(8); void sincronizarPendientes() }}
          className="press fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-pill
                     border border-hairline bg-chrome px-3.5 py-2 text-[12.5px] text-label-secondary
                     shadow-lg backdrop-blur-2xl lg:left-[calc(50%+124px)]"
          style={{ bottom: 'calc(var(--nav-h) + var(--sab) + 12px)' }}
        >
          <CloudOff size={13} className="shrink-0 text-accent-orange" />
          <span>
            {colaPendientes === 1
              ? '1 cambio sin enviar'
              : `${colaPendientes} cambios sin enviar`}
          </span>
          <RefreshCw size={12} className="shrink-0 text-label-tertiary" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
