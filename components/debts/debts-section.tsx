'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeftRight, Check, HandCoins, Link2, Pencil, Plus, Trash2, TriangleAlert, Wallet,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { DebtSheet } from '@/components/debts/debt-sheet'
import { SettleSheet } from '@/components/debts/settle-sheet'
import { mensualDesdeAnual, movimientoDeAbono, redondeaMoneda } from '@/lib/deudas'
import { formatDate, formatMoney, formatPercent } from '@/lib/format'
import { useDeudaTotal, useDeudas, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import { formaDeAbono, type Debt, type DebtDirection } from '@/lib/types'
import type { DeudaConSaldo } from '@/lib/store'

/**
 * Deudas personales: lo que le debes a gente y lo que la gente te debe.
 *
 * Vive en Cuentas y no en Metas porque responde a la misma pregunta que el
 * resto de la pantalla —dónde está tu dinero— solo que en los bordes: dinero
 * que ya no es tuyo aunque lo tengas en la mano, y dinero que es tuyo aunque no
 * lo tengas.
 *
 * Los dos lados no se suman en una sola cifra. Que un amigo te deba dos
 * millones no paga el millón que le debes a tu mamá, y un neto escondería
 * justo lo que uno viene a mirar: a quién hay que pagarle y a quién hay que
 * cobrarle.
 */
export function DebtsSection() {
  const todas = useDeudas()
  const { deudasError, synced } = useFinance()
  const { debo, meDeben } = useDeudaTotal()

  const [lado, setLado] = useState<DebtDirection>('owe')
  const [hoja, setHoja] = useState(false)
  const [editando, setEditando] = useState<Debt | null>(null)
  const [cuadrando, setCuadrando] = useState<DeudaConSaldo | null>(null)

  const deudas = useMemo(
    () => todas.filter((d) => d.deuda.direction === lado),
    [todas, lado],
  )
  const prestado = lado === 'lent'
  const totales = prestado ? meDeben : debo

  /** Abre el alta con el lado que se está mirando ya elegido. */
  const abrirNueva = (direccion: DebtDirection = lado) => {
    haptic(6)
    setLado(direccion)
    setEditando(null)
    setHoja(true)
  }

  return (
    <section>
      <CardHeader
        title="Deudas personales"
        action={
          <button
            onClick={() => abrirNueva()}
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
              se arregle. Si acabas de desplegar, falta aplicar las migraciones
              <code className="mx-1 rounded bg-white/10 px-1 py-0.5 text-[11px]">deudas_personales</code>
              y
              <code className="mx-1 rounded bg-white/10 px-1 py-0.5 text-[11px]">prestamos_a_favor</code>
              en Supabase.
            </p>
          </div>
        </div>
      )}

      {!todas.length ? (
        <Card className="p-8 text-center">
          <HandCoins size={22} className="mx-auto mb-2 text-label-tertiary" />
          <p className="text-[15px] font-medium text-label">No hay cuentas pendientes con nadie</p>
          <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
            Si alguien te prestó —o si prestaste tú— anótalo aquí: cuánto fue,
            qué se lleva pagado y, si lo pactaron, qué interés corre.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={() => abrirNueva('owe')}
              className="press rounded-xl border border-hairline bg-fill-1 px-4 py-2 text-[14px] font-medium text-accent-blue"
            >
              Me prestaron
            </button>
            <button
              onClick={() => abrirNueva('lent')}
              className="press rounded-xl border border-hairline bg-fill-1 px-4 py-2 text-[14px] font-medium text-accent-blue"
            >
              Yo presté
            </button>
          </div>
        </Card>
      ) : (
        <>
          {/* Los dos lados, siempre visibles aunque uno esté vacío: enterarse de
              que lo que te deben también se puede anotar no debería depender de
              haberlo anotado ya. */}
          <Segmented
            id="lado-deudas" className="mb-3"
            value={lado} onChange={setLado}
            options={[
              { value: 'owe' as DebtDirection, label: `Debo${debo.cuantas ? ` · ${debo.cuantas}` : ''}` },
              { value: 'lent' as DebtDirection, label: `Me deben${meDeben.cuantas ? ` · ${meDeben.cuantas}` : ''}` },
            ]}
          />

          {/* El total arriba: es lo que uno viene a mirar, y sumar de cabeza
              cuatro tarjetas no es forma de enterarse. */}
          {totales.cuantas > 0 && (
            <Card className="mb-3 flex items-baseline justify-between p-4">
              <span className="text-[13px] text-label-secondary">
                {prestado ? 'Te deben en total' : 'Debes en total'}
                {totales.cuantas > 1 ? ` · ${totales.cuantas} ${prestado ? 'préstamos' : 'deudas'}` : ''}
              </span>
              <span className={cn(
                'tnum text-[20px] font-bold',
                prestado ? 'text-accent-green' : 'text-accent-red',
              )}>
                {formatMoney(totales.total)}
              </span>
            </Card>
          )}

          {!deudas.length ? (
            <Card className="p-6 text-center">
              <p className="text-[14px] text-label-secondary">
                {prestado ? 'No le has prestado a nadie.' : 'No le debes nada a nadie.'}
              </p>
              <button
                onClick={() => abrirNueva()}
                className="press mt-3 rounded-xl border border-hairline bg-fill-1 px-4 py-2 text-[14px] font-medium text-accent-blue"
              >
                {prestado ? 'Registrar un préstamo' : 'Registrar una deuda'}
              </button>
            </Card>
          ) : (
            <div className="space-y-3">
              {deudas.map((d) => (
                <FilaDeuda
                  key={d.deuda.id}
                  item={d}
                  onEditar={() => { haptic(6); setEditando(d.deuda); setHoja(true) }}
                  onCuadrar={() => { haptic(6); setCuadrando(d) }}
                />
              ))}
            </div>
          )}
        </>
      )}

      <DebtSheet
        open={hoja} deuda={editando} indice={todas.length} direccionInicial={lado}
        // Si se cambió el sentido dentro de la hoja, la lista se mueve con él:
        // guardar un préstamo y que no aparezca por ningún lado es la forma más
        // rápida de creer que no se guardó.
        onGuardado={setLado}
        onClose={() => setHoja(false)}
      />
      <SettleSheet
        open={Boolean(cuadrando)} item={cuadrando}
        onClose={() => setCuadrando(null)}
      />
    </section>
  )
}

function FilaDeuda({
  item, onEditar, onCuadrar,
}: { item: DeudaConSaldo; onEditar: () => void; onCuadrar: () => void }) {
  const { accounts, deleteDebtPayment } = useFinance()
  const { deuda, saldo, pagado, interes, capital, progreso, saldada, excedente, abonos } = item

  const [verAbonos, setVerAbonos] = useState(false)

  const moneda = deuda.currency
  const prestado = deuda.direction === 'lent'
  /** Importe listo para pintar: en la moneda de la deuda y sin centavos en pesos. */
  const importe = (v: number) => formatMoney(redondeaMoneda(v, moneda), moneda)
  const dias = deuda.dueDate
    ? Math.ceil((new Date(`${deuda.dueDate}T12:00:00Z`).getTime() - Date.now()) / 86_400_000)
    : null

  return (
    <Card className={cn('p-4', saldada && 'opacity-60')}>
      <div className="mb-2 flex items-start gap-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: deuda.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[16px] font-semibold text-label">{deuda.person}</p>
            {moneda === 'USD' && (
              <span className="shrink-0 rounded bg-fill-3 px-1 py-px text-[9px] font-bold text-label-secondary">USD</span>
            )}
            {saldada && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-pill bg-accent-green/15 px-1.5 py-px text-[10px] font-semibold text-accent-green">
                <Check size={10} strokeWidth={3} /> Saldada
              </span>
            )}
          </div>
          {/* Lo prestado y lo pagado, que es la pregunta literal: cuánto era y
              cuánto lleva dado. */}
          <p className="tnum text-[12px] text-label-secondary">
            {prestado
              ? `te ha devuelto ${importe(pagado)} de ${importe(capital)}`
              : `${importe(pagado)} pagados de ${importe(capital)}`}
            {interes > 0.5 && ` + ${importe(interes)} de interés`}
          </p>
        </div>
        <button
          onClick={onEditar}
          aria-label={`Editar ${prestado ? 'préstamo a' : 'deuda con'} ${deuda.person}`}
          className="press-icon shrink-0 p-1 text-label-tertiary"
        >
          <Pencil size={15} />
        </button>
      </div>

      <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-fill-3">
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
            {excedente > 0.5
              ? prestado
                ? `Te pagó ${importe(excedente)} de más`
                : `Pagaste ${importe(excedente)} de más`
              : 'Sin saldo pendiente'}
          </span>
        ) : (
          <span className="tnum text-[15px] font-bold text-label">
            {prestado ? 'Te debe' : 'Debes'} {importe(saldo)}
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

      {/* Una hoja y no un campo en línea: saldar una deuda ya no es «cuánto»,
          es «cuánto, de dónde y de qué forma», y eso no cabe en una fila. */}
      <button
        onClick={onCuadrar}
        className="press mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-hairline
                   bg-fill-1 py-2 text-[13px] font-medium text-accent-blue"
      >
        <ArrowLeftRight size={14} />
        {saldada ? 'Ajustar cuentas' : prestado ? 'Cobrar o cuadrar' : 'Abonar o cuadrar'}
      </button>

      {abonos.length > 0 && (
        <>
          <button
            onClick={() => { haptic(6); setVerAbonos((v) => !v) }}
            className="press mt-2 w-full py-1 text-center text-[12px] text-label-tertiary"
          >
            {verAbonos ? 'Ocultar' : abonos.length === 1 ? 'Ver el abono' : `Ver los ${abonos.length} abonos`}
          </button>

          {verAbonos && (
            <ul className="mt-1 divide-y divide-hairline border-t border-hairline">
              {abonos.map((a) => {
                const forma = formaDeAbono(a)
                const cuenta = accounts.find((c) => c.id === a.accountId)
                return (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <span className="shrink-0 text-label-tertiary">
                    {forma === 'cruce' ? <Link2 size={13} />
                      : forma === 'cuenta' ? <Wallet size={13} />
                      : <ArrowLeftRight size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-label-secondary">{formatDate(a.occurredAt)}</p>
                    {/* De qué forma se saldó: sin esto, tres abonos del mismo
                        importe son indistinguibles y no hay manera de recordar
                        cuál fue el que se cruzó contra la compra. */}
                    <p className="truncate text-[11px] text-label-tertiary">
                      {a.note ? `${a.note} · ` : ''}
                      {forma === 'cruce' ? 'cruzado con un gasto'
                        : forma === 'cuenta'
                          // «a» o «desde» según a dónde fue la plata: en un
                          // préstamo tuyo lo que te devuelven entra a la cuenta.
                          ? `${movimientoDeAbono(deuda.direction, a.amount).entra ? 'a' : 'desde'} ${cuenta?.name ?? 'una cuenta'}`
                        : 'ajuste'}
                    </p>
                  </div>
                  <span className={cn(
                    'tnum text-[14px] font-medium',
                    a.amount < 0 ? 'text-accent-red' : 'text-label',
                  )}>
                    {a.amount < 0 ? '+' : '−'}{importe(Math.abs(a.amount))}
                  </span>
                  <button
                    onClick={() => { haptic([16, 30]); deleteDebtPayment(a.id) }}
                    aria-label={`Eliminar abono de ${formatDate(a.occurredAt)}`}
                    className="press-icon shrink-0 p-1 text-label-tertiary"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}
