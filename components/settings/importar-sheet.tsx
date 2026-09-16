'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeftRight, Check, FileUp, Loader2 } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { AccountPicker } from '@/components/ui/account-picker'
import { categoryById } from '@/lib/categories'
import { formatMoney } from '@/lib/format'
import {
  buscarCabecera, detectarColumnas, detectarSeparador, partirCsv, prepararImportacion,
  type Campo, type FilaImportada, type Mapeo,
} from '@/lib/datos'
import { leerTexto } from '@/lib/parseo'
import { useFinance } from '@/lib/store'
import { instanteEnDia } from '@/lib/zona'
import { cn, haptic } from '@/lib/utils'

/**
 * Importar el extracto que descarga el banco.
 *
 * Tres pasos, y el del medio es el que hace que esto funcione: elegir el
 * archivo, decir qué columna es cuál, y revisar antes de escribir.
 *
 * El paso del mapeo existe porque no hay dos bancos que exporten igual.
 * Bancolombia manda el monto con signo en una columna; Davivienda parte
 * débitos y créditos en dos; algunos escriben la fecha como 12/09/2026 y otros
 * como 20260912. La app propone lo que reconoce por el nombre de la columna, y
 * si se equivoca se corrige con dos toques. Adivinar sin preguntar significa
 * importar seiscientos movimientos con el signo al revés y descubrirlo tres
 * días después.
 *
 * La vista previa no es decorativa: enseña lo que se va a escribir, marca lo
 * que no se entendió y señala lo que ya está registrado. Nada se guarda hasta
 * el último botón.
 */

const CAMPOS: { campo: Campo; etiqueta: string; obligatorio?: boolean }[] = [
  { campo: 'fecha', etiqueta: 'Fecha', obligatorio: true },
  { campo: 'descripcion', etiqueta: 'Descripción' },
  { campo: 'monto', etiqueta: 'Valor (con signo)' },
  { campo: 'debito', etiqueta: 'Débitos' },
  { campo: 'credito', etiqueta: 'Créditos' },
  { campo: 'comercio', etiqueta: 'Comercio' },
  { campo: 'referencia', etiqueta: 'Referencia' },
]

type Paso = 'archivo' | 'mapeo' | 'guardando' | 'listo'

export function ImportarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, transactions, addTransaction } = useFinance()
  const entrada = useRef<HTMLInputElement>(null)

  const [paso, setPaso] = useState<Paso>('archivo')
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [filas, setFilas] = useState<string[][]>([])
  const [cabeceras, setCabeceras] = useState<string[]>([])
  const [mapeo, setMapeo] = useState<Mapeo>({})
  const [cuenta, setCuenta] = useState('')
  const [invertir, setInvertir] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardadas, setGuardadas] = useState(0)

  /** Las referencias que ya están registradas: es lo que marca los duplicados. */
  const existentes = useMemo(
    () => new Set(transactions.map((t) => t.externalId).filter(Boolean) as string[]),
    [transactions],
  )

  const propuestas = useMemo<FilaImportada[]>(() => {
    if (!filas.length || !cuenta) return []
    return prepararImportacion({
      filas, mapeo, accountId: cuenta, invertir, existentes,
      // La categoría se propone con el mismo intérprete que lee los SMS del
      // banco: el comercio que escribe un extracto es el mismo texto.
      categorizar: (texto, tipo) => {
        const l = leerTexto(texto)
        return l.tipo === tipo ? l.categoryId : null
      },
    })
  }, [filas, mapeo, cuenta, invertir, existentes])

  const importables = propuestas.filter((p) => !p.problema && !p.duplicada)
  const conProblema = propuestas.filter((p) => p.problema)
  const duplicadas = propuestas.filter((p) => p.duplicada)

  async function abrir(f: File) {
    setError(null)
    setNombreArchivo(f.name)
    try {
      const texto = await f.text()
      const separador = detectarSeparador(texto)
      const todas = partirCsv(texto, separador)
      if (todas.length < 2) { setError('El archivo no tiene filas que importar.'); return }

      // Los extractos traen líneas de logo y número de cuenta antes de la
      // cabecera de verdad. Se busca dónde empieza la tabla.
      const iCabecera = buscarCabecera(todas)
      const cabs = todas[iCabecera].map((c) => c.trim())
      setCabeceras(cabs)
      setFilas(todas.slice(iCabecera + 1))
      setMapeo(detectarColumnas(cabs))
      if (!cuenta && accounts.length) setCuenta(accounts[0].id)
      setPaso('mapeo')
    } catch {
      setError('No se pudo leer el archivo.')
    }
  }

  async function guardar() {
    if (!importables.length) return
    haptic([16, 40])
    setPaso('guardando')
    let n = 0
    for (const p of importables) {
      await addTransaction({
        accountId: cuenta,
        categoryId: p.categoryId,
        amount: p.monto,
        type: p.tipo,
        currency: 'COP',
        description: p.descripcion,
        merchant: p.comercio,
        occurredAt: instanteEnDia(p.dia),
        source: 'import',
        externalId: p.externalId,
      })
      n++
    }
    setGuardadas(n)
    setPaso('listo')
  }

  function cerrar() {
    onClose()
    // El reinicio espera a que la hoja termine de salir: vaciarlo antes deja
    // ver el paso uno mientras se va.
    setTimeout(() => {
      setPaso('archivo'); setFilas([]); setCabeceras([]); setMapeo({})
      setError(null); setGuardadas(0); setNombreArchivo('')
    }, 450)
  }

  return (
    <Sheet open={open} onClose={cerrar}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-1 text-[19px] font-bold text-label">Importar un extracto</h2>

        {/* ---- Paso 1: el archivo ---- */}
        {paso === 'archivo' && (
          <>
            <p className="mb-4 text-[13.5px] leading-relaxed text-label-secondary">
              El CSV que descarga tu banco. En el siguiente paso dices qué columna es
              la fecha y cuál el valor, y verás todo antes de que se guarde nada.
            </p>
            <input
              ref={entrada}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void abrir(f)
              }}
            />
            <button
              onClick={() => { haptic(10); entrada.current?.click() }}
              className="press flex h-[120px] w-full flex-col items-center justify-center gap-2 rounded-2xl
                         border border-dashed border-hairline bg-fill-1 text-label-secondary"
            >
              <FileUp size={26} />
              <span className="text-[14px] font-medium">Elegir el archivo</span>
            </button>
            {error && <p className="mt-2 text-center text-[12.5px] text-accent-orange">{error}</p>}
          </>
        )}

        {/* ---- Paso 2: el mapeo y la vista previa ---- */}
        {paso === 'mapeo' && (
          <>
            <p className="mb-3 truncate text-[12.5px] text-label-tertiary">
              {nombreArchivo} · {filas.length} filas
            </p>

            <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              ¿A qué cuenta van?
            </p>
            <div className="mb-4">
              <AccountPicker accountId={cuenta} onChange={(id) => setCuenta(id)} />
            </div>

            <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              Qué columna es cuál
            </p>
            <div className="mb-3 space-y-1.5">
              {CAMPOS.map(({ campo, etiqueta, obligatorio }) => (
                <div key={campo} className="flex items-center gap-2">
                  <span className="w-[112px] shrink-0 text-[13px] text-label-secondary">
                    {etiqueta}
                    {obligatorio && <span className="text-accent-red"> *</span>}
                  </span>
                  <select
                    value={mapeo[campo] ?? -1}
                    onChange={(e) => setMapeo((m) => ({ ...m, [campo]: Number(e.target.value) }))}
                    className="min-w-0 flex-1 rounded-xl border border-hairline bg-fill-2 px-3 py-2
                               text-[13.5px] text-label focus:border-accent-blue/50 focus:outline-none"
                  >
                    <option value={-1}>— sin usar —</option>
                    {cabeceras.map((c, i) => (
                      <option key={i} value={i}>{c || `Columna ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button
              onClick={() => { haptic(6); setInvertir((v) => !v) }}
              aria-pressed={invertir}
              className={cn(
                'press mb-4 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px]',
                invertir ? 'border-accent-orange/40 bg-accent-orange/10 text-label' : 'border-hairline text-label-secondary',
              )}
            >
              <ArrowLeftRight size={14} className="shrink-0" />
              <span className="text-left">
                Invertir el signo
                <span className="block text-[11.5px] text-label-tertiary">
                  Si los gastos salen como ingresos en la vista previa
                </span>
              </span>
            </button>

            {/* La vista previa. Cinco filas bastan para ver si el mapeo acertó. */}
            <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
              Vista previa
            </p>
            <div className="mb-3 space-y-1 rounded-2xl border border-hairline bg-fill-1 p-2.5">
              {propuestas.slice(0, 5).map((p) => (
                <div key={p.linea} className={cn('flex items-baseline gap-2 text-[12.5px]', (p.problema || p.duplicada) && 'opacity-50')}>
                  <span className="w-[68px] shrink-0 tabular-nums text-label-tertiary">
                    {p.dia || '—'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-label">{p.descripcion}</span>
                  <span className="shrink-0 text-[11px] text-label-tertiary">
                    {categoryById(p.categoryId).name}
                  </span>
                  <span className={cn(
                    'tnum w-[82px] shrink-0 text-right font-medium',
                    p.tipo === 'income' ? 'text-accent-green' : 'text-label',
                  )}>
                    {p.tipo === 'income' ? '+' : '−'}{formatMoney(p.monto)}
                  </span>
                </div>
              ))}
              {!propuestas.length && (
                <p className="py-2 text-center text-[12.5px] text-label-tertiary">
                  Elige una cuenta para ver la vista previa.
                </p>
              )}
            </div>

            {(conProblema.length > 0 || duplicadas.length > 0) && (
              <div className="mb-3 flex gap-2 rounded-xl bg-accent-orange/10 p-3">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-accent-orange" />
                <p className="text-[12.5px] leading-snug text-label-secondary">
                  {conProblema.length > 0 && (
                    <>
                      {conProblema.length} {conProblema.length === 1 ? 'fila se salta' : 'filas se saltan'} porque
                      no se entendió la fecha o el importe
                      {conProblema[0]?.problema ? ` (${conProblema[0].problema.toLowerCase()})` : ''}.{' '}
                    </>
                  )}
                  {duplicadas.length > 0 && (
                    <>{duplicadas.length} {duplicadas.length === 1 ? 'ya estaba' : 'ya estaban'} registradas y no se repiten.</>
                  )}
                </p>
              </div>
            )}

            <button
              onClick={guardar}
              disabled={!importables.length}
              className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[16px] font-semibold text-white
                         shadow-glow disabled:bg-fill-2 disabled:text-label-tertiary disabled:shadow-none"
            >
              {importables.length
                ? `Importar ${importables.length} ${importables.length === 1 ? 'movimiento' : 'movimientos'}`
                : 'No hay nada que importar'}
            </button>
          </>
        )}

        {paso === 'guardando' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 size={28} className="animate-spin text-accent-blue" />
            <p className="text-[14px] text-label-secondary">Guardando…</p>
          </div>
        )}

        {paso === 'listo' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-green/20 text-accent-green">
              <Check size={30} strokeWidth={3} />
            </div>
            <p className="text-[17px] font-semibold text-label">
              {guardadas} {guardadas === 1 ? 'movimiento importado' : 'movimientos importados'}
            </p>
            <p className="max-w-[280px] text-[13px] leading-relaxed text-label-secondary">
              Quedaron marcados como importados, así que se pueden distinguir de los
              que registraste a mano. Volver a importar el mismo archivo no los
              duplicará.
            </p>
            <button
              onClick={cerrar}
              className="press mt-2 h-[48px] w-full rounded-2xl bg-fill-3 text-[16px] font-semibold text-label"
            >
              Listo
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
