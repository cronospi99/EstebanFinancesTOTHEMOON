import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign as firmar } from 'node:crypto'

/**
 * Web Push escrito a mano.
 *
 * Mandar un aviso al teléfono de alguien parece una petición HTTP y no lo es.
 * El servicio de push —el de Apple, el de Google, el de Mozilla— reenvía el
 * mensaje sin poder leerlo, y para eso el contenido va cifrado de extremo a
 * extremo con una clave que solo conocen este servidor y ese navegador
 * concreto. Son dos especificaciones: RFC 8291 para el cifrado y RFC 8292 para
 * la firma que identifica a quien envía.
 *
 * ---------------------------------------------------------------------------
 * Por qué a mano y no con `web-push`
 * ---------------------------------------------------------------------------
 * La biblioteca `web-push` hace justo esto y está bien hecha. Se escribió aquí
 * por dos razones concretas:
 *
 *  1. Node ya trae todo lo que hace falta. ECDH sobre P-256, HKDF con HMAC y
 *     AES-128-GCM están en `node:crypto` desde hace años. Lo que queda es
 *     encadenarlos en el orden que dice la especificación, que son estas
 *     ciento y pico líneas.
 *  2. Una dependencia que firma y cifra es una dependencia que, el día que se
 *     comprometa, tiene en la mano las llaves VAPID y el contenido de todos
 *     los avisos. Para algo que se ejecuta entero en cuatro funciones
 *     conocidas, el intercambio no compensa.
 *
 * La contrapartida honesta: si una especificación cambia, aquí no se entera
 * nadie. Son especificaciones estables desde 2017 y el formato está congelado,
 * así que el riesgo es bajo, pero existe.
 *
 * ---------------------------------------------------------------------------
 * Cómo se generan las llaves VAPID
 * ---------------------------------------------------------------------------
 * Un par de llaves P-256 en base64url. Con Node, sin instalar nada:
 *
 *   node -e "const c=require('crypto');const e=c.createECDH('prime256v1');e.generateKeys();const b=x=>x.toString('base64url');console.log('VAPID_PUBLIC_KEY='+b(e.getPublicKey()));console.log('VAPID_PRIVATE_KEY='+b(e.getPrivateKey()))"
 *
 * La pública va también al navegador —es la que identifica al remitente— y la
 * privada no sale del servidor jamás.
 */

const b64url = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url')
const deB64url = (s: string) => Buffer.from(s, 'base64url')

const hmac = (clave: Buffer, datos: Buffer) => createHmac('sha256', clave).update(datos).digest()

/**
 * HKDF en su versión corta.
 *
 * Extraer y expandir, con una sola vuelta de expansión. Vale porque todo lo
 * que se deriva aquí —una clave de 16 bytes, un nonce de 12— cabe de sobra en
 * los 32 bytes que da una vuelta de HMAC-SHA256. El HKDF completo haría falta
 * para material más largo.
 */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, largo: number): Buffer {
  const prk = hmac(salt, ikm)
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, largo)
}

export interface SuscripcionPush {
  endpoint: string
  /** Clave pública del navegador, base64url. */
  p256dh: string
  /** Secreto de autenticación del navegador, base64url. */
  auth: string
}

/**
 * Cifra el contenido para un destinatario concreto (RFC 8291, `aes128gcm`).
 *
 * El resultado es el cuerpo entero de la petición, con su cabecera binaria
 * delante: sal, tamaño de registro, y la clave pública efímera que el
 * navegador necesita para derivar la misma clave por su lado.
 */
function cifrar(texto: string, p256dh: string, auth: string): Buffer {
  const claveUsuario = deB64url(p256dh)
  const secretoUsuario = deB64url(auth)

  // Par efímero: uno nuevo por mensaje. Reutilizarlo dejaría que dos mensajes
  // compartieran clave, que es lo que la especificación prohíbe expresamente.
  const efimero = createECDH('prime256v1')
  efimero.generateKeys()
  const clavePublica = efimero.getPublicKey()
  const compartido = efimero.computeSecret(claveUsuario)

  const salt = randomBytes(16)

  /*
   * La derivación tiene dos escalones y el primero es el que se olvida. El
   * secreto ECDH no se usa directamente: primero se mezcla con el secreto de
   * autenticación del navegador y con las dos claves públicas, y de ahí sale
   * el material del que cuelgan la clave y el nonce. Saltarse el escalón
   * produce un cuerpo que el servicio de push acepta —él no lo lee— y que el
   * navegador descarta en silencio. El síntoma es un aviso que nunca aparece
   * sin ningún error por ninguna parte.
   */
  const infoClave = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    claveUsuario,
    clavePublica,
  ])
  const ikm = hkdf(secretoUsuario, compartido, infoClave, 32)

  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)

  // El 0x02 marca el final del último (y único) registro. Con 0x01 el
  // navegador se queda esperando otro que no llega.
  const contenido = Buffer.concat([Buffer.from(texto, 'utf8'), Buffer.from([2])])

  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  const cifrado = Buffer.concat([cipher.update(contenido), cipher.final(), cipher.getAuthTag()])

  const cabecera = Buffer.alloc(21)
  salt.copy(cabecera, 0)
  // Tamaño de registro. 4096 sobra para un aviso de dos líneas.
  cabecera.writeUInt32BE(4096, 16)
  cabecera.writeUInt8(clavePublica.length, 20)

  return Buffer.concat([cabecera, clavePublica, cifrado])
}

/**
 * El JWT que identifica a este servidor ante el servicio de push (RFC 8292).
 *
 * `aud` es el origen del endpoint y no el endpoint entero: mandar la URL
 * completa lo rechazan tanto Apple como Google, cada uno con un error distinto
 * y ninguno claro.
 */
function firmarVapid(endpoint: string, publica: string, privada: string, sujeto: string): string {
  const cabecera = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const cuerpo = b64url(Buffer.from(JSON.stringify({
    aud: new URL(endpoint).origin,
    // Doce horas. La especificación permite hasta veinticuatro; la mitad deja
    // margen para un reloj mal puesto en cualquiera de los dos extremos.
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: sujeto,
  })))

  const cruda = deB64url(privada)
  const pub = deB64url(publica)
  const jwk = {
    kty: 'EC' as const,
    crv: 'P-256' as const,
    // La clave pública viene como punto sin comprimir: un 0x04 y luego X e Y.
    x: b64url(pub.subarray(1, 33)),
    y: b64url(pub.subarray(33, 65)),
    d: b64url(cruda),
  }
  const clave = createPrivateKey({ key: jwk, format: 'jwk' })

  /*
   * `ieee-p1363` da la firma como r‖s en crudo, que es lo que espera un JWT.
   * Sin esa opción Node devuelve DER, y el servicio de push responde 401 sin
   * decir por qué.
   */
  const firma = firmar('sha256', Buffer.from(`${cabecera}.${cuerpo}`), {
    key: clave,
    dsaEncoding: 'ieee-p1363',
  })

  return `${cabecera}.${cuerpo}.${b64url(firma)}`
}

export interface ConfigVapid {
  publica: string
  privada: string
  /** `mailto:` de contacto. Lo exige la especificación por si hay abuso. */
  sujeto: string
}

/** Lee las llaves del entorno, o null si no están puestas. */
export function configVapid(): ConfigVapid | null {
  const publica = process.env.VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) return null
  return {
    publica,
    privada,
    sujeto: process.env.VAPID_SUBJECT || 'mailto:avisos@estebanfinances.app',
  }
}

export interface ResultadoEnvio {
  ok: boolean
  status: number
  /** El endpoint ya no existe: hay que borrar la suscripción. */
  caducada: boolean
  detalle?: string
}

/**
 * Manda un aviso a un dispositivo.
 *
 * El 404 y el 410 son los que importan: significan que esa suscripción está
 * muerta —se desinstaló la app, se borraron los datos del sitio— y que hay que
 * borrarla de la tabla. Sin hacerlo, la lista se llena de endpoints zombis y
 * cada envío tarda más en fallar contra todos ellos.
 */
export async function enviarPush(
  sub: SuscripcionPush,
  contenido: unknown,
  config: ConfigVapid,
  ttlSegundos = 12 * 3600,
): Promise<ResultadoEnvio> {
  try {
    const cuerpo = cifrar(JSON.stringify(contenido), sub.p256dh, sub.auth)
    const jwt = firmarVapid(sub.endpoint, config.publica, config.privada, config.sujeto)

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${config.publica}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        // Si el teléfono está apagado, cuánto tiempo guardarlo antes de tirarlo.
        TTL: String(ttlSegundos),
        Urgency: 'normal',
      },
      body: new Uint8Array(cuerpo),
    })

    return {
      ok: res.ok,
      status: res.status,
      caducada: res.status === 404 || res.status === 410,
      detalle: res.ok ? undefined : (await res.text().catch(() => '')).slice(0, 200),
    }
  } catch (e) {
    return { ok: false, status: 0, caducada: false, detalle: (e as Error).message }
  }
}
