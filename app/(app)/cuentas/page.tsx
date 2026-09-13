'use client'

import { useState } from 'react'
import { ArrowLeftRight, CreditCard, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { AddAccountSheet } from '@/components/accounts/add-account-sheet'
import { DebtsSection } from '@/components/debts/debts-section'
import { AccountDetailSheet } from '@/components/accounts/account-detail-sheet'
import { TransferSheet } from '@/components/accounts/transfer-sheet'
import { PayCardSheet } from '@/components/accounts/pay-card-sheet'
import { CO_INSTITUTIONS } from '@/lib/categories'
import { formatMoney, formatPercent } from '@/lib/format'
import { accountTotal, useAccountsAvailable, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Account, AccountType } from '@/lib/types'

const TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Corriente', savings: 'Ahorros', credit: 'Crédito',
  cash: 'Efectivo', investment: 'Inversión',
}

/**
 * Cuentas, en su propia sección.
 *
 * Vivía como pestaña dentro de Gastos, que es donde nadie la busca: una
 * cuenta no es un gasto, y llegar a ella pedía dos toques y saber que estaba
 * escondida ahí. Ahora tiene su sitio en la barra y en la lateral.
 */
export default function AccountsPage() {
  const { accounts, fxRate } = useFinance()
  const saldos = useAccountsAvailable()
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [pagarOpen, setPagarOpen] = useState(false)
  const [detail, setDetail] = useState<Account | null>(null)

  // Las de inversión se gestionan en su propia pestaña: aquí solo el dinero
  // disponible del día a día.
  const delDia = accounts.filter((a) => a.type !== 'investment')
  const hayTarjetas = accounts.some((a) => a.type === 'credit')

  return (
    <div className="space-y-5 px-5">
      <PageHeader title="Cuentas" subtitle="Dónde está tu dinero" />

      {!delDia.length ? (
        <Card className="p-8 text-center">
          <p className="text-[15px] font-medium text-label">Aún no tienes cuentas</p>
          <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
            Crea la primera para poder registrar movimientos.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-hairline overflow-hidden">
          {delDia.map((acc) => {
            const total = accountTotal(acc)
            const pockets = acc.pockets?.length ?? 0
            const apartado = saldos.get(acc.id)?.apartado ?? 0
            return (
              <button
                key={acc.id}
                onClick={() => { haptic(6); setDetail(acc) }}
                className="press-soft flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/[0.04]"
              >
                <InstitutionBadge institution={acc.institution} color={acc.color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-medium text-label">{acc.name}</span>
                    {acc.currency === 'USD' && (
                      <span className="shrink-0 rounded bg-white/[0.09] px-1 py-px text-[9px] font-bold text-label-secondary">USD</span>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-label-tertiary">
                    {TYPE_LABEL[acc.type]}
                    {pockets > 0 && ` · ${pockets} bolsillo${pockets > 1 ? 's' : ''}`}
                    {acc.apy ? ` · ${formatPercent(acc.apy, false, 1)} E.A.` : ''}
                    {acc.type === 'credit' && acc.creditLimit
                      ? ` · ${formatMoney(Math.max(acc.creditLimit - Math.abs(Math.min(acc.balance, 0)), 0), acc.currency)} libre`
                      : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn('tnum text-[15px] font-semibold', total < 0 ? 'text-accent-red' : 'text-label')}>
                    {formatMoney(total, acc.currency)}
                  </div>
                  {/* El apartado en presupuestos no baja el saldo, así que sin
                      esta línea el número de arriba se lee como gastable. */}
                  {apartado > 0 && (
                    <div className="tnum text-[11px] text-label-tertiary">
                      {formatMoney(total - apartado, acc.currency)} libre
                    </div>
                  )}
                  {acc.currency === 'USD' && (
                    <div className="tnum text-[11px] text-label-tertiary">≈ {formatMoney(total * fxRate)}</div>
                  )}
                </div>
              </button>
            )
          })}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { haptic(6); setTransferOpen(true) }}
          disabled={delDia.length < 2}
          className="press flex items-center justify-center gap-2 rounded-2xl border border-hairline
                     bg-white/[0.04] py-3.5 text-[15px] font-medium text-accent-blue
                     disabled:text-label-tertiary"
        >
          <ArrowLeftRight size={17} />
          Transferir
        </button>
        <button
          onClick={() => { haptic(6); setAddAccountOpen(true) }}
          className="press flex items-center justify-center gap-2 rounded-2xl border border-hairline
                     bg-white/[0.04] py-3.5 text-[15px] font-medium text-accent-blue"
        >
          <Plus size={17} />
          Añadir
        </button>
        {/* A todo lo ancho y solo cuando hay tarjeta: es la acción del mes para
            quien la tiene, y un botón muerto para quien no. */}
        {hayTarjetas && (
          <button
            onClick={() => { haptic(6); setPagarOpen(true) }}
            className="press col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-hairline
                       bg-white/[0.04] py-3.5 text-[15px] font-medium text-accent-blue"
          >
            <CreditCard size={17} />
            Pagar tarjeta
          </button>
        )}
      </div>

      {/* Las deudas van tras las cuentas y antes del catálogo: son la otra
          mitad de "dónde está tu dinero" —el que ya no es tuyo— y quien entra
          aquí a mirar saldos quiere verlas en la misma pantalla. */}
      <DebtsSection />

      <section>
        <CardHeader title="Instituciones soportadas" />
        <div className="flex flex-wrap gap-2">
          {CO_INSTITUTIONS.map((inst) => (
            <span
              key={inst.name}
              className="flex items-center gap-2 rounded-pill border border-hairline py-1 pl-1 pr-3 text-[12px] text-label-secondary"
            >
              <InstitutionBadge institution={inst.name} size="xs" />
              {inst.name}
            </span>
          ))}
        </div>
      </section>

      <AddAccountSheet open={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
      <TransferSheet open={transferOpen} onClose={() => setTransferOpen(false)} />
      <PayCardSheet open={pagarOpen} onClose={() => setPagarOpen(false)} />
      <AccountDetailSheet account={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
