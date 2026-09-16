'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ChevronDown, Download, Landmark } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { aCsv, descargar } from '@/lib/datos'
import { formatMoney } from '@/lib/format'
import {
  BENEFICIOS, LIMITE_GLOBAL_PCT, LIMITE_GLOBAL_UVT, VENTANA_PLAZOS,
  cifrasDelAnio, enPesos, evaluar, uvtDe, ULTIMO_ANIO,
} from '@/lib/dian'
import { useFinance, useInvestmentsValue } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

/**
 * Declaración de renta: si toca, por qué, y con las cuentas hechas.
 *
 * Es la pantalla más fácil de convertir en una mentira útil, así que lleva dos
 * avisos grandes y ninguno es decorativo. El primero: las cifras salen de lo
 * que está registrado en la app, y la DIAN cruza lo que reportan bancos,
 * empleadores y comercios —si algo no se anotó aquí, aquí no está—. El
 * segundo: esto no calcula el impuesto, porque faltan datos que la app no
 * tiene por qué conocer, y una cifra de impuesto a medias se cree.
 *
 * Lo que sí hace bien: decir a cuánto se anda de cada tope, con los valores
 * de UVT del año que corresponde, y sacar el desglose para llevárselo.
 */
export function DianCard() {
  const { transactions, accounts, holdings, fxRate } = useFinance()
  const inv = useInvestmentsValue()

  /*
   * Por defecto, el año gravable que se declara ahora.
   *
   * La declaración que se presenta en un año es la del ANTERIOR, y confundirlo
   * mueve los topes un cinco por ciento largo —justo en el margen donde está
   * la gente que duda—. Desde agosto, que es cuando empiezan los plazos, se
   * ofrece el año pasado.
   */
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual - 1)
  const [detalle, setDetalle] = useState(false)

  const cifras = useMemo(
    () => cifrasDelAnio({ transactions, accounts, holdings, portafolio: inv.value, fxRate, anio }),
    [transactions, accounts, holdings, inv.value, fxRate, anio],
  )

  const evaluacion = useMemo(() => evaluar(cifras, anio), [cifras, anio])
  const { valor: uvt, estimada } = uvtDe(anio)

  const anios = [anioActual, anioActual - 1, anioActual - 2]

  const exportar = () => {
    haptic(10)
    const filas = evaluacion.topes
      .filter((t) => t.tope.clave !== 'iva')
      .map((t) => [
        t.tope.nombre,
        t.tope.uvts,
        t.limite,
        t.valor,
        t.supera ? 'SÍ' : 'no',
        Math.round(t.avance),
        t.margen,
      ])
    descargar(
      `topes-dian-${anio}.csv`,
      aCsv(
        ['Concepto', 'Tope en UVT', `Tope en pesos (UVT ${anio} = ${uvt})`, 'Tu cifra', '¿Supera?', '% del tope', 'Margen'],
        filas,
      ),
    )
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          evaluacion.obligado ? 'bg-accent-orange/15 text-accent-orange' : 'bg-fill-3 text-label-secondary',
        )}>
          <Landmark size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-label">
            {evaluacion.obligado ? 'Te toca declarar renta' : 'Por ahora no superas ningún tope'}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-label-secondary">
            {evaluacion.obligado
              ? `Superas ${evaluacion.superados.length} de los cinco topes del año gravable ${anio}.`
              : `Con lo registrado en la app para el año gravable ${anio}.`}
          </p>
        </div>
      </div>

      {/* El año gravable, que no es el año en que se declara. */}
      <div className="mb-3 flex gap-1.5">
        {anios.map((a) => (
          <button
            key={a}
            onClick={() => { haptic(6); setAnio(a) }}
            aria-pressed={anio === a}
            className={cn(
              'press flex-1 rounded-xl py-2 text-[13px] transition-colors',
              anio === a ? 'bg-fill-4 font-semibold text-label' : 'border border-hairline text-label-secondary',
            )}
          >
            {a}
          </button>
        ))}
      </div>

      <p className="mb-3 text-[11.5px] leading-snug text-label-tertiary">
        Año gravable {anio}, que se declara en {anio + 1}. UVT {anio}:{' '}
        <strong className="font-semibold text-label-secondary">{formatMoney(uvt)}</strong>
        {estimada && ' (estimada: la DIAN todavía no ha publicado la resolución)'}
        {!estimada && anio === ULTIMO_ANIO && ' (Resolución DIAN 000238 de 2025)'}.
      </p>

      {/* Los cinco topes, con lo cerca que se anda de cada uno. */}
      <div className="space-y-2.5 border-t border-hairline pt-3">
        {evaluacion.topes.filter((t) => t.tope.clave !== 'iva').map((t) => (
          <div key={t.tope.clave}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[13.5px] text-label">{t.tope.nombre}</span>
              <span className={cn(
                'tnum shrink-0 text-[12.5px] font-medium',
                t.supera ? 'text-accent-orange' : 'text-label-secondary',
              )}>
                {formatMoney(t.valor)}
              </span>
            </div>
            <div className="mb-1 h-1.5 w-full overflow-hidden rounded-pill bg-fill-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, t.avance)}%` }}
                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                className={cn('h-full rounded-pill', t.supera ? 'bg-accent-orange' : 'bg-accent-blue')}
              />
            </div>
            <p className="text-[11.5px] text-label-tertiary">
              {t.supera
                ? `Superado: el tope son ${t.tope.uvts} UVT (${formatMoney(t.limite)}).`
                : `${Math.round(t.avance)} % del tope de ${t.tope.uvts} UVT · te faltan ${formatMoney(t.margen)}.`}
            </p>
          </div>
        ))}
      </div>

      {cifras.patrimonioEsHoy && (
        <p className="mt-3 flex gap-2 rounded-xl bg-fill-1 p-2.5 text-[11.5px] leading-snug text-label-tertiary">
          <AlertTriangle size={13} className="mt-px shrink-0 text-accent-orange" />
          El patrimonio se mide al 31 de diciembre. Como el año todavía no ha
          terminado, aquí sale el de hoy.
        </p>
      )}

      <button
        onClick={() => { haptic(6); setDetalle((v) => !v) }}
        className="press mt-3 flex w-full items-center justify-between border-t border-hairline pt-3 text-left"
      >
        <span className="text-[13px] text-accent-blue">
          {detalle ? 'Ocultar el detalle' : 'Qué se puede restar y cuándo se declara'}
        </span>
        <ChevronDown size={15} className={cn('text-label-tertiary transition-transform', detalle && 'rotate-180')} />
      </button>

      {detalle && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
          <div className="mt-3 space-y-2.5">
            <p className="text-[12.5px] leading-snug text-label-secondary">
              Los beneficios de la cédula general, con su tope anual en pesos de {anio}.
              El conjunto no puede pasar del {LIMITE_GLOBAL_PCT} % de los ingresos netos
              ni de {LIMITE_GLOBAL_UVT} UVT ({formatMoney(enPesos(LIMITE_GLOBAL_UVT, anio))}),
              salvo los dos marcados.
            </p>

            {BENEFICIOS.map((b) => (
              <div key={b.clave} className="rounded-xl bg-fill-1 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 text-[13px] font-medium text-label">{b.nombre}</span>
                  <span className="tnum shrink-0 text-[12.5px] text-label-secondary">
                    {formatMoney(enPesos(b.uvts, anio))}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-label-tertiary">
                  {b.explicacion} · {b.norma}
                  {b.fueraDelLimite && ' · fuera del límite global'}
                </p>
              </div>
            ))}

            <div className="rounded-xl bg-fill-1 p-2.5">
              <p className="text-[13px] font-medium text-label">Cuándo se declara</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-label-tertiary">
                {VENTANA_PLAZOS} La fecha exacta la fija el decreto de plazos de cada
                año; los 01-02 abren y los 99-00 cierran.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <button
        onClick={exportar}
        className="press mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-hairline
                   py-2.5 text-[14px] font-medium text-accent-blue"
      >
        <Download size={14} /> Descargar el desglose
      </button>

      <p className="mt-3 text-[11.5px] leading-relaxed text-label-tertiary">
        Estas cifras salen de lo que está registrado aquí. La DIAN cruza lo que
        reportan bancos, empleadores y comercios, así que lo que no se anotó en la app
        no aparece en esta cuenta. Sirve para saber si andas cerca de un tope y para
        llegar con el desglose hecho, no para sustituir tus certificados ni el
        cálculo del impuesto, que depende de datos que la app no conoce.
      </p>
    </Card>
  )
}
