'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, Check, Pencil, Scissors, X } from 'lucide-react'
import { fechaCobro } from '@/lib/suscripciones'
import { cicloDe, deudaDe } from '@/lib/tarjetas'
import { formatMoney } from '@/lib/format'
import { useFinance } from '@/lib/store'
import type { Account } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

/**
 * Las dos fechas de una tarjeta de crédito: cuándo corta y cuándo se paga.
 *
 * El campo pide un día del mes y no una fecha, porque el ciclo se repite: una
 * fecha concreta caduca al mes siguiente y obligaría a volver a escribirla.
 *
 * Debajo se enseña siempre lo que sale de los dos números —el próximo corte,
 * el próximo pago y cuántos días de financiación da una compra de hoy—. Es lo
 * que convierte dos casillas de formulario en algo comprobable: si alguien se
 * equivoca y escribe el pago antes del corte, la vista previa lo enseña en el
 * momento en vez de esperar a que llegue un aviso equivocado dentro de un mes.
 */
export function CicloEditor({
  statementDay, dueDay, onChange,
}: {
  statementDay: string
  dueDay: string
  onChange: (campo: 'corte' | 'pago', valor: string) => void
}) {
  const previa = useMemo(() => {
    const corte = Number(statementDay)
    const pago = Number(dueDay)
    if (!corte || !pago) return null
    return cicloDe({ type: 'credit', statementDay: corte, dueDay: pago })
  }, [statementDay, dueDay])

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <DiaDelMes
          etiqueta="Día de corte"
          icono={<Scissors size={13} />}
          valor={statementDay}
          onChange={(v) => onChange('corte', v)}
        />
        <DiaDelMes
          etiqueta="Día límite de pago"
          icono={<CalendarClock size={13} />}
          valor={dueDay}
          onChange={(v) => onChange('pago', v)}
        />
      </div>

      {previa ? (
        <div className="mt-2 rounded-xl border border-hairline bg-fill-1 p-3">
          <p className="text-[12.5px] leading-relaxed text-label-secondary">
            Corta el <strong className="font-semibold text-label">{fechaCobro(previa.corteProximo)}</strong> y
            ese extracto se paga el{' '}
            <strong className="font-semibold text-label">{fechaCobro(previa.limiteEnCurso)}</strong>.
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-label-secondary">
            Una compra hecha hoy se paga hasta el {fechaCobro(previa.limiteDeHoy)}:{' '}
            <strong className="font-semibold text-accent-green">
              {previa.diasDeFinanciacion} días sin intereses
            </strong>.
          </p>
        </div>
      ) : (
        <p className="mt-1.5 px-1 text-[12px] leading-snug text-label-tertiary">
          Están en el extracto. El corte es cuando cierra el período y el límite es
          cuando hay que pagarlo, entre quince y veinte días después. Con las dos, la
          app avisa a tiempo y sabe con cuál conviene pagar.
        </p>
      )}
    </div>
  )
}

function DiaDelMes({
  etiqueta, icono, valor, onChange,
}: {
  etiqueta: string
  icono: React.ReactNode
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
        {icono}{etiqueta}
      </span>
      <div className="flex items-center gap-1.5 rounded-xl border border-hairline bg-fill-2 px-3 py-3">
        <input
          value={valor}
          inputMode="numeric"
          placeholder="—"
          onChange={(e) => {
            // Solo 1-31. Se recorta al escribir en vez de avisar después: un
            // 45 no es un día del mes y no hay nada que explicar.
            const n = e.target.value.replace(/\D/g, '').slice(0, 2)
            onChange(n === '' ? '' : String(Math.min(31, Math.max(1, Number(n)))))
          }}
          className="tnum w-full bg-transparent text-[20px] font-semibold text-label
                     placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
        />
        <span className="shrink-0 text-[13px] text-label-tertiary">del mes</span>
      </div>
    </label>
  )
}

/**
 * El ciclo dentro del detalle de una cuenta: se ve, y se edita ahí mismo.
 *
 * Con las fechas puestas enseña el estado —cuánto falta para el corte, cuánto
 * para el pago— y sin ellas invita a ponerlas, explicando para qué sirven. Una
 * tarjeta sin fechas no es un error, es una tarjeta a la que le falta el dato
 * que hace que el resto de la app pueda ayudar.
 */
export function CicloBloque({ account }: { account: Account }) {
  const { updateAccount } = useFinance()
  const [editando, setEditando] = useState(false)
  const [corte, setCorte] = useState(account.statementDay ? String(account.statementDay) : '')
  const [pago, setPago] = useState(account.dueDay ? String(account.dueDay) : '')

  const ciclo = cicloDe(account)
  const deuda = deudaDe(account)

  const guardar = () => {
    haptic([14, 30])
    updateAccount(account.id, {
      statementDay: corte ? Number(corte) : undefined,
      dueDay: pago ? Number(pago) : undefined,
    })
    setEditando(false)
  }

  if (editando) {
    return (
      <div className="mb-5 rounded-2xl border border-hairline bg-fill-1 p-4">
        <CicloEditor
          statementDay={corte}
          dueDay={pago}
          onChange={(campo, v) => (campo === 'corte' ? setCorte(v) : setPago(v))}
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => { setEditando(false); setCorte(account.statementDay ? String(account.statementDay) : ''); setPago(account.dueDay ? String(account.dueDay) : '') }}
            className="press flex-1 rounded-xl border border-hairline py-2.5 text-[14px] text-label-secondary"
          >
            <X size={14} className="mx-auto" />
          </button>
          <button
            onClick={guardar}
            className="press flex-[2] rounded-xl bg-accent-blue py-2.5 text-[14px] font-semibold text-white"
          >
            <Check size={16} className="mx-auto" />
          </button>
        </div>
      </div>
    )
  }

  if (!ciclo) {
    return (
      <button
        onClick={() => { haptic(6); setEditando(true) }}
        className="press mb-5 flex w-full items-start gap-3 rounded-2xl border border-dashed border-hairline
                   bg-fill-1 p-4 text-left"
      >
        <div className="mt-0.5 shrink-0 text-label-tertiary"><CalendarClock size={17} /></div>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-label">Añade el corte y la fecha de pago</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-label-secondary">
            Con las dos fechas, la app avisa antes de que venza y sabe si esta tarjeta
            es la que más días sin intereses te da hoy.
          </p>
        </div>
      </button>
    )
  }

  const urgente = deuda > 0 && ciclo.faltanLimite <= 3

  return (
    <div className="mb-5 rounded-2xl border border-hairline bg-fill-1 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-label">Ciclo de facturación</p>
        <button
          onClick={() => { haptic(6); setEditando(true) }}
          aria-label="Cambiar las fechas"
          className="press flex items-center gap-1 text-[12px] text-accent-blue"
        >
          <Pencil size={11} /> Cambiar
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Casilla
          etiqueta="Corta"
          valor={fechaCobro(ciclo.corteProximo)}
          nota={ciclo.faltanCorte === 0 ? 'hoy' : `en ${ciclo.faltanCorte} ${ciclo.faltanCorte === 1 ? 'día' : 'días'}`}
        />
        <Casilla
          etiqueta="Se paga"
          valor={fechaCobro(ciclo.limiteEnCurso)}
          nota={
            deuda <= 0 ? 'sin saldo'
              : ciclo.faltanLimite < 0 ? `hace ${Math.abs(ciclo.faltanLimite)} días`
              : ciclo.faltanLimite === 0 ? 'hoy'
              : `en ${ciclo.faltanLimite} ${ciclo.faltanLimite === 1 ? 'día' : 'días'}`
          }
          alerta={urgente || ciclo.faltanLimite < 0}
        />
      </div>

      {/* La posición dentro del ciclo, en una barra. Donde está el marcador
          se lee de un vistazo si conviene comprar ahora o esperar. */}
      <div className="relative mb-1.5 h-2 overflow-hidden rounded-pill bg-fill-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, (1 - ciclo.faltanCorte / 30) * 100))}%` }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="h-full rounded-pill bg-accent-blue/70"
        />
      </div>
      <p className="text-[12px] leading-snug text-label-secondary">
        Una compra hecha hoy se paga el {fechaCobro(ciclo.limiteDeHoy)}:{' '}
        <strong className={cn('font-semibold', ciclo.diasDeFinanciacion >= 35 ? 'text-accent-green' : 'text-label')}>
          {ciclo.diasDeFinanciacion} días sin intereses
        </strong>.
      </p>

      {deuda > 0 && (
        <p className="mt-2 border-t border-hairline pt-2 text-[12px] text-label-tertiary">
          Pendiente del extracto: {formatMoney(deuda, account.currency)}. Pagar el total
          evita intereses; el mínimo, no.
        </p>
      )}
    </div>
  )
}

function Casilla({
  etiqueta, valor, nota, alerta,
}: {
  etiqueta: string
  valor: string
  nota: string
  alerta?: boolean
}) {
  return (
    <div className="rounded-xl bg-fill-2 p-2.5">
      <p className="text-[11.5px] text-label-tertiary">{etiqueta}</p>
      <p className="text-[15px] font-semibold text-label">{valor}</p>
      <p className={cn('text-[11.5px]', alerta ? 'text-accent-red' : 'text-label-secondary')}>{nota}</p>
    </div>
  )
}
