'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Alta y baja de los avisos del navegador, desde la interfaz.
 *
 * El flujo tiene cuatro pasos y cada uno puede fallar por su cuenta, así que
 * el estado dice en cuál se está: hace falta un service worker registrado, la
 * llave pública del servidor, el permiso del usuario y una suscripción
 * guardada en la cuenta.
 *
 * Nota sobre iPhone, que es donde más se nota: los avisos web solo funcionan
 * si la app está instalada en la pantalla de inicio. En Safari a secas, el
 * permiso ni siquiera se puede pedir. Por eso se detecta y se explica en vez
 * de enseñar un botón que no va a hacer nada.
 */

export type EstadoPush =
  | 'comprobando'
  | 'no-soportado'
  | 'sin-instalar'
  | 'sin-configurar'
  | 'apagado'
  | 'bloqueado'
  | 'encendido'

/**
 * La llave pública VAPID viene en base64url y el navegador la quiere en bytes.
 *
 * Se devuelve un `ArrayBuffer` y no un `Uint8Array` porque `applicationServerKey`
 * lo tipa así: un `Uint8Array` puede estar respaldado por memoria compartida y
 * TypeScript lo rechaza, aunque en la práctica este nunca lo esté.
 */
function aBytes(base64url: string): ArrayBuffer {
  const base = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(base.padEnd(Math.ceil(base.length / 4) * 4, '='))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

/** Una PWA instalada. Es lo que iOS exige para dejar pedir el permiso. */
const estaInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true

/** Un nombre reconocible para la lista de dispositivos. */
function nombreDelDispositivo(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Este dispositivo'
}

export function usePush() {
  const [estado, setEstado] = useState<EstadoPush>('comprobando')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const comprobar = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      // En iOS sin instalar, `PushManager` no existe; el aviso correcto no es
      // «tu navegador no puede» sino «instálala y podrá».
      setEstado(/iPhone|iPad/.test(navigator.userAgent) && !estaInstalada() ? 'sin-instalar' : 'no-soportado')
      return
    }

    try {
      const res = await fetch('/api/push')
      const datos = await res.json()
      if (!datos?.configurado) { setEstado('sin-configurar'); return }
    } catch {
      setEstado('sin-configurar')
      return
    }

    if (Notification.permission === 'denied') { setEstado('bloqueado'); return }

    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    setEstado(sub ? 'encendido' : 'apagado')
  }, [])

  useEffect(() => { void comprobar() }, [comprobar])

  const encender = useCallback(async () => {
    setOcupado(true)
    setError(null)
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueado' : 'apagado')
        return
      }

      const res = await fetch('/api/push')
      const { clavePublica } = await res.json()
      if (!clavePublica) { setEstado('sin-configurar'); return }

      // `ready` y no `getRegistration`: si el service worker se está
      // instalando, `getRegistration` devuelve uno sin `pushManager` activo y
      // la suscripción falla con un error que no dice nada.
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        // Obligatorio en todos los navegadores actuales: no se admiten avisos
        // sin contenido cifrado.
        userVisibleOnly: true,
        applicationServerKey: aBytes(clavePublica),
      })

      const guardado = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'guardar',
          suscripcion: sub.toJSON(),
          dispositivo: nombreDelDispositivo(),
        }),
      }).then((r) => r.json())

      if (!guardado?.ok) {
        // Si no se pudo guardar, se deshace la suscripción del navegador: una
        // suscripción que el servidor no conoce es un aviso que nunca llega y
        // un interruptor encendido que miente.
        await sub.unsubscribe().catch(() => {})
        setError(guardado?.error || 'No se pudo guardar en tu cuenta.')
        setEstado('apagado')
        return
      }

      setEstado('encendido')
    } catch (e) {
      setError((e as Error).message)
      setEstado('apagado')
    } finally {
      setOcupado(false)
    }
  }, [])

  const apagar = useCallback(async () => {
    setOcupado(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'borrar', suscripcion: { endpoint: sub.endpoint } }),
        }).catch(() => {})
        await sub.unsubscribe().catch(() => {})
      }
      setEstado('apagado')
    } finally {
      setOcupado(false)
    }
  }, [])

  const probar = useCallback(async () => {
    setOcupado(true)
    setError(null)
    try {
      const r = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'probar' }),
      }).then((res) => res.json())
      if (!r?.ok) setError(r?.error || 'No se pudo enviar.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }, [])

  return { estado, ocupado, error, encender, apagar, probar, comprobar }
}
