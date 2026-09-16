'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, ScanFace } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  activar, desactivar, estaActiva, fijarMinutos, leerConfig, soportado,
} from '@/lib/biometria'
import { useProfileName } from '@/lib/use-profile'
import { cn, haptic } from '@/lib/utils'

const ESPERAS = [
  { minutos: 0, etiqueta: 'Siempre' },
  { minutos: 2, etiqueta: 'A los 2 min' },
  { minutos: 15, etiqueta: 'A los 15 min' },
  { minutos: 60, etiqueta: 'A la hora' },
]

/**
 * Face ID, Touch ID o huella al volver a la app.
 *
 * La tarjeta dice sin rodeos qué es y qué no es, porque la diferencia importa
 * y prometer de más en seguridad es peor que no ofrecer nada. Es un cerrojo:
 * sirve contra quien coge tu teléfono desbloqueado, que es el riesgo real de
 * una app de finanzas en un móvil que se deja en la mesa. No sirve contra
 * alguien que controle el dispositivo. Ver `biometria.ts`.
 */
export function BiometriaCard() {
  const { name, email } = useProfileName()
  const [puede, setPuede] = useState<boolean | null>(null)
  const [activada, setActivada] = useState(false)
  const [minutos, setMinutos] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    void soportado().then(setPuede)
    setActivada(estaActiva())
    setMinutos(leerConfig()?.minutos ?? 2)
  }, [])

  if (puede === false) {
    return (
      <Card className="flex items-start gap-3 p-4">
        <div className="mt-0.5 shrink-0 text-label-tertiary"><Fingerprint size={17} /></div>
        <p className="text-[13px] leading-snug text-label-secondary">
          Este dispositivo no le ofrece al navegador ni Face ID, ni Touch ID, ni
          lector de huella. En un iPhone hace falta tener la app instalada en la
          pantalla de inicio.
        </p>
      </Card>
    )
  }

  const alternar = async () => {
    haptic(10)
    setError(null)

    if (activada) {
      desactivar()
      setActivada(false)
      return
    }

    setOcupado(true)
    const r = await activar({ id: email || 'usuario', nombre: name || email || 'Mi cuenta' })
    setOcupado(false)
    if (r.ok) {
      setActivada(true)
      setMinutos(leerConfig()?.minutos ?? 2)
    } else {
      setError(r.error)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          activada ? 'bg-accent-blue/15 text-accent-blue' : 'bg-fill-3 text-label-secondary',
        )}>
          <ScanFace size={17} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-label">Bloquear con biometría</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-label-secondary">
            {activada
              ? 'Al volver a la app pide tu cara o tu huella antes de enseñar nada.'
              : 'Pide Face ID, Touch ID o tu huella para abrir la app.'}
          </p>
        </div>

        <button
          onClick={alternar}
          disabled={ocupado || puede === null}
          aria-pressed={activada}
          className={cn(
            'press shrink-0 rounded-pill px-3 py-1.5 text-[13px] font-semibold transition-colors',
            activada ? 'border border-hairline text-label-secondary' : 'bg-accent-blue text-white',
          )}
        >
          {ocupado ? '…' : activada ? 'Quitar' : 'Activar'}
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-accent-orange">{error}</p>}

      {activada && (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
            Volver a pedirla
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ESPERAS.map((e) => (
              <button
                key={e.minutos}
                onClick={() => { haptic(6); fijarMinutos(e.minutos); setMinutos(e.minutos) }}
                aria-pressed={minutos === e.minutos}
                className={cn(
                  'press rounded-pill px-3 py-1.5 text-[13px] transition-colors',
                  minutos === e.minutos ? 'bg-fill-4 font-medium text-label' : 'border border-hairline text-label-secondary',
                )}
              >
                {e.etiqueta}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] leading-snug text-label-tertiary">
            Cuánto tiempo puede estar la app en segundo plano antes de volver a
            pedirla. «Siempre» la pide cada vez que vuelves, aunque sea de mirar una
            notificación.
          </p>
        </div>
      )}

      <p className="mt-3 border-t border-hairline pt-3 text-[11.5px] leading-relaxed text-label-tertiary">
        Es un cerrojo de esta app en este dispositivo, no un segundo factor de tu
        cuenta: protege de quien coja tu teléfono desbloqueado, no de quien controle
        el dispositivo. Tus datos los sigue guardando tu sesión, que es lo que el
        servidor comprueba de verdad. No se guarda ninguna huella ni ninguna imagen:
        la clave vive en el chip seguro del teléfono y de aquí solo sale un
        identificador público.
      </p>
    </Card>
  )
}
