'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { Segmented } from '@/components/ui/segmented'
import { anualDesdeMensual, mensualDesdeAnual } from '@/lib/deudas'
import { formatPercent, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Currency, Debt } from '@/lib/types'

export const COLORES_DEUDA = ['#FF453A', '#FF9F0A', '#BF5AF2', '#0A84FF', '#30D158', '#98989F']

/** Cómo se teclea la tasa. Lo que se guarda siempre es la anual. */
type Periodo = 'mensual' | 'anual'

const hoy = () => new Date().toISOString().slice(0, 10)

/**
 * Alta y edición de una deuda personal.
 *
 * Con `deuda` a `null` crea; con una deuda, edita. Lo abonado no se toca desde
 * aquí: vive en sus propias filas y se maneja en la lista, así que cambiar el
 * monto prestado o la tasa nunca puede llevarse por delante el historial de
 * pagos.
 */
export function DebtSheet({
  open, deuda, indice, onClose,
}: {
  open: boolean
  deuda: Debt | null
  /** Cuántas deudas hay ya, para elegir color al crear. */
  indice: number
  onClose: () => void
}) {
  const { addDebt, updateDebt, deleteDebt } = useFinance()

  const [person, setPerson] = useState('')
  const [principal, setPrincipal] = useState('')
  const [currency, setCurrency] = useState<Currency>('COP')
  const [conInteres, setConInteres] = useState(false)
  const [periodo, setPeriodo] = useState<Periodo>('mensual')
  const [tasa, setTasa] = useState('')
  const [startedAt, setStartedAt] = useState(hoy())
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [color, setColor] = useState(COLORES_DEUDA[0])
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  // Se recargan al abrir: la hoja se reutiliza entre deudas y entre crear y
  // editar, así que sin esto se editaría una deuda con los datos de otra.
  useEffect(() => {
    if (!open) return
    setPerson(deuda?.person ?? '')
    setPrincipal(deuda ? String(Math.round(deuda.principal)) : '')
    setCurrency(deuda?.currency ?? 'COP')
    const tieneTasa = Boolean(deuda?.rate && deuda.rate > 0)
    setConInteres(tieneTasa)
    // Se ofrece en mensual, que es como se pacta un préstamo entre personas.
    setPeriodo('mensual')
    setTasa(tieneTasa ? mensualDesdeAnual(deuda!.rate!).toFixed(2).replace('.', ',') : '')
    setStartedAt(deuda?.startedAt ?? hoy())
    setDueDate(deuda?.dueDate ?? '')
    setNote(deuda?.note ?? '')
    setColor(deuda?.color ?? COLORES_DEUDA[indice % COLORES_DEUDA.length])
    setConfirmarBorrado(false)
  }, [open, deuda, indice])

  const monto = parseKeypad(principal)
  const tecleada = parseKeypad(tasa)
  // Lo que se guarda es siempre la efectiva anual, venga como venga tecleada.
  const anual = !conInteres || tecleada <= 0
    ? undefined
    : periodo === 'mensual' ? anualDesdeMensual(tecleada) : tecleada
  const listo = Boolean(person.trim()) && monto > 0

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-5 text-center text-[17px] font-semibold">
          {deuda ? 'Editar deuda' : 'Nueva deuda'}
        </h2>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          ¿A quién le debes?
        </label>
        <input
          value={person} onChange={(e) => setPerson(e.target.value)}
          placeholder="Andrés" autoFocus={!deuda}
          className="mb-4 w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-[16px]
                     text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Moneda
        </label>
        <Segmented
          id="moneda-deuda" className="mb-4"
          value={currency} onChange={setCurrency}
          options={[
            { value: 'COP' as Currency, label: 'Pesos (COP)' },
            { value: 'USD' as Currency, label: 'Dólares (USD)' },
          ]}
        />

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Cuánto te prestó
        </label>
        <MoneyInput
          value={principal} onChange={setPrincipal} currency={currency}
          placeholder={currency === 'USD' ? '500' : '1.500.000'} className="mb-1"
        />
        <p className="mb-4 px-1 text-[12px] text-label-tertiary">
          El monto original. Lo que llevas pagado se registra aparte, abono a abono.
        </p>

        {/* ---- Interés ---------------------------------------------------- */}
        <button
          onClick={() => { haptic(6); setConInteres((v) => !v) }}
          className="press mb-3 flex w-full items-center justify-between rounded-xl border border-hairline
                     bg-fill-1 px-4 py-3 text-left"
        >
          <span className="text-[15px] text-label">Cobra intereses</span>
          <span
            className={cn(
              'flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors',
              conInteres ? 'bg-accent-green' : 'bg-fill-4',
            )}
          >
            <span className={cn('h-5 w-5 rounded-full bg-white transition-transform', conInteres && 'translate-x-4')} />
          </span>
        </button>

        {conInteres && (
          <div className="mb-4">
            <Segmented
              id="periodo-tasa" className="mb-3"
              value={periodo} onChange={setPeriodo}
              options={[
                { value: 'mensual' as Periodo, label: '% mensual' },
                { value: 'anual' as Periodo, label: '% anual (E.A.)' },
              ]}
            />
            <div className="flex items-center gap-2 rounded-xl border border-hairline bg-fill-2 px-4 py-3">
              <input
                value={tasa}
                onChange={(e) => setTasa(e.target.value.replace(/[^\d,]/g, ''))}
                placeholder={periodo === 'mensual' ? '2' : '26,8'}
                inputMode="decimal"
                className="tnum w-full bg-transparent text-[20px] font-semibold text-label
                           placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
              />
              <span className="shrink-0 text-[18px] text-label-secondary">%</span>
            </div>
            {/* La equivalencia, porque un 2 % mensual no es un 24 % anual sino
                un 26,8 %: los intereses del mes siguiente corren también sobre
                los del anterior, y esa diferencia sorprende a cualquiera. */}
            {anual !== undefined && (
              <p className="mt-1.5 px-1 text-[12px] text-label-tertiary">
                {periodo === 'mensual'
                  ? `Equivale a ${formatPercent(anual, false, 1)} efectivo anual.`
                  : `Equivale a ${formatPercent(mensualDesdeAnual(anual), false, 2)} mensual.`}
                {' '}Corre sobre el saldo pendiente, así que cada abono lo baja.
              </p>
            )}
          </div>
        )}

        {/* ---- Fechas ------------------------------------------------------ */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              Desde
            </label>
            <input
              type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-fill-2 px-3 py-3 text-[15px]
                         text-label focus:border-accent-blue/50 focus:outline-none [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              Límite
            </label>
            <input
              type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-fill-2 px-3 py-3 text-[15px]
                         text-label focus:border-accent-blue/50 focus:outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Nota (opcional)
        </label>
        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Para la cuota inicial de la moto"
          className="mb-4 w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-[16px]
                     text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Color
        </label>
        <div className="mb-5 flex gap-2">
          {COLORES_DEUDA.map((c) => (
            <button
              key={c}
              onClick={() => { haptic(6); setColor(c) }}
              aria-label={`Color ${c}`}
              className={cn(
                'h-9 w-9 rounded-full transition-transform',
                color === c ? 'scale-110 ring-2 ring-ring-sel' : 'opacity-70',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          onClick={() => {
            if (!listo) return
            haptic([14, 40, 22])
            const campos = {
              person: person.trim(),
              principal: monto,
              currency,
              rate: anual,
              startedAt,
              dueDate: dueDate || undefined,
              note: note.trim() || undefined,
              color,
            }
            if (deuda) updateDebt(deuda.id, campos)
            else addDebt(campos)
            onClose()
          }}
          disabled={!listo}
          className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                     shadow-glow disabled:bg-fill-2 disabled:text-label-tertiary disabled:shadow-none"
        >
          {deuda ? 'Guardar' : 'Registrar deuda'}
        </button>

        {/* Borrar pide confirmación: se lleva por delante todos los abonos. */}
        {deuda && (confirmarBorrado ? (
          <div className="mt-3 rounded-2xl border border-accent-red/30 bg-accent-red/[0.08] p-4">
            <p className="mb-3 text-center text-[13px] leading-relaxed text-label">
              Se borra también el historial de abonos. No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmarBorrado(false)}
                className="press flex-1 rounded-xl border border-hairline py-2.5 text-[14px] text-label-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={() => { haptic([20, 40]); deleteDebt(deuda.id); onClose() }}
                className="press flex-1 rounded-xl bg-accent-red py-2.5 text-[14px] font-semibold text-white"
              >
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { haptic(8); setConfirmarBorrado(true) }}
            className="press mt-3 flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl
                       border border-hairline text-[15px] font-medium text-accent-red"
          >
            <Trash2 size={16} />
            Eliminar deuda
          </button>
        ))}
      </div>
    </Sheet>
  )
}
