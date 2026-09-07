'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Segmented } from '@/components/ui/segmented'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { investmentPlatforms } from '@/lib/categories'
import { formatKeypad, formatMoney, formatQuantity, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import type { AssetType, Currency, Holding } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

const ASSETS: { value: AssetType; label: string }[] = [
  { value: 'etf', label: 'ETF' },
  { value: 'stock', label: 'Acción' },
  { value: 'crypto', label: 'Cripto' },
  { value: 'cdt', label: 'CDT' },
]

/** Yahoo devuelve el tipo; lo traducimos para no preguntarlo. */
const TIPO_YAHOO: Record<string, AssetType> = {
  etf: 'etf', equity: 'stock', cryptocurrency: 'crypto', currency: 'fx', mutualfund: 'etf',
}

const hoy = () => new Date().toISOString().slice(0, 10)

export function AddHoldingSheet({
  open, onClose, editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Holding | null
}) {
  const { accounts, holdings, addHolding, updateHolding, asegurarPlataforma, fxRate } = useFinance()

  /*
   * Las plataformas son una lista cerrada, no las cuentas que existan. Antes
   * salía cualquier cuenta de ahorros o de inversión, así que aparecían Nequi
   * y Bancolombia —donde no se compran ETF— y faltaban las corredoras para las
   * que todavía no se había creado una cuenta a mano. La cuenta de la
   * plataforma elegida se crea sola al guardar.
   */
  const plataformas = investmentPlatforms()

  const [symbol, setSymbol] = useState(editing?.symbol ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [buscando, setBuscando] = useState(false)
  const [operacion, setOperacion] = useState<'compra' | 'venta'>('compra')
  const [modo, setModo] = useState<'cantidad' | 'monto'>('cantidad')
  const [qty, setQty] = useState(editing ? String(editing.quantity).replace('.', ',') : '')
  const [monto, setMonto] = useState('')
  const [precio, setPrecio] = useState(editing ? String(editing.avgCost).replace('.', ',') : '')
  const [fecha, setFecha] = useState(hoy())
  const [assetType, setAssetType] = useState<AssetType>(editing?.assetType ?? 'etf')
  const [currency, setCurrency] = useState<Currency>(editing?.currency ?? 'USD')
  const [plataforma, setPlataforma] = useState(
    () =>
      accounts.find((a) => a.id === editing?.accountId)?.institution
      ?? plataformas[0]?.name
      ?? '',
  )
  const [saving, setSaving] = useState(false)

  /*
   * El formulario se rellena cada vez que la hoja se abre.
   *
   * Los `useState` solo leen su valor inicial en el primer montaje, y este
   * componente no se desmonta al cerrar la hoja —solo su contenido—, así que
   * abrir «editar» sobre otra posición enseñaba los datos de la anterior.
   *
   * Las dependencias son solo `open` y `editing` a propósito: incluir
   * `accounts` haría que el formulario se reiniciara solo al crearse la cuenta
   * de una plataforma nueva, en mitad de lo que el usuario está escribiendo.
   */
  useEffect(() => {
    if (!open) return
    setSymbol(editing?.symbol ?? '')
    setName(editing?.name ?? '')
    setOperacion('compra')
    setModo('cantidad')
    setQty(editing ? String(editing.quantity).replace('.', ',') : '')
    setMonto('')
    setPrecio(editing ? String(editing.avgCost).replace('.', ',') : '')
    setFecha(hoy())
    setAssetType(editing?.assetType ?? 'etf')
    setCurrency(editing?.currency ?? 'USD')
    setPlataforma(
      accounts.find((a) => a.id === editing?.accountId)?.institution
      ?? investmentPlatforms()[0]?.name
      ?? '',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  /** Posición ya existente con el mismo símbolo: una compra se suma a ella. */
  const existente = useMemo(
    () => (editing ? null : holdings.find((h) => h.symbol === symbol.trim().toUpperCase())),
    [holdings, symbol, editing],
  )

  // Nombre automático. El usuario escribe el ticker y el proveedor pone el
  // nombre: no tiene por qué decidir cómo se llama un ETF.
  const ultimo = useRef('')
  useEffect(() => {
    const s = symbol.trim().toUpperCase()
    if (!s || s === ultimo.current || editing) return
    const t = setTimeout(async () => {
      ultimo.current = s
      setBuscando(true)
      try {
        const res = await fetch(`/api/symbol?symbol=${encodeURIComponent(s)}`)
        const data = await res.json()
        if (data?.name) {
          setName(data.name)
          const tipo = TIPO_YAHOO[data.type ?? '']
          if (tipo) setAssetType(tipo)
        } else {
          // Sin respuesta usamos el propio ticker: siempre es válido.
          setName(s)
        }
      } catch {
        setName(s)
      } finally {
        setBuscando(false)
      }
    }, 550)
    return () => clearTimeout(t)
  }, [symbol, editing])

  const precioNum = parseKeypad(precio)
  const montoNum = parseKeypad(monto)
  // Con el importe en dinero, la cantidad sale de dividir por el precio.
  const cantidad = modo === 'cantidad' ? parseKeypad(qty) : (precioNum > 0 ? montoNum / precioNum : 0)

  const maxVenta = existente?.quantity ?? editing?.quantity ?? 0
  const excedeVenta = operacion === 'venta' && cantidad > maxVenta + 1e-8
  const canSave = symbol.trim().length > 0 && cantidad > 0 && precioNum > 0 && !excedeVenta

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    haptic([14, 40, 22])

    const sym = symbol.trim().toUpperCase()
    const base = existente ?? editing
    // La cuenta de la plataforma nace aquí si aún no existía.
    const accountId = plataforma ? await asegurarPlataforma(plataforma) : undefined

    if (base && !editing) {
      if (operacion === 'compra') {
        // Coste promedio ponderado: (qxp anterior + qxp nuevo) / cantidad total.
        const nuevaQty = base.quantity + cantidad
        await updateHolding(base.id, {
          quantity: nuevaQty,
          avgCost: (base.quantity * base.avgCost + cantidad * precioNum) / nuevaQty,
        })
      } else {
        // En venta el coste promedio no cambia: solo se reduce la cantidad.
        const resto = base.quantity - cantidad
        if (resto <= 1e-8) await updateHolding(base.id, { quantity: 0 })
        else await updateHolding(base.id, { quantity: resto })
      }
    } else if (editing) {
      await updateHolding(editing.id, {
        symbol: sym, name: name.trim() || sym,
        quantity: cantidad, avgCost: precioNum, assetType, currency, accountId,
      })
    } else {
      await addHolding({
        symbol: sym, name: name.trim() || sym,
        quantity: cantidad, avgCost: precioNum, assetType, currency, accountId,
      })
    }

    setSymbol(''); setName(''); setQty(''); setMonto(''); setPrecio(''); setFecha(hoy())
    setSaving(false)
    onClose()
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
      {children}
    </label>
  )

  const campoNum = "tnum w-full bg-transparent text-[20px] font-semibold text-label placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
  const caja = "flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.05] px-4 py-3"
  const soloNum = (v: string, dec = 2) => {
    const limpio = v.replace(/[^\d,]/g, '')
    const [ent, ...d] = limpio.split(',')
    return d.length ? `${ent},${d.join('').slice(0, dec)}` : ent
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-4 text-center text-[17px] font-semibold">
          {editing ? 'Editar posición' : 'Movimiento de inversión'}
        </h2>

        {!editing && (
          <Segmented
            id="operacion" className="mb-5"
            value={operacion} onChange={setOperacion}
            options={[{ value: 'compra' as const, label: 'Compra' }, { value: 'venta' as const, label: 'Venta' }]}
          />
        )}

        <Label>Símbolo</Label>
        <div className={cn(caja, 'mb-1.5')}>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="VOO, AAPL, BTC-USD"
            autoCapitalize="characters"
            className="w-full bg-transparent text-[16px] font-semibold tracking-wide text-label placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
          />
          {buscando && <Loader2 size={16} className="shrink-0 animate-spin text-label-tertiary" />}
        </div>
        <p className="mb-5 min-h-[18px] px-1 text-[12px] text-label-tertiary">
          {name ? <span className="text-label-secondary">{name}</span> : 'Símbolo de Yahoo Finance. El nombre se completa solo.'}
        </p>

        {existente && !editing && (
          <p className="mb-4 rounded-xl border border-accent-blue/25 bg-accent-blue/[0.08] px-3 py-2 text-[12px] leading-relaxed text-accent-blue">
            Ya tienes {formatQuantity(existente.quantity)} de {existente.symbol}.
            {operacion === 'compra' ? ' Se sumará y se recalculará el precio promedio.' : ' Se descontará de esa posición.'}
          </p>
        )}

        <Label>Fecha</Label>
        <input
          type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} max={hoy()}
          className="mb-5 w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3
                     text-[16px] text-label focus:border-accent-blue/50 focus:outline-none [color-scheme:dark]"
        />

        <Label>Precio por unidad</Label>
        <div className={cn(caja, 'mb-5')}>
          <span className="text-[17px] text-label-secondary">{currency === 'USD' ? 'US$' : '$'}</span>
          <input
            value={precio ? formatKeypad(precio) : ''}
            onChange={(e) => setPrecio(soloNum(e.target.value, 4))}
            placeholder="465,20" inputMode="decimal" className={campoNum}
          />
        </div>

        <Label>Cuánto</Label>
        <Segmented
          id="modo" className="mb-3"
          value={modo} onChange={setModo}
          options={[{ value: 'cantidad' as const, label: 'Por cantidad' }, { value: 'monto' as const, label: 'Por monto' }]}
        />

        {modo === 'cantidad' ? (
          <>
            <div className={cn(caja, 'mb-1.5')}>
              <input
                value={qty} onChange={(e) => setQty(soloNum(e.target.value, 8))}
                placeholder="12,4" inputMode="decimal" className={campoNum}
              />
              <span className="text-[13px] text-label-tertiary">unid.</span>
            </div>
            <p className="mb-5 px-1 text-[12px] text-label-tertiary">
              Admite fracciones: 0,0852 BTC o 12,4 participaciones.
              {cantidad > 0 && precioNum > 0 && (
                <span className="ml-1 text-label-secondary">
                  ≈ {formatMoney(cantidad * precioNum, currency)}
                </span>
              )}
            </p>
          </>
        ) : (
          <>
            <div className={cn(caja, 'mb-1.5')}>
              <span className="text-[17px] text-label-secondary">{currency === 'USD' ? 'US$' : '$'}</span>
              <input
                value={monto ? formatKeypad(monto) : ''}
                onChange={(e) => setMonto(soloNum(e.target.value, 2))}
                placeholder="1.000" inputMode="decimal" className={campoNum}
              />
            </div>
            <p className="mb-5 px-1 text-[12px] text-label-tertiary">
              {precioNum > 0
                ? <>Equivale a <span className="text-label-secondary">{formatQuantity(cantidad)} unidades</span>{currency === 'USD' && fxRate > 0 && <> · {formatMoney(montoNum * fxRate)}</>}</>
                : 'Escribe primero el precio por unidad.'}
            </p>
          </>
        )}

        {excedeVenta && (
          <p className="mb-4 rounded-xl border border-accent-red/25 bg-accent-red/[0.08] px-3 py-2 text-[12px] text-accent-red">
            No puedes vender {formatQuantity(cantidad)}: solo tienes {formatQuantity(maxVenta)}.
          </p>
        )}

        {(!existente || editing) && (
          <>
            <Label>Tipo de activo</Label>
            <div className="mb-5 grid grid-cols-4 gap-2">
              {ASSETS.map((a) => (
                <button
                  key={a.value}
                  onClick={() => { haptic(6); setAssetType(a.value) }}
                  className={cn(
                    'press rounded-xl border py-2.5 text-[12px] font-medium transition-colors',
                    a.value === assetType ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <Label>Moneda</Label>
            <Segmented
              id="holding-cur" className="mb-5"
              value={currency} onChange={setCurrency}
              options={[{ value: 'USD' as Currency, label: 'Dólares' }, { value: 'COP' as Currency, label: 'Pesos' }]}
            />

            {plataformas.length > 0 && (
              <>
                <Label>Plataforma</Label>
                <div className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
                  {plataformas.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => { haptic(6); setPlataforma(p.name) }}
                      className={cn(
                        'press flex shrink-0 items-center gap-2 rounded-pill border py-1 pl-1 pr-3 text-[12px] font-medium transition-colors',
                        p.name === plataforma ? 'border-transparent bg-white/[0.14] text-label' : 'border-hairline text-label-secondary',
                      )}
                    >
                      <InstitutionBadge institution={p.name} color={p.color} size="xs" />
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <motion.button
          whileTap={{ scale: canSave ? 0.97 : 1 }}
          onClick={handleSave}
          disabled={!canSave || saving}
          className={cn(
            'h-[52px] w-full rounded-2xl text-[17px] font-semibold transition-colors',
            canSave
              ? operacion === 'venta' && !editing
                ? 'bg-accent-red text-white'
                : 'bg-accent-blue text-white shadow-glow'
              : 'bg-white/[0.06] text-label-tertiary',
          )}
        >
          {saving ? 'Guardando…' : editing ? 'Guardar cambios' : operacion === 'venta' ? 'Registrar venta' : 'Registrar compra'}
        </motion.button>
      </div>
    </Sheet>
  )
}
