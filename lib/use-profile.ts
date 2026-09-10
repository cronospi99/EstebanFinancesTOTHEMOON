'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient, isSupabaseConfigured } from './supabase/client'

const KEY = 'eftm.profile.name'

/**
 * Nombre del usuario para el saludo.
 *
 * Se guarda en el dispositivo y, si hay sesión, también en los metadatos del
 * usuario de Supabase, para que al entrar en otro teléfono el saludo ya sepa
 * cómo se llama. Si no hay nada, se deriva del correo antes de rendirse:
 * "esteban@…" ya es mejor saludo que ninguno.
 */
export function useProfileName() {
  const [name, setName] = useState('')
  // El correo de la sesión, para que Ajustes pueda decir con qué cuenta se
  // entró antes de ofrecer salir de ella. Vacío en Modo Demo.
  const [email, setEmail] = useState('')

  useEffect(() => {
    let cancelado = false
    try {
      const local = localStorage.getItem(KEY)
      if (local) setName(local)
    } catch { /* storage bloqueado */ }

    if (!isSupabaseConfigured) return
    ;(async () => {
      const supabase = createClient()
      const { data } = (await supabase?.auth.getUser()) ?? { data: null }
      const user = data?.user
      if (!user || cancelado) return
      setEmail(user.email ?? '')
      const remoto = (user.user_metadata?.full_name as string | undefined)?.trim()
      if (remoto) {
        setName(remoto)
        try { localStorage.setItem(KEY, remoto) } catch { /* noop */ }
        return
      }
      // Sin nombre guardado: se propone la parte del correo, capitalizada.
      setName((actual) => {
        if (actual) return actual
        const base = user.email?.split('@')[0]?.replace(/[._-]+/g, ' ') ?? ''
        return base ? base.charAt(0).toUpperCase() + base.slice(1) : ''
      })
    })()
    return () => { cancelado = true }
  }, [])

  const guardar = useCallback(async (nuevo: string) => {
    const limpio = nuevo.trim()
    setName(limpio)
    try { limpio ? localStorage.setItem(KEY, limpio) : localStorage.removeItem(KEY) } catch { /* noop */ }
    if (isSupabaseConfigured) {
      const supabase = createClient()
      await supabase?.auth.updateUser({ data: { full_name: limpio } }).catch(() => {})
    }
  }, [])

  return { name, setName: guardar, email }
}

/**
 * Borra el nombre guardado en este dispositivo.
 *
 * Se llama al cerrar sesión: el nombre vive en una clave sin usuario, así que
 * sin esto el siguiente en entrar desde el mismo teléfono vería el saludo de
 * quien salió. En la cuenta sigue guardado, y vuelve solo al iniciar sesión.
 */
export function olvidarNombreGuardado() {
  try { localStorage.removeItem(KEY) } catch { /* storage bloqueado */ }
}

/** Saludo según la hora local. */
export function saludo(d = new Date()) {
  const h = d.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}
