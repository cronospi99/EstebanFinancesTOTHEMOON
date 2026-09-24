/**
 * En qué espacio está la app: las finanzas personales o las del negocio.
 *
 * Son dos libros separados con la misma app encima. Cada fila del servidor
 * lleva su espacio, y la app solo lee y escribe el que está abierto: el
 * patrimonio, los presupuestos y la declaración de renta de la persona no
 * pueden sumar la caja de la empresa, ni la nómina competir con el mercado.
 *
 * Vive en el módulo y no en React porque lo necesitan los traductores de filas
 * del store (`accountToRow` y compañía), que son funciones sueltas: así cada
 * alta sale con su espacio sin que cada una de las diecisiete escrituras tenga
 * que acordarse de ponerlo.
 *
 * Cambiar de espacio recarga la página a propósito. Es un cambio raro, y la
 * recarga es la única forma de estar seguros de que nada del espacio anterior
 * —un cobro automático a medias, una escritura en vuelo— acaba guardándose en
 * el nuevo.
 */
export type Espacio = 'personal' | 'negocio'

export const ESPACIOS: Record<Espacio, { nombre: string; corto: string; descripcion: string }> = {
  personal: {
    nombre: 'Finanzas personales',
    corto: 'Personal',
    descripcion: 'Tu dinero: cuentas, gastos, metas e inversiones.',
  },
  negocio: {
    nombre: 'Empresa / Negocio',
    corto: 'Negocio',
    descripcion: 'La caja del negocio: ventas, proveedores, nómina e impuestos.',
  },
}

const CLAVE = 'eftm.espacio'

function leer(): Espacio {
  try {
    return localStorage.getItem(CLAVE) === 'negocio' ? 'negocio' : 'personal'
  } catch {
    return 'personal'
  }
}

// En el servidor no hay localStorage: se arranca en personal, que es lo que
// era todo antes de que existieran los espacios.
let actual: Espacio = typeof window === 'undefined' ? 'personal' : leer()

export const espacioActual = (): Espacio => actual

/*
 * ---- Un servidor sin la migración ----------------------------------------
 * Si el código llega a producción antes que la migración de espacios, cada
 * consulta filtrada por `espacio` y cada alta con esa columna fallaría, y la
 * app dejaría de sincronizar entera. En vez de eso, la carga detecta que la
 * columna no existe, lo apunta aquí, y la app sigue como antes de que
 * existieran los espacios: todo es personal y el negocio queda apagado hasta
 * que se aplique. Se recuerda entre aperturas para que la pantalla de entrada
 * no ofrezca un modo que no va a funcionar.
 */
const CLAVE_SIN_MIGRACION = 'eftm.espacio.sin-migracion'

let sinColumna = (() => {
  try { return typeof window !== 'undefined' && localStorage.getItem(CLAVE_SIN_MIGRACION) === '1' } catch { return false }
})()

/** ¿El servidor conoce la columna `espacio`? En Modo Demo siempre. */
export const servidorConEspacios = () => !sinColumna

// Quien pinta la disponibilidad del negocio se entera cuando la carga
// descubre que falta la migración, sin esperar a la siguiente apertura.
const oyentes = new Set<() => void>()
export function escucharEspacios(fn: () => void) {
  oyentes.add(fn)
  return () => { oyentes.delete(fn) }
}

export function marcarServidorSinEspacios(sin: boolean) {
  const cambia = sin !== sinColumna
  sinColumna = sin
  if (cambia) oyentes.forEach((fn) => fn())
  try {
    if (sin) localStorage.setItem(CLAVE_SIN_MIGRACION, '1')
    else localStorage.removeItem(CLAVE_SIN_MIGRACION)
  } catch { /* noop */ }
}

/** ¿El fallo de una consulta es que la columna `espacio` todavía no existe? */
export function faltaColumnaEspacio(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  if (!e) return false
  return e.code === '42703' || e.code === 'PGRST204' || /espacio/.test(e.message ?? '')
}

/**
 * Lo que cada fila nueva lleva del espacio: la columna, o nada si el servidor
 * todavía no la tiene. Se expande dentro de los traductores de filas.
 */
export const columnaEspacio = (): { espacio?: Espacio } => (sinColumna ? {} : { espacio: actual })

/** Abre otro espacio. Recarga la página: ver la nota de arriba. */
export function cambiarEspacio(nuevo: Espacio) {
  try { localStorage.setItem(CLAVE, nuevo) } catch { /* modo privado: dura lo que la pestaña */ }
  if (nuevo === actual) return
  actual = nuevo
  window.location.reload()
}
