'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Loader2 } from 'lucide-react'
import { cn, haptic } from '@/lib/utils'

/**
 * Tomarle una foto a la factura y que el formulario se rellene solo.
 *
 * Es el gesto más corto que existe para registrar un gasto en efectivo: el
 * tiquete del almuerzo, el recibo del taller, la factura del mercado que no
 * pasó por ninguna tarjeta y que por lo tanto no genera ningún SMS.
 *
 * ---------------------------------------------------------------------------
 * Dos caminos, y el bueno primero
 * ---------------------------------------------------------------------------
 * Antes de subir nada se intenta reconocer el texto en el propio teléfono con
 * `TextDetector`, la API de detección de texto del navegador. Donde existe
 * —Chrome en Android— la foto no sale del dispositivo, no cuesta nada y
 * responde en menos de un segundo.
 *
 * Donde no existe —iOS, escritorio— se sube al servidor, que la pasa por un
 * servicio de OCR. Ahí la foto sí viaja, y por eso se avisa la primera vez.
 *
 * En los dos casos, lo que se extrae pasa por el mismo intérprete que lee los
 * SMS del banco (`parseo.ts`), así que el reconocimiento del Éxito o de
 * Terpel mejora en los dos caminos a la vez.
 *
 * ---------------------------------------------------------------------------
 * La foto no se guarda
 * ---------------------------------------------------------------------------
 * Ni aquí ni en el servidor. Una factura lleva el comercio, la fecha, la hora
 * y a veces los últimos dígitos de la tarjeta; conservarla sin necesitarla
 * sería acumular un riesgo a cambio de nada. Lo que queda es el movimiento que
 * el usuario confirme.
 */

export interface LecturaFactura {
  monto: number
  moneda: 'COP' | 'USD'
  tipo: 'expense' | 'income'
  comercio: string | null
  categoryId: string | null
  dia: string | null
  confianza: number
  descripcion: string
}

type Estado = 'quieto' | 'leyendo' | 'error'

/** Lo que cabe sin perder legibilidad en un tiquete. Más píxeles no leen mejor. */
const LADO_MAXIMO = 1600

/**
 * Reduce la foto antes de subirla.
 *
 * Una foto de un móvil moderno son cuatro o cinco megas, y sobre datos móviles
 * eso es medio minuto de espera para leer doce caracteres. A 1.600 píxeles de
 * lado y calidad 0,8 pesa unos doscientos kilos y el OCR acierta igual: el
 * límite no es la resolución, es el enfoque.
 */
async function reducir(archivo: File): Promise<string> {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  lienzo.getContext('2d')?.drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close?.()

  return lienzo.toDataURL('image/jpeg', 0.8)
}

/** El reconocedor del propio navegador, si lo hay. */
async function textoEnElDispositivo(archivo: File): Promise<string | null> {
  const Detector = (window as unknown as {
    TextDetector?: new () => { detect: (img: ImageBitmapSource) => Promise<{ rawValue: string }[]> }
  }).TextDetector
  if (!Detector) return null

  try {
    const bitmap = await createImageBitmap(archivo)
    const bloques = await new Detector().detect(bitmap)
    bitmap.close?.()
    const texto = bloques.map((b) => b.rawValue).join('\n').trim()
    return texto.length > 8 ? texto : null
  } catch {
    return null
  }
}

export function FotoFactura({ onLeida }: { onLeida: (l: LecturaFactura) => void }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [estado, setEstado] = useState<Estado>('quieto')
  const [mensaje, setMensaje] = useState('')

  async function procesar(archivo: File) {
    setEstado('leyendo')
    setMensaje('')

    try {
      // 1. El camino corto: el propio teléfono.
      const local = await textoEnElDispositivo(archivo)

      const cuerpo = local
        ? { texto: local }
        : { imagen: await reducir(archivo) }

      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const datos = await res.json()

      if (!datos?.ok) {
        setEstado('error')
        setMensaje(datos?.error || 'No se pudo leer la factura.')
        return
      }

      if (!datos.lectura?.monto) {
        setEstado('error')
        setMensaje('Se leyó la factura pero no se encontró el total. Escríbelo a mano.')
        return
      }

      haptic([12, 30])
      setEstado('quieto')
      onLeida(datos.lectura as LecturaFactura)
    } catch {
      setEstado('error')
      setMensaje('No se pudo procesar la foto. Prueba otra vez o escribe el monto.')
    }
  }

  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        // `environment` abre la cámara trasera directamente en el móvil, sin
        // pasar por la galería. En escritorio el atributo se ignora y se abre
        // el selector de archivos, que es lo correcto ahí.
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          // Se limpia el valor para que elegir la misma foto dos veces seguidas
          // vuelva a disparar el evento.
          e.target.value = ''
          if (archivo) void procesar(archivo)
        }}
      />

      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={() => { haptic(10); entrada.current?.click() }}
        disabled={estado === 'leyendo'}
        aria-label="Tomar foto de la factura"
        className={cn(
          'press flex items-center gap-1.5 rounded-pill border px-3 py-1 text-[13px] font-semibold transition-colors',
          estado === 'leyendo'
            ? 'border-transparent bg-fill-3 text-label-secondary'
            : 'border-hairline text-label-secondary',
        )}
      >
        {estado === 'leyendo'
          ? <Loader2 size={13} className="animate-spin" />
          : <Camera size={13} />}
        {estado === 'leyendo' ? 'Leyendo' : 'Factura'}
      </motion.button>

      {estado === 'error' && mensaje && (
        <p className="w-full text-center text-[12px] leading-snug text-accent-orange">{mensaje}</p>
      )}
    </>
  )
}
