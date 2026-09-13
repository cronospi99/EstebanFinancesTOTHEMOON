'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, HandCoins, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { MoneyInput } from '@/components/ui/money-input'
import { DebtSheet } from '@/components/debts/debt-sheet'
import { mensualDesdeAnual, redondeaMoneda } from '@/lib/deudas'
import { formatDate, formatMoney, formatPercent, parseKeypad } from '@/lib/format'
import { useDeudaTotal, useDeudas, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Debt } from '@/lib/types'
import type { DeudaConSaldo } from '@/lib/store'

const hoy = () => new Date().toISOString().slice(0, 10)

/**
 * Deudas personales: lo que le debes a gente, no a un banco.
 *
 * Vive en Cuentas y no en Metas porque responde a la misma pregunta que el
 * resto de la pantalla —dónde está tu dinero— solo que del otro lado: es
 * dinero que ya no es tuyo aunque lo tengas en la mano.
 */
export function DebtsSection() {
  const deudas = useDeudas()
  const { deudasError, synced } = useFinance()
  const { total, cuantas } = useDeudaTotal()

  const [hoja, setHoja] = useState(false)
  const [editando, setEditando] = useState<Debt | null>(null)

  const abrirNueva = () => { haptic(6); setEditando(null); setHoja(true) }

  return (
    <section>
      <CardHeader
        title="Deudas personales"
        action={
          <button
            onClick={abrirNueva}
            className="flex items-center gap-1 text-[13px] font-medium text-accent-blue"
          >
            <Plus size={14} /> Nueva
          </button>
        }
      />

      {/* Si el servidor las rechaza, decirlo. Sin este aviso el fallo era
          invisible: se registraba la deuda, se veía en pantalla, y a la carga
          siguiente ya no estaba sin que nada explicara por qué. */}
      {synced && deudasError && (
        <div className="mb-3 flex gap-2.5 rounded-2xl border border-accent-orange/25 bg-accent-orange/[0.08] px-4 py-3">
          <TriangleAlert size={17} className="mt-0.5 shrink-0 text-accent-orange" />
          <div>
            <p className="text-[13px] font-semibold text-accent-orange">
              Las deudas no se están guardando en tu cuenta
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-label-secondary">
              {deudasError}. Lo que registres se queda en este teléfono hasta que
              se arregle. Si acabas de desplegar, falta aplicar la migración
              <code className="mx-1 rounded bg-white/10 px-1 py-0.5 text-[11px]">deudas_personales</code>
              en Supabase.
            </p>
          </div>
        </div>
      )}

      {!deudas.length ? (
        <Card className="p-8 text-center">
          <HandCoins size={22} className="mx-auto mb-2 text-label-tertiary" />
          <p className="text-[15px] font-medium text-label">No le debes nada a nadie</p>
          <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
            Si alguien te prestó, anótalo aquí: cuánto fue, qué llevas pagado y,
            si lo pactaron, qué interés corre.
          </p>
          <button
            onClick={abrirNueva}
            className="press mt-3 rounded-xl border border-hairline bg-white/[0.04] px-4 py-2 text-[14px] font-medium text-accent-blue"
          >
            Registrar una deuda
          </button>
        </Card>
      ) : (
        <>
          {/* El total arriba: es lo que uno viene a mirar, y sumar de cabeza
              cuatro tarjetas no es forma de enterarse. */}
          {cuantas > 0 && (
            <Card className="mb-3 flex items-baseline justify-between p-4">
              <span className="text-[13px] text-label-secondary">
                Debes en total{cuantas > 1 ? ` · ${cuantas} deudas` : ''}
              </span>
              <span className="tnum text-[20px] font-bold text-accent-red">{formatMoney(total)}</span>
            </Card>
          )}

          <div className="space-y-3">
            {deudas.map((d) => (
              <FilaDeuda
                key={d.deuda.id}
                item={d}
                onEditar={() => { haptic(6); setEditando(d.deuda); setHoja(true) }}
              />
            ))}
          </div>
        </>
      )}

      <DebtSheet
        open={hoja} deuda={editando} indice={deudas.length}
        onClose={() => setHoja(false)}
      />
    </section>
  )
}

function FilaDeuda({ item, onEditar }: { item: DeudaConSaldo; onEditar: () => void }) {
  const { abonarDeuda, deleteDebtPayment } = useFinance()
  const { deuda, saldo, pagado, interes, capital, progreso, saldada, excedente, abonos } = item

  const [abonando, setAbonando] = useState(false)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [verAbonos, setVerAbonos] = useState(false)

  const moneda = deuda.currency
  /** Importe listo para pintar: en la moneda de la deuda y sin centavos en pesos. */
  const importe = (v: number) => formatMoney(redondeaMoneda(v, moneda), moneda)
  const dias = deuda.dueDate
    ? Math.ceil((new Date(`${deuda.dueDate}T12:00:00Z`).getTime() - Date.now()) / 86_400_000)
    : null

  const registrar = () => {
    const cantidad = parseKeypad(monto)
    if (cantidad <= 0) return
    haptic([14, 30])
    abonarDeuda({ debtId: deuda.id, amount: cantidad, occurredAt: fecha })
    setMonto(''); setFecha(hoy()); setAbonando(false)
  }

  return (
    <Card className={cn('p-4', saldada && 'opacity-60')}>
      <div className="mb-2 flex items-start gap-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: deuda.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[16px] font-semibold text-label">{deuda.person}</p>
            {moneda === 'USD' && (
              <span className="shrink-0 rounded bg-white/[0.09] px-1 py-px text-[9px] font-bold text-label-secondary">USD</span>
            )}
            {saldada && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-pill bg-accent-green/15 px-1.5 py-px text-[10px] font-semibold text-accent-green">
                <Check size={10} strokeWidth={3} /> Saldada
              </span>
            )}
          </div>
          {/* Lo prestado y lo pagado, que es la pregunta literal: cuánto era y
              cuánto le llevo dado. */}
          <p className="tnum text-[12px] text-label-secondary">
            {importe(pagado)} pagados de {importe(capital)}
            {interes > 0.5 && ` + ${importe(interes)} de interés`}
          </p>
        </div>
        <button
          onClick={onEditar}
          aria-label={`Editar deuda con ${deuda.person}`}
          className="press shrink-0 p-1 text-label-tertiary"
        >
          <Pencil size={15} />
        </button>
      </div>

      <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${progreso * 100}%` }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          className="h-full rounded-full"
          style={{ backgroundColor: saldada ? '#30D158' : deuda.color }}
        />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {saldada ? (
          <span className="text-[13px] font-semibold text-accent-green">
            {excedente > 0.5 ? `Pagaste ${importe(excedente)} de más` : 'Sin saldo pendiente'}
          </span>
        ) : (
          <span className="tnum text-[15px] font-bold text-label">
            Debes {importe(saldo)}
          </span>
        )}
        {/* La tasa se enseña mensual, que es como se pactó, aunque se guarde anual. */}
        {deuda.rate ? (
          <span className="tnum text-[12px] text-label-tertiary">
            {formatPercent(mensualDesdeAnual(deuda.rate), false, 1)} mensual
          </span>
        ) : null}
        {dias !== null && !saldada && (
          <span className={cn('text-[12px]', dias < 0 ? 'text-accent-red' : 'text-label-tertiary')}>
            {dias < 0 ? `${Math.abs(dias)} días de retraso` : `faltan ${dias} días`}
          </span>
        )}
      </div>

      {deuda.note && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-label-tertiary">{deuda.note}</p>
      )}

      {abonando ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <MoneyInput
              value={monto} onChange={setMonto} currency={moneda}
              autoFocus size="sm" className="flex-1"
            />
            <button
              onClick={registrar}
              className="press rounded-xl bg-accent-blue px-4 text-[14px] font-semibold text-white"
            >
              Abonar
            </button>
            <button
              onClick={() => { setAbonando(false); setMonto('') }}
              aria-label="Cancelar abono"
              className="press rounded-xl border border-hairline px-3 text-[14px] text-label-secondary"
            >
              ✕
            </button>
          </div>
          {/* La fecha importa cuando hay interés: un abono de hace un mes deja
              menos saldo hoy que el mismo abono hecho esta mañana. */}
          <input
            type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            aria-label="Fecha del abono"
            className="w-full rounded-xl border border-hairline bg-white/[0.05] px-3 py-2 text-[14px]
                       text-label focus:border-accent-blue/50 focus:outline-none [color-scheme:dark]"
          />
        </div>
      ) : (
        !saldada && (
          <button
            onClick={() => { haptic(6); setAbonando(true) }}
            className="press mt-3 w-full rounded-xl border border-hairline bg-white/[0.04] py-2 text-[13px] font-medium text-accent-blue"
          >
            Registrar un abono
          </button>
        )
      )}

      {abonos.length > 0 && (
        <>
          <button
            onClick={() => { haptic(6); setVerAbonos((v) => !v) }}
            className="press mt-2 w-full py-1 text-center text-[12px] text-label-tertiary"
          >
            {verAbonos ? 'Ocultar abonos' : `Ver los ${abonos.length} abonos`}
          </button>

          {verAbonos && (
            <ul className="mt-1 divide-y divide-hairline border-t border-hairline">
              {abonos.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-[13px] text-label-secondary">{formatDate(a.occurredAt)}</span>
                  <span className="tnum text-[14px] font-medium text-label">
                    {importe(a.amount)}
                  </span>
                  <button
                    onClick={() => { haptic([16, 30]); deleteDebtPayment(a.id) }}
                    aria-label={`Eliminar abono de ${formatDate(a.occurredAt)}`}
                    className="press shrink-0 p-1 text-label-tertiary"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}
