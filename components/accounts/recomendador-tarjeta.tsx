'use client'

import { CreditCard, Sparkles } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { fechaCobro } from '@/lib/suscripciones'
import { formatMoney } from '@/lib/format'
import { useRecomendacionTarjeta, useTarjetasConCiclo } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Con qué tarjeta conviene pagar hoy.
 *
 * Es la única jugada que de verdad da dinero con una tarjeta de crédito, y no
 * se puede hacer de cabeza: hay que saberse la fecha de corte de cada una y
 * restar. Comprar justo después del corte mueve la compra al extracto
 * siguiente y la paga un mes y medio más tarde; comprar la víspera la paga en
 * dos semanas. Con la misma tarjeta.
 *
 * Ordena por días de financiación y no por cupo libre, que es lo que uno
 * miraría sin pensar. El cupo dice si la compra cabe; los días dicen cuánto
 * tiempo el dinero sigue en tu cuenta en vez de en la del banco.
 *
 * Las descartadas se enseñan igual, tachadas y con el motivo. Esconderlas
 * dejaría a alguien mirando la pantalla con la tarjeta en la mano sin entender
 * por qué no aparece.
 */
export function RecomendadorTarjeta({ monto = 0, compacto = false }: { monto?: number; compacto?: boolean }) {
  const filas = useRecomendacionTarjeta(monto)
  const conCiclo = useTarjetasConCiclo()

  if (!conCiclo) {
    if (compacto) return null
    return (
      <section>
        <CardHeader title="Con cuál pagar hoy" />
        <Card className="flex gap-3 p-4">
          <div className="mt-0.5 shrink-0 text-label-tertiary"><CreditCard size={17} /></div>
          <p className="text-[13px] leading-snug text-label-secondary">
            Ponle a tus tarjetas el día de corte y el día límite de pago —están en el
            extracto— y aquí aparecerá con cuál conviene pagar cada día. La diferencia
            entre acertar y no acertar llega a 45 días sin intereses.
          </p>
        </Card>
      </section>
    )
  }

  const utilizables = filas.filter((f) => !f.descartada)
  const mejor = utilizables[0]

  if (compacto) {
    if (!mejor) return null
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-hairline bg-fill-1 px-3 py-2.5">
        <Sparkles size={14} className="shrink-0 text-accent-green" />
        <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-label-secondary">
          Con <strong className="font-semibold text-label">{mejor.cuenta.name}</strong> tendrías{' '}
          <strong className="font-semibold text-accent-green">{mejor.dias} días</strong> para pagarlo.
        </p>
      </div>
    )
  }

  return (
    <section>
      <CardHeader title="Con cuál pagar hoy" />
      <Card className="p-2">
        {filas.map((f, i) => {
          const gana = !f.descartada && f === mejor
          return (
            <div
              key={f.cuenta.id}
              className={cn(
                'flex items-center gap-3 rounded-xl p-2.5',
                gana && 'bg-accent-green/[0.08]',
                f.descartada && 'opacity-45',
                i > 0 && 'mt-0.5',
              )}
            >
              <InstitutionBadge institution={f.cuenta.institution} color={f.cuenta.color} size="sm" />

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[14.5px] font-medium text-label">
                  <span className="truncate">{f.cuenta.name}</span>
                  {gana && <Sparkles size={12} className="shrink-0 text-accent-green" />}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-label-secondary">
                  {f.descartada ?? f.motivo}
                </p>
                {!f.descartada && (
                  <p className="mt-0.5 text-[11.5px] text-label-tertiary">
                    Corta el {fechaCobro(f.ciclo.corteProximo)} · se paga el {fechaCobro(f.ciclo.limiteDeHoy)}
                    {f.cupo !== null && ` · cupo libre ${formatMoney(f.cupo, f.cuenta.currency)}`}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className={cn(
                  'tnum text-[19px] font-bold leading-none',
                  gana ? 'text-accent-green' : 'text-label',
                )}>
                  {f.dias}
                </p>
                <p className="text-[10.5px] text-label-tertiary">días</p>
              </div>
            </div>
          )
        })}
      </Card>

      <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-label-tertiary">
        Los días son hasta la fecha límite del extracto donde caería la compra, y dan
        por hecho que se paga el total ese día. Diferir a cuotas tiene una tasa
        detrás: ahí ya no es dinero gratis.
      </p>
    </section>
  )
}
