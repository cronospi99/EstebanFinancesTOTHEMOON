'use client'

import { useState } from 'react'
import { Store } from 'lucide-react'
import { Segmented } from '@/components/ui/segmented'
import { cambiarEspacio, type Espacio } from '@/lib/espacio'
import { useEspacio, useNegocioDisponible } from '@/lib/use-espacio'
import { cn } from '@/lib/utils'

/** Por qué no se puede abrir el negocio, dicho de forma que se pueda arreglar. */
export const AVISO_SIN_MIGRACION =
  'El modo Negocio necesita la migración «espacios_personal_y_negocio» en Supabase. ' +
  'Hasta que se aplique, todo se guarda como personal.'

/**
 * Personal o negocio, a un toque.
 *
 * Vive en el resumen y en la lateral, no solo en la pantalla de entrada: esa
 * sale una vez al día, y quien lleva las dos cosas cambia de una a otra
 * varias veces en la misma tarde. Cambiar recarga la app —ver `lib/espacio.ts`—.
 */
export function SelectorEspacio({ className, id = 'espacio' }: { className?: string; id?: string }) {
  const espacio = useEspacio()
  const disponible = useNegocioDisponible()
  const [aviso, setAviso] = useState(false)

  return (
    <div className={className}>
      <Segmented<Espacio>
        id={id}
        value={espacio}
        onChange={(e) => {
          if (e === 'negocio' && !disponible) { setAviso(true); return }
          cambiarEspacio(e)
        }}
        options={[
          { value: 'personal', label: 'Personal' },
          { value: 'negocio', label: 'Negocio' },
        ]}
      />
      {aviso && (
        <p className="mt-2 px-1 text-[12px] leading-relaxed text-accent-orange">{AVISO_SIN_MIGRACION}</p>
      )}
    </div>
  )
}

/**
 * La marca de que se está en el negocio.
 *
 * Solo ahí: quien nunca abre el negocio no necesita que cada pantalla le
 * recuerde que está en lo personal. Quien sí lo abre necesita saberlo siempre,
 * porque la pregunta «¿dónde están mis cuentas?» delante de la caja de la
 * empresa es exactamente la confusión que hay que evitar.
 */
export function MarcaNegocio({ className }: { className?: string }) {
  const espacio = useEspacio()
  if (espacio !== 'negocio') return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill bg-accent-violet/15 px-2 py-0.5 text-[11px] font-semibold text-accent-violet',
        className,
      )}
    >
      <Store size={11} strokeWidth={2.4} /> Negocio
    </span>
  )
}
