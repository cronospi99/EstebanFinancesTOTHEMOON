'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, CalendarRange, Check, Pencil, Scissors, X } from 'lucide-react'
import { diasEntre, fechaCobro } from '@/lib/suscripciones'
import { cicloDe, corteDeInicio, deudaDe, deudaPorCiclo, inicioDeCorte } from '@/lib/tarjetas'
import { formatMoney } from '@/lib/format'
import { useFinance } from '@/lib/store'
import type { Account } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

/**
 * Las tres fechas de una tarjeta de crédito, tal como las imprime el extracto.
 *
 * Los campos piden un día del mes y no una fecha, porque el ciclo se repite:
 * una fecha concreta caduca al mes siguiente y obligaría a volver a escribirla.
 *
 * Aquí había un conmutador para escribir «el corte» o «cuándo empieza», porque
 * se daba por hecho que eran el mismo dato corrido un día. En casi todas las
 * tarjetas lo son, pero no en todas: hay extractos que dicen «inicio del
 * período 4 de septiembre, fecha de corte 5 de octubre, fecha de pago 15 de
 * octubre», donde el corte es el día en que emiten el papel y no el fin del
 * período. Deducir uno del otro ahí se equivoca en dos días, y esos dos días
 * son un mes de diferencia en cuándo vence lo que se compró en ellos.
 *
 * Así que ahora son tres campos y no hay nada que restar mentalmente: se
 * copian del extracto. Escribir uno rellena el otro con lo más probable —el
 * período empieza justo después del corte— y quien tenga las dos fechas
 * separadas solo tiene que corregirlo.
 *
 * Debajo se enseña siempre lo que sale de los números. Es lo que convierte
 * tres casillas en algo comprobable contra el extracto que uno tiene delante.
 */
export function CicloEditor({
  statementDay, periodStartDay, dueDay, onChange,
}: {
  statementDay: string
  periodStartDay: string
  dueDay: string
  onChange: (campo: 'corte' | 'inicio' | 'pago', valor: string) => void
}) {
  const previa = useMemo(() => {
    const corte = Number(statementDay)
    const pago = Number(dueDay)
    if (!corte || !pago) return null
    return cicloDe({
      type: 'credit',
      statementDay: corte,
      dueDay: pago,
      periodStartDay: Number(periodStartDay) || undefined,
    })
  }, [statementDay, periodStartDay, dueDay])

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        <DiaDelMes
          etiqueta="Empieza"
          icono={<CalendarRange size={12} />}
          valor={periodStartDay}
          onChange={(v) => {
            onChange('inicio', v)
            // Si aún no hay corte, el más probable es la víspera. Se rellena
            // en vez de dejarlo vacío porque es cierto en casi todas las
            // tarjetas, y corregirlo es cambiar un número.
            if (v && !statementDay) onChange('corte', String(corteDeInicio(Number(v))))
          }}
        />
        <DiaDelMes
          etiqueta="Corta"
          icono={<Scissors size={12} />}
          valor={statementDay}
          onChange={(v) => {
            onChange('corte', v)
            if (v && !periodStartDay) onChange('inicio', String(inicioDeCorte(Number(v))))
          }}
        />
        <DiaDelMes
          etiqueta="Se paga"
          icono={<CalendarClock size={12} />}
          valor={dueDay}
          onChange={(v) => onChange('pago', v)}
        />
      </div>

      {previa ? (
        <div className="mt-2 rounded-xl border border-hairline bg-fill-1 p-3">
          <p className="text-[12.5px] leading-relaxed text-label-secondary">
            Lo que compres hoy entra en el período que va del{' '}
            <strong className="font-semibold text-label">{fechaCobro(previa.inicioEnCurso)}</strong> al{' '}
            <strong className="font-semibold text-label">{fechaCobro(previa.finEnCurso)}</strong>
            {previa.retardoEmision > 0 && (
              <>, cuyo extracto sale el{' '}
                <strong className="font-semibold text-label">{fechaCobro(previa.corteDeHoy)}</strong>
              </>
            )}
            . El extracto anterior se paga el{' '}
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
          Están las tres en el extracto, con estos mismos nombres. En la mayoría de las
          tarjetas el período empieza justo después del corte y basta con escribir dos;
          si el tuyo imprime un inicio que no cuadra con eso, cópialo tal cual.
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
      <span className="mb-1 flex items-center gap-1 px-0.5 text-[11px] font-medium uppercase tracking-wide text-label-tertiary">
        {icono}{etiqueta}
      </span>
      <div className="flex items-baseline gap-1 rounded-xl border border-hairline bg-fill-2 px-2.5 py-2.5">
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
          className="tnum w-full min-w-0 bg-transparent text-[19px] font-semibold text-label
                     placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
        />
        <span className="shrink-0 text-[11px] text-label-tertiary">del mes</span>
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
  const { updateAccount, transactions } = useFinance()
  const [editando, setEditando] = useState(false)
  const [corte, setCorte] = useState(account.statementDay ? String(account.statementDay) : '')
  const [inicio, setInicio] = useState(account.periodStartDay ? String(account.periodStartDay) : '')
  const [pago, setPago] = useState(account.dueDay ? String(account.dueDay) : '')

  const ciclo = cicloDe(account)
  const deuda = deudaDe(account)
  // Qué parte del saldo está facturada y qué parte es de este ciclo. Ver
  // `deudaPorCiclo`: sin esto, lo recién comprado se presentaba como vencido.
  const reparto = deudaPorCiclo(account, transactions)
  // Cuándo se pagará lo de este ciclo: es el límite de una compra de hoy, que
  // cae en el mismo período.
  const limitePróximo = ciclo?.limiteDeHoy ?? ''

  const restablecer = () => {
    setCorte(account.statementDay ? String(account.statementDay) : '')
    setInicio(account.periodStartDay ? String(account.periodStartDay) : '')
    setPago(account.dueDay ? String(account.dueDay) : '')
  }

  const guardar = () => {
    haptic([14, 30])
    const nCorte = corte ? Number(corte) : undefined
    const nInicio = inicio ? Number(inicio) : undefined
    updateAccount(account.id, {
      statementDay: nCorte,
      dueDay: pago ? Number(pago) : undefined,
      // Si el inicio es el que se deduciría del corte, no se guarda: un dato
      // redundante guardado es un dato que alguien edita por un lado y deja la
      // tarjeta diciendo dos cosas del mismo ciclo.
      periodStartDay: nInicio && nCorte && nInicio === inicioDeCorte(nCorte) ? undefined : nInicio,
    })
    setEditando(false)
  }

  if (editando) {
    return (
      <div className="mb-5 rounded-2xl border border-hairline bg-fill-1 p-4">
        <CicloEditor
          statementDay={corte}
          periodStartDay={inicio}
          dueDay={pago}
          onChange={(campo, v) => {
            if (campo === 'corte') setCorte(v)
            else if (campo === 'inicio') setInicio(v)
            else setPago(v)
          }}
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => { setEditando(false); restablecer() }}
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
  // Lo andado del período sobre lo que dura de verdad. Antes se dividía entre
  // 30 fijos, y en un período de 32 días la barra llegaba al final dos días
  // antes de que el período terminara.
  const largo = Math.max(1, diasEntre(ciclo.inicioEnCurso, ciclo.finEnCurso))
  const avance = Math.min(1, Math.max(0, (largo - ciclo.faltanCorte) / largo))

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
          etiqueta={ciclo.retardoEmision > 0 ? 'Cierra' : 'Corta'}
          valor={fechaCobro(ciclo.finEnCurso)}
          nota={ciclo.faltanCorte === 0 ? 'hoy' : `en ${ciclo.faltanCorte} ${ciclo.faltanCorte === 1 ? 'día' : 'días'}`}
        />
        <Casilla
          etiqueta="Se paga"
          valor={reparto.facturado > 0 ? fechaCobro(ciclo.limiteEnCurso) : fechaCobro(limitePróximo)}
          nota={
            reparto.facturado <= 0 ? 'nada facturado'
              : ciclo.faltanLimite < 0 ? `hace ${Math.abs(ciclo.faltanLimite)} días`
              : ciclo.faltanLimite === 0 ? 'hoy'
              : `en ${ciclo.faltanLimite} ${ciclo.faltanLimite === 1 ? 'día' : 'días'}`
          }
          alerta={urgente || (reparto.facturado > 0 && ciclo.faltanLimite < 0)}
        />
      </div>

      {/* La posición dentro del ciclo, en una barra. Donde está el marcador
          se lee de un vistazo si conviene comprar ahora o esperar. */}
      <div className="relative mb-1.5 h-2 overflow-hidden rounded-pill bg-fill-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(avance * 100)}%` }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="h-full rounded-pill bg-accent-blue/70"
        />
      </div>
      {/* Los dos extremos de la barra, con fecha. Sin esto la barra dice que
          el ciclo va por la mitad, pero no de qué mitad de qué. */}
      <div className="mb-1.5 flex items-baseline justify-between text-[11px] text-label-tertiary">
        <span>Empezó el {fechaCobro(ciclo.inicioEnCurso)}</span>
        <span>
          {ciclo.faltanCorte === 0 ? 'Cierra hoy' : `Cierra el ${fechaCobro(ciclo.finEnCurso)}`}
        </span>
      </div>
      {/* El retardo de emisión solo se menciona cuando existe. En una tarjeta
          normal, el período cierra y el extracto sale el mismo día, y decirlo
          sería ruido. */}
      {ciclo.retardoEmision > 0 && (
        <p className="mb-1.5 text-[11px] text-label-tertiary">
          El extracto de este período sale el {fechaCobro(ciclo.corteDeHoy)}.
        </p>
      )}
      <p className="text-[12px] leading-snug text-label-secondary">
        Una compra hecha hoy se paga el {fechaCobro(ciclo.limiteDeHoy)}:{' '}
        <strong className={cn('font-semibold', ciclo.diasDeFinanciacion >= 35 ? 'text-accent-green' : 'text-label')}>
          {ciclo.diasDeFinanciacion} días sin intereses
        </strong>.
      </p>

      {/*
        Las dos mitades de la deuda, separadas.

        Una sola cifra de «pendiente» era el problema: mezclaba lo que hay que
        pagar en diez días con lo que se acaba de comprar y no vence hasta el
        mes siguiente. Quien cortó en cero veía su gasto del ciclo nuevo
        presentado como una deuda vencida.
      */}
      {deuda > 0 && (
        <div className="mt-2 space-y-1 border-t border-hairline pt-2 text-[12px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-label-secondary">
              Facturado, se paga el {fechaCobro(ciclo.limiteEnCurso)}
            </span>
            <span className={cn('tnum shrink-0 font-semibold', reparto.facturado > 0 ? 'text-label' : 'text-label-tertiary')}>
              {formatMoney(reparto.facturado, account.currency)}
            </span>
          </div>
          {reparto.enCurso > 0 && (
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label-tertiary">
                De este ciclo, se paga el {fechaCobro(limitePróximo)}
              </span>
              <span className="tnum shrink-0 text-label-secondary">
                {formatMoney(reparto.enCurso, account.currency)}
              </span>
            </div>
          )}
          <p className="pt-0.5 text-[11.5px] leading-relaxed text-label-tertiary">
            {reparto.facturado > 0
              ? 'Pagar el total del extracto evita intereses; el mínimo, no.'
              : 'El extracto que venció no tiene saldo: lo que debes es de este ciclo y todavía no lo han facturado.'}
          </p>
        </div>
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
