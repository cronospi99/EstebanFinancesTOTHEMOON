'use client'

import { useState } from 'react'
import { Check, Plus, Trash2, TrendingUp, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AccountPicker } from '@/components/ui/account-picker'
import { formatKeypad, formatMoney, parseKeypad } from '@/lib/format'
import { fechaCobro } from '@/lib/suscripciones'
import { ocurrencias } from '@/lib/liquidez'
import { useFinance } from '@/lib/store'
import type { IncomeCycle } from '@/lib/types'
import { hoyEnZona, sumarDias } from '@/lib/zona'
import { cn, haptic } from '@/lib/utils'

const CICLOS: { valor: IncomeCycle; etiqueta: string }[] = [
  { valor: 'quincenal', etiqueta: 'Quincenal' },
  { valor: 'mensual', etiqueta: 'Mensual' },
  { valor: 'semanal', etiqueta: 'Semanal' },
  { valor: 'trimestral', etiqueta: 'Trimestral' },
  { valor: 'semestral', etiqueta: 'Semestral' },
  { valor: 'anual', etiqueta: 'Anual' },
]

/**
 * El sueldo, el arriendo que cobras, el cliente fijo.
 *
 * Existe por la proyección de liquidez. Sin saber qué entra, un saldo
 * proyectado a noventa días solo puede bajar, y una app que le dice a
 * cualquiera que en tres meses estará en cero no sirve para decidir nada.
 *
 * No genera movimientos por su cuenta, a diferencia de las suscripciones, y
 * eso está dicho en la propia tarjeta. Los dos errores no son simétricos: un
 * cobro que la app dio por hecho y no ocurrió se arregla con un toque, pero un
 * sueldo dado por recibido que no llegó deja el saldo mintiendo hacia arriba.
 */
export function IngresosRecurrentesCard() {
  const { recurringIncomes, accounts, addIngreso, updateIngreso, deleteIngreso } = useFinance()
  const [creando, setCreando] = useState(false)

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green">
          <TrendingUp size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-label">Ingresos recurrentes</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-label-secondary">
            Lo que entra todos los meses. Es lo que hace que la proyección de liquidez
            sepa cuándo vuelve a subir el saldo.
          </p>
        </div>
      </div>

      {recurringIncomes.length > 0 && (
        <div className="mb-3 space-y-1 border-t border-hairline pt-3">
          {recurringIncomes.map((i) => {
            const proxima = ocurrencias(i.anchorAt, i.cycle, sumarDias(hoyEnZona(), 1), sumarDias(hoyEnZona(), 400))[0]
            const cuenta = accounts.find((a) => a.id === i.accountId)
            return (
              <div key={i.id} className={cn('flex items-center gap-2.5 py-1.5', i.active === false && 'opacity-45')}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] text-label">{i.name}</p>
                  <p className="truncate text-[11.5px] text-label-tertiary">
                    {CICLOS.find((c) => c.valor === i.cycle)?.etiqueta}
                    {cuenta && ` · ${cuenta.name}`}
                    {i.active !== false && proxima && ` · próximo el ${fechaCobro(proxima)}`}
                    {i.active === false && ' · apagado'}
                  </p>
                </div>
                <span className="tnum shrink-0 text-[14px] font-semibold text-accent-green">
                  {formatMoney(i.amount, i.currency)}
                </span>
                <button
                  onClick={() => { haptic(6); updateIngreso(i.id, { active: i.active === false }) }}
                  aria-label={i.active === false ? 'Reactivar' : 'Apagar'}
                  className="press shrink-0 rounded-lg px-2 py-1 text-[11.5px] text-label-tertiary"
                >
                  {i.active === false ? 'Activar' : 'Apagar'}
                </button>
                <button
                  onClick={() => { haptic([14, 30]); deleteIngreso(i.id) }}
                  aria-label={`Borrar ${i.name}`}
                  className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent-red"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {creando ? (
        <Formulario
          onCancelar={() => setCreando(false)}
          onGuardar={(datos) => { void addIngreso(datos); setCreando(false) }}
        />
      ) : (
        <button
          onClick={() => { haptic(6); setCreando(true) }}
          className="press flex w-full items-center justify-center gap-2 rounded-xl border border-hairline
                     py-2.5 text-[14px] font-medium text-accent-blue"
        >
          <Plus size={15} /> Añadir un ingreso
        </button>
      )}

      <p className="mt-3 text-[11.5px] leading-relaxed text-label-tertiary">
        No se anotan solos como movimientos, a diferencia de las suscripciones. Un
        cobro que no llegó se corrige con un toque; un sueldo que la app da por
        recibido y no llegó deja el saldo mintiendo hacia arriba, que es el lado caro
        de equivocarse.
      </p>
    </Card>
  )
}

function Formulario({
  onGuardar, onCancelar,
}: {
  onGuardar: (datos: Parameters<ReturnType<typeof useFinance>['addIngreso']>[0]) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [ciclo, setCiclo] = useState<IncomeCycle>('quincenal')
  const [cuenta, setCuenta] = useState('')
  const [dia, setDia] = useState(hoyEnZona)

  const valido = nombre.trim().length > 0 && parseKeypad(monto) > 0

  return (
    <div className="rounded-2xl border border-hairline bg-fill-1 p-3">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Salario, arriendo, cliente…"
        autoFocus
        className="mb-2 w-full rounded-xl border border-hairline bg-fill-2 px-3 py-2.5 text-[15px]
                   text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
      />

      <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-hairline bg-fill-2 px-3 py-2.5">
        <span className="text-[16px] text-label-secondary">$</span>
        <input
          value={monto ? formatKeypad(monto) : ''}
          inputMode="numeric"
          onChange={(e) => setMonto(e.target.value.replace(/[^\d,]/g, ''))}
          placeholder="2.400.000"
          className="tnum w-full bg-transparent text-[18px] font-semibold text-label
                     placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
        />
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {CICLOS.map((c) => (
          <button
            key={c.valor}
            onClick={() => { haptic(6); setCiclo(c.valor) }}
            aria-pressed={ciclo === c.valor}
            className={cn(
              'press rounded-pill px-2.5 py-1 text-[12.5px] transition-colors',
              ciclo === c.valor ? 'bg-fill-4 font-medium text-label' : 'border border-hairline text-label-secondary',
            )}
          >
            {c.etiqueta}
          </button>
        ))}
      </div>

      <label className="mb-2 flex items-center gap-2.5 rounded-xl border border-hairline bg-fill-2 px-3 py-2.5">
        <span className="flex-1 text-[14px] text-label-secondary">
          {ciclo === 'quincenal' ? 'Un día de pago (el otro sale a 15 días)' : 'Un día en que entra'}
        </span>
        <input
          type="date"
          value={dia}
          onChange={(e) => setDia(e.target.value || hoyEnZona())}
          className="bg-transparent text-[14px] text-label focus:outline-none"
        />
      </label>

      <div className="mb-3">
        <AccountPicker accountId={cuenta} onChange={(id) => setCuenta(id)} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancelar}
          className="press flex-1 rounded-xl border border-hairline py-2.5 text-label-secondary"
        >
          <X size={15} className="mx-auto" />
        </button>
        <button
          onClick={() => {
            if (!valido) return
            haptic([14, 30])
            onGuardar({
              name: nombre.trim(),
              amount: parseKeypad(monto),
              currency: 'COP',
              cycle: ciclo,
              anchorAt: dia,
              accountId: cuenta || undefined,
              active: true,
              color: '#30D158',
            })
          }}
          disabled={!valido}
          className="press flex-[2] rounded-xl bg-accent-green py-2.5 font-semibold text-black disabled:opacity-40"
        >
          <Check size={17} className="mx-auto" />
        </button>
      </div>
    </div>
  )
}
