'use client'

import { useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { ScrollStrip } from '@/components/ui/scroll-strip'
import { formatMoney, parseKeypad } from '@/lib/format'
import { accountTotal, useAccountsAvailable, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Account } from '@/lib/types'

/** Destino especial: el efectivo cuando todavía no hay una cuenta para él. */
const EFECTIVO = '__efectivo'

/**
 * Mover dinero de una cuenta a otra, o al bolsillo del pantalón.
 *
 * Faltaba, y se notaba: pasar de Bancolombia a Nequi había que registrarlo
 * como un gasto y un ingreso, con lo que el mes salía con un gasto que no lo
 * era y un ingreso que tampoco. Aquí es un solo movimiento con dos puntas,
 * de tipo `transfer`, que no cuenta ni como gasto ni como ingreso.
 */
export function TransferSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, addTransaction, asegurarEfectivo } = useFinance()
  const saldos = useAccountsAvailable()

  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')

  const origen = accounts.find((a) => a.id === origenId)
  const destino = accounts.find((a) => a.id === destinoId)
  const importe = parseKeypad(monto)
  const moneda = origen?.currency ?? 'COP'

  // Entre monedas distintas haría falta fijar a qué tasa se convirtió, y esa
  // decisión no cabe en esta hoja. Se ofrecen solo las de la misma moneda.
  const destinos = accounts.filter((a) => a.id !== origenId && (!origen || a.currency === origen.currency))
  /*
   * Sacar plata del cajero es de lo más corriente que hay, y sin una cuenta de
   * efectivo creada a mano no había a dónde mandarla: la transferencia se
   * quedaba sin destino y el retiro terminaba anotado como un gasto, que no lo
   * es. Se ofrece el efectivo siempre; la cuenta nace sola al confirmar.
   */
  // Entre todas y no solo entre los destinos: si la cuenta de origen ES la de
  // efectivo, buscarlo entre los destinos no lo encuentra y se ofrecería crear
  // una que ya existe — una transferencia de la cuenta a sí misma.
  const hayEfectivo = accounts.some((a) => a.type === 'cash' && a.currency === moneda)
  const aEfectivoNuevo = destinoId === EFECTIVO
  const libre = origen ? saldos.get(origen.id)?.libre ?? 0 : 0
  const excede = Boolean(origen) && importe > libre
  const listo = Boolean(origen) && (Boolean(destino) || aEfectivoNuevo) && importe > 0

  const cerrar = () => { setMonto(''); setNota(''); onClose() }

  const fila = (acc: Account, activa: boolean, onPick: () => void) => (
    <button
      key={acc.id}
      onClick={() => { haptic(6); onPick() }}
      className={cn(
        'press flex shrink-0 items-center gap-2 rounded-xl border py-2 pl-2 pr-3 text-left transition-colors',
        activa ? 'border-transparent bg-fill-4' : 'border-hairline',
      )}
    >
      <InstitutionBadge institution={acc.institution} color={acc.color} size="xs" />
      <span>
        <span className="block text-[13px] font-medium text-label">{acc.name}</span>
        <span className="tnum block text-[11px] text-label-tertiary">
          {formatMoney(accountTotal(acc), acc.currency)}
        </span>
      </span>
    </button>
  )

  return (
    <Sheet open={open} onClose={cerrar}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-5 text-center text-[17px] font-semibold">Transferir</h2>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Desde
        </label>
        <ScrollStrip className="mb-3">
          {accounts.map((a) => fila(a, a.id === origenId, () => {
            setOrigenId(a.id)
            // Cambiar de origen puede dejar el destino en otra moneda, o en la
            // misma cuenta. Se limpia en vez de quedarse en un estado inválido.
            if (a.id === destinoId) setDestinoId('')
          }))}
        </ScrollStrip>

        <div className="mb-3 flex justify-center">
          <ArrowDown size={18} className="text-label-tertiary" />
        </div>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Hacia
        </label>
        {origen && !destinos.length && hayEfectivo ? (
          <p className="mb-3 px-1 text-[12px] leading-relaxed text-label-tertiary">
            No hay otra cuenta en {origen.currency}. Una transferencia entre monedas
            necesitaría fijar a qué tasa se convirtió.
          </p>
        ) : (
          <ScrollStrip className="mb-4">
            {/* Delante de las cuentas: sin cuenta de efectivo creada, esta es la
                única forma de anotar un retiro, y al final de la tira se queda
                fuera de pantalla y no la encuentra nadie. */}
            {!hayEfectivo && (
              <button
                onClick={() => { haptic(6); setDestinoId(EFECTIVO) }}
                className={cn(
                  'press flex shrink-0 items-center gap-2 rounded-xl border py-2 pl-2 pr-3 text-left transition-colors',
                  aEfectivoNuevo ? 'border-transparent bg-fill-4' : 'border-hairline',
                )}
              >
                <InstitutionBadge institution="Efectivo" size="xs" />
                <span>
                  <span className="block text-[13px] font-medium text-label">
                    {moneda === 'USD' ? 'Efectivo USD' : 'Efectivo'}
                  </span>
                  <span className="block text-[11px] text-label-tertiary">se crea la cuenta</span>
                </span>
              </button>
            )}
            {(origen ? destinos : accounts).map((a) => fila(a, a.id === destinoId, () => setDestinoId(a.id)))}
          </ScrollStrip>
        )}

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Cuánto
        </label>
        <MoneyInput
          value={monto} onChange={setMonto}
          currency={moneda} placeholder="100.000" className="mb-2"
        />
        {excede && (
          <p className="mb-2 px-1 text-[12px] text-accent-orange">
            {origen!.name} tiene {formatMoney(libre, origen!.currency)} sin apartar.
            Puedes transferirlo igual; el saldo quedará por debajo de lo comprometido.
          </p>
        )}

        <input
          value={nota} onChange={(e) => setNota(e.target.value)}
          placeholder="Nota (opcional)"
          className="mb-5 w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-[16px]
                     text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />

        <button
          onClick={async () => {
            if (!listo || !origen) return
            haptic([14, 40, 22])
            // La cuenta de efectivo se crea aquí y no al tocar el chip: tocarlo
            // es mirar una opción, no decidir, y una cuenta creada por mirar se
            // queda para siempre si el usuario cierra la hoja.
            const destinoFinal = aEfectivoNuevo ? await asegurarEfectivo(origen.currency) : destino!.id
            const nombreDestino = aEfectivoNuevo
              ? (origen.currency === 'USD' ? 'Efectivo USD' : 'Efectivo')
              : destino!.name
            addTransaction({
              accountId: origen.id,
              toAccountId: destinoFinal,
              categoryId: 'transfer',
              amount: importe,
              type: 'transfer',
              description: nota.trim() || `${origen.name} → ${nombreDestino}`,
              occurredAt: new Date().toISOString(),
              currency: origen.currency,
            })
            cerrar()
          }}
          disabled={!listo}
          className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                     shadow-glow disabled:bg-fill-2 disabled:text-label-tertiary disabled:shadow-none"
        >
          Transferir{importe > 0 && origen ? ` ${formatMoney(importe, origen.currency)}` : ''}
        </button>
        <p className="mt-2 px-1 text-center text-[12px] leading-relaxed text-label-tertiary">
          No cuenta como gasto ni como ingreso: el dinero solo cambia de sitio.
        </p>
      </div>
    </Sheet>
  )
}
