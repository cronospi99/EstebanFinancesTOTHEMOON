'use client'

import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { formatDia, formatMoney, formatKeypad, parseKeypad } from '@/lib/format'
import { efectivaAnual, interesDelMes, type Prestamo } from '@/lib/prestamos'
import { sumarMeses } from '@/lib/suscripciones'
import { usePrestamos } from '@/lib/use-prestamos'
import { hoyEnZona } from '@/lib/zona'
import { haptic } from '@/lib/utils'

const Etiqueta = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">{children}</label>
)
const CAMPO = 'w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-[16px] text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none'

/**
 * Alta y edición de un préstamo.
 *
 * Lo mínimo para empezar a cobrar: a quién, cuánto, a qué tasa y desde qué
 * día. Debajo se enseña lo que eso significa —cuánto paga cada mes y cuándo
 * es el primer corte—, que es lo que se le va a decir al cliente al entregarle
 * la plata.
 */
export function PrestamoSheet({
  open, onClose, prestamo,
}: {
  open: boolean
  onClose: () => void
  /** Para editar. Sin él, es un préstamo nuevo. */
  prestamo?: Prestamo | null
}) {
  const { crearPrestamo, actualizarPrestamo } = usePrestamos()
  const [cliente, setCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [monto, setMonto] = useState('')
  const [tasa, setTasa] = useState('10')
  const [fecha, setFecha] = useState(hoyEnZona())
  const [nota, setNota] = useState('')

  useEffect(() => {
    if (!open) return
    setCliente(prestamo?.cliente ?? '')
    setTelefono(prestamo?.telefono ?? '')
    setMonto(prestamo ? String(prestamo.monto).replace('.', ',') : '')
    setTasa(prestamo ? String(prestamo.tasaMensual).replace('.', ',') : '10')
    setFecha(prestamo?.fecha ?? hoyEnZona())
    setNota(prestamo?.nota ?? '')
  }, [open, prestamo])

  const importe = parseKeypad(monto)
  const tasaNum = parseKeypad(tasa)
  const listo = cliente.trim().length > 0 && importe > 0 && tasaNum >= 0 && Boolean(fecha)
  const interes = interesDelMes(importe, tasaNum)

  const guardar = async () => {
    if (!listo) return
    haptic([14, 40, 22])
    const datos = {
      cliente: cliente.trim(), telefono: telefono.trim() || undefined,
      monto: importe, tasaMensual: tasaNum, fecha, nota: nota.trim() || undefined,
    }
    if (prestamo) await actualizarPrestamo(prestamo.id, datos)
    else await crearPrestamo(datos)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-5 text-center text-[17px] font-semibold">{prestamo ? 'Editar préstamo' : 'Nuevo préstamo'}</h2>

        <Etiqueta>Cliente</Etiqueta>
        <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre" className={`${CAMPO} mb-3`} autoFocus={!prestamo} />
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono (opcional)" inputMode="tel" className={`${CAMPO} mb-5`} />

        <Etiqueta>Cuánto se presta</Etiqueta>
        <MoneyInput value={monto} onChange={setMonto} placeholder="500.000" className="mb-5" />

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <Etiqueta>Interés mensual</Etiqueta>
            <div className="flex items-center gap-1 rounded-xl border border-hairline bg-fill-2 px-4 py-3">
              <input
                value={tasa ? formatKeypad(tasa) : ''}
                onChange={(e) => setTasa(e.target.value.replace(/[^\d,]/g, '').slice(0, 6))}
                inputMode="decimal" placeholder="10"
                className="tnum w-full bg-transparent text-[16px] font-semibold text-label focus:outline-none"
              />
              <span className="text-[15px] text-label-secondary">%</span>
            </div>
          </div>
          <div>
            <Etiqueta>Fecha del préstamo</Etiqueta>
            <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className={CAMPO} />
          </div>
        </div>

        {importe > 0 && fecha && (
          <div className="mb-5 rounded-2xl border border-hairline bg-fill-1 p-4 text-[13px] leading-relaxed text-label-secondary">
            Paga <span className="tnum font-semibold text-label">{formatMoney(interes)}</span> de intereses cada mes,
            el día {Number(fecha.slice(8, 10))}. El primer corte es el{' '}
            <span className="font-semibold text-label">{formatDia(sumarMeses(fecha, 1))}</span>, y para saldar ese día
            son <span className="tnum font-semibold text-label">{formatMoney(importe + interes)}</span>.
            {tasaNum > 0 && (
              <span className="mt-1 block text-[12px] text-label-tertiary">
                Un {formatKeypad(tasa)} % mensual equivale a un {efectivaAnual(tasaNum).toFixed(1).replace('.', ',')} % efectivo anual.
              </span>
            )}
          </div>
        )}

        <Etiqueta>Nota</Etiqueta>
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional: garantía, referido, dirección…" className={`${CAMPO} mb-6`} />

        <button
          onClick={guardar}
          disabled={!listo}
          className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white shadow-glow
                     disabled:bg-fill-2 disabled:text-label-tertiary disabled:shadow-none"
        >
          {prestamo ? 'Guardar cambios' : `Prestar${importe > 0 ? ` ${formatMoney(importe)}` : ''}`}
        </button>
      </div>
    </Sheet>
  )
}
