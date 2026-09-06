'use client'

import { createBrowserClient } from '@supabase/ssr'
import { normalizeSupabaseUrl } from './url'

export const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * La app arranca sin Supabase (Modo Demo). Todo lo que toca la red pregunta
 * primero por esta bandera, así el prototipo es usable antes de configurar nada.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export function createClient() {
  if (!isSupabaseConfigured) return null
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
