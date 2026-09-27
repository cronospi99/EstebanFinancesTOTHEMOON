'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Phone, Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { PrestamoSheet } from './prestamo-sheet'
import { EstadoChip } from './estado-chip'
import { formatDia, formatMoney, parseKeypad } from '@/lib/format'
import { estadoPrestamo, type Prestamo } from '@/lib/prestamos'
import { usePrestamos } from '@/lib/use-prestamos'
import { hoyEnZona } from '@/lib/zona'
import { cn, haptic } from '@/lib/utils'

const Etiqueta = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">{children}</p>
)

type Atajo = 'intereses' | 'saldar' | 'libre'

/**
 * La ficha de un cliente: cuánto debe, cuándo corta, y el registro de pagos.
 *
 * Registrar un pago es lo que más se hace aquí, así que va arriba y con dos
 * atajos para los casos de todos los meses —solo intereses, o saldar todo—.
 * Cualquier otra cosa se escribe a mano, partida entre intereses y capital,
 * y antes de guardar se ve cómo queda: «queda debiendo 400.000 y el mes que
 * viene paga 40.000».
 */
export function DetallePrestamoSheet({ prestamo, onClose }: { prestamo: Prestamo | null; onClose: () => void }) {
  const { prestamos, pagos, registrarPago, borrarPago, actualizarPrestamo, borrarPrestamo } = usePrestamos()
  // El préstamo vivo: tras editarlo o pagarle, la ficha tiene que enseñar lo nuevo.
  const p = prestamos.find((x) => x.id === prestamo?.id) ?? prestamo
  const hoy = hoyEnZona()

  const [fecha, setFecha] = useState(hoy)
  const [interes, setInteres] = useState('')
  const [capital, setCapital] = useState('')
  const [nota, setNota] = useState('')
  const [atajo, setAtajo] = useState<Atajo>('intereses')
  const [editando, setEditando] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  const propios = useMemo(() => (p ? pagos.filter((x) => x.prestamoId === p.id) : []), [pagos, p])
  const e = useMemo(() => (p ? estadoPrestamo(p, pagos, hoy) : null), [p, pagos, hoy])

  /*
   * Los intereses que tocan cobrar ahora: lo vencido y lo que vence hoy, o si
   * no hay nada de eso, los del próximo corte (quien paga antes de tiempo).
   */
  const interesQueToca = (x: NonNullable<typeof e>) => (x.pendienteHoy > 0 ? x.pendienteHoy : x.interesProximoCorte)

  // Al abrir, el pago propuesto es el de este mes: los intereses que tocan.
  useEffect(() => {
    if (!prestamo || !e) return
    setFecha(hoy)
    setInteres(interesQueToca(e) > 0 ? String(interesQueToca(e)) : '')
    setCapital('')
    setNota('')
    setAtajo('intereses')
    setConfirmarBorrado(false)
    // Solo al cambiar de préstamo: recalcularlo en cada pago pisaría lo que se
    // está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prestamo?.id])

  const interesNum = parseKeypad(interes)
  const capitalNum = Math.min(parseKeypad(capital), e?.capital ?? 0)
  const listo = interesNum > 0 || capitalNum > 0

  // Cómo queda si se guarda este pago, visto desde el día del pago (o desde
  // hoy, si se está anotando uno viejo).
  const despues = useMemo(() => {
    if (!p || !listo) return null
    const provisional = { id: '__nuevo', prestamoId: p.id, fecha, interes: interesNum, capital: capitalNum }
    return estadoPrestamo(p, [...pagos, provisional], fecha > hoy ? fecha : hoy)
  }, [p, pagos, fecha, interesNum, capitalNum, listo, hoy])

  if (!p || !e) return <Sheet open={false} onClose={onClose}>{null}</Sheet>

  const elegir = (a: Atajo) => {
    haptic(6)
    setAtajo(a)
    if (a === 'intereses') { setInteres(interesQueToca(e) > 0 ? String(interesQueToca(e)) : ''); setCapital('') }
    // Saldar hoy: todo el capital y los intereses que se deben hoy.
    if (a === 'saldar') {
      const intereses = e.paraSaldarHoy - e.capital
      setInteres(intereses > 0 ? String(intereses) : '')
      setCapital(String(e.capital))
    }
  }

  const guardarPago = async () => {
    if (!listo) return
    haptic([14, 40, 22])
    await registrarPago({ prestamoId: p.id, fecha, interes: interesNum, capital: capitalNum, nota: nota.trim() || undefined })
    setInteres(''); setCapital(''); setNota(''); setAtajo('libre')
  }

  const cifra = (etiqueta: string, valor: string, detalle?: string, tono?: string) => (
    <div className="rounded-xl bg-fill-1 px-3 py-2.5">
      <p className="text-[11px] text-label-tertiary">{etiqueta}</p>
      <p className={cn('tnum text-[16px] font-semibold', tono ?? 'text-label')}>{valor}</p>
      {detalle && <p className="text-[11px] text-label-tertiary">{detalle}</p>}
    </div>
  )

  return (
    <>
      <Sheet open={Boolean(prestamo) && !editando} onClose={onClose}>
        <div className="px-5 pb-8 pt-1">
          {/* Cabecera */}
          <div className="mb-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[20px] font-semibold">{p.cliente}</h2>
                <EstadoChip estado={e.estado} diasMora={e.diasMora} />
              </div>
              <p className="text-[13px] text-label-secondary">
                {formatMoney(p.monto)} al {String(p.tasaMensual).replace('.', ',')} % mensual · desde el {formatDia(p.fecha)}
              </p>
              {p.telefono && (
                <a href={`tel:${p.telefono}`} className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-accent-blue">
                  <Phone size={13} /> {p.telefono}
                </a>
              )}
            </div>
            <button onClick={() => { haptic(6); setEditando(true) }} aria-label="Editar préstamo"
              className="press rounded-full bg-fill-2 p-2 text-label-secondary">
              <Pencil size={16} />
            </button>
          </div>

          {/* Cifras */}
          <div className="mb-5 grid grid-cols-2 gap-2">
            {cifra('Capital pendiente', formatMoney(e.capital), e.capitalPagado > 0 ? `abonado ${formatMoney(e.capitalPagado)}` : undefined)}
            {e.pendienteHoy > 0
              ? cifra('A pagar hoy', formatMoney(e.pendienteHoy),
                  e.mora > 0 ? `${formatMoney(e.mora)} vencidos hace ${e.diasMora} días` : 'intereses que vencen hoy',
                  e.mora > 0 ? 'text-accent-red' : 'text-accent-orange')
              : cifra(e.proximoCorte ? `Intereses del ${formatDia(e.proximoCorte)}` : 'Intereses', formatMoney(e.interesProximoCorte), 'próximo corte')}
            {cifra('Para saldar hoy', formatMoney(e.paraSaldarHoy), 'capital + intereses que se deben')}
            {e.proximoCorte
              ? cifra(`Para saldar el ${formatDia(e.proximoCorte)}`, formatMoney(e.paraSaldarEnCorte), `o ${formatMoney(e.pagoProximoCorte)} solo intereses`)
              : cifra('Meses corridos', String(e.meses.length))}
            {cifra('El mes siguiente', formatMoney(e.interesSiguienteMes), 'si no abona más capital')}
            {cifra('Intereses cobrados', formatMoney(e.interesPagado), undefined, 'text-accent-green')}
          </div>
          {e.saldoAFavor > 0 && (
            <p className="-mt-3 mb-5 px-1 text-[12px] text-label-tertiary">
              Tiene {formatMoney(e.saldoAFavor)} de intereses pagados por adelantado: cubren los próximos meses.
            </p>
          )}

          {/* Registrar un pago */}
          {e.estado !== 'saldado' && (
            <div className="mb-6 rounded-2xl border border-hairline bg-fill-1 p-4">
              <p className="mb-3 text-[15px] font-semibold">Registrar pago</p>
              <div className="mb-3 flex gap-1.5">
                {([
                  ['intereses', 'Solo intereses'],
                  ['saldar', 'Saldar todo'],
                  ['libre', 'Otro'],
                ] as const).map(([a, texto]) => (
                  <button key={a} onClick={() => elegir(a)}
                    className={cn('press flex-1 rounded-pill border px-2 py-1.5 text-[12px] font-medium transition-colors',
                      atajo === a ? 'border-transparent bg-fill-4 text-label' : 'border-hairline text-label-secondary')}>
                    {texto}
                  </button>
                ))}
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 px-1 text-[11px] text-label-tertiary">A intereses</p>
                  <MoneyInput value={interes} onChange={(v) => { setInteres(v); setAtajo('libre') }} placeholder="0" />
                </div>
                <div>
                  <p className="mb-1 px-1 text-[11px] text-label-tertiary">Abono a capital</p>
                  <MoneyInput value={capital} onChange={(v) => { setCapital(v); setAtajo('libre') }} placeholder="0" />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <input type="date" value={fecha} onChange={(ev) => ev.target.value && setFecha(ev.target.value)}
                  className="w-full rounded-xl border border-hairline bg-fill-2 px-3 py-2.5 text-[15px] text-label focus:outline-none" />
                <input value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="Nota"
                  className="w-full rounded-xl border border-hairline bg-fill-2 px-3 py-2.5 text-[15px] text-label placeholder:text-label-tertiary focus:outline-none" />
              </div>

              {parseKeypad(capital) > e.capital && (
                <p className="mb-2 px-1 text-[12px] text-accent-orange">
                  El abono no puede pasar del capital pendiente: se toman {formatMoney(e.capital)}.
                </p>
              )}
              {despues && (
                <p className="mb-3 px-1 text-[12px] leading-relaxed text-label-secondary">
                  {despues.estado === 'saldado'
                    ? 'Con este pago el préstamo queda saldado.'
                    : <>Queda debiendo <b className="tnum text-label">{formatMoney(despues.capital)}</b> de capital
                        {despues.pendienteHoy > 0 && <>, con <b className="tnum text-accent-red">{formatMoney(despues.pendienteHoy)}</b> de intereses sin pagar</>}.
                        {despues.proximoCorte && <>
                          {' '}El {formatDia(despues.proximoCorte)} paga <b className="tnum text-label">{formatMoney(despues.pagoProximoCorte)}</b> de
                          intereses, o <b className="tnum text-label">{formatMoney(despues.paraSaldarEnCorte)}</b> para saldar.</>}</>}
                </p>
              )}

              <button onClick={guardarPago} disabled={!listo}
                className="press h-[46px] w-full rounded-xl bg-accent-blue text-[15px] font-semibold text-white
                           disabled:bg-fill-2 disabled:text-label-tertiary">
                Registrar {formatMoney(interesNum + capitalNum)}
              </button>
            </div>
          )}

          {/* Mes a mes */}
          <Etiqueta>Mes a mes</Etiqueta>
          <div className="-mx-5 mb-6 overflow-x-auto px-5">
            <table className="w-full min-w-[440px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-label-tertiary">
                  <th className="py-1.5 pr-2 font-medium">#</th>
                  <th className="py-1.5 pr-2 font-medium">Corte</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Capital</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Interés</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Pagado</th>
                  <th className="py-1.5 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {e.meses.map((m) => (
                  <tr key={m.numero} className="border-t border-hairline">
                    <td className="py-2 pr-2 text-label-tertiary">{m.numero}</td>
                    <td className="py-2 pr-2">{formatDia(m.corte)}</td>
                    <td className="py-2 pr-2 text-right">{formatMoney(m.base)}</td>
                    <td className="py-2 pr-2 text-right">{formatMoney(m.interes)}</td>
                    <td className="py-2 pr-2 text-right">{formatMoney(m.pagado)}</td>
                    <td className={cn('py-2 text-right text-[12px] font-medium',
                      m.estado === 'pagado' ? 'text-accent-green' : m.estado === 'vencido' ? 'text-accent-red' : 'text-label-secondary')}>
                      {m.estado === 'pagado' ? 'Pagado' : m.estado === 'vencido' ? 'Vencido' : 'En curso'}
                    </td>
                  </tr>
                ))}
                {!e.meses.length && (
                  <tr><td colSpan={6} className="py-3 text-center text-label-tertiary">Todavía no empieza ningún mes.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Historial de pagos */}
          <Etiqueta>Pagos</Etiqueta>
          {propios.length ? (
            <div className="mb-6 divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-fill-1">
              {[...propios].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((x) => (
                <div key={x.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{formatDia(x.fecha)}</p>
                    <p className="truncate text-[12px] text-label-tertiary">
                      {[x.interes > 0 && `intereses ${formatMoney(x.interes)}`, x.capital > 0 && `capital ${formatMoney(x.capital)}`, x.nota]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="tnum text-[15px] font-semibold text-accent-green">+{formatMoney(x.interes + x.capital).replace('$', '').trim()}</span>
                  <button onClick={() => { haptic([16, 30]); void borrarPago(x.id) }} aria-label="Borrar pago"
                    className="press p-1 text-label-tertiary">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-6 px-1 text-[13px] text-label-tertiary">Sin pagos todavía.</p>
          )}

          {/* Acciones */}
          <div className="flex gap-2">
            <button
              onClick={() => { haptic(8); void actualizarPrestamo(p.id, { archivado: !p.archivado }); if (!p.archivado) onClose() }}
              className="press flex flex-1 items-center justify-center gap-2 rounded-2xl border border-hairline py-3 text-[14px] font-medium text-label-secondary"
            >
              {p.archivado ? <><ArchiveRestore size={16} /> Desarchivar</> : <><Archive size={16} /> Archivar</>}
            </button>
            {confirmarBorrado ? (
              <button onClick={() => { haptic([18, 30]); void borrarPrestamo(p.id); onClose() }}
                className="press flex-1 rounded-2xl bg-accent-red py-3 text-[14px] font-semibold text-white">
                Sí, borrar todo
              </button>
            ) : (
              <button onClick={() => { haptic(8); setConfirmarBorrado(true) }}
                className="press flex flex-1 items-center justify-center gap-2 rounded-2xl border border-hairline py-3 text-[14px] font-medium text-accent-red">
                <Trash2 size={16} /> Borrar
              </button>
            )}
          </div>
          {confirmarBorrado && (
            <p className="mt-2 px-1 text-center text-[12px] text-label-tertiary">
              Se borran el préstamo y sus {propios.length} pagos. Archivar lo esconde sin perder el historial.
            </p>
          )}
        </div>
      </Sheet>
      <PrestamoSheet open={editando} onClose={() => setEditando(false)} prestamo={p} />
    </>
  )
}
