import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { configVapid, enviarPush, type SuscripcionPush } from '@/lib/webpush'

/**
 * Alta, baja y prueba de los avisos del navegador.
 *
 * Todo lo de aquí va con la sesión del usuario, así que la seguridad por filas
 * de Supabase hace el trabajo: nadie puede dar de alta un dispositivo en la
 * cuenta de otro ni mandarse avisos a un teléfono ajeno.
 *
 * El GET devuelve la llave pública VAPID, que el navegador necesita para
 * suscribirse y que no es ningún secreto: identifica a este servidor como
 * remitente y viaja en cada aviso.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const config = configVapid()
  return NextResponse.json({
    configurado: Boolean(config),
    clavePublica: config?.publica ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

interface Cuerpo {
  accion: 'guardar' | 'borrar' | 'probar'
  suscripcion?: { endpoint: string; keys?: { p256dh?: string; auth?: string } }
  dispositivo?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase no está configurado.' }, { status: 503 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Sin sesión.' }, { status: 401 })

  let cuerpo: Cuerpo
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo no válido.' }, { status: 400 })
  }

  // ---- Alta --------------------------------------------------------------
  if (cuerpo.accion === 'guardar') {
    const s = cuerpo.suscripcion
    if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth) {
      return NextResponse.json({ ok: false, error: 'La suscripción llegó incompleta.' }, { status: 400 })
    }

    /*
     * `upsert` por endpoint, que es único en toda la tabla y no por usuario.
     * Es lo que hace que un teléfono que cambia de cuenta —o que se comparte—
     * pase de un usuario al otro en vez de quedar registrado en los dos y
     * mandarle a alguien los avisos de otro.
     */
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: s.endpoint,
      p256dh: s.keys.p256dh,
      auth: s.keys.auth,
      dispositivo: (cuerpo.dispositivo ?? '').slice(0, 80),
      failed_at: null,
    }, { onConflict: 'endpoint' })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ---- Baja --------------------------------------------------------------
  if (cuerpo.accion === 'borrar') {
    const endpoint = cuerpo.suscripcion?.endpoint
    if (!endpoint) return NextResponse.json({ ok: false, error: 'Falta el endpoint.' }, { status: 400 })
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    return NextResponse.json({ ok: true })
  }

  // ---- Prueba ------------------------------------------------------------
  if (cuerpo.accion === 'probar') {
    const config = configVapid()
    if (!config) {
      return NextResponse.json({
        ok: false,
        error: 'El servidor no tiene llaves VAPID. Ver VAPID_PUBLIC_KEY en .env.example.',
      }, { status: 501 })
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user.id)

    if (!subs?.length) {
      return NextResponse.json({ ok: false, error: 'No hay ningún dispositivo suscrito.' }, { status: 404 })
    }

    const resultados = await Promise.all(
      (subs as SuscripcionPush[]).map((s) => enviarPush(s, {
        titulo: 'Los avisos funcionan',
        cuerpo: 'Así se verá el recordatorio de un corte o de un cobro.',
        url: '/ajustes',
      }, config).then((r) => ({ endpoint: s.endpoint, ...r }))),
    )

    /*
     * Un endpoint muerto se borra en el momento. Es la única forma de que la
     * lista no se llene de teléfonos que ya no existen: el servicio de push
     * no avisa cuando alguien desinstala la app, solo responde 410 la próxima
     * vez que se le manda algo.
     */
    const muertos = resultados.filter((r) => r.caducada).map((r) => r.endpoint)
    if (muertos.length) await supabase.from('push_subscriptions').delete().in('endpoint', muertos)

    const enviados = resultados.filter((r) => r.ok).length
    return NextResponse.json({
      ok: enviados > 0,
      enviados,
      retirados: muertos.length,
      error: enviados ? undefined : resultados[0]?.detalle || 'El servicio de avisos rechazó el envío.',
    })
  }

  return NextResponse.json({ ok: false, error: 'Acción desconocida.' }, { status: 400 })
}
