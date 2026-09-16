'use client'

import { useEffect } from 'react'
import { marcarEnviado, yaEnviados } from '@/lib/avisos'
import { useAvisos, useFinance } from '@/lib/store'

/**
 * Los recordatorios que salen con la app abierta.
 *
 * Es el respaldo del Web Push y no su sustituto, y conviene tener clara la
 * diferencia: el aviso que de verdad sirve llega con la app cerrada, y de ese
 * se encarga el trabajo diario del servidor. Esto cubre los dos casos en que
 * aquel no puede:
 *
 *  · El servidor no tiene llaves VAPID configuradas. La app sigue funcionando
 *    entera, así que los recordatorios tienen que salir de algún lado.
 *  · El usuario dio permiso de notificaciones pero no hay cron —un despliegue
 *    propio, un plan sin trabajos programados—.
 *
 * Se apoya en el mismo registro de «ya avisado» que usa el servidor, con la
 * misma clave: el identificador de un aviso lleva dentro la fecha del hecho,
 * así que el del cobro de octubre es distinto del de septiembre y vuelve a
 * salir solo el mes siguiente.
 *
 * No pide permiso por su cuenta. Un permiso pedido sin que nadie lo espere se
 * deniega, y en un navegador denegar es para siempre; la petición vive donde
 * tiene sentido, en Ajustes, con la explicación al lado.
 */
export function Recordatorios() {
  const { ready } = useFinance()
  const avisos = useAvisos()

  useEffect(() => {
    if (!ready || !avisos.length) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    // Un pequeño retraso: al abrir la app compiten el primer pintado, la carga
    // remota y las cotizaciones. Un aviso del sistema en ese medio segundo se
    // nota como un tirón.
    const t = setTimeout(async () => {
      const vistos = yaEnviados()
      const reg = await navigator.serviceWorker?.getRegistration()
      if (!reg) return

      // Como mucho tres. Quien vuelve tras dos semanas tiene ocho cosas
      // vencidas, y ocho notificaciones a la vez se descartan todas de un
      // gesto —incluida la que importaba—.
      for (const aviso of avisos.filter((a) => !vistos[a.id]).slice(0, 3)) {
        await reg.showNotification(aviso.titulo, {
          body: aviso.cuerpo,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: aviso.id,
          data: { url: aviso.url },
        })
        marcarEnviado(aviso.id)
      }
    }, 1200)

    return () => clearTimeout(t)
  }, [ready, avisos])

  return null
}
