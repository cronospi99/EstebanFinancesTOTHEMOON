'use client'

/**
 * Bloqueo de la app con Face ID, Touch ID o la huella del teléfono (WebAuthn).
 *
 * ---------------------------------------------------------------------------
 * Qué es y qué no es. Léase antes de tocar nada.
 * ---------------------------------------------------------------------------
 * Esto es un CERROJO LOCAL, no un factor de autenticación. La diferencia
 * importa y conviene tenerla escrita donde no se pueda pasar por alto.
 *
 * Lo que hace: si alguien coge tu teléfono desbloqueado y abre la app, se
 * encuentra una pantalla que pide tu cara o tu huella. Ese es el riesgo real
 * de una app de finanzas en un móvil que se deja en una mesa, y contra ese
 * riesgo funciona.
 *
 * Lo que NO hace: proteger los datos frente a alguien que controle el
 * dispositivo. La comprobación ocurre en el navegador y no la verifica ningún
 * servidor, así que quien sepa abrir las herramientas de desarrollo puede
 * saltársela. Protegerse de verdad de eso exigiría que el servidor validara la
 * firma y no devolviera los datos hasta entonces, lo que significa un reto
 * firmado por el servidor, una tabla de credenciales y validar la firma
 * ECDSA en cada arranque. Es otro proyecto, y prometer que existe cuando no
 * existe sería peor que no tenerlo.
 *
 * Quien de verdad guarda la puerta es Supabase: sin sesión válida el servidor
 * no devuelve una sola fila, y eso sí se comprueba del lado bueno.
 *
 * ---------------------------------------------------------------------------
 * Por qué WebAuthn y no un PIN
 * ---------------------------------------------------------------------------
 * Un PIN habría sido más simple, y es peor por dos razones. La primera es que
 * hay que guardarlo en algún sitio del teléfono, y ahí ya no es un secreto. La
 * segunda es que la gente reutiliza el PIN del banco, así que una app que
 * pide uno propio acaba guardando el del banco en localStorage.
 *
 * Con WebAuthn no se guarda ningún secreto: la clave privada vive en el chip
 * seguro del dispositivo —el Secure Enclave en iPhone— y de aquí solo sale el
 * identificador público de la credencial, que no sirve para nada por sí solo.
 */

const CLAVE = 'eftm.biometria'

interface Guardado {
  /** El id de la credencial, en base64url. No es un secreto. */
  credentialId: string
  /** Cuándo se activó, para poder decirlo en Ajustes. */
  creadaEn: string
  /** Cuántos minutos en segundo plano antes de volver a pedirla. */
  minutos: number
}

/** Cuánto puede estar la app fuera de pantalla antes de volver a pedir la cara. */
export const MINUTOS_POR_DEFECTO = 2

const aBase64Url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const deBase64Url = (s: string) => {
  const base = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(base.padEnd(Math.ceil(base.length / 4) * 4, '='))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export function leerConfig(): Guardado | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return null
    const g = JSON.parse(raw) as Guardado
    // El campo `minutos` se añadió después: lo guardado antes no lo trae.
    return g?.credentialId ? { ...g, minutos: g.minutos ?? MINUTOS_POR_DEFECTO } : null
  } catch {
    return null
  }
}

export const estaActiva = () => leerConfig() !== null

/**
 * ¿Este dispositivo puede?
 *
 * Se pregunta por un autenticador *de plataforma* y no por WebAuthn a secas:
 * una llave USB también es WebAuthn y aquí no sirve de nada —el sentido es que
 * baste con mirar el teléfono—. En un portátil sin lector de huella la
 * respuesta es no, y entonces la opción ni se ofrece en vez de ofrecerla y
 * fallar al tocarla.
 */
export async function soportado(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!window.PublicKeyCredential || !navigator.credentials) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

const reto = () => crypto.getRandomValues(new Uint8Array(32))

/**
 * Da de alta la credencial en este dispositivo.
 *
 * `residentKey: 'discouraged'` a propósito: no hace falta que la credencial se
 * pueda descubrir sola —siempre sabemos su id, lo tenemos guardado— y pedir
 * una clave residente consume uno de los espacios limitados que tienen algunos
 * autenticadores. `userVerification: 'required'` es lo que obliga a la cara o
 * la huella en vez de aceptar un simple toque.
 */
export async function activar(usuario: { id: string; nombre: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await soportado())) return { ok: false, error: 'Este dispositivo no tiene Face ID, Touch ID ni huella disponibles para el navegador.' }

  try {
    const credencial = (await navigator.credentials.create({
      publicKey: {
        challenge: reto(),
        // El dominio sale del propio navegador. Fijarlo a mano rompería la app
        // en las URL de vista previa de Vercel, que cambian en cada despliegue.
        rp: { name: 'EstebanFinances' },
        user: {
          id: new TextEncoder().encode(usuario.id.slice(0, 64)),
          name: usuario.nombre || 'usuario',
          displayName: usuario.nombre || 'Mi cuenta',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256: lo que usa el Secure Enclave
          { type: 'public-key', alg: -257 }, // RS256: respaldo en Windows Hello
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null

    if (!credencial) return { ok: false, error: 'No se pudo crear la credencial.' }

    const config: Guardado = {
      credentialId: aBase64Url(credencial.rawId),
      creadaEn: new Date().toISOString(),
      minutos: MINUTOS_POR_DEFECTO,
    }
    localStorage.setItem(CLAVE, JSON.stringify(config))
    return { ok: true }
  } catch (e) {
    const err = e as Error
    if (err.name === 'NotAllowedError') return { ok: false, error: 'Se canceló antes de registrar la huella.' }
    if (err.name === 'InvalidStateError') return { ok: false, error: 'Este dispositivo ya tiene una credencial registrada para la app.' }
    return { ok: false, error: err.message || 'No se pudo activar.' }
  }
}

export function desactivar() {
  try { localStorage.removeItem(CLAVE) } catch { /* noop */ }
}

export function fijarMinutos(minutos: number) {
  const actual = leerConfig()
  if (!actual) return
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...actual, minutos })) } catch { /* noop */ }
}

/** Pide la cara o la huella. `true` si la persona es quien dice ser. */
export async function verificar(): Promise<boolean> {
  const config = leerConfig()
  if (!config) return true

  try {
    const r = await navigator.credentials.get({
      publicKey: {
        challenge: reto(),
        allowCredentials: [{ type: 'public-key', id: deBase64Url(config.credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return r !== null
  } catch {
    // Cancelar cuenta como no verificado: la pantalla de bloqueo se queda y
    // ofrece reintentar. Dejar pasar por un error sería un cerrojo decorativo.
    return false
  }
}

const CLAVE_ULTIMO = 'eftm.biometria.visto'

/** Marca que la app estuvo a la vista. De aquí sale si hay que volver a pedirla. */
export function marcarActividad() {
  try { sessionStorage.setItem(CLAVE_ULTIMO, String(Date.now())) } catch { /* noop */ }
}

/**
 * ¿Hay que pedirla ahora?
 *
 * Sí en el primer arranque de la sesión, y sí cuando la app pasó más de los
 * minutos configurados fuera de pantalla. Volver a pedirla cada vez que uno
 * mira una notificación haría que la desactivara todo el mundo en dos días.
 *
 * El contador va en `sessionStorage` y no en `localStorage`: cerrar la pestaña
 * tiene que volver a pedirla. Con `localStorage` una app instalada y reabierta
 * al día siguiente se saltaría el cerrojo si el reloj decía que habían pasado
 * menos de dos minutos desde el último vistazo.
 */
export function hayQuePedir(): boolean {
  const config = leerConfig()
  if (!config) return false
  try {
    const visto = Number(sessionStorage.getItem(CLAVE_ULTIMO) || 0)
    if (!visto) return true
    return Date.now() - visto > config.minutos * 60_000
  } catch {
    return true
  }
}
