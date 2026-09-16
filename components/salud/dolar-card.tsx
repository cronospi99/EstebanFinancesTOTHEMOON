'use client'

import { ArrowDownRight, ArrowUpRight, DollarSign } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import { useFinance, useImpactoDolar } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Cuánto de tu patrimonio depende del dólar.
 *
 * Quien tiene una cuenta en dólares o ETF en Estados Unidos carga con un
 * riesgo cambiario que no eligió: el patrimonio en pesos sube y baja sin que
 * se compre ni se venda nada, y en ningún sitio aparece esa cifra. Aquí sí.
 *
 * La tasa que se usa es la TRM oficial cuando se conoce, y se dice cuál es.
 * No es un detalle de pedantes: la TRM es la que aplica el banco cuando llega
 * la factura de una compra en dólares y la que se declara ante la DIAN, y
 * puede separarse del precio de mercado lo suficiente como para que las
 * cuentas no cuadren.
 */
export function DolarCard() {
  const impacto = useImpactoDolar()
  const { trm } = useFinance()

  if (impacto.exposicion <= 0) return null

  return (
    <section>
      <CardHeader title="Tu exposición al dólar" />
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green">
            <DollarSign size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="tnum text-[22px] font-bold leading-tight tracking-[-0.01em] text-label">
              US$ {impacto.exposicion.toLocaleString('es-CO', { maximumFractionDigits: 2 })}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-label-secondary">
              {formatMoney(Math.round(impacto.enPesos))} · el {impacto.porcentaje.toFixed(0)} % de tu patrimonio
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2 border-t border-hairline pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13.5px] text-label-secondary">Por cada peso que suba el dólar</span>
            <span className="tnum shrink-0 text-[13.5px] font-medium text-accent-green">
              +{formatMoney(Math.round(impacto.sensibilidad))}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Escenario
              icono={<ArrowUpRight size={14} />}
              titulo="Si sube un 5 %"
              valor={`+${formatMoney(Math.round(impacto.siSube))}`}
              positivo
            />
            <Escenario
              icono={<ArrowDownRight size={14} />}
              titulo="Si baja un 5 %"
              valor={formatMoney(Math.round(impacto.siBaja))}
            />
          </div>

          {impacto.movimientos > 0 && (
            <div className="border-t border-hairline pt-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] text-label-secondary">Diferencia en cambio</span>
                <span className={cn(
                  'tnum shrink-0 text-[13.5px] font-medium',
                  impacto.diferencia >= 0 ? 'text-accent-green' : 'text-accent-red',
                )}>
                  {impacto.diferencia >= 0 ? '+' : '−'}{formatMoney(Math.abs(Math.round(impacto.diferencia)))}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-label-tertiary">
                Lo que el dólar te ha dado o quitado sobre {impacto.movimientos}{' '}
                {impacto.movimientos === 1 ? 'movimiento' : 'movimientos'} que guardaron
                la tasa de su día, comparada con la de hoy.
              </p>
            </div>
          )}
        </div>

        <p className="mt-3 text-[11.5px] leading-snug text-label-tertiary">
          {impacto.oficial ? (
            <>
              Calculado con la TRM oficial de la Superintendencia Financiera:{' '}
              {formatMoney(impacto.tasa)} por dólar{trm.dia ? `, vigente el ${trm.dia}` : ''}.
            </>
          ) : impacto.tasa > 0 ? (
            <>
              Con el precio de mercado ({formatMoney(impacto.tasa)}), no con la TRM oficial:
              no se pudo consultar. Para declarar o cuadrar con el banco, manda la TRM.
            </>
          ) : (
            <>No se conoce la tasa del dólar ahora mismo, así que estas cifras están sin convertir.</>
          )}
        </p>
      </Card>
    </section>
  )
}

function Escenario({
  icono, titulo, valor, positivo,
}: {
  icono: React.ReactNode
  titulo: string
  valor: string
  positivo?: boolean
}) {
  return (
    <div className="rounded-xl border border-hairline bg-fill-1 p-2.5">
      <p className="mb-0.5 flex items-center gap-1 text-[11.5px] text-label-tertiary">
        {icono}{titulo}
      </p>
      <p className={cn('tnum text-[14px] font-semibold', positivo ? 'text-accent-green' : 'text-accent-red')}>
        {valor}
      </p>
    </div>
  )
}
