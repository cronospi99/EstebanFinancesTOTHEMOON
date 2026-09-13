'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, CreditCard } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { ScrollStrip } from '@/components/ui/scroll-strip'
import { formatMoney, parseKeypad } from '@/lib/format'
import { accountTotal, useAccountsAvailable, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Account } from '@/lib/types'

/**
 * Pagar una tarjeta de crédito.
 *
 * Es una transferencia —el dinero sale de una cuenta y entra a la tarjeta, que
 * la debe menos— pero merecía su propia hoja. En la de transferir la tarjeta
 * era un destino más entre diez, con su saldo en negativo y sin decir cuánto
 * hay que pagar; aquí la pregunta es la que uno se hace de verdad: cuánto debo
 * y con qué lo cubro.
 *
 * No es un gasto. El gasto ocurrió cuando se pasó la tarjeta; pagar el
 * extracto solo mueve el dinero de un sitio a otro, y anotarlo como gasto lo
 * contaría dos veces en el mes.
 */
export function PayCardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, addTransaction, updateAccount } = useFinance()
  const saldos = useAccountsAvailable()

  const [tarjetaId, setTarjetaId] = useState('')
  const [origenId, setOrigenId] = useState('')
  const [monto, setMonto] = useState('')

  const tarjetas = accounts.filter((a) => a.type === 'credit')
  const tarjeta = accounts.find((a) => a.id === tarjetaId)
  // La deuda se guarda en negativo; lo que hay que pagar es su magnitud.
  const debe = tarjeta ? Math.max(-accountTotal(tarjeta), 0) : 0

  // De dónde sale: cualquier cuenta que no sea otra tarjeta —pagar una tarjeta
  // con otra no es pagar, es mover la deuda— y en la misma moneda.
  const origenes = accounts.filter(
    (a) => a.type !== 'credit' && (!tarjeta || a.currency === tarjeta.currency),
  )
  const origen = accounts.find((a) => a.id === origenId)
  const importe = parseKeypad(monto)

  useEffect(() => {
    if (!open) return
    // Con una sola tarjeta no hay nada que elegir: se preselecciona y la hoja
    // arranca en la pregunta que importa.
    setTarjetaId(tarjetas.length === 1 ? tarjetas[0].id : '')
    setOrigenId('')
    setMonto('')
    // Solo al abrir: si dependiera de `tarjetas` se reiniciaría al pagar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const libre = origen ? saldos.get(origen.id)?.libre ?? 0 : 0
  const excede = Boolean(origen) && importe > libre
  const listo = Boolean(tarjeta && origen) && importe > 0
  const moneda = tarjeta?.currency ?? 'COP'

  const chip = (acc: Account, activa: boolean, onPick: () => void, pie: string) => (
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
        <span className="tnum block text-[11px] text-label-tertiary">{pie}</span>
      </span>
    </button>
  )

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-5 text-center text-[17px] font-semibold">Pagar tarjeta</h2>

        {!tarjetas.length ? (
          <div className="py-6 text-center">
            <CreditCard size={22} className="mx-auto mb-2 text-label-tertiary" />
            <p className="text-[15px] font-medium text-label">No tienes tarjetas de crédito</p>
            <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
              Añade una cuenta de tipo Crédito y podrás pagarla desde aquí.
            </p>
          </div>
        ) : (
          <>
            {tarjetas.length > 1 && (
              <>
                <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
                  Qué tarjeta
                </label>
                <ScrollStrip className="mb-4">
                  {tarjetas.map((t) => chip(
                    t, t.id === tarjetaId, () => { setTarjetaId(t.id); setOrigenId('') },
                    `debe ${formatMoney(Math.max(-accountTotal(t), 0), t.currency)}`,
                  ))}
                </ScrollStrip>
              </>
            )}

            {/* Cuánto se debe, arriba y grande: es el dato que se viene a ver. */}
            {tarjeta && (
              <div className="mb-4 rounded-2xl border border-hairline bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-3">
                  <InstitutionBadge institution={tarjeta.institution} color={tarjeta.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-label">{tarjeta.name}</p>
                    <p className="text-[12px] text-label-secondary">Debes ahora</p>
                  </div>
                  <span className={cn(
                    'tnum shrink-0 text-[18px] font-bold',
                    debe > 0 ? 'text-accent-red' : 'text-accent-green',
                  )}>
                    {formatMoney(debe, moneda)}
                  </span>
                </div>
                {tarjeta.installments ? (
                  <p className="tnum mt-2 border-t border-hairline pt-2 text-[12px] text-label-tertiary">
                    Cuota {(tarjeta.installmentsPaid ?? 0) + 1} de {tarjeta.installments} ·
                    {' '}{formatMoney(Math.round(debe / Math.max(tarjeta.installments - (tarjeta.installmentsPaid ?? 0), 1)), moneda)} aprox.
                  </p>
                ) : null}
              </div>
            )}

            <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              Con qué la pagas
            </label>
            {!origenes.length ? (
              <p className="mb-3 px-1 text-[12px] leading-relaxed text-label-tertiary">
                No hay ninguna cuenta en {moneda} desde la que pagar. Pagar una tarjeta
                con otra no la paga: solo mueve la deuda de sitio.
              </p>
            ) : (
              <ScrollStrip className="mb-4">
                {origenes.map((a) => chip(
                  a, a.id === origenId, () => setOrigenId(a.id),
                  formatMoney(accountTotal(a), a.currency),
                ))}
              </ScrollStrip>
            )}

            <div className="mb-3 flex justify-center">
              <ArrowDown size={18} className="text-label-tertiary" />
            </div>

            <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              Cuánto abonas
            </label>
            <MoneyInput
              value={monto} onChange={setMonto} currency={moneda}
              placeholder="0" className="mb-2"
            />

            {/* Pagar el total es lo que se hace la mayoría de las veces, y
                teclear siete dígitos exactos para eso es trabajo de más. */}
            {debe > 0 && (
              <div className="mb-2 flex gap-2">
                <button
                  onClick={() => { haptic(6); setMonto(String(Math.round(debe))) }}
                  className="press flex-1 rounded-xl border border-hairline bg-white/[0.04] py-2 text-[13px] font-medium text-accent-blue"
                >
                  Pagar todo · {formatMoney(Math.round(debe), moneda)}
                </button>
                {tarjeta?.installments ? (
                  <button
                    onClick={() => {
                      haptic(6)
                      const faltan = Math.max(tarjeta.installments! - (tarjeta.installmentsPaid ?? 0), 1)
                      setMonto(String(Math.round(debe / faltan)))
                    }}
                    className="press flex-1 rounded-xl border border-hairline bg-white/[0.04] py-2 text-[13px] font-medium text-accent-blue"
                  >
                    Una cuota
                  </button>
                ) : null}
              </div>
            )}

            {excede && (
              <p className="mb-2 px-1 text-[12px] text-accent-orange">
                {origen!.name} tiene {formatMoney(libre, origen!.currency)} sin apartar.
                Puedes pagar igual; el saldo quedará por debajo de lo comprometido.
              </p>
            )}
            {importe > debe && debe > 0 && (
              <p className="mb-2 px-1 text-[12px] text-label-tertiary">
                Estás abonando más de lo que debes: la tarjeta quedará a favor.
              </p>
            )}

            <button
              onClick={() => {
                if (!listo || !tarjeta || !origen) return
                haptic([14, 40, 22])
                /*
                 * Una transferencia, no un gasto. El gasto ocurrió al pasar la
                 * tarjeta; pagar el extracto solo mueve el dinero, y anotarlo
                 * como gasto lo contaría dos veces en el mes. Al entrar en la
                 * tarjeta, su saldo negativo sube hacia cero: se debe menos.
                 */
                addTransaction({
                  accountId: origen.id,
                  toAccountId: tarjeta.id,
                  categoryId: 'transfer',
                  amount: importe,
                  type: 'transfer',
                  description: `Pago ${tarjeta.name}`,
                  occurredAt: new Date().toISOString(),
                  currency: tarjeta.currency,
                })
                // Con cuotas pactadas, pagar avanza el contador. Solo si el
                // abono cubre al menos una cuota: un abono suelto de veinte mil
                // no es una cuota y marcarla mentiría sobre lo que falta.
                if (tarjeta.installments) {
                  const faltan = Math.max(tarjeta.installments - (tarjeta.installmentsPaid ?? 0), 1)
                  if (importe >= debe / faltan * 0.95) {
                    updateAccount(tarjeta.id, {
                      installmentsPaid: Math.min((tarjeta.installmentsPaid ?? 0) + 1, tarjeta.installments),
                    })
                  }
                }
                onClose()
              }}
              disabled={!listo}
              className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                         shadow-glow disabled:bg-white/[0.06] disabled:text-label-tertiary disabled:shadow-none"
            >
              Pagar{importe > 0 ? ` ${formatMoney(importe, moneda)}` : ''}
            </button>
            <p className="mt-2 px-1 text-center text-[12px] leading-relaxed text-label-tertiary">
              No cuenta como gasto: el gasto fue cuando pasaste la tarjeta.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
