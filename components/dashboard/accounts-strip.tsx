'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CardHeader } from '@/components/ui/card'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { AccountDetailSheet } from '@/components/accounts/account-detail-sheet'
import { formatMoney } from '@/lib/format'
import { useAccountsAvailable, useFinance } from '@/lib/store'
import { useDragScroll } from '@/lib/use-drag-scroll'
import { cn, haptic } from '@/lib/utils'
import type { Account, AccountType } from '@/lib/types'

const TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Corriente',
  savings: 'Ahorros',
  credit: 'Crédito',
  cash: 'Efectivo',
  investment: 'Inversión',
}

/**
 * Tira horizontal estilo Apple Wallet: las tarjetas se deslizan y cada una
 * lleva el color de su banco como firma visual.
 *
 * En escritorio se arrastra con el ratón y aparecen flechas: con `overflow-x`
 * a secas, un ratón sin trackpad no tenía forma de mover la tira ni de saber
 * que había más cuentas a la derecha.
 */
export function AccountsStrip() {
  const { accounts } = useFinance()
  const saldos = useAccountsAvailable()
  // El sheet vive aquí para que tocar una tarjeta funcione igual en el
  // resumen que en la pestaña de cuentas.
  const [detalle, setDetalle] = useState<Account | null>(null)
  const tira = useDragScroll<HTMLDivElement>()

  return (
    <section>
      <CardHeader
        title="Cuentas"
        action={
          // Solo en escritorio: en el móvil el dedo ya hace este trabajo y dos
          // botones ahí serían dos objetivos que estorban.
          <span className="hidden items-center gap-1 lg:flex">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => tira.desplazar(dir)}
                disabled={dir === -1 ? !tira.puedeIzq : !tira.puedeDer}
                aria-label={dir === -1 ? 'Ver cuentas anteriores' : 'Ver más cuentas'}
                className="press flex h-7 w-7 items-center justify-center rounded-full border border-hairline
                           text-label-secondary transition-opacity disabled:opacity-25"
              >
                {dir === -1 ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
              </button>
            ))}
          </span>
        }
      />
      {/* El sangrado negativo lleva la tira hasta los bordes de la pantalla en
          móvil. En escritorio la tarjeta vive dentro de una columna, y ese
          mismo sangrado la metía por debajo de la columna vecina. */}
      <div
        ref={tira.ref}
        onPointerDown={tira.onPointerDown}
        className={cn(
          '-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 no-scrollbar lg:mx-0 lg:px-0',
          // Mientras se arrastra, el snap pelea con el scroll manual y la tira
          // da tirones; y el cursor tiene que decir que esto se agarra.
          tira.arrastrando && 'snap-none [&_*]:pointer-events-none',
          'lg:cursor-grab lg:active:cursor-grabbing',
        )}
      >
        {accounts.map((acc, i) => {
          const saldo = saldos.get(acc.id)
          const apartado = saldo?.apartado ?? 0
          return (
            <motion.button
              key={acc.id}
              // Un arrastre termina en click; sin esto, mover la tira abría la
              // cuenta que quedara debajo del ratón al soltar.
              onClick={() => { if (tira.arrastrando) return; haptic(6); setDetalle(acc) }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="glass press-soft relative w-[164px] shrink-0 snap-start overflow-hidden rounded-card p-4 text-left"
            >
              {/* Lavado de color de la marca en la esquina */}
              <div
                aria-hidden
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl"
                style={{ backgroundColor: acc.color }}
              />
              <div className="relative">
                <InstitutionBadge institution={acc.institution} color={acc.color} size="sm" className="mb-3" />
                <div className="truncate text-[13px] font-semibold text-label">{acc.name}</div>
                <div className="mb-2.5 text-[11px] text-label-tertiary">{TYPE_LABEL[acc.type]}</div>
                <div
                  className={cn(
                    'tnum text-[16px] font-bold',
                    acc.balance < 0 ? 'text-accent-red' : 'text-label',
                  )}
                >
                  {formatMoney(acc.balance)}
                </div>
                {/* El saldo del banco manda y no se toca. Debajo, cuánto de él
                    está libre — solo si hay algo apartado, para no añadir una
                    línea que diga lo mismo dos veces. */}
                {apartado > 0 && (
                  <div className="tnum mt-0.5 text-[11px] text-label-tertiary">
                    {formatMoney(saldo!.libre)} libre
                  </div>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>

      <AccountDetailSheet account={detalle} onClose={() => setDetalle(null)} />
    </section>
  )
}
