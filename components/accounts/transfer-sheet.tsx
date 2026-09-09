'use client'

import { useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { formatMoney, parseKeypad } from '@/lib/format'
import { accountTotal, useAccountsAvailable, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Account } from '@/lib/types'

/**
 * Mover dinero de una cuenta a otra.
 *
 * Faltaba, y se notaba: pasar de Bancolombia a Nequi había que registrarlo
 * como un gasto y un ingreso, con lo que el mes salía con un gasto que no lo
 * era y un ingreso que tampoco. Aquí es un solo movimiento con dos puntas,
 * de tipo `transfer`, que no cuenta ni como gasto ni como ingreso.
 */
export function TransferSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, addTransaction } = useFinance()
  const saldos = useAccountsAvailable()

  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')

  const origen = accounts.find((a) => a.id === origenId)
  const destino = accounts.find((a) => a.id === destinoId)
  const importe = parseKeypad(monto)

  // Entre monedas distintas haría falta fijar a qué tasa se convirtió, y esa
  // decisión no cabe en esta hoja. Se ofrecen solo las de la misma moneda.
  const destinos = accounts.filter((a) => a.id !== origenId && (!origen || a.currency === origen.currency))
  const libre = origen ? saldos.get(origen.id)?.libre ?? 0 : 0
  const excede = Boolean(origen) && importe > libre
  const listo = Boolean(origen && destino) && importe > 0

  const cerrar = () => { setMonto(''); setNota(''); onClose() }

  const fila = (acc: Account, activa: boolean, onPick: () => void) => (
    <button
      key={acc.id}
      onClick={() => { haptic(6); onPick() }}
      className={cn(
        'press flex shrink-0 items-center gap-2 rounded-xl border py-2 pl-2 pr-3 text-left transition-colors',
        activa ? 'border-transparent bg-white/[0.14]' : 'border-hairline',
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
        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
          {accounts.map((a) => fila(a, a.id === origenId, () => {
            setOrigenId(a.id)
            // Cambiar de origen puede dejar el destino en otra moneda, o en la
            // misma cuenta. Se limpia en vez de quedarse en un estado inválido.
            if (a.id === destinoId) setDestinoId('')
          }))}
        </div>

        <div className="mb-3 flex justify-center">
          <ArrowDown size={18} className="text-label-tertiary" />
        </div>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Hacia
        </label>
        {origen && !destinos.length ? (
          <p className="mb-3 px-1 text-[12px] leading-relaxed text-label-tertiary">
            No hay otra cuenta en {origen.currency}. Una transferencia entre monedas
            necesitaría fijar a qué tasa se convirtió.
          </p>
        ) : (
          <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
            {(origen ? destinos : accounts).map((a) => fila(a, a.id === destinoId, () => setDestinoId(a.id)))}
          </div>
        )}

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Cuánto
        </label>
        <MoneyInput
          value={monto} onChange={setMonto}
          currency={origen?.currency ?? 'COP'} placeholder="100.000" className="mb-2"
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
          className="mb-5 w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3 text-[16px]
                     text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />

        <button
          onClick={() => {
            if (!listo || !origen || !destino) return
            haptic([14, 40, 22])
            addTransaction({
              accountId: origen.id,
              toAccountId: destino.id,
              categoryId: 'transfer',
              amount: importe,
              type: 'transfer',
              description: nota.trim() || `${origen.name} → ${destino.name}`,
              occurredAt: new Date().toISOString(),
              currency: origen.currency,
            })
            cerrar()
          }}
          disabled={!listo}
          className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                     shadow-glow disabled:bg-white/[0.06] disabled:text-label-tertiary disabled:shadow-none"
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
