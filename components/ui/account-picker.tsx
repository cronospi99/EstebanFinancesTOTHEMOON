'use client'

import { useMemo, useState } from 'react'
import { InstitutionBadge } from './institution-badge'
import { ScrollStrip } from './scroll-strip'
import { accountTotal, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Account } from '@/lib/types'

/**
 * ¿Se puede gastar desde esta cuenta?
 *
 * Con saldo positivo, sí. Una tarjeta de crédito casi nunca lo tiene —su saldo
 * es lo que se debe— y sin embargo es de donde más se gasta: lo que decide ahí
 * es el cupo que queda. Sin cupo declarado se deja pasar, porque no saber no
 * es lo mismo que no poder.
 */
function puedeGastar(a: Account): boolean {
  if (a.type === 'credit') {
    if (!a.creditLimit) return true
    return a.creditLimit - Math.abs(Math.min(a.balance, 0)) > 0
  }
  return accountTotal(a) > 0
}

/**
 * Medio de pago: la cuenta y, dentro de ella, el bolsillo.
 *
 * Elegir cuenta limpia el bolsillo en la misma llamada. El bolsillo pertenece
 * a su cuenta, así que arrastrarlo a otra dejaría el movimiento apuntando a un
 * bolsillo inexistente y el saldo se descuadraría en silencio.
 */
export function AccountPicker({
  accountId, pocketId, onChange, soloConSaldo = false,
}: {
  accountId: string
  pocketId?: string
  onChange: (accountId: string, pocketId?: string) => void
  /**
   * Esconde las cuentas de las que no se puede gastar.
   *
   * Al registrar un gasto, ofrecer las cuentas vacías es ruido: son las que
   * nunca se eligen y empujan a la derecha a las que sí. En un ingreso no
   * aplica —el dinero puede entrar en una cuenta a cero, que es justo cuando
   * más falta hace registrarlo— así que lo decide quien llama.
   */
  soloConSaldo?: boolean
}) {
  const { accounts } = useFinance()
  const [verTodas, setVerTodas] = useState(false)

  const visibles = useMemo(() => {
    if (!soloConSaldo || verTodas) return accounts
    // La seleccionada nunca se esconde: quitarla de debajo dejaría el
    // formulario apuntando a una cuenta que no se ve.
    const conSaldo = accounts.filter((a) => a.id === accountId || puedeGastar(a))
    // Y si ninguna tiene saldo, se enseñan todas: quedarse sin opciones es
    // peor que enseñar una cuenta vacía.
    return conSaldo.length ? conSaldo : accounts
  }, [accounts, accountId, soloConSaldo, verTodas])

  const escondidas = accounts.length - visibles.length
  const cuenta = accounts.find((a) => a.id === accountId)
  const bolsillos = cuenta?.pockets ?? []

  return (
    <>
      <ScrollStrip className="mb-2">
        {visibles.map((acc) => {
          const activa = acc.id === accountId
          return (
            <button
              key={acc.id}
              onClick={() => { haptic(6); onChange(acc.id, undefined) }}
              className={cn(
                'press flex shrink-0 items-center gap-2 rounded-pill border py-1 pl-1 pr-3 text-[12px] font-medium transition-colors',
                activa ? 'border-transparent bg-fill-4 text-label' : 'border-hairline text-label-secondary',
              )}
            >
              <InstitutionBadge institution={acc.institution} color={acc.color} size="xs" />
              {acc.name}
              {acc.currency === 'USD' && <span className="text-[10px] text-label-tertiary">USD</span>}
            </button>
          )
        })}
        {/* Nada queda inalcanzable: si se escondió alguna, se puede pedir. */}
        {escondidas > 0 && (
          <button
            onClick={() => { haptic(6); setVerTodas(true) }}
            className="press shrink-0 rounded-pill border border-dashed border-hairline px-3 py-1 text-[12px] font-medium text-label-tertiary"
          >
            Ver {escondidas} más
          </button>
        )}
      </ScrollStrip>

      {bolsillos.length > 0 && (
        <ScrollStrip className="mb-3">
          <button
            onClick={() => { haptic(6); onChange(accountId, undefined) }}
            className={cn(
              'press shrink-0 rounded-pill border px-3 py-1 text-[12px] font-medium transition-colors',
              !pocketId ? 'border-transparent bg-fill-4 text-label' : 'border-hairline text-label-secondary',
            )}
          >
            General
          </button>
          {bolsillos.map((p) => (
            <button
              key={p.id}
              onClick={() => { haptic(6); onChange(accountId, p.id) }}
              className={cn(
                'press flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1 text-[12px] font-medium transition-colors',
                pocketId === p.id ? 'border-transparent bg-fill-4 text-label' : 'border-hairline text-label-secondary',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color ?? '#98989F' }} />
              {p.name}
            </button>
          ))}
        </ScrollStrip>
      )}
    </>
  )
}
