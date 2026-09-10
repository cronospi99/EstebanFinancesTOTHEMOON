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
 */
const CACHE = 'finanzas-v4'

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
