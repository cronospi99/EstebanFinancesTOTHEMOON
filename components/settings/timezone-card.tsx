'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Globe, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  desfaseDe, fijarZona, horaEn, zonaDelDispositivo, zonaElegida, zonaValida,
} from '@/lib/zona'
import { cn, haptic } from '@/lib/utils'

/**
 * Las que va a buscar alguien desde Colombia.
 *
 * Una lista corta y no las cuatrocientas que conoce el navegador: se elige zona
 * una vez en la vida, y un desplegable con todas es peor que un buscador. Las
 * que no estén se encuentran escribiendo.
 */
const FRECUENTES = [
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
]

/** «America/Bogota» → «Bogotá». El continente no lo lee nadie. */
const nombreCorto = (zona: string) =>
  zona.split('/').pop()!.replace(/_/g, ' ')
    .replace('Bogota', 'Bogotá').replace('Mexico City', 'Ciudad de México')
    .replace('Sao Paulo', 'São Paulo').replace('Buenos Aires', 'Buenos Aires')

/** Todas las zonas que conozca el navegador, para el buscador. */
function todasLasZonas(): string[] {
  try {
    // Disponible en Safari 17 y Chrome 130+. Donde no esté, quedan las de la
    // lista corta, que cubren de sobra a quien usa esto.
    const z = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.('timeZone')
    return z ?? FRECUENTES
  } catch {
    return FRECUENTES
  }
}

/**
 * Elegir la zona horaria.
 *
 * Existe porque «qué día es este gasto» depende de dónde esté el que lo hizo:
 * sin esto, un gasto de las once de la noche en Bogotá se registraba con la
 * fecha del día siguiente. Por defecto se sigue al teléfono, que acierta casi
 * siempre; el selector está para cuando no —un viaje del que no se quiere que
 * se muevan las cuentas, o un teléfono con la zona mal puesta—.
 */
export function TimezoneCard() {
  const [elegida, setElegida] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  // La hora de ejemplo se recalcula cada medio minuto: es lo que deja
  // comprobar de un vistazo que la zona elegida es la correcta.
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    setElegida(zonaElegida())
    const id = setInterval(() => setAhora(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const delTeléfono = zonaDelDispositivo()
  const activa = elegida ?? delTeléfono

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return FRECUENTES
    return todasLasZonas()
      .filter((z) => z.toLowerCase().replace(/_/g, ' ').includes(q))
      .slice(0, 12)
  }, [busqueda])

  const elegir = (zona: string | null) => {
    haptic(8)
    fijarZona(zona)
    setElegida(zona)
    setBuscando(false)
    setBusqueda('')
  }

  const fila = (zona: string, etiqueta: string, sigueAlTeléfono = false) => {
    const marcada = sigueAlTeléfono ? elegida === null : elegida === zona
    return (
      <button
        key={sigueAlTeléfono ? '__auto' : zona}
        onClick={() => elegir(sigueAlTeléfono ? null : zona)}
        className="press-soft flex w-full items-center gap-3 px-4 py-3 text-left active:bg-fill-1"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-label">{etiqueta}</p>
          <p className="tnum truncate text-[12px] text-label-tertiary">
            {desfaseDe(zona, ahora)} · son las {horaEn(zona, ahora)}
          </p>
        </div>
        {marcada && <Check size={17} className="shrink-0 text-accent-blue" />}
      </button>
    )
  }

  return (
    <>
      <Card className="divide-y divide-hairline overflow-hidden">
        {/* Seguir al teléfono es lo primero y lo que viene puesto: quien no
            tenga un motivo para cambiarlo no debería tener que decidir. */}
        {fila(delTeléfono, `Automática · ${nombreCorto(delTeléfono)}`, true)}

        {/* Solo si ya eligió una distinta, para no repetirla dos veces. */}
        {elegida && elegida !== delTeléfono && fila(elegida, nombreCorto(elegida))}

        <button
          onClick={() => { haptic(6); setBuscando((v) => !v) }}
          className="press-soft flex w-full items-center gap-3 px-4 py-3 text-left active:bg-fill-1"
        >
          <Globe size={17} className="shrink-0 text-label-tertiary" />
          <span className="flex-1 text-[15px] text-label">
            {buscando ? 'Cerrar' : 'Elegir otra zona'}
          </span>
        </button>

        {buscando && (
          <div className="p-3">
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-hairline bg-fill-2 px-3 py-2">
              <Search size={15} className="shrink-0 text-label-tertiary" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Bogotá, Madrid, Lima…"
                autoFocus
                className="w-full bg-transparent text-[15px] text-label placeholder:text-label-tertiary focus:outline-none"
              />
            </div>
            <div className="max-h-[280px] divide-y divide-hairline overflow-y-auto">
              {resultados.map((z) => (
                <button
                  key={z}
                  onClick={() => elegir(z)}
                  className={cn(
                    'press-soft flex w-full items-center gap-3 py-2.5 text-left active:bg-fill-1',
                    activa === z && 'text-accent-blue',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-label">{nombreCorto(z)}</p>
                    <p className="tnum truncate text-[11px] text-label-tertiary">
                      {z} · {desfaseDe(z, ahora)}
                    </p>
                  </div>
                  {activa === z && <Check size={15} className="shrink-0 text-accent-blue" />}
                </button>
              ))}
              {!resultados.length && (
                <p className="py-4 text-center text-[13px] text-label-tertiary">
                  Ninguna zona se llama así.
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      <p className="mt-2 px-1 text-[12px] leading-relaxed text-label-tertiary">
        Decide a qué día pertenece cada movimiento. Con la zona equivocada, un
        gasto de las once de la noche aparece fechado al día siguiente.
        {!zonaValida(activa) && ' La zona guardada no la reconoce este navegador.'}
      </p>
    </>
  )
}
