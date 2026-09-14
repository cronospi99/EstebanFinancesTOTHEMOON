'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Link2, Minus, Plus, Wallet } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { CategoryIcon } from '@/components/ui/category-icon'
import { ScrollStrip } from '@/components/ui/scroll-strip'
import { categoryById } from '@/lib/categories'
import { movimientoDeAbono, redondeaMoneda } from '@/lib/deudas'
import { formatDate, formatMoney, parseKeypad } from '@/lib/format'
import { accountTotal, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import { hoyEnZona } from '@/lib/zona'
import type { DeudaConSaldo } from '@/lib/store'

/** Las tres formas de saldar. La diferencia entre ellas es qué pasa con el dinero. */
type Forma = 'cuenta' | 'cruce' | 'ajuste'

const FORMAS = (prestado: boolean): { value: Forma; label: string; icono: React.ReactNode }[] => [
  // «Pagar» solo vale para la deuda propia: si te deben, lo que pasa por la
  // cuenta es plata que entra.
  { value: 'cuenta', label: prestado ? 'Cobrar' : 'Pagar', icono: <Wallet size={15} /> },
  { value: 'cruce', label: 'Cruzar', icono: <Link2 size={15} /> },
  { value: 'ajuste', label: 'Ajuste', icono: <ArrowLeftRight size={15} /> },
]

/** Cuántos movimientos recientes se ofrecen para cruzar. */
const CUANTOS = 40

/**
 * Cuadrar cuentas con una persona.
 *
 * Una deuda no siempre se salda pasando plata, y esa era toda la maquinaria que
 * había. Entre personas se salda de tres formas, y lo que las distingue es qué
 * pasa con el dinero:
 *
 *  · **Pagar** desde una cuenta o una tarjeta. El dinero sale, así que se crea
 *    el movimiento. Con tarjeta, la deuda de la tarjeta sube: no dejaste de
 *    deber, cambiaste de acreedor.
 *  · **Cruzar** un gasto que ya está registrado. Le pagaste algo suyo con tu
 *    tarjeta, ese gasto ya existe, y lo que falta es decir que descuenta. No se
 *    crea nada — crear otro movimiento lo cobraría dos veces, que es justo el
 *    error que esta pantalla existe para evitar.
 *  · **Ajuste**, sin mover un peso. Un perdón, un descuento, un redondeo.
 *
 * Y en los tres casos puede ir al revés: un cargo, porque el otro puso algo más
 * o porque alguien apuntó mal. Cuadrar cuentas es en dos direcciones.
 *
 * Todo esto vale igual para un préstamo que hiciste tú, con el dinero en el
 * sentido contrario: lo que te devuelven entra a la cuenta, lo que le prestas
 * de más sale, y un gasto cruzado es algo suyo que pagaste y que por tanto
 * *sube* lo que te debe. Lo único que cambia son los rótulos y el signo del
 * movimiento; el saldo se calcula igual.
 */
export function SettleSheet({
  open, item, onClose,
}: {
  open: boolean
  item: DeudaConSaldo | null
  onClose: () => void
}) {
  const { transactions, accounts, debtPayments, abonarDeuda } = useFinance()

  const [forma, setForma] = useState<Forma>('cuenta')
  const [signo, setSigno] = useState<1 | -1>(1)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyEnZona)
  const [cuentaId, setCuentaId] = useState('')
  const [movimientoId, setMovimientoId] = useState('')
  const [nota, setNota] = useState('')

  const deuda = item?.deuda
  const moneda = deuda?.currency ?? 'COP'
  const prestado = deuda?.direction === 'lent'
  // Qué movimiento va a quedar registrado, para poder anunciarlo antes de
  // pulsar en vez de después.
  const efecto = movimientoDeAbono(deuda?.direction ?? 'owe', signo)

  useEffect(() => {
    if (!open) return
    setForma('cuenta')
    setSigno(1)
    setMonto('')
    setFecha(hoyEnZona())
    setCuentaId('')
    setMovimientoId('')
    setNota('')
  }, [open])

  /** Lo que ya está cruzado, para no ofrecerlo dos veces. */
  const yaCruzados = useMemo(
    () => new Set(debtPayments.filter((p) => p.transactionId).map((p) => p.transactionId!)),
    [debtPayments],
  )

  /*
   * Qué movimientos se pueden cruzar: gastos recientes que no estén ya
   * cruzados contra otra deuda. Se ofrecen los gastos y no las transferencias
   * porque lo que se cruza es algo que se compró, no dinero que cambió de sitio.
   */
  const cruzables = useMemo(
    () => transactions
      .filter((t) => t.type === 'expense' && !yaCruzados.has(t.id))
      .slice(0, CUANTOS),
    [transactions, yaCruzados],
  )

  const movimiento = cruzables.find((t) => t.id === movimientoId)
  const cuenta = accounts.find((a) => a.id === cuentaId)
  const importe = parseKeypad(monto)

  const listo = Boolean(deuda) && importe > 0 && (
    forma === 'ajuste' || (forma === 'cuenta' ? Boolean(cuenta) : Boolean(movimiento))
  )

  const confirmar = () => {
    if (!listo || !deuda) return
    haptic([14, 40, 22])
    abonarDeuda({
      debtId: deuda.id,
      amount: importe * signo,
      occurredAt: fecha,
      note: nota.trim() || undefined,
      // Solo una de las dos: `accountId` crea el movimiento, `transactionId`
      // enlaza uno que ya existe. Ver `abonarDeuda`.
      accountId: forma === 'cuenta' ? cuentaId : undefined,
      transactionId: forma === 'cruce' ? movimientoId : undefined,
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-1 text-center text-[17px] font-semibold">
          Cuadrar con {deuda?.person ?? ''}
        </h2>
        {item && (
          <p className="tnum mb-4 text-center text-[13px] text-label-secondary">
            {prestado ? 'Te debe' : 'Debes'}{' '}
            {formatMoney(redondeaMoneda(item.saldo, moneda), moneda)}
          </p>
        )}

        {/* Abono o cargo: cuadrar cuentas va en las dos direcciones, y el
            rótulo dice quién hizo qué, que es como se recuerda. */}
        <div className="mb-4 flex gap-2">
          {([1, -1] as const).map((s) => (
            <button
              key={s}
              onClick={() => { haptic(6); setSigno(s) }}
              className={cn(
                'press flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[14px] font-medium transition-colors',
                signo === s
                  ? s === 1
                    ? 'border-transparent bg-accent-green/15 text-accent-green'
                    : 'border-transparent bg-accent-red/15 text-accent-red'
                  : 'border-hairline text-label-secondary',
              )}
            >
              {s === 1 ? <Minus size={14} /> : <Plus size={14} />}
              {prestado
                ? s === 1 ? 'Te pagó' : 'Le prestaste más'
                : s === 1 ? 'Le pagaste' : 'Te prestó más'}
            </button>
          ))}
        </div>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Cómo
        </label>
        <div className="mb-4 flex gap-1 rounded-pill bg-fill-3 p-[3px]">
          {FORMAS(prestado).map((f) => (
            <button
              key={f.value}
              onClick={() => { haptic(6); setForma(f.value) }}
              className={cn(
                'press flex flex-1 items-center justify-center gap-1.5 rounded-pill py-2 text-[13px] font-medium transition-colors',
                forma === f.value ? 'bg-fill-4 text-label' : 'text-label-secondary',
              )}
            >
              {f.icono}
              {f.label}
            </button>
          ))}
        </div>

        {/* ---- Pagar desde una cuenta -------------------------------------- */}
        {forma === 'cuenta' && (
          <>
            <ScrollStrip className="mb-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { haptic(6); setCuentaId(a.id) }}
                  className={cn(
                    'press flex shrink-0 items-center gap-2 rounded-xl border py-2 pl-2 pr-3 text-left transition-colors',
                    cuentaId === a.id ? 'border-transparent bg-fill-4' : 'border-hairline',
                  )}
                >
                  <InstitutionBadge institution={a.institution} color={a.color} size="xs" />
                  <span>
                    <span className="block text-[13px] font-medium text-label">{a.name}</span>
                    <span className="tnum block text-[11px] text-label-tertiary">
                      {formatMoney(accountTotal(a), a.currency)}
                    </span>
                  </span>
                </button>
              ))}
            </ScrollStrip>
            <p className="mb-4 px-1 text-[12px] leading-relaxed text-label-tertiary">
              {cuenta?.type === 'credit' && !efecto.entra
                ? 'Con tarjeta la deuda de la tarjeta sube por el mismo importe: no dejas de deber, cambias de acreedor.'
                : efecto.entra
                  ? 'Se registra como ingreso para que el saldo de la cuenta lo acuse: es plata que vuelve, no un ingreso nuevo.'
                  : 'Se registra el movimiento para que el saldo de la cuenta lo acuse.'}
            </p>
          </>
        )}

        {/* ---- Cruzar un movimiento que ya existe --------------------------- */}
        {forma === 'cruce' && (
          <>
            <p className="mb-2 px-1 text-[12px] leading-relaxed text-label-tertiary">
              Un gasto que ya registraste y que en realidad era suyo. No se crea
              nada nuevo: crear otro movimiento lo cobraría dos veces.
              {prestado && ' Si lo pagaste tú por él, sube lo que te debe: elige «Le prestaste más».'}
            </p>
            {!cruzables.length ? (
              <p className="mb-4 px-1 text-[13px] text-label-secondary">
                No hay gastos sin cruzar todavía.
              </p>
            ) : (
              <ul className="mb-4 max-h-[240px] divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline">
                {cruzables.map((t) => {
                  const cat = categoryById(t.categoryId)
                  const elegido = movimientoId === t.id
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => {
                          haptic(6)
                          setMovimientoId(t.id)
                          // El importe se rellena solo con el del gasto, que es
                          // lo que se cruza casi siempre. Se puede recortar si
                          // solo una parte era suya.
                          setMonto(String(Math.round(t.amount)))
                          setFecha(t.occurredAt.slice(0, 10))
                        }}
                        className={cn(
                          'press-soft flex w-full items-center gap-3 px-3 py-2.5 text-left',
                          elegido && 'bg-fill-3',
                        )}
                      >
                        <CategoryIcon icon={cat.icon} color={cat.color} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] text-label">{t.description || cat.name}</p>
                          <p className="truncate text-[11px] text-label-tertiary">
                            {formatDate(t.occurredAt)} ·{' '}
                            {accounts.find((a) => a.id === t.accountId)?.name ?? 'Cuenta'}
                          </p>
                        </div>
                        <span className="tnum shrink-0 text-[14px] font-medium text-label">
                          {formatMoney(t.amount, t.currency)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}

        {/* ---- Ajuste ------------------------------------------------------- */}
        {forma === 'ajuste' && (
          <p className="mb-4 px-1 text-[12px] leading-relaxed text-label-tertiary">
            No mueve un peso en ninguna cuenta. Para un perdón, un descuento o un
            redondeo al cuadrar cuentas.
          </p>
        )}

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Cuánto
        </label>
        <MoneyInput
          value={monto} onChange={setMonto} currency={moneda}
          placeholder="0" className="mb-2"
        />
        {forma === 'cruce' && movimiento && importe > movimiento.amount + 0.5 && (
          <p className="mb-2 px-1 text-[12px] text-accent-orange">
            Estás cruzando más de lo que costó ese gasto
            ({formatMoney(movimiento.amount, movimiento.currency)}).
          </p>
        )}
        {item && signo === 1 && importe > item.saldo + 0.5 && (
          <p className="mb-2 px-1 text-[12px] text-label-tertiary">
            {prestado
              ? 'Es más de lo que te debe: quedarás debiéndole la diferencia.'
              : 'Es más de lo que debes: la deuda quedará a tu favor.'}
          </p>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              Cuándo
            </label>
            <input
              type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-fill-2 px-3 py-3 text-[15px]
                         text-label focus:border-accent-blue/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              Nota
            </label>
            <input
              value={nota} onChange={(e) => setNota(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-xl border border-hairline bg-fill-2 px-3 py-3 text-[15px]
                         text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={confirmar}
          disabled={!listo}
          className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                     shadow-glow disabled:bg-fill-2 disabled:text-label-tertiary disabled:shadow-none"
        >
          {prestado
            ? signo === 1 ? 'Cobrar' : 'Prestar'
            : signo === 1 ? 'Abonar' : 'Cargar'}
          {importe > 0 ? ` ${formatMoney(importe, moneda)}` : ''}
        </button>
      </div>
    </Sheet>
  )
}
