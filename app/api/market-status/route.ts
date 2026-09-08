import { NextResponse } from 'next/server'

/**
 * Qué llaves de datos de mercado ve el servidor.
 *
 * Existe por una pregunta que desde la app no tenía respuesta: «ya puse la
 * llave de Twelve Data, ¿por qué no cambia nada?». Configurar la variable no
 * basta —en Vercel las variables de entorno solo entran en el despliegue
 * siguiente, así que hay que volver a desplegar— y hasta ahora la única forma
 * de saber si había llegado era leer los mensajes de error de las cotizaciones
 * y deducirlo. Ahora Ajustes lo dice.
 *
 * Devuelve booleanos. El valor de la llave no sale de aquí.
 */

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      claves: {
        twelveData: Boolean(process.env.TWELVE_DATA_API_KEY?.trim()),
        alphaVantage: Boolean(process.env.ALPHA_VANTAGE_API_KEY?.trim()),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
