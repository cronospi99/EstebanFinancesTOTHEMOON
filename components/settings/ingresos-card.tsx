'use client'

import { useState } from 'react'
import { BadgeCheck, Check, Plus, Trash2, TrendingUp, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AccountPicker } from '@/components/ui/account-picker'
import { formatKeypad, formatMoney, parseKeypad } from '@/lib/format'
import { fechaCobro } from '@/lib/suscripciones'
import { resumirNomina } from '@/lib/nomina'
import { NominaForm, type DatosNomina } from './nomina-form'
import { ocurrencias } from '@/lib/liquidez'
import { useFinance } from '@/lib/store'
import type { IncomeCycle, RecurringIncome, Transaction } from '@/lib/types'
import { hoyEnZona, instanteEnDia, sumarDias } from '@/lib/zona'
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
  const { recurringIncomes, accounts, transactions, addIngreso, addTransaction, updateIngreso, deleteIngreso } = useFinance()
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
                {i.active !== false && (
                  <BotonYaMePagaron ingreso={i} transactions={transactions} onRegistrar={addTransaction} />
                )}
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
  /*
   * Modo nómina: en vez de teclear lo que llega, se teclea el sueldo pactado y
   * la app deriva lo que llega. Son dos cifras distintas y pedir solo una
   * obligaba a elegir cuál mentira preferías: con el bruto la proyección iba
   * inflada un 8 %, y con el neto no se podía estimar la prima.
   */
  const [esNomina, setEsNomina] = useState(false)
  const [nomina, setNomina] = useState<DatosNomina>({})

  // Lo que de verdad va a `amount`: en nómina es el resultado del cálculo.
  const resumen = esNomina && nomina.salarioBase
    ? resumirNomina({
        base: nomina.salarioBase, auxilio: nomina.auxilioTransporte,
        cotiza: nomina.cotiza, turnos: nomina.turnos,
      }, hoyEnZona())
    : null
  const importe = resumen ? resumen.mensual : parseKeypad(monto)

  const valido = nombre.trim().length > 0 && importe > 0

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

      <div className="mb-2 flex gap-1.5">
        {([false, true] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => { haptic(6); setEsNomina(v) }}
            aria-pressed={esNomina === v}
            className={cn(
              'press flex-1 rounded-pill px-2.5 py-1 text-[12.5px] transition-colors',
              esNomina === v ? 'bg-fill-4 font-medium text-label' : 'border border-hairline text-label-secondary',
            )}
          >
            {v ? 'Es un sueldo' : 'Importe fijo'}
          </button>
        ))}
      </div>

      {esNomina ? (
        <div className="mb-2">
          <NominaForm datos={nomina} onChange={setNomina} />
        </div>
      ) : (
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
      )}

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
              // En nómina, `amount` es lo que llega: el cálculo manda. Lo
              // pactado se guarda aparte, en `salarioBase`.
              amount: importe,
              currency: 'COP',
              cycle: ciclo,
              anchorAt: dia,
              accountId: cuenta || undefined,
              active: true,
              color: '#30D158',
              ...(esNomina ? {
                salarioBase: nomina.salarioBase,
                auxilioTransporte: nomina.auxilioTransporte,
                cotiza: nomina.cotiza,
                turnos: nomina.turnos,
              } : {}),
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

/**
 * «Ya me pagaron»: anota el ingreso con la fecha de hoy.
 *
 * Un ingreso recurrente NO se anota solo, y esa decisión sigue siendo la
 * correcta: un sueldo dado por recibido que no llegó deja el saldo mintiendo
 * hacia arriba. Pero el otro extremo tampoco servía: quien cobraba tenía que
 * ir a la captura rápida, elegir categoría, importe y cuenta, y teclear a mano
 * lo que la app ya sabía. Con un toque se anota, y desde ahí cuenta para el
 * saldo, para el reparto 50/30/20 y para el puntaje de salud.
 *
 * El doble toque es el error que hay que impedir: anotar dos veces la quincena
 * infla el mes entero. Si ya hay un ingreso del mismo importe en la misma
 * cuenta en los últimos días, el botón lo dice en vez de volver a anotarlo.
 */
function BotonYaMePagaron({
  ingreso, transactions, onRegistrar,
}: {
  ingreso: RecurringIncome
  transactions: Transaction[]
  onRegistrar: (t: Omit<Transaction, 'id'>) => void
}) {
  const hoy = hoyEnZona()
  // Cuánto atrás se mira para no repetir: la mitad del ciclo, acotada. En un
  // sueldo quincenal, mirar treinta días atrás bloquearía la segunda quincena.
  const ventana = { semanal: 3, quincenal: 6, mensual: 12 }[ingreso.cycle as string] ?? 20
  const desde = sumarDias(hoy, -ventana)

  const yaEsta = transactions.some((t) =>
    t.type === 'income'
    && t.occurredAt.slice(0, 10) >= desde
    && Math.abs(t.amount - ingreso.amount) < 1
    && (!ingreso.accountId || t.accountId === ingreso.accountId))

  if (yaEsta) {
    return (
      <span className="flex shrink-0 items-center gap-1 px-2 text-[11.5px] text-accent-green">
        <BadgeCheck size={13} /> Anotado
      </span>
    )
  }

  const cuenta = ingreso.accountId ?? ''
  if (!cuenta) {
    return (
      <span className="shrink-0 px-2 text-[11px] text-label-tertiary" title="Elige una cuenta para poder anotarlo">
        sin cuenta
      </span>
    )
  }

  return (
    <button
      onClick={() => {
        haptic([14, 30])
        onRegistrar({
          accountId: cuenta,
          // El sueldo es salario; lo demás, un ingreso sin más. La categoría
          // decide si cuenta como fijo en el desglose de `lib/ingresos.ts`.
          categoryId: ingreso.salarioBase ? 'salary' : 'other-income',
          amount: ingreso.amount,
          type: 'income',
          description: ingreso.name,
          occurredAt: instanteEnDia(hoy),
          currency: ingreso.currency,
        })
      }}
      className="press shrink-0 rounded-lg px-2 py-1 text-[11.5px] font-medium text-accent-blue"
    >
      Ya me pagaron
    </button>
  )
}
