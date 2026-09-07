/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
