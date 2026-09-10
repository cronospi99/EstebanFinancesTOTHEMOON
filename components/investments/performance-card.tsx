'use client'

import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { RangePicker } from '@/components/dashboard/range-picker'
import { BalanceChart } from '@/components/dashboard/balance-chart'
import { formatCompact, formatMoney, formatPercent } from '@/lib/format'
import { calcularSeriePortafolio } from '@/lib/portfolio-series'
import { RANGE_DAYS, RANGE_LABEL, useFinance, type RangeKey } from '@/lib/store'
import { useHistory } from '@/lib/use-history'
import { cn } from '@/lib/utils'
import type { Currency } from '@/lib/types'

/**
 * Rendimiento histórico del portafolio.
 *
 * Enseña el valor a lo largo del tiempo, no el rendimiento acumulado en
 * porcentaje, porque es lo que responde la pregunta que uno se hace mirando el
 * gráfico: cuánto tenía y cuánto tengo. El porcentaje va en la cabecera y
 * descuenta las aportaciones del período: sin eso, meter dinero se leería como
 * haber ganado, que es la forma más fácil de engañarse con una cartera.
 */
export function PerformanceCard({ moneda, enMoneda }: { moneda: Currency; enMoneda: (cop: number) => number }) {
  const { holdings, trades, fxRate } = useFinance()
  const [range, setRange] = useState<RangeKey>('1M')

  const simbolos = useMemo(
    () => [...new Set(holdings.filter((h) => h.quantity > 0).map((h) => h.symbol))],
    [holdings],
  )
  const { series, loading, fallos } = useHistory(simbolos, RANGE_DAYS[range])

  const datos = useMemo(
    () => calcularSeriePortafolio({
      holdings, trades, series, fxRate, days: RANGE_DAYS[range],
    }),
    [holdings, trades, series, fxRate, range],
  )

  const sube = datos.variacion >= 0
  const enDivisa = (cop: number) => formatMoney(enMoneda(cop), moneda)
  // Con todas las posiciones sin cierres, la curva es el coste plano: decirlo
  // es más útil que dibujar una línea recta y dejar que parezca un resultado.
  const sinDatos = datos.sinPrecio.length === simbolos.length && simbolos.length > 0

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-label-secondary">
          Rendimiento · {RANGE_LABEL[range]}
        </span>
        {loading && <span className="text-[11px] text-label-tertiary">cargando…</span>}
      </div>

      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <span className={cn('tnum text-[26px] font-bold leading-none tracking-[-0.02em]', sube ? 'text-accent-green' : 'text-accent-red')}>
          {sube ? '+' : '−'}{enDivisa(Math.abs(datos.variacion))}
        </span>
        <span
          className={cn(
            'flex items-center gap-0.5 rounded-pill px-2 py-0.5 text-[12px] font-semibold',
            sube ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red',
          )}
        >
          {sube ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {formatPercent(datos.variacionPct)}
        </span>
      </div>

      <div className="mb-3">
        <RangePicker value={range} onChange={setRange} />
      </div>

      {datos.serie.length > 1 && (
        /*
         * El color de la curva sigue a la curva —dónde acabó frente a dónde
         * empezó—, no al rendimiento del titular. Son cosas distintas: una
         * cartera puede valer más porque se le metió dinero y aun así no haber
         * rendido nada, y pintar de rojo una línea que sube es desconcertante.
         * El titular ya dice lo otro, y con su propio color.
         */
        <BalanceChart
          data={datos.serie}
          positive={datos.fin >= datos.inicio}
          id="portafolioFill"
          label="Portafolio"
          format={(v) => formatCompact(enMoneda(v), moneda)}
        />
      )}

      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-hairline pt-3">
        <Dato titulo="Al inicio" valor={enDivisa(datos.inicio)} />
        <Dato titulo="Aportes" valor={`${datos.aportes >= 0 ? '+' : '−'}${enDivisa(Math.abs(datos.aportes))}`} />
        <Dato titulo="Hoy" valor={enDivisa(datos.fin)} />
      </div>

      {sinDatos ? (
        <p className="mt-3 rounded-lg bg-accent-orange/10 px-3 py-2 text-[12px] leading-relaxed text-accent-orange">
          Sin histórico de precios. La curva muestra el costo de lo aportado, no
          el valor de mercado.
          {fallos.length > 0 && (
            <span className="mt-1 block text-[11px] text-accent-orange/70">{fallos.slice(0, 2).join(' · ')}</span>
          )}
        </p>
      ) : datos.sinPrecio.length > 0 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-label-tertiary">
          {loading
            ? `Falta el histórico de ${datos.sinPrecio.join(', ')}: se está pidiendo.`
            : `Sin precios de ${datos.sinPrecio.join(', ')}: esas posiciones entran al costo.`}
          {/* El motivo, también cuando solo falla parte. Antes solo se decía si
              fallaban todas, así que un «entran al costo» sobre tres símbolos
              no daba nada con lo que actuar: el cupo del proveedor y un ticker
              que no existe se leían igual. */}
          {!loading && fallos.length > 0 && (
            <span className="mt-0.5 block text-label-tertiary/70">{fallos[0]}</span>
          )}
        </p>
      ) : (
        <p className="mt-3 text-[11px] leading-relaxed text-label-tertiary">
          El porcentaje descuenta los aportes del período. La conversión a pesos
          usa la tasa de hoy en toda la serie.
        </p>
      )}
    </Card>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[11px] text-label-secondary">{titulo}</p>
      <p className="tnum truncate text-[14px] font-semibold text-label">{valor}</p>
    </div>
  )
}
