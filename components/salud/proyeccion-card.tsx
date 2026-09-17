'use client'

import { useState } from 'react'
import { AlertTriangle, CalendarRange, ChevronDown } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import { NOMBRE_EVENTO, type TipoEvento } from '@/lib/liquidez'
import { useProyeccionMeses } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

/**
 * «oct 26», corto: son doce filas y la etiqueta tiene 52 px.
 *
 * El mes y el año se piden por separado a propósito. Pidiéndolos juntos, el
 * español devuelve «oct de 26», y ese «de» se comía el espacio de la barra.
 */
function nombreMes(clave: string): string {
  const [a, m] = clave.split('-').map(Number)
  const mes = new Date(a, m - 1, 1)
    .toLocaleDateString('es-CO', { month: 'short' })
    .replace('.', '')
  return `${mes} ${String(a).slice(2)}`
}

/**
 * Los próximos doce meses, uno por uno.
 *
 * La proyección de liquidez de arriba contesta «¿llego al día 30?» y va día a
 * día. Esta contesta otra cosa —«¿cuánto me sobra al mes, y a dónde llego si
 * esto sigue así?»— y por eso la unidad es el mes: a un año vista, decir qué
 * pasa un jueves concreto es precisión inventada.
 *
 * La cifra grande es lo que sobra al mes de media, no el saldo final. El saldo
 * final de doce meses depende tanto de los supuestos que no se puede tomar en
 * serio como cifra; lo que sobra al mes sí se puede, y es además lo único
 * sobre lo que se puede actuar.
 */
export function ProyeccionCard() {
  const p = useProyeccionMeses()
  const [abierto, setAbierto] = useState<string | null>(null)

  const positivo = p.netoMedio >= 0
  // La escala de las barras: el mes que más mueve manda, y los demás se miden
  // contra él. Con una escala fija, quien gana poco vería doce barras llenas.
  const tope = Math.max(...p.meses.map((m) => Math.abs(m.neto)), 1)

  return (
    <section>
      <CardHeader title="Próximos 12 meses" />

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]',
              positivo ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red',
            )}
          >
            <CalendarRange size={20} strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              {positivo ? 'Te sobra al mes' : 'Te falta al mes'}
            </p>
            <p className={cn(
              'tnum text-[28px] font-bold leading-tight',
              positivo ? 'text-label' : 'text-accent-red',
            )}>
              {formatMoney(Math.abs(p.netoMedio))}
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-[13px] leading-relaxed text-label-secondary">
          {positivo ? (
            <>
              Si todo sigue igual, en un año tendrías {formatMoney(p.saldoFinal)} frente a
              los {formatMoney(p.saldoInicial)} de hoy.
            </>
          ) : (
            <>
              Cada mes sale más de lo que entra. En un año quedarías
              en {formatMoney(p.saldoFinal)}, partiendo de {formatMoney(p.saldoInicial)}.
            </>
          )}
        </p>

        {p.primerRojo && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-accent-red/25 bg-accent-red/[0.07] p-3">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-accent-red" />
            <p className="text-[12.5px] leading-relaxed text-label">
              El saldo se te acaba en <strong>{nombreMes(p.primerRojo)}</strong>
              {p.mesesEnRojo > 1 && <> y sigue en rojo {p.mesesEnRojo} meses</>}. Es el mes
              al que hay que llegar con algo hecho.
            </p>
          </div>
        )}

        {/* Los doce meses. Fila y no gráfico: aquí se vienen a leer cifras
            —cuánto sobra en marzo— y una barra por mes basta para ver la
            forma sin perder el número exacto. */}
        <div className="mt-3.5 space-y-0.5 border-t border-hairline pt-2">
          {p.meses.map((m) => {
            const estaAbierto = abierto === m.mes
            const ancho = (Math.abs(m.neto) / tope) * 100
            const sobra = m.neto >= 0
            return (
              <div key={m.mes}>
                <button
                  onClick={() => { haptic(6); setAbierto(estaAbierto ? null : m.mes) }}
                  aria-expanded={estaAbierto}
                  className="press-dim flex w-full items-center gap-2.5 py-1.5 text-left"
                >
                  <span className="w-[52px] shrink-0 text-[12.5px] capitalize text-label-secondary">
                    {nombreMes(m.mes)}
                  </span>

                  {/* Eje al centro: lo que sobra crece a la derecha y lo que
                      falta a la izquierda, así un mes malo se ve de lejos. */}
                  <span className="relative h-2 min-w-0 flex-1 rounded-pill bg-fill-2">
                    <span
                      className="absolute top-0 h-full rounded-pill"
                      style={{
                        width: `${Math.max(2, ancho / 2)}%`,
                        left: sobra ? '50%' : undefined,
                        right: sobra ? undefined : '50%',
                        background: sobra ? '#30D158' : '#FF453A',
                      }}
                    />
                    <span className="absolute left-1/2 top-[-2px] h-[calc(100%+4px)] w-px bg-fill-4" />
                  </span>

                  <span className="shrink-0 text-right">
                    <span className={cn(
                      'tnum block text-[13px] font-semibold',
                      sobra ? 'text-label' : 'text-accent-red',
                    )}>
                      {sobra ? '+' : '−'}{formatMoney(Math.abs(m.neto))}
                    </span>
                    <span className={cn(
                      'tnum block text-[10.5px]',
                      m.enRojo ? 'text-accent-red' : 'text-label-tertiary',
                    )}>
                      {formatMoney(m.saldo)}
                    </span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn('shrink-0 text-label-tertiary transition-transform', estaAbierto && 'rotate-180')}
                  />
                </button>

                {estaAbierto && (
                  <div className="mb-2 ml-[62px] space-y-1 border-l border-hairline pl-3 text-[12.5px]">
                    <Fila etiqueta="Ingresos con fecha" monto={m.entraFijo} signo="+" />
                    {m.entraVariable > 0 && (
                      <Fila etiqueta="Variable estimado" monto={m.entraVariable} signo="+" tenue />
                    )}
                    {Object.entries(m.salePorTipo)
                      .sort((a, b) => b[1] - a[1])
                      .map(([tipo, monto]) => (
                        <Fila
                          key={tipo}
                          etiqueta={NOMBRE_EVENTO[tipo as TipoEvento] ?? tipo}
                          monto={monto}
                          signo="−"
                        />
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/*
          Los supuestos, escritos. Una proyección a un año sin decir de qué
          depende es un número que parece un hecho, y este depende de cuatro
          cosas que el usuario puede querer discutir.
        */}
        <p className="mt-3 border-t border-hairline pt-2.5 text-[11.5px] leading-relaxed text-label-tertiary">
          En pesos de hoy: sin inflación ni aumentos. Cuenta el sueldo y demás ingresos
          recurrentes con su fecha
          {p.variableEstimado > 0 && <>, {formatMoney(p.variableEstimado)} al mes de ingreso
          variable estimado</>}, las suscripciones, las cuotas de tarjeta, las deudas con
          plazo y el gasto corriente de tus últimos meses. Lo extraordinario —loterías,
          rifas, regalos— no entra nunca.
          {p.sinConvertir > 0 && <> {p.sinConvertir} cosas quedaron fuera por estar en
          dólares sin tasa conocida.</>}
        </p>
      </Card>
    </section>
  )
}

function Fila({
  etiqueta, monto, signo, tenue,
}: {
  etiqueta: string
  monto: number
  signo: '+' | '−'
  tenue?: boolean
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={cn('min-w-0 flex-1 truncate', tenue ? 'text-label-tertiary' : 'text-label-secondary')}>
        {etiqueta}
        {tenue && ' (estimado)'}
      </span>
      <span className={cn('tnum shrink-0', signo === '+' ? 'text-accent-green' : 'text-label-secondary')}>
        {signo}{formatMoney(monto)}
      </span>
    </div>
  )
}
