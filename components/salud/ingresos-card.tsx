'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Dices, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { CategoryIcon } from '@/components/ui/category-icon'
import { categoryById } from '@/lib/categories'
import { formatMoney } from '@/lib/format'
import {
  ORIGENES, categoriasPorOrigen, guardarOrigen, leerOrigenes, origenDe,
  type OrigenIngreso,
} from '@/lib/ingresos'
import { useIngresos } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

const ICONO: Record<OrigenIngreso, typeof Wallet> = {
  fijo: Wallet,
  variable: TrendingUp,
  extraordinario: Dices,
}

/**
 * De dónde sale lo que entra, y con cuánto se puede contar.
 *
 * La cifra grande no es lo que ganas: es lo que puedes dar por hecho al mes
 * —los fijos enteros más la mediana de lo variable—. Esa y no el total es la
 * cifra con la que se hace un presupuesto que se sostenga, porque es la única
 * que sigue estando el mes que no toca nada.
 *
 * Los extraordinarios se enseñan con la misma prominencia pero fuera de esa
 * suma, y eso es medio propósito de la tarjeta: ver de un vistazo cuánto del
 * semestre fue trabajo y cuánto fue suerte. Sumarlos habría sido más
 * halagador y exactamente igual de inútil.
 */
export function IngresosCard() {
  const d = useIngresos()
  const [abierto, setAbierto] = useState<OrigenIngreso | null>(null)

  if (d.vacio) {
    return (
      <section>
        <CardHeader title="De dónde entra" />
        <Card className="p-6 text-center">
          <TrendingUp size={22} className="mx-auto mb-2 text-label-tertiary" />
          <p className="text-[15px] font-medium text-label">Aún no hay ingresos registrados</p>
          <p className="mx-auto mt-1 max-w-[290px] text-[13px] leading-relaxed text-label-secondary">
            Se miran los {d.meses} meses completos anteriores a este. En cuanto haya
            movimientos de ingreso, aquí se separa lo que puedes dar por hecho de lo
            que fue suerte.
          </p>
        </Card>
      </section>
    )
  }

  return (
    <section>
      <CardHeader title="De dónde entra" />

      <Card className="p-4">
        <p className="text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Puedes contar con
        </p>
        <p className="tnum mt-0.5 text-[30px] font-bold leading-tight text-label">
          {formatMoney(d.contableMensual)}
          <span className="ml-1.5 text-[15px] font-medium text-label-secondary">al mes</span>
        </p>
        <p className="mt-1 text-[13px] leading-snug text-label-secondary">
          {!d.suficiente
            ? <>Con {d.mesesConIngreso === 1 ? 'un mes' : `${d.mesesConIngreso} meses`} de
               historial esto es provisional: hacen falta tres para que la cifra
               signifique algo.</>
            : d.estabilidad >= 99
              ? 'Todo lo que entra es previsible.'
              : <>Es el {d.estabilidad.toFixed(0)} % de los {formatMoney(d.totalMensual)} que
                 entran al mes de media. El resto va y viene.</>}
        </p>

        {!d.suficiente && (
          <p className="mt-2 rounded-xl border border-hairline bg-fill-1 p-2.5 text-[12px] leading-relaxed text-label-secondary">
            Solo se miran los {d.meses} meses completos anteriores a este, y en {d.mesesConIngreso} de
            ellos hubo movimientos de ingreso. Lo de este mes no cuenta todavía: a mitad de
            mes falta media nómina y hundiría todas las medias. Mientras tanto, esto no
            afecta a tu puntaje de salud.
          </p>
        )}

        {/* La proporción, en una barra. Tres tramos y no un gráfico: son tres
            cifras y lo que importa es cuál pesa más, no su forma exacta. */}
        <div className="mt-3.5 flex h-2 overflow-hidden rounded-pill bg-fill-2">
          {ORIGENES.map((o) => {
            const pct = d.partes[o.id].porcentaje
            if (pct <= 0) return null
            return (
              <div
                key={o.id}
                className="h-full"
                style={{ width: `${pct}%`, background: o.color }}
                title={`${o.nombre}: ${pct.toFixed(0)} %`}
              />
            )
          })}
        </div>

        <div className="mt-3.5 space-y-1 border-t border-hairline pt-3">
          {ORIGENES.map((o) => {
            const parte = d.partes[o.id]
            const Icon = ICONO[o.id]
            const estaAbierto = abierto === o.id
            return (
              <div key={o.id}>
                <button
                  onClick={() => { haptic(6); setAbierto(estaAbierto ? null : o.id) }}
                  aria-expanded={estaAbierto}
                  className="press-dim flex w-full items-center gap-2.5 py-2 text-left"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: `${o.color}22`, color: o.color }}
                  >
                    <Icon size={15} strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium text-label">{o.nombre}</span>
                    <span className="block truncate text-[11.5px] text-label-tertiary">
                      {parte.total <= 0
                        ? 'Nada en el período'
                        : o.proyecta
                          ? `${parte.porcentaje.toFixed(0)} % de lo que entra · se proyecta`
                          : `${parte.porcentaje.toFixed(0)} % de lo que entra · no se proyecta`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-[14.5px] font-semibold text-label">
                      {formatMoney(parte.mensual)}
                    </span>
                    <span className="block text-[10.5px] text-label-tertiary">al mes</span>
                  </span>
                  <ChevronDown
                    size={15}
                    className={cn('shrink-0 text-label-tertiary transition-transform', estaAbierto && 'rotate-180')}
                  />
                </button>

                {estaAbierto && (
                  <div className="mb-2 ml-[42px] space-y-1.5 border-l border-hairline pl-3">
                    <p className="text-[12px] leading-relaxed text-label-secondary">{o.descripcion}</p>
                    {o.id === 'variable' && parte.total > 0 && (
                      <p className="text-[12px] leading-relaxed text-label-secondary">
                        Se proyecta {formatMoney(d.variableEstimado)} al mes: la mediana de
                        los {d.meses} meses, no la media. Entró en {parte.mesesConAlgo} de
                        los {d.meses}.
                      </p>
                    )}
                    {parte.detalle.map((x) => {
                      const cat = categoryById(x.categoryId)
                      return (
                        <div key={x.categoryId} className="flex items-center gap-2 py-0.5">
                          <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-label">{cat.name}</span>
                          <span className="tnum shrink-0 text-[13px] text-label-secondary">
                            {formatMoney(x.monto)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {d.sinClasificar > 0 && (
          <p className="mt-2 border-t border-hairline pt-2.5 text-[11.5px] leading-relaxed text-label-tertiary">
            Fuera del reparto: {formatMoney(d.sinClasificar)} de préstamos recibidos o
            devueltos y retiros de ahorro. Entran en la cuenta, pero no son dinero nuevo.
          </p>
        )}
      </Card>

      <AjusteOrigen />
    </section>
  )
}

/**
 * Cambiar a qué nivel va cada categoría.
 *
 * Existe por la misma razón que el ajuste del 50/30/20: el freelance de uno es
 * el sueldo de otro. Quien factura al mismo cliente desde hace cuatro años
 * tiene un fijo, y quien cobra un «salario» por comisiones, no. Sin poder
 * cambiarlo, la proyección se equivoca sistemáticamente y no hay forma de
 * arreglarla.
 *
 * Va plegado: es la clase de ajuste que se toca una vez y nunca más.
 */
function AjusteOrigen() {
  const [abierto, setAbierto] = useState(false)
  const [ajustes, setAjustes] = useState<Record<string, OrigenIngreso>>({})

  // En un efecto, no al construir: `localStorage` no existe en el servidor.
  useEffect(() => { setAjustes(leerOrigenes()) }, [])

  const cambiar = (categoryId: string, origen: OrigenIngreso) => {
    haptic(6)
    guardarOrigen(categoryId, origen)
    setAjustes(leerOrigenes())
  }

  const grupos = categoriasPorOrigen(ajustes)

  return (
    <div className="mt-2">
      <button
        onClick={() => { haptic(6); setAbierto(!abierto) }}
        aria-expanded={abierto}
        className="press-dim flex w-full items-center justify-between px-1 py-2 text-[13px] text-label-secondary"
      >
        <span>Cambiar cómo se clasifica cada ingreso</span>
        <ChevronDown size={15} className={cn('transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <Card className="mt-1 p-4">
          <p className="mb-3 text-[12.5px] leading-relaxed text-label-secondary">
            Lo de abajo es un punto de partida, no una ley. Si llevas cuatro años
            facturándole al mismo cliente, ese freelance es un fijo; si tu «salario» es
            comisiones, no lo es. Lo que cambies aquí cambia lo que se proyecta.
          </p>
          <div className="space-y-3">
            {ORIGENES.map((o) => (
              <div key={o.id}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: o.color }}>
                  {o.nombre}
                </p>
                <div className="space-y-1">
                  {grupos[o.id].map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5 py-1">
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-label">{c.name}</span>
                      <div className="flex shrink-0 gap-1">
                        {ORIGENES.map((destino) => (
                          <button
                            key={destino.id}
                            onClick={() => cambiar(c.id, destino.id)}
                            aria-label={`${c.name}: ${destino.nombre}`}
                            aria-pressed={origenDe(c.id, ajustes) === destino.id}
                            className={cn(
                              'press h-6 w-6 rounded-md border text-[10px] font-semibold transition-colors',
                              origenDe(c.id, ajustes) === destino.id
                                ? 'border-transparent text-black'
                                : 'border-hairline text-label-tertiary',
                            )}
                            style={
                              origenDe(c.id, ajustes) === destino.id
                                ? { background: destino.color }
                                : undefined
                            }
                          >
                            {destino.nombre[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!grupos[o.id].length && (
                    <p className="text-[12px] text-label-tertiary">Ninguna.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
