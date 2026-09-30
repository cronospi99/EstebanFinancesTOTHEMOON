'use client'

import { useMemo, useState } from 'react'
import { BadgeCheck, Check, Link2, Pencil, Plus, Trash2, TrendingUp, Unlink, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AccountPicker } from '@/components/ui/account-picker'
import { MoneyInput } from '@/components/ui/money-input'
import { formatKeypad, formatMoney, parseKeypad } from '@/lib/format'
import { fechaCobro } from '@/lib/suscripciones'
import { resumirNomina } from '@/lib/nomina'
import { NominaForm, type DatosNomina } from './nomina-form'
import { ocurrencias } from '@/lib/liquidez'
import { useFinance } from '@/lib/store'
import type { IncomeCycle, RecurringIncome, Transaction } from '@/lib/types'
import { diaEn, hoyEnZona, instanteEnDia, sumarDias } from '@/lib/zona'
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
 * Cuánto atrás cuenta un pago como «el de este ciclo»: la mitad del ciclo,
 * acotada. En un sueldo quincenal, mirar treinta días atrás daría por cobrada
 * la segunda quincena con el pago de la primera.
 */
const ventanaDe = (ciclo: IncomeCycle) =>
  ({ semanal: 3, quincenal: 6, mensual: 12 } as Partial<Record<IncomeCycle, number>>)[ciclo] ?? 20

/** El movimiento vinculado que cubre el ciclo en curso, si lo hay. */
function pagoDelCiclo(i: RecurringIncome, txs: Transaction[], hoy: string) {
  const desde = sumarDias(hoy, -ventanaDe(i.cycle))
  return txs
    .filter((t) => t.recurringIncomeId === i.id && diaEn(t.occurredAt) >= desde)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
}

/**
 * Ingresos ya registrados que podrían ser este pago: los de las últimas
 * semanas que no están vinculados a ningún otro ingreso. Primero los de la
 * misma cuenta y los de importe más parecido, que es como lo buscaría uno.
 */
function candidatos(i: RecurringIncome, txs: Transaction[], hoy: string) {
  const desde = sumarDias(hoy, -40)
  return txs
    .filter((t) => t.type === 'income' && !t.recurringIncomeId && diaEn(t.occurredAt) >= desde)
    .sort((a, b) => {
      const cuenta = Number(b.accountId === i.accountId) - Number(a.accountId === i.accountId)
      if (cuenta) return cuenta
      const cerca = Math.abs(a.amount - i.amount) - Math.abs(b.amount - i.amount)
      return cerca || b.occurredAt.localeCompare(a.occurredAt)
    })
    .slice(0, 4)
}

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
  const { recurringIncomes, addIngreso } = useFinance()
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
        <div className="mb-3 divide-y divide-hairline border-t border-hairline">
          {recurringIncomes.map((i) => <FilaIngreso key={i.id} ingreso={i} />)}
        </div>
      )}

      {creando ? (
        <Formulario
          onCancelar={() => setCreando(false)}
          onGuardar={(datos) => { void addIngreso({ ...datos, active: true, color: '#30D158' }); setCreando(false) }}
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

type Panel = null | 'editar' | 'cobro' | 'pagado'

/**
 * Un ingreso, en dos líneas: arriba qué es y cuánto, abajo lo que se hace con
 * él. En una sola línea no cabía: el nombre se quedaba en «S…» detrás de los
 * botones, justo lo único que dice de qué ingreso se trata.
 */
function FilaIngreso({ ingreso: i }: { ingreso: RecurringIncome }) {
  const { accounts, transactions, updateIngreso, deleteIngreso, vincularIngreso } = useFinance()
  const [panel, setPanel] = useState<Panel>(null)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const hoy = hoyEnZona()

  const proxima = ocurrencias(i.anchorAt, i.cycle, sumarDias(hoy, 1), sumarDias(hoy, 400))[0]
  const cuenta = accounts.find((a) => a.id === i.accountId)
  const pagado = useMemo(() => pagoDelCiclo(i, transactions, hoy), [i, transactions, hoy])
  const activo = i.active !== false
  const abrir = (p: Panel) => { haptic(6); setPanel((x) => (x === p ? null : p)); setConfirmarBorrado(false) }

  return (
    <div className={cn('py-3', !activo && 'opacity-50')}>
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-snug text-label">{i.name || 'Sin nombre'}</p>
          <p className="text-[12px] text-label-tertiary">
            {CICLOS.find((c) => c.valor === i.cycle)?.etiqueta}
            {cuenta && ` · ${cuenta.name}`}
            {activo && proxima && ` · próximo el ${fechaCobro(proxima)}`}
            {!activo && ' · apagado'}
          </p>
        </div>
        <span className="tnum shrink-0 text-[15px] font-semibold text-accent-green">
          {formatMoney(i.amount, i.currency)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1 pl-5">
        {activo && (pagado ? (
          <button onClick={() => abrir('pagado')}
            className="press flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill bg-accent-green/15 px-2.5 py-1 text-[12px] font-medium text-accent-green">
            <BadgeCheck size={13} /> Pagado {fechaCobro(diaEn(pagado.occurredAt))}
          </button>
        ) : (
          <button onClick={() => abrir('cobro')}
            className={cn('press shrink-0 whitespace-nowrap rounded-pill px-2.5 py-1 text-[12px] font-semibold',
              panel === 'cobro' ? 'bg-fill-4 text-label' : 'bg-accent-blue/15 text-accent-blue')}>
            Ya me pagaron
          </button>
        ))}
        <button onClick={() => abrir('editar')}
          className={cn('press flex shrink-0 items-center gap-1 rounded-pill px-2 py-1 text-[12px]',
            panel === 'editar' ? 'bg-fill-4 text-label' : 'text-label-secondary')}>
          <Pencil size={12} /> Editar
        </button>
        <button onClick={() => { haptic(6); void updateIngreso(i.id, { active: !activo }) }}
          className="press shrink-0 rounded-pill px-2 py-1 text-[12px] text-label-tertiary">
          {activo ? 'Apagar' : 'Activar'}
        </button>
        <span className="flex-1" />
        {confirmarBorrado ? (
          <button onClick={() => { haptic([18, 30]); void deleteIngreso(i.id) }}
            className="press rounded-pill bg-accent-red px-2.5 py-1 text-[12px] font-semibold text-white">
            Sí, borrar
          </button>
        ) : (
          <button onClick={() => { haptic(8); setConfirmarBorrado(true) }} aria-label={`Borrar ${i.name}`}
            className="press flex h-7 w-7 items-center justify-center rounded-lg text-accent-red">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {panel === 'editar' && (
        <div className="mt-3">
          <Formulario
            inicial={i}
            onCancelar={() => setPanel(null)}
            onGuardar={(datos) => { void updateIngreso(i.id, datos); setPanel(null) }}
          />
        </div>
      )}
      {panel === 'cobro' && !pagado && <PanelCobro ingreso={i} onListo={() => setPanel(null)} />}
      {panel === 'pagado' && pagado && (
        <div className="mt-3 rounded-2xl border border-hairline bg-fill-1 p-3">
          <p className="text-[13px] text-label-secondary">
            Vinculado a <span className="font-medium text-label">{pagado.description || 'un ingreso'}</span>{' '}
            del {fechaCobro(diaEn(pagado.occurredAt))}
            {accounts.find((a) => a.id === pagado.accountId) && ` en ${accounts.find((a) => a.id === pagado.accountId)!.name}`}
            , por <span className="tnum font-semibold text-accent-green">{formatMoney(pagado.amount, pagado.currency)}</span>.
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-label-tertiary">
            Desvincular no borra el movimiento: solo deja de contar como el pago de este ingreso.
            Para borrarlo, hazlo desde Gastos.
          </p>
          <button
            onClick={() => { haptic([14, 30]); void vincularIngreso(pagado.id, null); setPanel(null) }}
            className="press mt-2 flex items-center gap-1.5 rounded-xl border border-hairline px-3 py-2 text-[13px] font-medium text-label-secondary"
          >
            <Unlink size={14} /> Desvincular
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Confirmar un pago: anotarlo, o decir cuál de los ya anotados es.
 *
 * Antes, «Ya me pagaron» anotaba al instante el importe de siempre con la
 * fecha de hoy. Servía el mes en que llegaba exacto; el resto quedaba mal —el
 * sueldo con horas extra, la quincena que entró ayer— y no había forma de
 * decirlo antes. Ahora se ve y se corrige antes de confirmar.
 *
 * Y quien ya lo había anotado desde el botón de captura no tenía cómo decir
 * «es este»: la app buscaba un ingreso del mismo importe exacto y, si no lo
 * encontraba, invitaba a anotarlo otra vez. Los ingresos de las últimas
 * semanas salen arriba para vincular el que sea, sin duplicar nada.
 */
function PanelCobro({ ingreso: i, onListo }: { ingreso: RecurringIncome; onListo: () => void }) {
  const { transactions, accounts, addTransaction, vincularIngreso, updateIngreso } = useFinance()
  const hoy = hoyEnZona()
  const [monto, setMonto] = useState(String(i.amount).replace('.', ','))
  const [fecha, setFecha] = useState(hoy)
  const [cuenta, setCuenta] = useState(i.accountId ?? '')
  const [pocket, setPocket] = useState<string | undefined>()
  const [actualizarImporte, setActualizarImporte] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const lista = useMemo(() => candidatos(i, transactions, hoy), [i, transactions, hoy])
  const importe = parseKeypad(monto)
  const cambia = Math.abs(importe - i.amount) >= 1
  // En un sueldo, el importe sale del cálculo de la nómina: cambiarlo a mano
  // se pisaría en la siguiente edición.
  const puedeActualizar = cambia && !i.salarioBase
  const listo = importe > 0 && Boolean(cuenta) && !guardando

  const confirmar = async () => {
    if (!listo) return
    setGuardando(true)
    haptic([14, 40, 22])
    const id = await addTransaction({
      accountId: cuenta,
      pocketId: pocket,
      // El sueldo es salario; lo demás, un ingreso sin más. La categoría
      // decide si cuenta como fijo en el desglose de `lib/ingresos.ts`.
      categoryId: i.salarioBase ? 'salary' : 'other-income',
      amount: importe,
      type: 'income',
      description: i.name,
      occurredAt: instanteEnDia(fecha),
      currency: i.currency,
    })
    await vincularIngreso(id, i.id)
    if (puedeActualizar && actualizarImporte) await updateIngreso(i.id, { amount: importe })
    onListo()
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-hairline bg-fill-1 p-3">
      {lista.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-[12px] font-medium text-label-secondary">¿Ya lo anotaste? Vincúlalo</p>
          <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
            {lista.map((t) => {
              const c = accounts.find((a) => a.id === t.accountId)
              return (
                <button
                  key={t.id}
                  onClick={() => { haptic([14, 30]); void vincularIngreso(t.id, i.id); onListo() }}
                  className="press flex w-full items-center gap-2.5 bg-fill-2 px-3 py-2.5 text-left"
                >
                  <Link2 size={15} className="shrink-0 text-accent-blue" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-label">{t.description || 'Ingreso'}</span>
                    <span className="block truncate text-[11.5px] text-label-tertiary">
                      {fechaCobro(diaEn(t.occurredAt))}{c && ` · ${c.name}`}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-[13.5px] font-semibold text-accent-green">
                    {formatMoney(t.amount, t.currency)}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 px-1 text-[11.5px] text-label-tertiary">
            Se queda como está —importe, fecha y cuenta— y pasa a contar como el pago de {i.name}.
          </p>
        </div>
      )}

      <div>
        <p className="mb-1.5 px-1 text-[12px] font-medium text-label-secondary">
          {lista.length > 0 ? 'O anótalo ahora' : 'Anótalo'}
        </p>
        <MoneyInput value={monto} onChange={setMonto} currency={i.currency} className="mb-2" />
        {puedeActualizar && (
          <label className="mb-2 flex items-center gap-2 px-1 text-[12px] text-label-secondary">
            <input type="checkbox" checked={actualizarImporte} onChange={(e) => setActualizarImporte(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent-blue)]" />
            Usar {formatMoney(importe, i.currency)} de ahora en adelante
          </label>
        )}
        <label className="mb-2 flex items-center gap-2.5 rounded-xl border border-hairline bg-fill-2 px-3 py-2">
          <span className="flex-1 text-[13px] text-label-secondary">Día en que llegó</span>
          <input type="date" value={fecha} max={hoy} onChange={(e) => e.target.value && setFecha(e.target.value)}
            className="bg-transparent text-[14px] text-label focus:outline-none" />
        </label>
        <AccountPicker accountId={cuenta} pocketId={pocket} onChange={(c, b) => { setCuenta(c); setPocket(b) }} />
        <div className="mt-1 flex gap-2">
          <button onClick={onListo} className="press flex-1 rounded-xl border border-hairline py-2.5 text-label-secondary">
            <X size={15} className="mx-auto" />
          </button>
          <button onClick={confirmar} disabled={!listo}
            className="press flex-[2] rounded-xl bg-accent-green py-2.5 text-[14px] font-semibold text-black disabled:opacity-40">
            {cuenta ? `Confirmar ${formatMoney(importe, i.currency)}` : 'Elige una cuenta'}
          </button>
        </div>
      </div>
    </div>
  )
}

type DatosIngreso = Omit<RecurringIncome, 'id' | 'active' | 'color'>

/**
 * Alta y edición. Al editar se parte de lo guardado, sueldo incluido: pasar
 * un ingreso de «importe fijo» a «es un sueldo» o al revés es un cambio de
 * verdad, y por eso lo que deja de aplicar se borra en vez de quedarse.
 */
function Formulario({
  onGuardar, onCancelar, inicial,
}: {
  onGuardar: (datos: DatosIngreso) => void
  onCancelar: () => void
  inicial?: RecurringIncome
}) {
  const [nombre, setNombre] = useState(inicial?.name ?? '')
  const [monto, setMonto] = useState(inicial && !inicial.salarioBase ? String(inicial.amount).replace('.', ',') : '')
  const [ciclo, setCiclo] = useState<IncomeCycle>(inicial?.cycle ?? 'quincenal')
  const [cuenta, setCuenta] = useState(inicial?.accountId ?? '')
  const [dia, setDia] = useState(inicial?.anchorAt ?? hoyEnZona())
  /*
   * Modo nómina: en vez de teclear lo que llega, se teclea el sueldo pactado y
   * la app deriva lo que llega. Son dos cifras distintas y pedir solo una
   * obligaba a elegir cuál mentira preferías: con el bruto la proyección iba
   * inflada un 8 %, y con el neto no se podía estimar la prima.
   */
  const [esNomina, setEsNomina] = useState(Boolean(inicial?.salarioBase))
  const [nomina, setNomina] = useState<DatosNomina>(inicial?.salarioBase ? {
    salarioBase: inicial.salarioBase, auxilioTransporte: inicial.auxilioTransporte,
    cotiza: inicial.cotiza, turnos: inicial.turnos,
    trabajaFestivos: inicial.trabajaFestivos, pagaExtras: inicial.pagaExtras,
  } : {})

  // Lo que de verdad va a `amount`: en nómina es el resultado del cálculo.
  const resumen = esNomina && nomina.salarioBase
    ? resumirNomina({
        base: nomina.salarioBase, auxilio: nomina.auxilioTransporte,
        cotiza: nomina.cotiza, turnos: nomina.turnos,
        trabajaFestivos: nomina.trabajaFestivos, pagaExtras: nomina.pagaExtras,
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
        autoFocus={!inicial}
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
              currency: inicial?.currency ?? 'COP',
              cycle: ciclo,
              anchorAt: dia,
              accountId: cuenta || undefined,
              // Las claves van siempre, también vacías: dejar de ser sueldo
              // tiene que borrar lo pactado, y sin la clave el borrado no
              // viajaría (ver `ingresoPatchToRow`).
              salarioBase: esNomina ? nomina.salarioBase : undefined,
              auxilioTransporte: esNomina ? nomina.auxilioTransporte : undefined,
              cotiza: esNomina ? nomina.cotiza : undefined,
              turnos: esNomina ? nomina.turnos : undefined,
              trabajaFestivos: esNomina ? nomina.trabajaFestivos : undefined,
              pagaExtras: esNomina ? nomina.pagaExtras : undefined,
            })
          }}
          disabled={!valido}
          className="press flex-[2] rounded-xl bg-accent-green py-2.5 font-semibold text-black disabled:opacity-40"
        >
          {inicial ? 'Guardar cambios' : <Check size={17} className="mx-auto" />}
        </button>
      </div>
    </div>
  )
}
