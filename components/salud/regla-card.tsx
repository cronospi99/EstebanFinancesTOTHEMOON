'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { CategoryIcon } from '@/components/ui/category-icon'
import { categoryById } from '@/lib/categories'
import { formatMoney } from '@/lib/format'
import { GRUPOS, categoriasPorGrupo, guardarAjuste, type Grupo } from '@/lib/salud'
import { useSalud } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

/**
 * La regla 50/30/20, con las categorías ya repartidas.
 *
 * La barra es de proporciones y no de progreso: enseña cómo se repartió lo que
 * entró, y encima, en una línea más fina, dónde estarían las marcas de la
 * regla. Eso es lo que permite ver el desfase sin leer un solo número —si el
 * bloque morado de los deseos se pasa de su marca, se ve—.
 *
 * Las tres barras suman lo que entró, no el 100 % de lo gastado. Es una
 * decisión con consecuencias: en un mes en que se gasta más de lo que entra,
 * las barras se salen del contenedor, y eso está bien. Normalizar a 100
 * escondería justamente el mes en que hay que mirar.
 */
export function ReglaCard() {
  const { reparto, grupos } = useSalud()
  const [abierto, setAbierto] = useState<Grupo | null>(null)
  const [ajustando, setAjustando] = useState(false)

  if (reparto.vacio) {
    return (
      <section>
        <CardHeader title="Necesidades, deseos y ahorro" />
        <Card className="p-5 text-center">
          <p className="text-[14px] leading-relaxed text-label-secondary">
            La regla reparte lo que entra, así que hace falta al menos un ingreso
            registrado en los últimos 30 días para calcularla.
          </p>
        </Card>
      </section>
    )
  }

  return (
    <section>
      <CardHeader
        title="Necesidades, deseos y ahorro"
        action={
          <button
            onClick={() => { haptic(6); setAjustando((v) => !v) }}
            className="press flex items-center gap-1 text-[12px] font-medium text-accent-blue"
          >
            <SlidersHorizontal size={12} />
            {ajustando ? 'Listo' : 'Ajustar'}
          </button>
        }
      />

      <Card className="p-4">
        <p className="mb-3 text-[13px] leading-snug text-label-secondary">
          De los {formatMoney(Math.round(reparto.ingresos))} que entraron en 30 días.
        </p>

        {/* La barra de proporciones */}
        <div className="mb-1 flex h-3 w-full gap-[2px] overflow-hidden rounded-pill bg-fill-2">
          {GRUPOS.map((g) => {
            const parte = reparto.partes[g.id]
            return (
              <motion.div
                key={g.id}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, parte.porcentaje)}%` }}
                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                style={{ background: g.color }}
                className="h-full first:rounded-l-pill last:rounded-r-pill"
              />
            )
          })}
        </div>

        {/* Las marcas de la regla: 50 y 80. Dos líneas finas y nada más. */}
        <div className="relative mb-4 h-3">
          {[50, 80].map((pct) => (
            <span
              key={pct}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${pct}%` }}
            >
              <span className="h-1.5 w-px bg-label-tertiary/60" />
              <span className="text-[9.5px] leading-none text-label-tertiary">{pct}</span>
            </span>
          ))}
        </div>

        <div className="space-y-1">
          {GRUPOS.map((g) => {
            const parte = reparto.partes[g.id]
            // El ahorro se desvía «bien» cuando se pasa; los otros dos, al revés.
            const bien = g.id === 'ahorro' ? parte.desvio >= 0 : parte.desvio <= 0
            const abierta = abierto === g.id

            return (
              <div key={g.id}>
                <button
                  onClick={() => { haptic(6); setAbierto(abierta ? null : g.id) }}
                  className="press flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-label">{g.nombre}</span>
                    <span className="block text-[12px] text-label-tertiary">
                      {parte.porcentaje.toFixed(0)} % · la regla dice {g.objetivo} %
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-[15px] font-semibold text-label">
                      {formatMoney(Math.round(parte.monto))}
                    </span>
                    <span className={cn(
                      'tnum block text-[12px]',
                      bien ? 'text-accent-green' : 'text-accent-orange',
                    )}>
                      {parte.desvio > 0 ? '+' : '−'}{formatMoney(Math.abs(Math.round(parte.desvio)))}
                    </span>
                  </span>
                  <ChevronDown
                    size={15}
                    className={cn('shrink-0 text-label-tertiary transition-transform', abierta && 'rotate-180')}
                  />
                </button>

                {abierta && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden"
                  >
                    <p className="px-1 pb-2 text-[12.5px] leading-snug text-label-secondary">
                      {g.descripcion}
                    </p>
                    <div className="space-y-0.5 pb-2">
                      {parte.detalle.slice(0, 6).map((d) => (
                        <div key={d.categoryId} className="flex items-center gap-2.5 px-1 py-1">
                          {d.categoryId === '__sobrante' ? (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-green/15 text-[12px] text-accent-green">
                              ✓
                            </span>
                          ) : (
                            <CategoryIcon
                              icon={categoryById(d.categoryId).icon}
                              color={categoryById(d.categoryId).color}
                              size="sm"
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate text-[13.5px] text-label-secondary">
                            {d.categoryId === '__sobrante'
                              ? 'Lo que no se gastó'
                              : categoryById(d.categoryId).name}
                          </span>
                          <span className="tnum shrink-0 text-[13.5px] text-label">
                            {formatMoney(Math.round(d.monto))}
                          </span>
                        </div>
                      ))}
                      {!parte.detalle.length && (
                        <p className="px-1 py-1 text-[13px] text-label-tertiary">
                          Nada registrado en este grupo.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>

        {reparto.sinClasificar > 0 && (
          <p className="mt-2 border-t border-hairline pt-2.5 text-[12px] leading-snug text-label-tertiary">
            {formatMoney(Math.round(reparto.sinClasificar))} en retiros de cajero quedan fuera del
            reparto: sacar plata no es gastarla, y contarla duplicaría lo que luego se pague en
            efectivo.
          </p>
        )}
      </Card>

      {ajustando && <AjusteDeGrupos grupos={grupos} />}
    </section>
  )
}

/**
 * Cambiar de grupo una categoría.
 *
 * Existe porque los casos de frontera son reales y personales: el gimnasio es
 * salud para quien va y un recibo olvidado para quien no; un curso puede ser
 * lo que te da de comer. Quien sabe eso es el dueño de la cuenta.
 *
 * Se guarda en el dispositivo, no en la cuenta, y la nota lo dice: es una
 * preferencia de lectura y ninguna cifra de dinero depende de ella.
 */
function AjusteDeGrupos({ grupos }: { grupos: Record<string, Grupo> }) {
  const [local, setLocal] = useState(grupos)
  const porGrupo = useMemo(() => categoriasPorGrupo(local), [local])

  const mover = (categoryId: string, grupo: Grupo) => {
    haptic(8)
    guardarAjuste(categoryId, grupo)
    setLocal((prev) => ({ ...prev, [categoryId]: grupo }))
  }

  return (
    <Card className="mt-2 p-4">
      <p className="mb-3 text-[12.5px] leading-snug text-label-secondary">
        Toca una categoría para moverla de grupo. Se guarda en este dispositivo y
        solo cambia cómo se agrupa: ninguna cifra de dinero se toca. Los cambios
        se ven al volver a entrar.
      </p>
      <div className="space-y-3">
        {GRUPOS.map((g) => (
          <div key={g.id}>
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[12px] font-semibold uppercase tracking-wider text-label-tertiary">
              <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
              {g.nombre}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {porGrupo[g.id].map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    // Rota entre los tres: es el gesto más corto para algo que
                    // se toca una vez y no se vuelve a mirar.
                    const orden: Grupo[] = ['necesidades', 'deseos', 'ahorro']
                    const siguiente = orden[(orden.indexOf(g.id) + 1) % 3]
                    mover(c.id, siguiente)
                  }}
                  className="press rounded-pill border border-hairline px-2.5 py-1 text-[12.5px] text-label-secondary"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
