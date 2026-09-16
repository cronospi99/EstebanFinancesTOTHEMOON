'use client'

import { TriangleAlert } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ResumenSuscripciones } from '@/lib/store'

/**
 * Lo que suma todo esto.
 *
 * La cifra del año va aquí, grande, y no escondida en un detalle: la gracia de
 * juntar las suscripciones en una pantalla es poder ver que nueve cobros que
 * por separado no parecen nada valen más que el arriendo de una semana. Cada
 * uno por su lado nunca alarma; sumados, sí.
 *
 * Al mes «en promedio», con las palabras puestas: la anual no cobra nada once
 * meses del año, y sin el matiz la cifra parecería un recibo que llega en
 * diciembre.
 */
export function SubscriptionsSummary({
  resumen, className,
}: {
  resumen: ResumenSuscripciones
  className?: string
}) {
  const { mensual, anual, cuantas, teDeben, podriasAhorrar, sinConvertir } = resumen

  return (
    <section
      className={cn(
        'rounded-[26px] bg-[#101014] p-5 text-white shadow-card ring-1 ring-white/[0.06]',
        className,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/45">
        Gasto en suscripciones
      </p>

      <p className="tnum mt-1 flex flex-wrap items-baseline gap-x-2 leading-none">
        <span className="text-[34px] font-black tracking-[-0.03em]">{formatMoney(Math.round(mensual))}</span>
        <span className="text-[14px] font-medium text-white/55">/ mes en promedio</span>
      </p>

      <p className="tnum mt-2 text-[13px] text-white/45">
        {formatMoney(Math.round(anual))} al año
        {cuantas > 0 && ` · ${cuantas} ${cuantas === 1 ? 'activa' : 'activas'}`}
      </p>

      {/* Las de dólares que no se pudieron convertir quedan fuera del total, y
          eso hay que decirlo: una cifra a la que le falta algo y no avisa es
          peor que no tenerla. */}
      {sinConvertir > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-accent-orange">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          {sinConvertir === 1 ? 'Una suscripción en dólares queda' : `${sinConvertir} suscripciones en dólares quedan`}
          {' '}fuera del total: falta la tasa de cambio.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.07]">
        <Dato
          rotulo="Podrías ahorrar"
          valor={`${formatMoney(Math.round(podriasAhorrar))}/mes`}
          pie="Cancelando las pruebas antes de que cobren"
          tono={podriasAhorrar > 0 ? 'verde' : 'apagado'}
        />
        <Dato
          rotulo="Te deben"
          valor={formatMoney(Math.round(teDeben))}
          pie="Al mes, de las que compartes"
          tono={teDeben > 0 ? 'claro' : 'apagado'}
        />
      </div>
    </section>
  )
}

function Dato({
  rotulo, valor, pie, tono,
}: {
  rotulo: string
  valor: string
  pie: string
  tono: 'verde' | 'claro' | 'apagado'
}) {
  return (
    <div className="bg-[#17171C] px-4 py-3">
      <p className={cn(
        'text-[10.5px] font-bold uppercase tracking-[0.08em]',
        tono === 'verde' ? 'text-accent-green' : 'text-white/45',
      )}>
        {rotulo}
      </p>
      <p className={cn(
        'tnum mt-0.5 text-[19px] font-bold tracking-[-0.02em]',
        tono === 'apagado' ? 'text-white/35' : 'text-white',
      )}>
        {valor}
      </p>
      {/* El pie es la letra pequeña que evita la pregunta: sin él, «podrías
          ahorrar» es una cifra que nadie sabe de dónde sale ni qué hacer con
          ella. */}
      <p className="mt-1 text-[10.5px] leading-snug text-white/35">{pie}</p>
    </div>
  )
}
