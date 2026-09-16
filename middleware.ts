import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { normalizeSupabaseUrl } from '@/lib/supabase/url'

const URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const isConfigured = Boolean(URL && KEY)

/** Rutas alcanzables sin sesión. */
const PUBLIC_PATHS = ['/login', '/auth']

/**
 * Rutas de API que no pueden exigir sesión, y por qué cada una.
 *
 * La comparación es por ruta EXACTA y no por prefijo, a propósito: con
 * `startsWith` bastaría `/api/push` para abrir de paso `/api/push`, que sí
 * necesita sesión —es la que da de alta el dispositivo de alguien—. Un prefijo
 * de más aquí es un agujero.
 *
 *  · /api/quick-add            Un atajo de iOS no tiene cookies: manda una
 *                              petición suelta desde el teléfono. Se autoriza
 *                              con su propio token, que comprueba una función
 *                              de Postgres antes de escribir nada.
 *  · /api/push/recordatorios   Lo llama el cron de Vercel a las ocho de la
 *                              mañana, cuando no hay ninguna sesión. Se
 *                              autoriza con CRON_SECRET, y sin esa variable la
 *                              ruta está apagada.
 *  · /api/trm y /api/fx        Devuelven una tasa de cambio pública, la misma
 *                              para todo el mundo, sin tocar un solo dato de
 *                              nadie. Además /api/trm llama a /api/fx desde el
 *                              servidor como respaldo, y esa llamada tampoco
 *                              lleva cookies: protegiéndolas, el respaldo se
 *                              iba a /login y la TRM se quedaba sin él sin que
 *                              nada lo dijera.
 */
const PUBLIC_API = new Set([
  '/api/quick-add',
  '/api/push/recordatorios',
  '/api/trm',
  '/api/fx',
])

/**
 * Puerta de entrada de la app.
 *
 * Hace dos trabajos distintos:
 *
 *  1. **Refrescar el token.** @supabase/ssr guarda la sesión en cookies y solo
 *     puede renovarla desde el middleware. Sin esto la sesión caduca y el móvil
 *     te expulsa cada pocas horas, aunque el login funcione.
 *
 *  2. **Proteger las rutas.** Sin sesión, todo redirige a /login.
 *
 * En Modo Demo (sin llaves de Supabase) no hay sesión que proteger, así que
 * deja pasar todo: la app sigue siendo usable sin configurar nada.
 */
export async function middleware(request: NextRequest) {
  if (!isConfigured) return NextResponse.next()

  /*
   * Las rutas de API públicas salen antes de tocar nada.
   *
   * No es solo que no necesiten sesión: `getUser()` hace un viaje de ida y
   * vuelta a Supabase para revalidar el token, y ponerlo delante de
   * /api/quick-add le añade ese viaje a cada SMS reenviado desde el teléfono
   * para averiguar algo que ya sabemos —que no hay cookies—. Cada una de estas
   * rutas se autoriza por su cuenta.
   */
  if (PUBLIC_API.has(request.nextUrl.pathname)) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(URL, KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // getUser() —y no getSession()— porque revalida el token contra Supabase.
  // getSession() se fía de la cookie, que el cliente podría falsificar.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Recuerda a dónde iba para volver ahí tras iniciar sesión.
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Ya autenticado: /login no tiene nada que ofrecer.
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Todo excepto los estáticos y los archivos que la PWA necesita servir
     * sin sesión (si el manifiesto o el service worker redirigieran a /login,
     * la app dejaría de ser instalable).
     */
    '/((?!_next/static|_next/image|favicon.ico|icon|manifest.webmanifest|sw.js|apple-touch-icon.png|icon-192.png|icon-512.png).*)',
  ],
}
