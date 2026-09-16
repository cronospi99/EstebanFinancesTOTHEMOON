'use client'

import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, HardDriveDownload, Loader2, Upload } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ImportarSheet } from './importar-sheet'
import {
  crearRespaldo, cuentasACsv, descargar, leerRespaldo, movimientosACsv,
} from '@/lib/datos'
import { useFinance } from '@/lib/store'
import { hoyEnZona } from '@/lib/zona'
import { haptic } from '@/lib/utils'

/**
 * Sacar los datos y volver a meterlos.
 *
 * Tres cosas que parecen la misma y no lo son, y por eso están separadas en la
 * pantalla:
 *
 *  · El CSV es para MIRAR: abrirlo en Excel, mandárselo al contador, cuadrar
 *    la declaración. Pierde información —los bolsillos, las asignaciones, los
 *    enlaces entre un abono y su movimiento— y por eso no vale como respaldo.
 *  · El JSON es para VOLVER: lo trae todo y se puede restaurar entero.
 *  · La importación es para TRAER lo que está en otro lado: el extracto que
 *    descarga el banco.
 *
 * Que un respaldo se pueda restaurar no es un detalle. Un archivo que solo se
 * puede descargar y nunca devolver no es un respaldo: es un recuerdo.
 */
export function DatosCard() {
  const finanzas = useFinance()
  const [importando, setImportando] = useState(false)
  const [estado, setEstado] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState(false)
  const [porRestaurar, setPorRestaurar] = useState<{ datos: Parameters<typeof finanzas.restaurar>[0]; creadoEn: string } | null>(null)
  const archivo = useRef<HTMLInputElement>(null)

  const datos = {
    accounts: finanzas.accounts,
    transactions: finanzas.transactions,
    subscriptions: finanzas.subscriptions,
    debts: finanzas.debts,
    debtPayments: finanzas.debtPayments,
    holdings: finanzas.holdings,
    trades: finanzas.trades,
    goals: finanzas.goals,
    allocations: finanzas.allocations,
    recurringIncomes: finanzas.recurringIncomes,
    budgets: finanzas.budgets,
    settings: finanzas.settings,
  }

  const hoy = hoyEnZona()

  const exportarMovimientos = () => {
    haptic(10)
    descargar(`movimientos-${hoy}.csv`, movimientosACsv(datos, finanzas.fxRate))
  }

  const exportarCuentas = () => {
    haptic(10)
    descargar(`cuentas-${hoy}.csv`, cuentasACsv(datos, finanzas.fxRate))
  }

  const respaldar = () => {
    haptic([12, 30])
    descargar(`respaldo-${hoy}.json`, crearRespaldo(datos), 'application/json')
  }

  async function elegirRespaldo(f: File) {
    setEstado(null)
    const texto = await f.text()
    const leido = leerRespaldo(texto)
    if ('error' in leido) { setEstado(leido.error); return }
    setPorRestaurar({ datos: leido.datos, creadoEn: leido.creadoEn })
  }

  async function confirmarRestauracion() {
    if (!porRestaurar) return
    haptic([18, 40])
    setRestaurando(true)
    const r = await finanzas.restaurar(porRestaurar.datos)
    setRestaurando(false)
    setPorRestaurar(null)
    setEstado(r.ok ? 'Restaurado.' : `Restaurado a medias — ${r.error}`)
  }

  return (
    <>
      <Card className="p-2">
        <Fila
          icono={<FileSpreadsheet size={17} />}
          titulo="Movimientos en CSV"
          detalle={`${finanzas.transactions.length} movimientos, con su monto en pesos y la tasa del día`}
          onClick={exportarMovimientos}
        />
        <Fila
          icono={<FileSpreadsheet size={17} />}
          titulo="Cuentas en CSV"
          detalle="Saldos a hoy, cupos y fechas de corte"
          onClick={exportarCuentas}
        />
        <Fila
          icono={<HardDriveDownload size={17} />}
          titulo="Respaldo completo en JSON"
          detalle="Todo, y se puede volver a cargar"
          onClick={respaldar}
        />
        <Fila
          icono={<Upload size={17} />}
          titulo="Importar un extracto"
          detalle="El CSV que descarga tu banco, diciéndole qué columna es cuál"
          onClick={() => { haptic(8); setImportando(true) }}
        />
        <Fila
          icono={restaurando ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
          titulo="Restaurar un respaldo"
          detalle="Vuelve a como estaba en el archivo"
          onClick={() => { haptic(8); archivo.current?.click() }}
        />

        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void elegirRespaldo(f)
          }}
        />
      </Card>

      {estado && <p className="mt-2 px-1 text-[12.5px] text-label-secondary">{estado}</p>}

      {/* La confirmación de restaurar dice exactamente qué va a pasar. Es la
          única acción de esta pantalla que puede pisar datos buenos. */}
      {porRestaurar && (
        <div className="mt-2 rounded-2xl border border-accent-orange/30 bg-accent-orange/[0.07] p-4">
          <p className="mb-1 text-[14px] font-semibold text-label">
            ¿Restaurar el respaldo{porRestaurar.creadoEn ? ` del ${porRestaurar.creadoEn.slice(0, 10)}` : ''}?
          </p>
          <p className="mb-3 text-[12.5px] leading-snug text-label-secondary">
            Trae {porRestaurar.datos.accounts?.length ?? 0} cuentas y{' '}
            {porRestaurar.datos.transactions?.length ?? 0} movimientos. Lo que tenga el
            mismo identificador queda como dice el archivo; lo que no esté en él se
            queda como está ahora.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPorRestaurar(null)}
              className="press flex-1 rounded-xl border border-hairline py-2.5 text-[14px] text-label-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarRestauracion}
              disabled={restaurando}
              className="press flex-1 rounded-xl bg-accent-orange py-2.5 text-[14px] font-semibold text-black"
            >
              {restaurando ? 'Restaurando…' : 'Restaurar'}
            </button>
          </div>
        </div>
      )}

      <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-label-tertiary">
        Los CSV usan punto y coma y llevan marca de codificación, que es lo que hace
        que Excel en español los abra con las columnas en su sitio y sin acentos
        rotos. El respaldo en JSON es el único que lo lleva todo.
      </p>

      <ImportarSheet open={importando} onClose={() => setImportando(false)} />
    </>
  )
}

function Fila({
  icono, titulo, detalle, onClick,
}: {
  icono: React.ReactNode
  titulo: string
  detalle: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="press flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fill-3 text-label-secondary">
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-label">{titulo}</span>
        <span className="block truncate text-[12px] text-label-tertiary">{detalle}</span>
      </span>
    </button>
  )
}
