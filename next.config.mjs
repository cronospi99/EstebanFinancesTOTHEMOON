/*
 * Sello de la compilación.
 *
 * Responde a «he mezclado el cambio y no lo veo en la app», que sin esto solo
 * se puede contestar abriendo el panel de Vercel: dice qué commit y qué rama
 * está sirviendo la versión que tienes delante. Si el commit no es el que
 * acabas de mezclar, el despliegue es viejo; si la rama no es la que esperas,
 * es que la rama de producción del proyecto apunta a otro sitio.
 *
 * Vercel pone estas variables en el entorno del build. En local no existen y
 * se marca como tal.
 */
const build = {
  NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || 'local',
  NEXT_PUBLIC_BUILD_REF: process.env.VERCEL_GIT_COMMIT_REF ?? '',
  NEXT_PUBLIC_BUILD_AT: new Date().toISOString(),
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: build,
  experimental: {
    // Keeps Framer Motion / Recharts out of the server bundle graph where possible.
    optimizePackageImports: ['lucide-react', 'recharts'],
    /*
     * Caché del router en el cliente.
     *
     * Por defecto Next 15 no reutiliza nada de una ruta dinámica, así que cada
     * toque en la barra inferior vuelve a pedir el payload al servidor y a
     * relanzar el prefetch de las otras tres pestañas. Cada una de esas
     * peticiones pasa por el middleware, que valida la sesión contra Supabase:
     * cuatro viajes de ida y vuelta por toque, sobre las seis conexiones que
     * Safari concede por dominio. En el móvil eso se nota como pestañas que
     * tardan y, con la red mala, que dejan de responder.
     *
     * Treinta segundos de reutilización bastan para que moverse entre pestañas
     * sea inmediato sin que los datos se queden viejos.
     */
    staleTimes: { dynamic: 30, static: 180 },
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
