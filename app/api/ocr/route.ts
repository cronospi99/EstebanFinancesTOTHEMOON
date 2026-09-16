import { NextResponse } from 'next/server'
import { descripcionDe, leerTexto } from '@/lib/parseo'

/**
 * Leer una factura de papel.
 *
 * Le llega la foto del tiquete del supermercado o del recibo del taller, saca
 * el texto y lo pasa por el mismo intérprete que lee los SMS del banco. De ahí
 * salen el total, el comercio y una categoría propuesta, y el formulario se
 * abre relleno.
 *
 * ---------------------------------------------------------------------------
 * Por qué el OCR no se hace aquí
 * ---------------------------------------------------------------------------
 * Reconocer texto en una foto torcida, con sombra y en papel térmico
 * medio borrado es un problema de visión por computador, no de programación.
 * Las opciones eran tres:
 *
 *  · Meter Tesseract en el navegador. Son unos doce megas de WebAssembly que
 *    se descargan la primera vez, en un móvil, para leer un tiquete. Y con
 *    papel térmico acierta poco.
 *  · Un modelo propio. No.
 *  · Un servicio, que es lo que hay. Se prueban en cadena los que estén
 *    configurados, igual que hacen las rutas de precios y de divisa.
 *
 * Sin ninguna llave configurada, la ruta lo dice con todas las letras en vez
 * de fallar con un 500. El navegador tiene además su propio camino corto —la
 * API `TextDetector`, que existe en Chrome de Android— y la pantalla lo
 * intenta antes de subir nada: si funciona, la foto no sale del teléfono.
 *
 * ---------------------------------------------------------------------------
 * La foto no se guarda
 * ---------------------------------------------------------------------------
 * Ni aquí ni en el proveedor más allá de lo que dure la petición. Una factura
 * lleva el nombre del comercio, la fecha, la hora y a veces los últimos
 * dígitos de la tarjeta; guardarla para nada sería acumular un riesgo que no
 * hace falta correr. Lo que se conserva es lo que el usuario confirme: un
 * movimiento con su monto y su comercio.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Tope de subida. Una foto de un tiquete comprimida no pasa de un mega. */
const MAX_BYTES = 6 * 1024 * 1024

const PLAZO_MS = 20_000

interface Proveedor {
  nombre: string
  /** Si no está configurado, se salta sin ruido. */
  disponible: () => boolean
  leer: (base64: string, tipo: string) => Promise<string | null>
}

async function conPlazo(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PLAZO_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * OCR.space. Cupo gratuito generoso y una llave que se saca en un minuto.
 *
 * `OCREngine: 2` es el motor nuevo: reconoce mucho mejor los tiquetes de papel
 * térmico, que es justo el caso. `isTable` le dice que el documento tiene
 * columnas, y con eso deja de mezclar el precio de una línea con el nombre del
 * artículo de la siguiente.
 */
const ocrSpace: Proveedor = {
  nombre: 'ocr.space',
  disponible: () => Boolean(process.env.OCR_SPACE_API_KEY),
  leer: async (base64, tipo) => {
    const cuerpo = new URLSearchParams({
      base64Image: `data:${tipo};base64,${base64}`,
      language: 'spa',
      isTable: 'true',
      scale: 'true',
      OCREngine: '2',
    })
    const r = await conPlazo('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: process.env.OCR_SPACE_API_KEY!, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo,
    })
    if (!r.ok) return null
    const datos = await r.json()
    if (datos?.IsErroredOnProcessing) return null
    const texto = datos?.ParsedResults?.[0]?.ParsedText
    return typeof texto === 'string' && texto.trim() ? texto : null
  },
}

/** Google Cloud Vision. Más caro y bastante más preciso. */
const vision: Proveedor = {
  nombre: 'google-vision',
  disponible: () => Boolean(process.env.GOOGLE_VISION_API_KEY),
  leer: async (base64) => {
    const r = await conPlazo(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            // DOCUMENT_TEXT_DETECTION y no TEXT_DETECTION: el primero entiende
            // que hay bloques y líneas, y en un tiquete eso es la diferencia
            // entre leer el total y leer una sopa de números.
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: { languageHints: ['es'] },
          }],
        }),
      },
    )
    if (!r.ok) return null
    const datos = await r.json()
    const texto = datos?.responses?.[0]?.fullTextAnnotation?.text
    return typeof texto === 'string' && texto.trim() ? texto : null
  },
}

const PROVEEDORES = [vision, ocrSpace]

export async function POST(request: Request) {
  let base64 = ''
  let tipo = 'image/jpeg'

  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const cuerpo = await request.json()
      const crudo: string = cuerpo?.imagen ?? cuerpo?.image ?? ''
      // Admite tanto el data URL entero como el base64 pelado: quien llama
      // desde un `FileReader` tiene lo primero y no debería tener que cortarlo.
      const m = crudo.match(/^data:([^;]+);base64,(.*)$/s)
      if (m) { tipo = m[1]; base64 = m[2] } else { base64 = crudo }
      // El texto ya reconocido en el propio teléfono llega por aquí y se salta
      // los proveedores: no hay nada que subir.
      if (typeof cuerpo?.texto === 'string' && cuerpo.texto.trim()) {
        return interpretar(cuerpo.texto, 'dispositivo')
      }
    } else {
      const form = await request.formData()
      const archivo = form.get('imagen') ?? form.get('file')
      if (!(archivo instanceof File)) {
        return NextResponse.json({ ok: false, error: 'No llegó ninguna imagen.' }, { status: 400 })
      }
      if (archivo.size > MAX_BYTES) {
        return NextResponse.json({ ok: false, error: 'La foto pesa demasiado. Vuelve a tomarla con menos resolución.' }, { status: 413 })
      }
      tipo = archivo.type || tipo
      base64 = Buffer.from(await archivo.arrayBuffer()).toString('base64')
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo leer la imagen.' }, { status: 400 })
  }

  if (!base64) {
    return NextResponse.json({ ok: false, error: 'No llegó ninguna imagen.' }, { status: 400 })
  }
  if (Buffer.byteLength(base64, 'base64') > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'La foto pesa demasiado.' }, { status: 413 })
  }

  const configurados = PROVEEDORES.filter((p) => p.disponible())
  if (!configurados.length) {
    return NextResponse.json({
      ok: false,
      sinConfigurar: true,
      error: 'El servidor no tiene ningún servicio de lectura configurado. Con GOOGLE_VISION_API_KEY o OCR_SPACE_API_KEY en el entorno, este botón empieza a funcionar.',
    }, { status: 501 })
  }

  const intentos: string[] = []
  for (const proveedor of configurados) {
    try {
      const texto = await proveedor.leer(base64, tipo)
      if (texto) return interpretar(texto, proveedor.nombre)
      intentos.push(`${proveedor.nombre}: no reconoció texto`)
    } catch (e) {
      intentos.push(`${proveedor.nombre}: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({
    ok: false,
    error: 'No se pudo leer la factura. Prueba con más luz o escribe el monto a mano.',
    intentos,
  }, { status: 422 })
}

/**
 * El texto reconocido, ya interpretado.
 *
 * Se devuelve también el texto entero: en una factura mal leída, ver lo que el
 * reconocedor entendió es la única forma de saber por qué propuso lo que
 * propuso, y a veces el dato bueno está ahí aunque el intérprete no lo haya
 * pescado.
 */
function interpretar(texto: string, fuente: string) {
  const lectura = leerTexto(texto)
  return NextResponse.json({
    ok: true,
    fuente,
    lectura: {
      monto: lectura.monto,
      moneda: lectura.moneda,
      tipo: lectura.tipo,
      comercio: lectura.comercio,
      categoryId: lectura.categoryId,
      dia: lectura.dia,
      confianza: lectura.confianza,
      descripcion: descripcionDe(lectura),
    },
    texto: texto.slice(0, 1500),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
