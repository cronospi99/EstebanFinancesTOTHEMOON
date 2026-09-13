import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FinanceProvider } from '@/lib/store'
import { PwaRecovery } from '@/components/layout/pwa-recovery'
import { ServiceWorkerRegistrar } from '@/components/layout/service-worker'

// Inter con números tabulares. En iPhone el fallback -apple-system entrega
// SF Pro real, que es aún más fiel al look nativo.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'To The Moon - Finances',
  description: 'Tus gastos, cuentas e inversiones. Sólo tuyos.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'To The Moon - Finances',
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

/*
 * El tema, antes del primer pintado.
 *
 * Va como guion en línea y no en un efecto de React porque un efecto corre
 * después de pintar: con el tema claro guardado, la app abría en negro y
 * saltaba a blanco un instante después. Ese fogonazo es lo único que delata
 * que esto es una web y no una app.
 *
 * Se escribe siempre el atributo —también para el oscuro— para que el CSS no
 * tenga que adivinar, y se ajusta la etiqueta de color de barra de estado a la
 * vez, que si no iOS deja una franja negra sobre el fondo claro.
 */
const GUION_TEMA = `(function(){try{
var t=localStorage.getItem('eftm.tema')||'oscuro';
var o=t==='oscuro'||(t==='sistema'&&!matchMedia('(prefers-color-scheme: light)').matches);
document.documentElement.dataset.theme=o?'dark':'light';
var m=document.querySelector('meta[name="theme-color"]');
if(m)m.setAttribute('content',o?'#000000':'#F2F2F7');
}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * `suppressHydrationWarning` va aquí a propósito: el guion de abajo escribe
     * `data-theme` en este mismo elemento antes de que React hidrate, así que
     * el servidor y el cliente nunca van a coincidir en ese atributo. Es la
     * forma documentada de decirle a React que la diferencia es intencionada;
     * sin ella, la app arranca con un error de hidratación en consola.
     */
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body>
        {/* Lo primero del body: corre antes de que se pinte nada de dentro, y
            un <head> propio aquí rompe la inyección de estilos de Next. */}
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
        <FinanceProvider>
          {children}
        </FinanceProvider>
        <ServiceWorkerRegistrar />
        <PwaRecovery />
      </body>
    </html>
  )
}
