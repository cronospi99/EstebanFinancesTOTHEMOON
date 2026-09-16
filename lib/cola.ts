'use client'

/**
 * Cola de escrituras para trabajar sin señal.
 *
 * El caso que la justifica es muy concreto y pasa todas las semanas: sales del
 * parqueadero de un centro comercial, o del sótano de un restaurante, y
 * registras lo que acabas de pagar. No hay señal. Hasta ahora el movimiento
 * quedaba en la pantalla y en el teléfono —la copia local siempre se
 * guardaba— pero la escritura contra el servidor se perdía sin ruido, y al
 * abrir la app en el portátil no estaba.
 *
 * Lo que hay ahora es una cola en IndexedDB que guarda la petición que no pudo
 * salir y la vuelve a lanzar cuando hay red, en el mismo orden.
 *
 * ---------------------------------------------------------------------------
 * Por qué se intercepta el `fetch` y no cada escritura
 * ---------------------------------------------------------------------------
 * La alternativa era envolver las cuarenta y cinco llamadas del store, una a
 * una, en un ayudante que supiera encolar. Habría funcionado y habría sido
 * frágil para siempre: cada escritura nueva —cada tabla que se añada— nace
 * fuera de la cola hasta que alguien se acuerde de meterla, y nadie se
 * acuerda.
 *
 * Interceptando el `fetch` que usa el cliente de Supabase, la cola cubre todo
 * lo que la app escriba hoy y todo lo que escriba mañana, sin que ninguna
 * mutación tenga que saber que existe. Además se guarda la petición exacta que
 * iba a salir, así que reproducirla es literalmente volver a mandarla, no
 * reconstruirla desde el estado y arriesgarse a que no sea la misma.
 *
 * ---------------------------------------------------------------------------
 * Por qué IndexedDB y no localStorage
 * ---------------------------------------------------------------------------
 * Porque localStorage es síncrono y bloquea el hilo de la interfaz, tiene unos
 * cinco megas de tope compartidos con la copia local del estado —que ya vive
 * ahí— y no ofrece ningún orden. IndexedDB da claves autoincrementales, que es
 * justo lo que hace falta: el orden importa, porque una transferencia que
 * mueve saldo y el ajuste de saldo que la acompaña tienen que llegar en el
 * orden en que ocurrieron.
 *
 * Se escribe contra la API nativa en vez de traer `idb`: son sesenta líneas,
 * se usan tres operaciones, y esta app ya paga el precio de cada dependencia
 * en cada arranque desde el móvil.
 *
 * ---------------------------------------------------------------------------
 * El token no se guarda
 * ---------------------------------------------------------------------------
 * La cabecera `Authorization` lleva el JWT de la sesión, que caduca en una
 * hora. Guardarlo sería inútil —si la cola se vacía mañana, el token ya no
 * vale— y además dejaría una credencial escrita en el disco del teléfono. Se
 * quita al encolar y se vuelve a poner, recién sacada de la sesión de ese
 * momento, justo antes de reenviar.
 */
import { fetchConTimeout } from './net'

const BASE = 'eftm'
const ALMACEN = 'cola'
const VERSION = 1

/** Lo que se guarda de una petición que no pudo salir. */
export interface EnCola {
  id?: number
  url: string
  method: string
  /** Sin `Authorization`: ver la nota de arriba. */
  headers: Record<string, string>
  body: string | null
  creadoEn: number
  intentos: number
  /** El último motivo por el que no se pudo reenviar. */
  error?: string
  /** El servidor la rechazó por algo que no se arregla reintentando. */
  fallida?: boolean
  /** Qué tabla toca. Solo para poder decirlo en pantalla. */
  tabla?: string
}

let db: IDBDatabase | null = null
let abriendo: Promise<IDBDatabase | null> | null = null

function abrir(): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db)
  if (abriendo) return abriendo
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)

  abriendo = new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(BASE, VERSION)
    } catch {
      // Safari en navegación privada lanza aquí mismo. Sin cola, pero la app
      // sigue: la copia local del estado no depende de esto.
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      const base = req.result
      if (!base.objectStoreNames.contains(ALMACEN)) {
        // Autoincremental: la clave es el orden, y el orden es media cola.
        base.createObjectStore(ALMACEN, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => { db = req.result; resolve(db) }
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
  return abriendo
}

function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return abrir().then((base) => {
    if (!base) return null
    return new Promise<T | null>((resolve) => {
      let req: IDBRequest<T>
      try {
        req = fn(base.transaction(ALMACEN, modo).objectStore(ALMACEN))
      } catch {
        resolve(null)
        return
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    })
  })
}

// ---- Avisos a la interfaz ---------------------------------------------------
type Oyente = (pendientes: number) => void
const oyentes = new Set<Oyente>()
let ultimoConteo = 0

/** Se entera de cuántas escrituras quedan sin salir. Devuelve cómo darse de baja. */
export function suscribirCola(cb: Oyente): () => void {
  oyentes.add(cb)
  cb(ultimoConteo)
  return () => { oyentes.delete(cb) }
}

async function avisar() {
  const n = await contar()
  ultimoConteo = n
  for (const cb of oyentes) cb(n)
}

export async function contar(): Promise<number> {
  const n = await tx<number>('readonly', (s) => s.count())
  return n ?? 0
}

export async function pendientes(): Promise<EnCola[]> {
  const todo = await tx<EnCola[]>('readonly', (s) => s.getAll())
  return todo ?? []
}

export async function vaciarCola() {
  await tx('readwrite', (s) => s.clear() as unknown as IDBRequest<unknown>)
  await avisar()
}

/** Quita una entrada concreta: la que ya se aplicó, o la que se decide tirar. */
export async function descartarDeCola(id: number) {
  await tx('readwrite', (s) => s.delete(id) as unknown as IDBRequest<unknown>)
  await avisar()
}

// ---- Qué se encola ----------------------------------------------------------

/** Solo se encolan escrituras contra los datos. Ni lecturas, ni sesión. */
function esEscrituraDeDatos(url: string, method: string): boolean {
  const m = method.toUpperCase()
  if (m !== 'POST' && m !== 'PATCH' && m !== 'DELETE' && m !== 'PUT') return false
  /*
   * `/rest/v1/` es la API de datos. `/auth/v1/` queda fuera a propósito:
   * reintentar un inicio de sesión media hora después no tiene sentido y
   * guardar su cuerpo sería guardar credenciales.
   *
   * `/rest/v1/rpc/` también queda fuera: una función puede no ser idempotente
   * y reenviarla a ciegas es la forma de duplicar un movimiento.
   */
  return url.includes('/rest/v1/') && !url.includes('/rest/v1/rpc/')
}

const tablaDe = (url: string) => url.match(/\/rest\/v1\/([a-z_]+)/i)?.[1]

/** Un fallo de red, no una respuesta del servidor. Es lo único que se encola. */
const esFalloDeRed = (e: unknown) => {
  const nombre = (e as Error | undefined)?.name
  return nombre === 'TypeError' || nombre === 'TimeoutError' || nombre === 'AbortError'
    || /network|failed to fetch|load failed/i.test(String((e as Error)?.message ?? ''))
}

async function encolar(url: string, init: RequestInit): Promise<boolean> {
  const headers: Record<string, string> = {}
  new Headers(init.headers).forEach((v, k) => {
    // El token se vuelve a pedir al reenviar: ver la nota de la cabecera.
    if (k.toLowerCase() !== 'authorization') headers[k] = v
  })

  const entrada: EnCola = {
    url,
    method: (init.method ?? 'POST').toUpperCase(),
    headers,
    body: typeof init.body === 'string' ? init.body : null,
    creadoEn: Date.now(),
    intentos: 0,
    tabla: tablaDe(url),
  }

  // Un cuerpo que no sea texto no se sabe reproducir: mejor no prometer que se
  // guardó. Solo pasa con subidas de archivos, que esta app no hace.
  if (init.body && typeof init.body !== 'string') return false

  const id = await tx('readwrite', (s) => s.add(entrada) as unknown as IDBRequest<number>)
  if (id === null) return false
  await avisar()
  pedirSincronizacionEnSegundoPlano()
  return true
}

/**
 * El `fetch` que usa el cliente de Supabase.
 *
 * Si la petición sale, no cambia nada. Si no sale y era una escritura, se
 * guarda y se responde con un 202: para el resto de la app la escritura fue
 * aceptada, que es exactamente lo que va a pasar en cuanto vuelva la red. La
 * alternativa —devolver el error— haría que el store marcara un fallo de
 * guardado por algo que sí se va a guardar.
 */
export function fetchConCola(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const method = init.method ?? (input instanceof Request ? input.method : 'GET')

  return fetchConTimeout(input, init).catch(async (e) => {
    if (!esFalloDeRed(e) || !esEscrituraDeDatos(url, method)) throw e
    const guardada = await encolar(url, { ...init, method })
    if (!guardada) throw e
    return new Response('', {
      status: 202,
      // PostgREST devuelve 201 con cuerpo vacío en un insert normal, así que
      // un cuerpo vacío es lo que el cliente ya sabe interpretar.
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

// ---- Vaciar la cola ---------------------------------------------------------

let sincronizando = false

export interface ResultadoSync {
  enviadas: number
  fallidas: number
  quedan: number
}

/**
 * Reenvía lo que haya, en orden, hasta que algo vuelva a fallar.
 *
 * Se para en el primer fallo recuperable en vez de seguir con las siguientes,
 * y es a propósito: las escrituras de esta app tienen orden entre sí —se crea
 * una cuenta y después se le ajusta el saldo, se registra un movimiento y
 * luego se edita— y adelantar una por encima de otra que falló deja los datos
 * en un estado que no ocurrió nunca.
 *
 * `dameToken` la da quien llama, porque esta capa no conoce a Supabase: pedirle
 * el cliente aquí crearía una dependencia circular con el store.
 */
export async function sincronizarCola(dameToken: () => Promise<string | null>): Promise<ResultadoSync> {
  if (sincronizando) return { enviadas: 0, fallidas: 0, quedan: await contar() }
  sincronizando = true

  let enviadas = 0
  let fallidas = 0

  try {
    const lista = (await pendientes()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    if (!lista.length) return { enviadas: 0, fallidas: 0, quedan: 0 }

    const token = await dameToken()

    for (const entrada of lista) {
      if (entrada.fallida) { fallidas++; continue }

      const headers = { ...entrada.headers }
      if (token) headers.Authorization = `Bearer ${token}`

      let res: Response
      try {
        res = await fetchConTimeout(entrada.url, {
          method: entrada.method,
          headers,
          body: entrada.body ?? undefined,
        })
      } catch {
        // Sigue sin haber red. Se deja todo como está y se intentará luego.
        break
      }

      if (res.ok) {
        await tx('readwrite', (s) => s.delete(entrada.id!) as unknown as IDBRequest<unknown>)
        enviadas++
        continue
      }

      /*
       * 409 es «esa fila ya existe». Ocurre cuando la petición sí llegó al
       * servidor y lo que se perdió fue la respuesta: la escritura está hecha,
       * y reintentarla para siempre dejaría la cola atascada en algo que ya
       * está bien. Se da por buena.
       */
      if (res.status === 409) {
        await tx('readwrite', (s) => s.delete(entrada.id!) as unknown as IDBRequest<unknown>)
        enviadas++
        continue
      }

      const detalle = `${res.status} ${(await res.text().catch(() => '')).slice(0, 140)}`

      // Un 4xx no se arregla reintentando: la fila está mal, o la sesión ya no
      // tiene permiso. Se marca y se deja de intentar, pero NO se borra: es un
      // movimiento del usuario y tiene derecho a verlo y decidir.
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        await tx('readwrite', (s) =>
          s.put({ ...entrada, intentos: entrada.intentos + 1, error: detalle, fallida: true }) as unknown as IDBRequest<unknown>)
        fallidas++
        continue
      }

      // 5xx o plazo agotado: el servidor está mal, no la petición. Se reintenta
      // más tarde y se para aquí para no romper el orden.
      await tx('readwrite', (s) =>
        s.put({ ...entrada, intentos: entrada.intentos + 1, error: detalle }) as unknown as IDBRequest<unknown>)
      break
    }
  } finally {
    sincronizando = false
    await avisar()
  }

  return { enviadas, fallidas, quedan: await contar() }
}

// ---- Cuándo se vacía --------------------------------------------------------

export const ETIQUETA_SYNC = 'eftm-cola'

/**
 * Le pide al sistema operativo que despierte a la app cuando vuelva la red.
 *
 * Es la Background Sync API, y donde existe —Chrome y Edge— funciona aunque la
 * pestaña esté cerrada: el service worker se despierta solo. Safari no la
 * implementa, así que en iPhone la cola se vacía con los dos oyentes de abajo,
 * que necesitan que la app esté abierta. Es peor, pero es lo que hay, y el
 * caso de uso —sacas el teléfono del sótano y vuelves a mirar la app— lo cubre
 * igual.
 */
export function pedirSincronizacionEnSegundoPlano() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  navigator.serviceWorker.ready
    .then((reg) => (reg as ServiceWorkerRegistration & {
      sync?: { register: (t: string) => Promise<void> }
    }).sync?.register(ETIQUETA_SYNC))
    .catch(() => { /* sin permiso o sin soporte: quedan los oyentes */ })
}

/**
 * Engancha el vaciado a los dos momentos en que puede haber vuelto la red.
 *
 * `online` es el aviso del navegador, y `visibilitychange` cubre lo que ese
 * aviso se pierde: iOS congela la app al salir de pantalla y no dispara nada
 * al volver, así que sin el segundo oyente la cola de un iPhone se quedaría
 * esperando a un evento que no llega.
 */
export function vigilarRed(dameToken: () => Promise<string | null>): () => void {
  if (typeof window === 'undefined') return () => {}

  const intentar = () => {
    if (!navigator.onLine) return
    void sincronizarCola(dameToken)
  }

  const alVolver = () => { if (document.visibilityState === 'visible') intentar() }

  window.addEventListener('online', intentar)
  document.addEventListener('visibilitychange', alVolver)
  // Y una vez al arrancar: lo que quedó de la sesión anterior sale ya.
  intentar()

  return () => {
    window.removeEventListener('online', intentar)
    document.removeEventListener('visibilitychange', alVolver)
  }
}
