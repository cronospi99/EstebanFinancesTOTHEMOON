'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { DesbloqueoPrestamos } from '@/components/prestamos/desbloqueo'
import { PrestamoSheet } from '@/components/prestamos/prestamo-sheet'
import { DetallePrestamoSheet } from '@/components/prestamos/detalle-prestamo-sheet'
import { EstadoChip } from '@/components/prestamos/estado-chip'
import { formatDia, formatMoney } from '@/lib/format'
import { estadoPrestamo, resumenCartera, type EstadoPrestamo, type Prestamo } from '@/lib/prestamos'
import { usePrestamos } from '@/lib/use-prestamos'
import { hoyEnZona } from '@/lib/zona'
import { cn, haptic } from '@/lib/utils'

type Filtro = 'activos' | 'mora' | 'saldados' | 'archivados'
type Orden = 'cliente' | 'capital' | 'corte' | 'pago' | 'siguiente' | 'saldar' | 'cobrado' | 'mora'

interface Fila { p: Prestamo; e: EstadoPrestamo }

/*
 * Cómo se ordena cada columna. Por defecto, por próximo corte y la mora
 * primero: la pregunta de cada mañana es «a quién le toca cobrar», y el que
 * ya debe va antes que el que vence el jueves.
 */
const CLAVE: Record<Orden, (f: Fila) => number | string> = {
  cliente: (f) => f.p.cliente.toLocaleLowerCase('es'),
  capital: (f) => f.e.capital,
  corte: (f) => (f.e.mora > 0 ? '0' : f.e.venceHoy > 0 ? '1' : '2') + (f.e.proximoCorte ?? '9999'),
  pago: (f) => f.e.pagoProximoCorte,
  siguiente: (f) => f.e.interesSiguienteMes,
  saldar: (f) => f.e.paraSaldarEnCorte,
  cobrado: (f) => f.e.interesPagado,
  mora: (f) => f.e.pendienteHoy,
}

/**
 * El tablero de los préstamos a clientes.
 *
 * Arriba, las cuatro cifras de la cartera; debajo, una fila por cliente con
 * todo lo que se pregunta de un préstamo: cuánto se le prestó, cuánto debe,
 * cuándo corta, cuánto paga en ese corte y el mes siguiente, y cuánto le
 * falta para saldar. Es una tabla y no una lista de tarjetas a propósito:
 * con quince clientes, comparar columnas es el trabajo, y en tarjetas cada
 * número está en un sitio distinto.
 */
export default function PrestamosPage() {
  const { disponibilidad, prestamos, pagos, error } = usePrestamos()
  const hoy = hoyEnZona()
  const [filtro, setFiltro] = useState<Filtro>('activos')
  const [buscar, setBuscar] = useState('')
  const [orden, setOrden] = useState<{ col: Orden; asc: boolean }>({ col: 'corte', asc: true })
  const [nuevo, setNuevo] = useState(false)
  const [abierto, setAbierto] = useState<Prestamo | null>(null)

  const filas = useMemo<Fila[]>(
    () => prestamos.map((p) => ({ p, e: estadoPrestamo(p, pagos, hoy) })),
    [prestamos, pagos, hoy],
  )
  const resumen = useMemo(
    () => resumenCartera(prestamos.filter((p) => !p.archivado), pagos, hoy),
    [prestamos, pagos, hoy],
  )

  const visibles = useMemo(() => {
    const q = buscar.trim().toLocaleLowerCase('es')
    const lista = filas.filter(({ p, e }) => {
      if (q && !p.cliente.toLocaleLowerCase('es').includes(q)) return false
      if (filtro === 'archivados') return Boolean(p.archivado)
      if (p.archivado) return false
      if (filtro === 'mora') return e.estado === 'mora'
      if (filtro === 'saldados') return e.estado === 'saldado'
      return e.estado !== 'saldado'
    })
    const clave = CLAVE[orden.col]
    return lista.sort((a, b) => {
      const x = clave(a), y = clave(b)
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')
      return orden.asc ? c : -c
    })
  }, [filas, filtro, buscar, orden])

  const total = (f: (x: Fila) => number) => visibles.reduce((s, x) => s + f(x), 0)

  if (disponibilidad === 'cargando') {
    return <div className="px-5"><PageHeader title="Préstamos" subtitle="Tu cartera de clientes" /></div>
  }

  if (disponibilidad !== 'desbloqueado') {
    return (
      <div className="space-y-5 px-5">
        <PageHeader title="Préstamos" subtitle="Una función que se desbloquea" />
        <DesbloqueoPrestamos />
      </div>
    )
  }

  const Th = ({ col, children, className, titulo }: { col: Orden; children: React.ReactNode; className?: string; titulo?: string }) => {
    const activo = orden.col === col
    return (
      <th title={titulo} className={cn('whitespace-nowrap px-3 py-2.5 font-medium lg:px-2', className)}>
        <button
          onClick={() => { haptic(4); setOrden((o) => ({ col, asc: o.col === col ? !o.asc : col === 'cliente' || col === 'corte' })) }}
          className={cn('inline-flex items-center gap-1 uppercase tracking-wider', activo ? 'text-label' : 'text-label-tertiary')}
        >
          {children}
          {activo && (orden.asc ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
        </button>
      </th>
    )
  }

  const tarjeta = (titulo: string, valor: string, detalle: string, tono?: string) => (
    <Card className="p-4">
      <p className="text-[12px] text-label-secondary">{titulo}</p>
      <p className={cn('tnum mt-0.5 text-[21px] font-bold tracking-[-0.01em]', tono ?? 'text-label')}>{valor}</p>
      <p className="mt-0.5 text-[11px] text-label-tertiary">{detalle}</p>
    </Card>
  )

  return (
    <div className="space-y-5 px-5">
      <PageHeader title="Préstamos" subtitle="Tu cartera de clientes" />

      {error && (
        <p className="rounded-2xl border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-[13px] text-accent-orange">
          No se guardó el último cambio: {error}.
        </p>
      )}

      {/* La cartera en cuatro cifras */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tarjeta('Capital en la calle', formatMoney(resumen.capitalEnLaCalle),
          `${resumen.clientesActivos} cliente${resumen.clientesActivos === 1 ? '' : 's'} activo${resumen.clientesActivos === 1 ? '' : 's'}`)}
        {tarjeta('Por cobrar en los cortes', formatMoney(resumen.porCobrarProximosCortes), 'intereses del próximo corte + lo vencido')}
        {tarjeta('Intereses este mes', formatMoney(resumen.interesCobradoEsteMes), `${formatMoney(resumen.interesCobrado)} en total`, 'text-accent-green')}
        {tarjeta('Vencido', formatMoney(resumen.moraTotal),
          resumen.clientesEnMora ? `${resumen.clientesEnMora} cliente${resumen.clientesEnMora === 1 ? '' : 's'}` : 'nadie atrasado',
          resumen.moraTotal > 0 ? 'text-accent-red' : undefined)}
      </div>
      {resumen.capitalEnLaCalle > 0 && (
        <p className="px-1 text-[12px] leading-relaxed text-label-tertiary">
          Si todos pagan solo intereses, la cartera deja{' '}
          <span className="tnum font-semibold text-label-secondary">{formatMoney(resumen.interesMensualCartera)}</span> al mes.
          Ya recuperaste {formatMoney(resumen.capitalRecuperado)} de {formatMoney(resumen.prestadoTotal)} prestados.
        </p>
      )}

      {/* Controles */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented<Filtro>
          id="filtro-prestamos" className="lg:w-[420px]" value={filtro} onChange={setFiltro}
          options={[
            { value: 'activos', label: 'Activos' },
            { value: 'mora', label: 'En mora' },
            { value: 'saldados', label: 'Saldados' },
            { value: 'archivados', label: 'Archivo' },
          ]}
        />
        <div className="flex flex-1 gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-hairline bg-fill-1 px-3 py-2">
            <Search size={15} className="text-label-tertiary" />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar cliente"
              className="w-full bg-transparent text-[15px] text-label placeholder:text-label-tertiary focus:outline-none" />
          </label>
          <button onClick={() => { haptic(8); setNuevo(true) }}
            className="press flex shrink-0 items-center gap-1.5 rounded-xl bg-accent-blue px-4 text-[14px] font-semibold text-white shadow-glow">
            <Plus size={16} strokeWidth={2.6} /> Prestar
          </button>
        </div>
      </div>

      {/* La tabla */}
      {visibles.length ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] whitespace-nowrap text-[13px] lg:min-w-0 lg:text-[12.5px]">
              <thead className="border-b border-hairline text-left text-[11px]">
                <tr>
                  {/* La primera columna se queda quieta al desplazar: sin el
                      nombre a la vista, la fila de números no es de nadie. */}
                  <Th col="cliente" className="sticky left-0 z-10 bg-surface">Cliente</Th>
                  <th className="px-3 py-2.5 font-medium uppercase tracking-wider text-label-tertiary lg:px-2">Estado</th>
                  <Th col="capital" className="text-right">Debe</Th>
                  <Th col="corte" titulo="Próximo corte">Corte</Th>
                  <Th col="pago" className="text-right" titulo="Intereses a pagar en el próximo corte, con lo vencido">Intereses</Th>
                  <Th col="saldar" className="text-right" titulo="Capital más intereses, el día del próximo corte">Para saldar</Th>
                  <Th col="siguiente" className="text-right" titulo="Interés del mes siguiente si no abona más capital">Mes sig.</Th>
                  <Th col="mora" className="text-right" titulo="Vencido más lo que vence hoy">Debe hoy</Th>
                  <Th col="cobrado" className="text-right">Cobrado</Th>
                </tr>
              </thead>
              <tbody className="tnum">
                {visibles.map(({ p, e }) => (
                  <tr key={p.id} onClick={() => { haptic(6); setAbierto(p) }}
                    className="group cursor-pointer border-b border-hairline last:border-0 active:bg-fill-2 lg:hover:bg-fill-1">
                    <td className="sticky left-0 z-10 bg-surface px-3 py-3 lg:px-2 group-active:bg-fill-2">
                      <p className="max-w-[150px] truncate text-[14px] font-medium">{p.cliente}</p>
                      <p className="text-[11px] text-label-tertiary">
                        {formatMoney(p.monto)} · {String(p.tasaMensual).replace('.', ',')} % · {formatDia(p.fecha)}
                      </p>
                    </td>
                    <td className="px-3 py-3 lg:px-2"><EstadoChip estado={e.estado} diasMora={e.diasMora} /></td>
                    <td className="px-3 py-3 lg:px-2 text-right font-semibold">{formatMoney(e.capital)}</td>
                    <td className="whitespace-nowrap px-3 py-3 lg:px-2">{e.proximoCorte ? formatDia(e.proximoCorte) : '—'}</td>
                    <td className={cn('px-3 py-3 lg:px-2 text-right font-semibold', e.mora > 0 && 'text-accent-red')}>{formatMoney(e.pagoProximoCorte)}</td>
                    <td className="px-3 py-3 lg:px-2 text-right">{formatMoney(e.paraSaldarEnCorte)}</td>
                    <td className="px-3 py-3 lg:px-2 text-right text-label-secondary">{formatMoney(e.interesSiguienteMes)}</td>
                    <td className={cn('px-3 py-3 lg:px-2 text-right', e.mora > 0 ? 'text-accent-red' : e.venceHoy > 0 ? 'text-accent-orange' : 'text-label-tertiary')}>
                      {e.pendienteHoy > 0 ? formatMoney(e.pendienteHoy) : '—'}
                    </td>
                    <td className="px-3 py-3 lg:px-2 text-right text-accent-green">{formatMoney(e.interesPagado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="tnum border-t border-hairline text-[12px] font-semibold">
                <tr>
                  <td className="sticky left-0 z-10 bg-surface px-3 py-3 lg:px-2 text-label-secondary">
                    {visibles.length} cliente{visibles.length === 1 ? '' : 's'}
                  </td>
                  <td />
                  <td className="px-3 py-3 lg:px-2 text-right">{formatMoney(total((x) => x.e.capital))}</td>
                  <td />
                  <td className="px-3 py-3 lg:px-2 text-right">{formatMoney(total((x) => x.e.pagoProximoCorte))}</td>
                  <td className="px-3 py-3 lg:px-2 text-right">{formatMoney(total((x) => x.e.paraSaldarEnCorte))}</td>
                  <td className="px-3 py-3 lg:px-2 text-right">{formatMoney(total((x) => x.e.interesSiguienteMes))}</td>
                  <td className="px-3 py-3 lg:px-2 text-right text-accent-red">{formatMoney(total((x) => x.e.pendienteHoy))}</td>
                  <td className="px-3 py-3 lg:px-2 text-right text-accent-green">{formatMoney(total((x) => x.e.interesPagado))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-[15px] font-medium text-label">
            {prestamos.length ? 'Nadie en este grupo' : 'Aún no hay préstamos'}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-label-secondary">
            {prestamos.length
              ? 'Cambia el filtro o la búsqueda para ver al resto.'
              : 'Registra el primero con el nombre del cliente, cuánto le prestas y a qué interés mensual.'}
          </p>
        </Card>
      )}

      <p className="px-1 pb-4 text-[12px] leading-relaxed text-label-tertiary">
        Cada mes se cobra el interés sobre el capital que había al empezar el mes. Un abono a capital
        baja el interés desde el mes siguiente; el que ya empezó se cobra entero. Los pagos de
        intereses cubren primero lo más viejo.
      </p>

      <PrestamoSheet open={nuevo} onClose={() => setNuevo(false)} />
      <DetallePrestamoSheet prestamo={abierto} onClose={() => setAbierto(null)} />
    </div>
  )
}
