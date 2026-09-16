'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Flame } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import { RENDIMIENTO_REAL_POR_DEFECTO, SWR_POR_DEFECTO } from '@/lib/fire'
import { useFire } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

/**
 * El sueldo pasivo, en pequeño y sin promesas.
 *
 * La cifra que manda es «cuánto de tus gastos del mes paga ya tu dinero», no
 * «te faltan 23,4 años». La primera se puede comprobar, sube cuando aportas y
 * se entiende sin explicar nada. La segunda depende de rendimientos que nadie
 * conoce y da una precisión que no existe, así que va debajo, en gris, con sus
 * supuestos escritos al lado.
 *
 * Toda la tarjeta se puede plegar. Para quien está empezando, un 0,4 % de
 * cobertura no es una cifra motivadora, y esto no debería ser lo primero que
 * ve al abrir la pantalla.
 */
export function FireCard() {
  const [detalle, setDetalle] = useState(false)
  const fire = useFire()

  const cobertura = Math.min(100, Math.max(0, fire.cobertura))

  return (
    <section>
      <CardHeader title="Sueldo pasivo" />
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-orange/15 text-accent-orange">
            <Flame size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="tnum text-[22px] font-bold leading-tight tracking-[-0.01em] text-label">
              {formatMoney(Math.round(fire.sueldoPasivo))}
              <span className="ml-1 text-[13px] font-normal text-label-tertiary">al mes</span>
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-label-secondary">
              {fire.cobertura >= 100
                ? 'Tu dinero ya paga todos tus gastos del mes.'
                : `Cubre el ${fire.cobertura.toFixed(fire.cobertura < 10 ? 1 : 0)} % de lo que gastas al mes.`}
            </p>
          </div>
        </div>

        {/* La barra de cobertura. Es el número que se mueve mes a mes. */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-fill-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${cobertura}%` }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            className="h-full rounded-pill bg-gradient-to-r from-accent-orange to-accent-green"
          />
        </div>

        <button
          onClick={() => { haptic(6); setDetalle((v) => !v) }}
          className="press mt-3 flex w-full items-center justify-between text-left"
        >
          <span className="text-[13px] text-label-secondary">
            {detalle ? 'Ocultar el detalle' : 'Cómo sale esta cifra'}
          </span>
          <ChevronDown size={15} className={cn('text-label-tertiary transition-transform', detalle && 'rotate-180')} />
        </button>

        {detalle && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2 border-t border-hairline pt-3">
              <Fila
                etiqueta="Dividendos y rendimientos cobrados"
                valor={`${formatMoney(Math.round(fire.sueldoPasivoReal))} al mes`}
                nota="Lo que de verdad entró en los últimos 12 meses. Un fondo que no reparte sale en cero aunque crezca."
              />
              <Fila
                etiqueta="Capital para vivir de él"
                valor={formatMoney(Math.round(fire.numeroFire))}
                nota={`Tu gasto anual dividido entre una tasa de retiro del ${SWR_POR_DEFECTO} %.`}
              />
              <Fila
                etiqueta="Lo que llevas"
                valor={`${fire.avance.toFixed(1)} %`}
              />
              {fire.anios !== null && (
                <Fila
                  etiqueta="Al ritmo de aporte actual"
                  valor={fire.anios < 1 ? 'menos de un año' : `${fire.anios.toFixed(0)} años · ${fire.anio}`}
                  nota={`Supone un ${RENDIMIENTO_REAL_POR_DEFECTO} % real anual, ya descontada la inflación. Es una proyección, no una promesa.`}
                />
              )}
              <Fila
                etiqueta="Coast FIRE"
                valor={formatMoney(Math.round(fire.coast))}
                nota={fire.enCoast
                  ? 'Ya lo pasaste: sin aportar un peso más, el interés compuesto llega solo.'
                  : 'Al llegar ahí puedes dejar de aportar y el interés compuesto hace el resto en 30 años.'}
              />
            </div>

            <p className="mt-3 text-[11.5px] leading-relaxed text-label-tertiary">
              La tasa de retiro del 4 % viene del estudio Trinity, hecho sobre carteras
              en dólares. En pesos conviene ser más conservador: la inflación colombiana
              ha sido más alta y más variable, y lo único que cuenta es el rendimiento
              que queda después de ella.
            </p>
          </motion.div>
        )}
      </Card>
    </section>
  )
}

function Fila({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13.5px] text-label-secondary">{etiqueta}</span>
        <span className="tnum shrink-0 text-[13.5px] font-medium text-label">{valor}</span>
      </div>
      {nota && <p className="mt-0.5 text-[11.5px] leading-snug text-label-tertiary">{nota}</p>}
    </div>
  )
}
