import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Intercambia el código del enlace mágico por una sesión con cookies. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Solo rutas internas. Sin este filtro, `next` podría apuntar fuera del sitio
  // y convertir el callback en un redirector abierto hacia una página de phishing.
  const raw = searchParams.get('next')
  const next = raw && /^\/(?!\/)/.test(raw) ? raw : '/'

  if (code) {
    const supabase = await createClient()
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
