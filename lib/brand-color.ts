/**
 * Color de marca adaptado a la superficie oscura de las tarjetas.
 *
 * La leyenda del patrimonio enseña el logotipo de cada entidad junto a un
 * cuadro de color, y ese cuadro tiene que ser el de la marca: si Rappi sale
 * naranja en el icono y verde en el punto, el donut deja de poder leerse de un
 * vistazo. Pero la mitad de las marcas colombianas no sirven tal cual sobre
 * #0E0E10 —RappiCard es #141414 y Littio #1B2A4A, que desaparecen— y hay
 * colores repetidos: Davivienda y Daviplata comparten el mismo rojo.
 *
 * Aquí se conserva el tono, que es lo que hace reconocible a una marca, y se
 * corrige lo que impide verla: se sube la luminosidad a una banda legible y se
 * le da croma suficiente para que el tono se distinga. El trabajo se hace en
 * OKLCH porque su luminosidad sí se corresponde con la percibida —en HSL, un
 * amarillo y un azul con la misma L se ven a brillos distintos.
 */

/** Banda de luminosidad legible sobre el fondo de las tarjetas. */
const L_MIN = 0.58
const L_MAX = 0.78
/** Por debajo de este croma el tono no se percibe: es un gris con matiz. */
const C_MIN = 0.11
/** Y por encima, sobre oscuro, el color vibra. */
const C_MAX = 0.19
/** Croma por debajo del cual la marca es acromática y no hay tono que salvar. */
const C_GRIS = 0.02

function aLineal(v: number) {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function aGamma(v: number) {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, c)) * 255)
}

function hexARgb(hex: string): [number, number, number] | null {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** sRGB → OKLCH (L 0-1, C 0-~0.4, H en grados). */
export function aOklch(hex: string): { l: number; c: number; h: number } | null {
  const rgb = hexARgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map(aLineal)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s

  return {
    l: L,
    c: Math.hypot(A, B),
    h: (Math.atan2(B, A) * 180) / Math.PI,
  }
}

/** OKLCH → sRGB hexadecimal, recortando al gamut por reducción de croma. */
export function deOklch({ l, c, h }: { l: number; c: number; h: number }): string {
  const rad = (h * Math.PI) / 180

  const intenta = (croma: number) => {
    const A = croma * Math.cos(rad)
    const B = croma * Math.sin(rad)
    const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3
    const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3
    const s_ = (l - 0.0894841775 * A - 1.2914855480 * B) ** 3
    return [
      +4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
    ]
  }

  // Fuera del gamut sRGB se baja el croma, nunca la luminosidad: perder algo
  // de saturación se nota mucho menos que aclarar u oscurecer el color.
  let croma = c
  for (let i = 0; i < 24; i++) {
    const rgb = intenta(croma)
    if (rgb.every((v) => v >= -0.001 && v <= 1.001)) break
    croma *= 0.92
  }

  return '#' + intenta(croma).map(aGamma).map((v) => v.toString(16).padStart(2, '0')).join('')
}

/**
 * El color de marca, llevado a la banda en la que se ve sobre oscuro.
 *
 * Devuelve `null` cuando la marca es acromática —negro, blanco, gris— porque
 * ahí no hay tono que conservar y forzar uno inventaría una identidad que la
 * entidad no tiene. Quien llama decide con qué rellenar ese hueco.
 */
export function colorLegible(hex: string | undefined): string | null {
  if (!hex) return null
  const lch = aOklch(hex)
  if (!lch || lch.c < C_GRIS) return null
  return deOklch({
    l: Math.min(L_MAX, Math.max(L_MIN, lch.l)),
    c: Math.min(C_MAX, Math.max(C_MIN, lch.c)),
    h: lch.h,
  })
}

/** Distancia perceptual aproximada entre dos colores ya en OKLCH. */
function distancia(a: { l: number; c: number; h: number }, b: { l: number; c: number; h: number }) {
  const dh = (((a.h - b.h + 540) % 360) - 180) * (Math.PI / 180)
  const ax = a.c * Math.cos(0), bx = b.c * Math.cos(dh), by = b.c * Math.sin(dh)
  return Math.hypot(a.l - b.l, ax - bx, by)
}

/**
 * Colores para una lista de entidades, sin dos que se confundan entre sí.
 *
 * Cuando dos marcas caen demasiado cerca —el rojo de Davivienda y el de
 * Daviplata son el mismo— la segunda pasa al color de reserva de su posición:
 * más vale un color prestado que dos porciones que parecen la misma.
 */
export function coloresDeMarca(
  marcas: (string | undefined)[],
  reserva: (i: number) => string,
  /** Por debajo de esto dos colores no se distinguen de un vistazo. */
  minima = 0.12,
): string[] {
  const usados: { l: number; c: number; h: number }[] = []
  return marcas.map((marca, i) => {
    const elegir = (hex: string) => {
      const lch = aOklch(hex)
      if (lch) usados.push(lch)
      return hex
    }
    const propio = colorLegible(marca)
    if (propio) {
      const lch = aOklch(propio)!
      if (usados.every((u) => distancia(u, lch) >= minima)) return elegir(propio)
    }
    return elegir(reserva(i))
  })
}
