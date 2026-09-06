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
const CACHE = 'finanzas-v2'

/** Rutas cuyo contenido es inmutable o irrelevante para la coherencia del router. */
const cacheable = (url) =>
  url.pathname.startsWith('/_next/static/') ||   // nombre con hash de contenido
  url.pathname.startsWith('/institutions/') ||   // logotipos
  url.pathname === '/manifest.webmanifest' ||
  /^\/(icon-\d+|apple-touch-icon)\.png$/.test(url.pathname)

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
      if (hit) return hit
      return fetch(request).then((res) => {
        // Solo se guarda una respuesta buena y completa.
        if (res.ok && res.status === 200 && res.type === 'basic') {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copia)).catch(() => {})
        }
        return res
      })
    }),
  )
})
