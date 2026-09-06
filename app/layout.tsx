import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FinanceProvider } from '@/lib/store'
import { ServiceWorkerRegistrar } from '@/components/layout/service-worker'

// Inter con números tabulares. En iPhone el fallback -apple-system entrega
// SF Pro real, que es aún más fiel al look nativo.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Finanzas',
  description: 'Gastos, cuentas e inversiones — privado y en tiempo real.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Finanzas',
    statusBarStyle: 'black-translucent', // deja que el fondo suba bajo el notch
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  // Bloquea el zoom por doble toque: en una app tipo nativa se siente a error.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <FinanceProvider>
          {children}
        </FinanceProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
