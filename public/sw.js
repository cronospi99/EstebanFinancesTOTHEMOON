/**
 * Service worker mínimo.
 *
 * Estrategia: network-first con respaldo en caché. En una app de finanzas
 * mostrar un saldo desactualizado es peor que mostrar un error, así que la red
 * siempre gana; la caché solo entra cuando no hay conexión.
 *
 * Las llamadas a /api/ nunca se cachean: un precio viejo no debe fingir ser actual.
 */
const CACHE = 'finanzas-v1'
const PRECACHE = ['/', '/gastos', '/inversiones', '/ajustes', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
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
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/'))),
  )
})
