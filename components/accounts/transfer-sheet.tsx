'use client'

import { useEffect, useRef, useState } from 'react'
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

/** El bolsillo elegido dentro de una cuenta, si se eligió uno. */
const bolsilloDe = (a: Account | undefined, pocketId: string | undefined) =>
  a && pocketId ? (a.pockets ?? []).find((p) => p.id === pocketId) : undefined

/** Cómo se llama un lado dentro de su propia cuenta. */
const etiquetaLado = (a: Account, pocketId?: string) =>
  bolsilloDe(a, pocketId)?.name ?? 'Saldo general'

/** Cómo se llama un lado visto desde fuera: la cuenta y, si lo hay, el bolsillo. */
const nombreLado = (a: Account, pocketId?: string) => {
  const p = bolsilloDe(a, pocketId)
  return p ? `${a.name} · ${p.name}` : a.name
}

const FICHA = 'press flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1 text-[12px] font-medium transition-colors'

/**
 * Mover dinero de una cuenta a otra, entre bolsillos de la misma cuenta, o al
 * bolsillo del pantalón.
 *
 * Faltaba, y se notaba: pasar de Bancolombia a Nequi había que registrarlo
 * como un gasto y un ingreso, con lo que el mes salía con un gasto que no lo
 * era y un ingreso que tampoco. Aquí es un solo movimiento con dos puntas,
 * de tipo `transfer`, que no cuenta ni como gasto ni como ingreso.
 *
 * Las dos puntas pueden caer en la misma cuenta. Un bolsillo es dinero
 * apartado de verdad —tiene su saldo y a veces su propio rendimiento— así que
 * pasar de «vacaciones» al saldo general mueve plata aunque el total de la
 * cuenta no cambie. Hacerlo editando los dos saldos a mano era la única
 * salida, y se descuadra la cuenta en cuanto se olvida el segundo.
 */
export function TransferSheet({
  open, onClose, cuentaInicial,
}: {
  open: boolean
  onClose: () => void
  /**
   * Cuenta con la que abrir la hoja, en los dos lados.
   *
   * Es la entrada desde el detalle de la cuenta: quien llega por ahí ya
   * decidió la cuenta y lo que le falta es decir de qué bolsillo a cuál.
   */
  cuentaInicial?: string
}) {
  const { accounts, addTransaction, asegurarEfectivo } = useFinance()
  const saldos = useAccountsAvailable()

  const [origenId, setOrigenId] = useState('')
  const [origenPocket, setOrigenPocket] = useState<string | undefined>()
  const [destinoId, setDestinoId] = useState('')
  const [destinoPocket, setDestinoPocket] = useState<string | undefined>()
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')

  // Espejo de las cuentas para el efecto de apertura: leerlas de la clausura
  // obligaría a ponerlas en las dependencias, y entonces cualquier cambio de
  // saldo —el de otra pestaña, el de la sincronización— rehacía la selección
  // debajo del dedo.
  const cuentasRef = useRef(accounts)
  cuentasRef.current = accounts

  /*
   * Abrir desde una cuenta concreta deja los dos lados puestos en ella, con el
   * primer bolsillo como origen y el saldo general como destino: es el
   * traspaso que más se hace —sacar de lo apartado para poder gastarlo— y así
   * solo queda teclear cuánto.
   */
  useEffect(() => {
    if (!open || !cuentaInicial) return
    const acc = cuentasRef.current.find((a) => a.id === cuentaInicial)
    if (!acc) return
    setOrigenId(acc.id)
    setOrigenPocket(acc.pockets?.[0]?.id)
    setDestinoId(acc.id)
    setDestinoPocket(undefined)
  }, [open, cuentaInicial])

  const origen = accounts.find((a) => a.id === origenId)
  const destino = accounts.find((a) => a.id === destinoId)
  const importe = parseKeypad(monto)
  const moneda = origen?.currency ?? 'COP'

  const bolsillosOrigen = origen?.pockets ?? []
  const bolsillosDestino = destino?.pockets ?? []

  /*
   * Una cuenta puede ser su propio destino, pero solo si tiene bolsillos: sin
   * ellos no habría dos sitios entre los que mover y el movimiento no movería
   * nada. La base de datos lo comprueba igual —ver la migración de bolsillos
   * en la misma cuenta—, pero ofrecerlo y que falle al confirmar no es una
   * opción.
   */
  const puedeConsigoMisma = bolsillosOrigen.length > 0

  // Entre monedas distintas haría falta fijar a qué tasa se convirtió, y esa
  // decisión no cabe en esta hoja. Se ofrecen solo las de la misma moneda.
  const destinos = accounts.filter(
    (a) => (!origen || a.currency === origen.currency) && (a.id !== origenId || puedeConsigoMisma),
  )
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

  const mismaCuenta = Boolean(origen) && destinoId === origenId
  // Mismo sitio a los dos lados: el botón no puede confirmarlo, porque no
  // movería nada. Se dice en vez de dejar el botón apagado sin motivo visible.
  const mismoLado = mismaCuenta && (origenPocket ?? '') === (destinoPocket ?? '')

  /*
   * Lo que hay en el lado elegido, no en la cuenta entera.
   *
   * El saldo de un bolsillo no sale del general ni al contrario, así que
   * avisar con el total de la cuenta callaba justo el caso que importa: vaciar
   * el bolsillo de las vacaciones porque la cifra de arriba daba de sobra. Sin
   * bolsillos las dos cuentas son la misma —el total ES el saldo general— y el
   * aviso se comporta como antes: lo apartado en presupuestos no está libre.
   */
  const apartado = origen ? saldos.get(origen.id)?.apartado ?? 0 : 0
  const bolsilloOrigen = bolsilloDe(origen, origenPocket)
  const libre = !origen ? 0 : bolsilloOrigen ? bolsilloOrigen.balance : origen.balance - apartado

  const excede = Boolean(origen) && importe > libre
  const listo = Boolean(origen) && (Boolean(destino) || aEfectivoNuevo) && importe > 0 && !mismoLado

  const cerrar = () => { setMonto(''); setNota(''); onClose() }

  /** Deja el destino en un estado válido para el origen que se acaba de elegir. */
  const elegirOrigen = (a: Account) => {
    setOrigenId(a.id)
    // El bolsillo pertenece a su cuenta: arrastrarlo a otra dejaría el
    // movimiento apuntando a un bolsillo que no existe ahí.
    setOrigenPocket(undefined)

    const dest = accounts.find((x) => x.id === destinoId)
    const sigueValido = destinoId === EFECTIVO
      || (dest && dest.currency === a.currency && (dest.id !== a.id || (a.pockets?.length ?? 0) > 0))
    if (!sigueValido) { setDestinoId(''); setDestinoPocket(undefined) }
  }

  const fila = (acc: Account, activa: boolean, onPick: () => void, pie?: string) => (
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
          {pie ?? formatMoney(accountTotal(acc), acc.currency)}
        </span>
      </span>
    </button>
  )

  /** Los sitios de una cuenta: el saldo general y cada uno de sus bolsillos. */
  const tiraBolsillos = (
    acc: Account,
    elegido: string | undefined,
    onPick: (pocketId: string | undefined) => void,
  ) => (
    <ScrollStrip className="mb-3">
      <button
        onClick={() => { haptic(6); onPick(undefined) }}
        className={cn(FICHA, !elegido ? 'border-transparent bg-fill-4 text-label' : 'border-hairline text-label-secondary')}
      >
        Saldo general
        <span className="tnum text-[11px] text-label-tertiary">{formatMoney(acc.balance, acc.currency)}</span>
      </button>
      {(acc.pockets ?? []).map((p) => (
        <button
          key={p.id}
          onClick={() => { haptic(6); onPick(p.id) }}
          className={cn(FICHA, elegido === p.id ? 'border-transparent bg-fill-4 text-label' : 'border-hairline text-label-secondary')}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color ?? '#98989F' }} />
          {p.name}
          <span className="tnum text-[11px] text-label-tertiary">{formatMoney(p.balance, acc.currency)}</span>
        </button>
      ))}
    </ScrollStrip>
  )

  return (
    <Sheet open={open} onClose={cerrar}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-5 text-center text-[17px] font-semibold">
          {mismaCuenta ? 'Mover entre bolsillos' : 'Transferir'}
        </h2>

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Desde
        </label>
        <ScrollStrip className="mb-3">
          {accounts.map((a) => fila(a, a.id === origenId, () => elegirOrigen(a)))}
        </ScrollStrip>
        {origen && bolsillosOrigen.length > 0 && tiraBolsillos(origen, origenPocket, setOrigenPocket)}

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
          <ScrollStrip className="mb-3">
            {/* Delante de las cuentas: sin cuenta de efectivo creada, esta es la
                única forma de anotar un retiro, y al final de la tira se queda
                fuera de pantalla y no la encuentra nadie. */}
            {!hayEfectivo && (
              <button
                onClick={() => { haptic(6); setDestinoId(EFECTIVO); setDestinoPocket(undefined) }}
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
            {(origen ? destinos : accounts).map((a) => fila(
              a,
              a.id === destinoId,
              () => { setDestinoId(a.id); setDestinoPocket(undefined) },
              // La misma cuenta no se ofrece por su saldo —es el de la línea de
              // arriba— sino por lo que se puede hacer con ella.
              a.id === origenId ? 'entre sus bolsillos' : undefined,
            ))}
          </ScrollStrip>
        )}
        {destino && bolsillosDestino.length > 0 && tiraBolsillos(destino, destinoPocket, setDestinoPocket)}

        {mismoLado && (
          <p className="mb-3 px-1 text-[12px] leading-relaxed text-accent-orange">
            El origen y el destino son el mismo sitio. Elige otro bolsillo en uno de los dos lados.
          </p>
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
            {bolsilloOrigen
              ? `${bolsilloOrigen.name} tiene ${formatMoney(libre, moneda)}.`
              : `${origen!.name} tiene ${formatMoney(libre, moneda)} sin apartar.`}
            {' '}Puedes moverlo igual; el saldo quedará por debajo de lo comprometido.
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
            const descripcion = aEfectivoNuevo
              ? `${nombreLado(origen, origenPocket)} → ${origen.currency === 'USD' ? 'Efectivo USD' : 'Efectivo'}`
              : mismaCuenta
                // Dentro de una cuenta, repetir su nombre en las dos puntas no
                // dice nada: lo que cambió es el bolsillo.
                ? `${origen.name}: ${etiquetaLado(origen, origenPocket)} → ${etiquetaLado(origen, destinoPocket)}`
                : `${nombreLado(origen, origenPocket)} → ${nombreLado(destino!, destinoPocket)}`
            addTransaction({
              accountId: origen.id,
              pocketId: origenPocket,
              toAccountId: destinoFinal,
              // El efectivo nace sin bolsillos, así que su punta no tiene uno.
              toPocketId: aEfectivoNuevo ? undefined : destinoPocket,
              categoryId: 'transfer',
              amount: importe,
              type: 'transfer',
              description: nota.trim() || descripcion,
              occurredAt: new Date().toISOString(),
              currency: origen.currency,
            })
            cerrar()
          }}
          disabled={!listo}
          className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                     shadow-glow disabled:bg-fill-2 disabled:text-label-tertiary disabled:shadow-none"
        >
          {mismaCuenta ? 'Mover' : 'Transferir'}
          {importe > 0 && origen ? ` ${formatMoney(importe, origen.currency)}` : ''}
        </button>
        <p className="mt-2 px-1 text-center text-[12px] leading-relaxed text-label-tertiary">
          {mismaCuenta
            ? 'El saldo de la cuenta no cambia: el dinero solo pasa de un bolsillo a otro.'
            : 'No cuenta como gasto ni como ingreso: el dinero solo cambia de sitio.'}
        </p>
      </div>
    </Sheet>
  )
}
