'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { formatCompact, formatKeypad, formatMoney, parseKeypad } from '@/lib/format'
import { COLOR_EVENTO, HORIZONTES, NOMBRE_EVENTO, puedoGastar, type Horizonte, type TipoEvento } from '@/lib/liquidez'
import { fechaCobro } from '@/lib/suscripciones'
import { useLiquidez } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

/**
 * La proyección de liquidez, que es la pantalla que responde a la pregunta.
 *
 * «¿Puedo hacer este gasto hoy sin quedarme sin dinero a fin de mes?» no se
 * contesta con el saldo. Se contesta con el punto más bajo de los próximos
 * treinta días, que casi nunca es hoy y casi siempre es el día antes de que
 * entre el sueldo.
 *
 * Por eso la cifra grande de la tarjeta no es el saldo de hoy ni el del final
 * del tramo: es el mínimo. El final no sirve —puede acabar bien después de
 * haber pasado por cero— y el de hoy es justo el que engaña.
 */
export function LiquidezCard() {
  const [dias, setDias] = useState<Horizonte>(30)
  const [conCorriente, setConCorriente] = useState(true)
  const [simulado, setSimulado] = useState('')

  const p = useLiquidez(dias, conCorriente)
  const monto = parseKeypad(simulado)
  const respuesta = useMemo(() => puedoGastar(p, monto), [p, monto])

  const serie = useMemo(
    () => p.serie.map((punto) => ({
      ...punto,
      // La línea del simulador es la misma desplazada: el gasto se hace hoy,
      // así que baja todos los días siguientes por igual.
      simulado: monto > 0 ? punto.saldo - monto : null,
    })),
    [p.serie, monto],
  )

  const enRojo = p.minimo.saldo < 0
  const color = enRojo ? '#FF453A' : respuesta.veredicto === 'justo' && monto > 0 ? '#FF9F0A' : '#30D158'

  // Los próximos movimientos grandes, para que la curva se pueda explicar.
  const proximos = useMemo(
    () => p.eventos.filter((e) => e.tipo !== 'corriente').slice(0, 6),
    [p.eventos],
  )

  return (
    <section>
      <CardHeader
        title="Liquidez proyectada"
        action={
          <Segmented
            id="horizonte"
            className="w-[168px]"
            value={String(dias)}
            onChange={(v) => setDias(Number(v) as Horizonte)}
            options={HORIZONTES.map((d) => ({ value: String(d), label: `${d} d` }))}
          />
        }
      />

      <Card className="overflow-hidden p-4">
        {/* El mínimo manda: es el día en que la cuerda se tensa. */}
        <div className="mb-1 flex items-baseline gap-2">
          <span className={cn('tnum text-[30px] font-bold leading-none tracking-[-0.02em]')} style={{ color }}>
            {formatMoney(Math.round(p.minimo.saldo))}
          </span>
          <span className="text-[13px] text-label-tertiary">lo más bajo</span>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-label-secondary">
          {p.minimo.dia === p.serie[0]?.dia
            ? `Hoy es tu punto más bajo: de aquí a ${dias} días solo sube.`
            : `Caerá ahí el ${fechaCobro(p.minimo.dia)}. Hoy tienes ${formatMoney(Math.round(p.saldoInicial))}.`}
        </p>

        {/* ---- El gráfico ---- */}
        <div className="-mx-2 h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="liquidezFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {/*
                El dominio arranca en el mínimo entre cero y el punto más bajo.
                Recortarlo al rango de los datos —que es lo que hace el gráfico
                del patrimonio— escondería el cruce por cero, que aquí es la
                única línea que de verdad importa.
              */}
              <YAxis
                hide
                domain={[
                  (min: number) => Math.min(0, min) * 1.1,
                  (max: number) => max * 1.05,
                ]}
              />
              <XAxis dataKey="dia" hide />
              <ReferenceLine y={0} stroke="rgba(255,69,58,0.5)" strokeDasharray="3 3" />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.22)', strokeWidth: 1 }}
                contentStyle={{
                  background: 'rgba(28,28,30,0.94)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  fontSize: 12,
                  padding: '8px 10px',
                }}
                labelFormatter={(v) => fechaCobro(String(v))}
                formatter={(valor, nombre) => [
                  formatMoney(Number(valor)),
                  nombre === 'simulado' ? 'Con el gasto' : 'Proyectado',
                ]}
              />
              <Area
                type="monotone" dataKey="saldo" stroke={color} strokeWidth={2}
                fill="url(#liquidezFill)" dot={false} isAnimationActive={false}
              />
              {monto > 0 && (
                <Area
                  type="monotone" dataKey="simulado" stroke="#FF9F0A" strokeWidth={1.5}
                  strokeDasharray="4 3" fill="none" dot={false} isAnimationActive={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mb-3 flex justify-between px-1 text-[11px] text-label-tertiary">
          <span>Hoy</span>
          <span>{fechaCobro(p.serie[p.serie.length - 1]?.dia ?? '')}</span>
        </div>

        {/* ---- El simulador ---- */}
        <div className="rounded-2xl border border-hairline bg-fill-1 p-3">
          <label className="mb-2 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
            <Wallet size={12} /> ¿Puedo gastarme…?
          </label>
          <div className="flex items-center gap-1.5 rounded-xl bg-fill-2 px-3 py-2.5">
            <span className="text-[17px] text-label-secondary">$</span>
            <input
              value={simulado ? formatKeypad(simulado) : ''}
              inputMode="numeric"
              onChange={(e) => setSimulado(e.target.value.replace(/[^\d,]/g, ''))}
              placeholder="350.000"
              aria-label="Monto que quieres gastar"
              className="tnum w-full bg-transparent text-[20px] font-semibold text-label
                         placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
            />
            {simulado && (
              <button
                onClick={() => { haptic(6); setSimulado('') }}
                className="press shrink-0 text-[13px] text-label-tertiary"
              >
                Borrar
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {monto > 0 && (
              <motion.div
                key={respuesta.veredicto}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'mt-2.5 flex gap-2.5 rounded-xl p-3',
                  respuesta.veredicto === 'si' && 'bg-accent-green/10',
                  respuesta.veredicto === 'justo' && 'bg-accent-orange/10',
                  respuesta.veredicto === 'no' && 'bg-accent-red/10',
                )}
              >
                <div className={cn(
                  'mt-0.5 shrink-0',
                  respuesta.veredicto === 'si' && 'text-accent-green',
                  respuesta.veredicto === 'justo' && 'text-accent-orange',
                  respuesta.veredicto === 'no' && 'text-accent-red',
                )}>
                  {respuesta.veredicto === 'si' ? <Check size={16} strokeWidth={2.6} />
                    : respuesta.veredicto === 'justo' ? <AlertTriangle size={16} />
                    : <TrendingDown size={16} />}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-label">{respuesta.titulo}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-label-secondary">
                    {respuesta.detalle}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---- Lo que viene ---- */}
        {proximos.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {proximos.map((e, i) => (
              <div key={`${e.dia}-${e.concepto}-${i}`} className="flex items-center gap-2.5 px-1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
                <span className="w-[54px] shrink-0 text-[12px] tabular-nums text-label-tertiary">
                  {fechaCobro(e.dia)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-label">{e.concepto}</span>
                <span className={cn(
                  'tnum shrink-0 text-[13.5px] font-medium',
                  e.monto >= 0 ? 'text-accent-green' : 'text-label-secondary',
                )}>
                  {e.monto >= 0 ? '+' : '−'}{formatCompact(Math.abs(e.monto))}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ---- El pie: de qué está hecha la línea ---- */}
        <div className="mt-3 border-t border-hairline pt-3">
          <button
            onClick={() => { haptic(6); setConCorriente((v) => !v) }}
            aria-pressed={conCorriente}
            className="press flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="min-w-0 text-[12.5px] leading-snug text-label-secondary">
              {conCorriente ? (
                <>
                  Incluye {formatMoney(p.gastoDiario)} al día de gasto corriente estimado,
                  a partir de tu historial.
                </>
              ) : (
                <>Solo cuenta lo que ya está comprometido: sin el gasto del día a día.</>
              )}
            </span>
            <span className={cn(
              'shrink-0 rounded-pill px-2.5 py-1 text-[12px] font-medium',
              conCorriente ? 'bg-fill-3 text-label' : 'border border-hairline text-label-tertiary',
            )}>
              {conCorriente ? 'Quitar' : 'Incluir'}
            </span>
          </button>

          {p.sinConvertir > 0 && (
            <p className="mt-2 text-[12px] text-accent-orange">
              {p.sinConvertir} {p.sinConvertir === 1 ? 'concepto quedó fuera' : 'conceptos quedaron fuera'} por
              estar en dólares sin tasa conocida.
            </p>
          )}
        </div>
      </Card>

      <Leyenda />
    </section>
  )
}

/** Qué es cada color. Sin esto, la lista de arriba son puntos de colores. */
function Leyenda() {
  const tipos: TipoEvento[] = ['ingreso', 'suscripcion', 'tarjeta', 'deuda', 'cobro', 'corriente']
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1">
      {tipos.map((t) => (
        <span key={t} className="flex items-center gap-1.5 text-[11px] text-label-tertiary">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLOR_EVENTO[t] }} />
          {NOMBRE_EVENTO[t]}
        </span>
      ))}
    </div>
  )
}
