/**
 * Los otros dos caminos por los que puede llegar un aviso: correo y SMS.
 *
 * El Web Push es el camino principal y es gratis, pero tiene dos agujeros que
 * se notan justo en este caso de uso. En iPhone solo funciona si la app está
 * instalada en la pantalla de inicio —en Safari a secas, no—, y si alguien
 * niega el permiso de notificaciones no hay segunda oportunidad sin entrar en
 * los ajustes del sistema. Un correo llega siempre, y un SMS llega incluso sin
 * datos.
 *
 * Los dos son opcionales y se activan poniendo sus variables de entorno. Sin
 * ellas no fallan: devuelven «no configurado» y el aviso sale solo por push.
 * Es a propósito —ninguno de los dos servicios es gratis del todo, y obligar a
 * contratarlos para que la app funcione sería cambiar el trato a mitad—.
 */

export interface Envio {
  ok: boolean
  /** No hay llaves para este canal. No es un fallo. */
  sinConfigurar?: boolean
  error?: string
}

const NO_CONFIGURADO: Envio = { ok: false, sinConfigurar: true }

/* ===========================================================================
 *  Correo — Resend
 * ===========================================================================
 *  Se eligió Resend por una razón práctica: manda cien correos al día en el
 *  plan gratuito y la API es una sola petición sin SDK. Cambiarlo por otro
 *  proveedor es cambiar esta función y nada más.
 * ------------------------------------------------------------------------ */

export async function enviarCorreo(opciones: {
  para: string
  asunto: string
  texto: string
  html?: string
}): Promise<Envio> {
  const llave = process.env.RESEND_API_KEY
  if (!llave || !opciones.para) return NO_CONFIGURADO

  // El remitente tiene que ser de un dominio verificado en el proveedor. El
  // de pruebas de Resend funciona sin verificar nada, que es lo que permite
  // probar esto en cinco minutos.
  const desde = process.env.AVISO_FROM || 'Finanzas <onboarding@resend.dev>'

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: desde,
        to: [opciones.para],
        subject: opciones.asunto,
        text: opciones.texto,
        ...(opciones.html ? { html: opciones.html } : {}),
      }),
    })
    if (r.ok) return { ok: true }
    return { ok: false, error: (await r.text().catch(() => '')).slice(0, 200) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/* ===========================================================================
 *  SMS — Twilio
 * ===========================================================================
 *  Aquí no hay plan gratuito que valga: cada mensaje a Colombia cuesta. Por eso
 *  el SMS se reserva a lo que de verdad no puede esperar —un pago que vence
 *  hoy— y no a «Netflix cobra mañana». Quien lo quiera para todo, que lo
 *  active; el filtro está en quien llama, no aquí.
 * ------------------------------------------------------------------------ */

export async function enviarSms(opciones: { para: string; texto: string }): Promise<Envio> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const desde = process.env.TWILIO_FROM
  if (!sid || !token || !desde || !opciones.para) return NO_CONFIGURADO

  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: opciones.para,
        From: desde,
        // 160 caracteres es un SMS; pasarse cobra dos. El recorte va aquí y no
        // en quien llama para que ningún aviso nuevo se coma el presupuesto
        // por descuido.
        Body: opciones.texto.slice(0, 155),
      }),
    })
    if (r.ok) return { ok: true }
    return { ok: false, error: (await r.text().catch(() => '')).slice(0, 200) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** Qué canales están disponibles ahora mismo. Para decirlo en Ajustes. */
export const canalesConfigurados = () => ({
  correo: Boolean(process.env.RESEND_API_KEY),
  sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM),
  push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
})
