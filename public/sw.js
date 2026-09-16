/**
 * Service worker.
 *
 * Solo cachea recursos inmutables. La versión anterior cacheaba todo lo del
 * mismo origen salvo /api/, y ese fue el origen del bloqueo tras navegar un
 * rato: el App Router pide cargas RSC (…?_rsc=…) y, ante cualquier fallo de
 * red, el respaldo `caches.match('/')` le devolvía un documento HTML en vez
 * del payload esperado. El router se rompía y ningún botón respondía hasta
 * recargar a mano. Tras un redespliegue era peor todavía, porque el HTML
 * cacheado apuntaba a chunks de una compilación que ya no existe.
 *
 * Regla ahora: los documentos y las cargas RSC van SIEMPRE a la red, sin
 * copia ni respaldo. Solo se guardan ficheros cuyo nombre lleva el hash del
 * contenido, o que no cambian nunca.
 */
/*
 * El número sube cuando cambia el CONTENIDO de un archivo cacheado sin que
 * cambie su nombre. Al activarse se borran las cachés que no sean esta, que es
 * la única forma de que llegue un logotipo redibujado: los de /institutions/
 * se guardan por nombre y `arq.png` sigue llamándose `arq.png`.
 *
 * v4: los logotipos pasaron a recortarse a sangre.
 * v5: el service worker pasó a atender avisos y a vaciar la cola de escrituras.
 */
const CACHE = 'finanzas-v5'

/** Rutas cuyo contenido es inmutable o irrelevante para la coherencia del router. */
const cacheable = (url) =>
  inmutable(url) ||
  url.pathname.startsWith('/institutions/') ||   // logotipos
  url.pathname === '/manifest.webmanifest' ||
  /^\/(icon-\d+|apple-touch-icon)\.png$/.test(url.pathname)

/**
 * Lo que no puede cambiar sin cambiar de nombre.
 *
 * Next pone el hash del contenido en el nombre de cada trozo, así que una
 * compilación nueva pide URL nuevas y la copia guardada jamás queda vieja. Todo
 * lo demás que cacheamos —los logotipos, los iconos, el manifiesto— conserva su
 * nombre entre despliegues, así que una copia guardada sí puede quedar vieja y
 * no se le puede servir a ciegas.
 */
function inmutable(url) {
  return url.pathname.startsWith('/_next/static/')
}

self.addEventListener('install', (event) => {
  // Entra en servicio de inmediato: si un usuario arrastra el SW anterior,
  // esperar al cierre de todas las pestañas lo dejaría roto indefinidamente.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/**
 * Pide a la red con un reintento.
 *
 * Cuando iOS reanuda una app instalada, las conexiones keep-alive que quedaron
 * abiertas están muertas: la primera petición que reutiliza una de ellas falla
 * en seco. Un solo reintento abre una conexión nueva y basta. Sin él, ese
 * fallo le llega al navegador como un error de red en un chunk de
 * /_next/static — y un chunk que no carga deja al router de Next sin la ruta,
 * así que las pestañas dejan de responder hasta recargar a mano.
 */
const conReintento = (request) => fetch(request).catch(() => fetch(request))

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Documentos y cargas del router: red y solo red. Sin excepciones.
  const esDocumento = request.mode === 'navigate' || request.destination === 'document'
  const esRSC = url.searchParams.has('_rsc') || request.headers.get('RSC') === '1'
  if (esDocumento || esRSC || url.pathname.startsWith('/api/')) return

  if (!cacheable(url)) return

  event.respondWith(
    caches.match(request).then((hit) => {
      // Un trozo con hash en el nombre no puede haber cambiado: se sirve y ya.
      if (hit && inmutable(url)) return hit

      const desdeLaRed = conReintento(request).then((res) => {
        // Solo se guarda una respuesta buena y completa.
        if (res.ok && res.status === 200 && res.type === 'basic') {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copia)).catch(() => {})
        }
        return res
      })

      /*
       * Para lo que conserva el nombre entre despliegues: se sirve la copia al
       * instante —que es de lo que va tener una copia— y se refresca por
       * detrás, así el logotipo redibujado entra en la carga siguiente sin
       * esperar a que alguien acuerde subir la versión de la caché. Con
       * `waitUntil` el navegador no mata al service worker a mitad del
       * refresco, y si la red falla la copia servida ya salió igualmente.
       */
      if (hit) {
        event.waitUntil(desdeLaRed.catch(() => {}))
        return hit
      }
      return desdeLaRed
    }),
  )
})

/** Permite a la página forzar el relevo cuando detecta una versión nueva. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

/* ===========================================================================
 *  Avisos (Web Push)
 * ===========================================================================
 *  Aquí es donde el aviso de un corte de tarjeta se convierte en una
 *  notificación del sistema. El contenido llega cifrado de extremo a extremo y
 *  el navegador lo descifra antes de dárnoslo: lo que se lee en `event.data`
 *  ya está en claro y nunca pasó legible por el servicio de push.
 * ------------------------------------------------------------------------ */

self.addEventListener('push', (event) => {
  let datos = {}
  try {
    datos = event.data ? event.data.json() : {}
  } catch {
    // Un cuerpo que no es JSON no debería llegar, pero si llega es mejor
    // enseñar un aviso genérico que tragárselo en silencio.
    datos = { titulo: 'Finanzas', cuerpo: event.data ? event.data.text() : '' }
  }

  const titulo = datos.titulo || 'Finanzas'
  const opciones = {
    body: datos.cuerpo || '',
    icon: '/icon-192.png',
    // El badge es el icono monocromo de la barra de estado en Android.
    badge: '/icon-192.png',
    // Con etiqueta, un aviso del mismo hecho reemplaza al anterior en vez de
    // apilarse. Sin ella, reintentar un envío deja dos notificaciones iguales.
    tag: datos.etiqueta || undefined,
    renotify: false,
    data: { url: datos.url || '/' },
    // Una vibración corta: lo suficiente para notarlo en el bolsillo sin que
    // parezca una llamada.
    vibrate: [18, 40, 18],
  }

  event.waitUntil(self.registration.showNotification(titulo, opciones))
})

/**
 * Al tocar el aviso.
 *
 * Si la app ya está abierta se la trae al frente y se la lleva a la pantalla
 * que toca, en vez de abrir una pestaña más. Abrir una segunda instancia de
 * una PWA instalada deja al usuario con dos ventanas de la misma app y el
 * estado repetido en las dos.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        if ('focus' in cliente) {
          if ('navigate' in cliente) cliente.navigate(destino).catch(() => {})
          return cliente.focus()
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})

/* ===========================================================================
 *  Cola de escrituras sin señal
 * ===========================================================================
 *  La cola vive en IndexedDB y la llena la app (ver lib/cola.ts). Aquí solo se
 *  atiende el evento `sync`, que el sistema dispara cuando vuelve la red
 *  —incluso con la app cerrada, en los navegadores que lo implementan—.
 *
 *  Se intenta primero por el camino bueno: si hay alguna ventana abierta, se
 *  le pide a ella que vacíe la cola, porque ahí está la sesión y todo el
 *  código que ya sabe hacerlo. Solo si no hay ninguna se reenvían las
 *  peticiones desde aquí, y para eso hace falta el token, que se saca de la
 *  cookie de sesión. Donde no se pueda leer, se deja la cola como está: se
 *  vaciará en cuanto alguien abra la app, que es lo que pasaba antes de todo
 *  esto y sigue siendo correcto.
 * ------------------------------------------------------------------------ */

const ETIQUETA_SYNC = 'eftm-cola'

self.addEventListener('sync', (event) => {
  if (event.tag !== ETIQUETA_SYNC) return
  event.waitUntil(vaciarCola())
})

async function vaciarCola() {
  const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (clientes.length) {
    for (const cliente of clientes) cliente.postMessage({ tipo: 'vaciar-cola' })
    return
  }
  await reenviarDesdeElWorker()
}

/** Abre la misma base que usa la app. Mismo nombre y misma versión. */
function abrirBase() {
  return new Promise((resolve) => {
    let req
    try {
      req = indexedDB.open('eftm', 1)
    } catch {
      resolve(null)
      return
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

/**
 * El token de la sesión, sacado de la cookie que escribe @supabase/ssr.
 *
 * Un service worker no tiene `document`, así que no hay `document.cookie`: se
 * usa `cookieStore`, que existe justamente en los navegadores que implementan
 * Background Sync. Donde no exista, esta función devuelve null y la cola se
 * queda esperando a que alguien abra la app.
 *
 * La cookie puede venir partida en varios trozos numerados cuando el token es
 * largo, y con el prefijo `base64-` cuando el valor va codificado. Las dos
 * cosas las hace la biblioteca, no nosotros, y hay que deshacerlas en el mismo
 * orden.
 */
async function tokenDeSesion() {
  if (typeof cookieStore === 'undefined') return null
  try {
    const todas = await cookieStore.getAll()
    const trozos = todas
      .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    if (!trozos.length) return null

    let crudo = trozos.map((c) => c.value).join('')
    if (crudo.startsWith('base64-')) crudo = atob(crudo.slice(7))
    const sesion = JSON.parse(crudo)
    return sesion?.access_token || (Array.isArray(sesion) ? sesion[0] : null)
  } catch {
    return null
  }
}

async function reenviarDesdeElWorker() {
  const base = await abrirBase()
  if (!base) return

  const token = await tokenDeSesion()
  if (!token) return

  const entradas = await new Promise((resolve) => {
    try {
      const req = base.transaction('cola', 'readonly').objectStore('cola').getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })

  for (const entrada of entradas.sort((a, b) => a.id - b.id)) {
    if (entrada.fallida) continue
    let res
    try {
      res = await fetch(entrada.url, {
        method: entrada.method,
        headers: { ...entrada.headers, Authorization: `Bearer ${token}` },
        body: entrada.body || undefined,
      })
    } catch {
      // Sigue sin red. Se para aquí para no romper el orden de las escrituras.
      break
    }
    // El 409 es «ya existe»: la escritura llegó y lo que se perdió fue la
    // respuesta. Se da por buena, igual que hace la app.
    if (!res.ok && res.status !== 409) break
    await new Promise((resolve) => {
      try {
        const req = base.transaction('cola', 'readwrite').objectStore('cola').delete(entrada.id)
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }
}
