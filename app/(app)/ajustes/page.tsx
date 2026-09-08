'use client'

import { useMemo, useState } from 'react'
import { Check, Database, DollarSign, KeyRound, LineChart, RefreshCw, ShieldCheck, User, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { useFinance } from '@/lib/store'
import { useMarketStatus } from '@/lib/use-market-status'
import { useProfileName } from '@/lib/use-profile'
import { formatKeypad, parseKeypad } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { cn, haptic } from '@/lib/utils'

export default function SettingsPage() {
  const {
    synced, syncError, transactions, accounts, holdings, resetDemo, fx, fxRate,
    quotes, quotesLoading, quotesFallos,
  } = useFinance()
  const { name, setName } = useProfileName()
  const [editTasa, setEditTasa] = useState(false)
  const [tasaDraft, setTasaDraft] = useState('')

  const mercado = useMarketStatus()

  /*
   * Qué proveedor está poniendo los precios ahora mismo. Es la otra mitad de
   * la respuesta: saber que la llave llegó al servidor no basta si luego el
   * proveedor rechaza el símbolo o se acabó el cupo del día.
   */
  const fuentesEnUso = useMemo(() => {
    const vistas = new Set<string>()
    for (const q of Object.values(quotes)) {
      if (q && !q.stale && q.price > 0 && q.source) vistas.add(q.source)
    }
    return [...vistas]
  }, [quotes])

  return (
    <div className="space-y-6 px-5">
      <PageHeader title="Ajustes" />

      <section>
        <CardHeader title="Tu perfil" />
        <Card className="p-4">
          <label className="mb-2 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
            <User size={12} /> Nombre
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="¿Cómo te llamas?"
            className="w-full rounded-xl border border-hairline bg-white/[0.05] px-4 py-3 text-[16px]
                       text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
          />
          <p className="mt-1.5 px-1 text-[12px] text-label-tertiary">
            Se usa en el saludo. Con sesión iniciada se guarda en tu cuenta, así
            que te reconoce también en otro dispositivo.
          </p>
        </Card>
      </section>

      <section>
        <CardHeader title="Tasa de cambio" />
        <Card className="p-4">
          {editTasa ? (
            <>
              <p className="mb-2 text-[12px] text-label-secondary">Dólar en pesos</p>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-hairline bg-white/[0.06] px-3 py-2.5">
                  <span className="text-[16px] text-label-secondary">$</span>
                  <input
                    autoFocus value={tasaDraft ? formatKeypad(tasaDraft) : ''} inputMode="decimal"
                    onChange={(e) => setTasaDraft(e.target.value.replace(/[^\d,]/g, ''))}
                    placeholder="4.000"
                    className="tnum w-full bg-transparent text-[20px] font-semibold text-label placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => { haptic([14, 30]); fx.setManual(parseKeypad(tasaDraft)); setEditTasa(false) }}
                  aria-label="Guardar tasa"
                  className="press flex h-11 w-11 items-center justify-center rounded-xl bg-accent-blue text-white"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => setEditTasa(false)} aria-label="Cancelar"
                  className="press flex h-11 w-11 items-center justify-center rounded-xl border border-hairline text-label-secondary"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="px-1 text-[12px] text-label-tertiary">
                Una tasa fijada a mano manda sobre la que se consulta en línea.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-label-secondary">
                  <DollarSign size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-label-secondary">USD / COP</p>
                  <p className="tnum text-[18px] font-semibold text-label">
                    {fxRate > 0 ? fxRate.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : 'Sin tasa'}
                  </p>
                </div>
                <button
                  onClick={() => { haptic(6); setTasaDraft(fxRate > 0 ? String(Math.round(fxRate)) : ''); setEditTasa(true) }}
                  className="press shrink-0 rounded-pill border border-hairline px-3 py-1.5 text-[13px] font-medium text-accent-blue"
                >
                  Fijar
                </button>
              </div>
              <p className="mt-2 px-1 text-[12px] text-label-tertiary">
                {fx.origin === 'live' && `En vivo, vía ${fx.source}.`}
                {fx.origin === 'cached' && 'Última conocida: no se pudo consultar en línea.'}
                {fx.origin === 'manual' && 'Fijada por ti. Toca Fijar y deja el campo vacío para volver a la automática.'}
                {fx.origin === 'none' && 'No se pudo obtener. Las cuentas en dólares quedan fuera del patrimonio hasta que la fijes.'}
              </p>
            </>
          )}
        </Card>
      </section>

      <section>
        <CardHeader title="Datos de mercado" />
        <Card className="divide-y divide-hairline overflow-hidden">
          <Row
            icon={<KeyRound size={17} />}
            title="Twelve Data"
            subtitle={
              mercado.cargando
                ? 'Comprobando…'
                : mercado.error
                  ? 'No se pudo comprobar con el servidor'
                  : mercado.claves?.twelveData
                    ? 'Llave activa en el servidor'
                    : 'Sin llave — solo fuentes públicas'
            }
            status={Boolean(mercado.claves?.twelveData)}
          />
          {mercado.claves?.alphaVantage && (
            <Row
              icon={<KeyRound size={17} />}
              title="Alpha Vantage"
              subtitle="Llave activa como último respaldo"
              status
            />
          )}
          <Row
            icon={<LineChart size={17} />}
            title="Precios en vivo"
            subtitle={
              !holdings.length
                ? 'Sin posiciones que cotizar'
                : fuentesEnUso.length
                  ? `Respondiendo: ${fuentesEnUso.join(', ')}`
                  : quotesLoading
                    ? 'Consultando…'
                    : 'Ninguna fuente está respondiendo'
            }
            status={fuentesEnUso.length > 0}
          />
        </Card>

        {/* Sin llave, el paso siguiente. Con llave y sin precios, el motivo:
            son las dos únicas situaciones en las que hay algo que hacer. */}
        {!mercado.cargando && !mercado.error && !mercado.claves?.twelveData && (
          <Card className="mt-3 p-4">
            <p className="mb-2 text-[13px] font-semibold text-label">Cómo activar Twelve Data</p>
            <ol className="space-y-1.5 text-[13px] leading-relaxed text-label-secondary">
              <li>1. Pide la llave gratuita en twelvedata.com</li>
              <li>
                2. Guárdala como <code className="rounded bg-white/10 px-1 py-0.5 text-[12px]">TWELVE_DATA_API_KEY</code>
                {' '}en las variables de entorno
              </li>
              <li>3. Vuelve a desplegar: las variables solo entran en el despliegue siguiente</li>
            </ol>
            <p className="mt-2 text-[12px] leading-relaxed text-label-tertiary">
              Mientras tanto los precios dependen de Yahoo y Stooq, que suelen
              bloquear las peticiones hechas desde un servidor.
            </p>
          </Card>
        )}

        {mercado.claves?.twelveData && !fuentesEnUso.length && !quotesLoading && quotesFallos.length > 0 && (
          <Card className="mt-3 p-4">
            <p className="mb-1.5 text-[13px] font-semibold text-accent-orange">
              La llave está, pero no hay precios
            </p>
            {/* Un solo símbolo: los motivos se repiten iguales en todos, y las
                seis cadenas completas ocupaban media pantalla sin añadir nada. */}
            <p className="break-words text-[12px] leading-relaxed text-label-secondary">
              {quotesFallos[0]}
            </p>
            {quotesFallos.length > 1 && (
              <p className="mt-1 text-[12px] text-label-tertiary">
                Y lo mismo en {quotesFallos.length - 1}{' '}
                {quotesFallos.length === 2 ? 'símbolo más' : 'símbolos más'}.
              </p>
            )}
          </Card>
        )}
      </section>

      <section>
        <CardHeader title="Almacenamiento" />
        <Card className="divide-y divide-hairline overflow-hidden">
          <Row
            icon={<Database size={17} />}
            title="Supabase"
            subtitle={
              !isSupabaseConfigured
                ? 'Sin configurar (Modo Demo)'
                : !synced
                  ? 'Configurado — falta iniciar sesión'
                  : syncError
                    ? 'Sesión activa, pero la última lectura falló'
                    : 'Conectado y sincronizando'
            }
            status={isSupabaseConfigured && synced && !syncError}
          />
          <Row
            icon={<ShieldCheck size={17} />}
            title="Datos privados"
            subtitle={
              synced
                ? 'Protegidos por Row Level Security'
                : 'Guardados solo en este dispositivo'
            }
            status
          />
        </Card>

        {!isSupabaseConfigured && (
          <Card className="mt-3 p-4">
            <p className="mb-2 text-[13px] font-semibold text-label">Cómo conectar Supabase</p>
            <ol className="space-y-1.5 text-[13px] leading-relaxed text-label-secondary">
              <li>1. Crea un proyecto en supabase.com</li>
              <li>2. Ejecuta <code className="rounded bg-white/10 px-1 py-0.5 text-[12px]">supabase/schema.sql</code> en el SQL Editor</li>
              <li>3. Copia <code className="rounded bg-white/10 px-1 py-0.5 text-[12px]">.env.example</code> a <code className="rounded bg-white/10 px-1 py-0.5 text-[12px]">.env.local</code> con tus llaves</li>
              <li>4. Reinicia el servidor de desarrollo</li>
            </ol>
          </Card>
        )}
      </section>

      <section>
        <CardHeader title="Datos" />
        <Card className="divide-y divide-hairline overflow-hidden">
          <Stat label="Movimientos" value={transactions.length} />
          <Stat label="Cuentas" value={accounts.length} />
          <Stat label="Posiciones" value={holdings.length} />
        </Card>
      </section>

      {!synced && (
        <button
          onClick={() => {
            haptic([16, 40])
            resetDemo()
          }}
          className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline
                     bg-white/[0.04] py-3.5 text-[15px] font-medium text-accent-red"
        >
          <RefreshCw size={16} />
          Restablecer datos de demostración
        </button>
      )}

      <p className="px-1 pb-2 text-center text-[12px] leading-relaxed text-label-tertiary">
        Los precios de mercado se consultan desde el servidor, probando varias
        fuentes en cadena. Ninguna llave de API se expone en el navegador.
      </p>
    </div>
  )
}

function Row({
  icon, title, subtitle, status,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  status: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-label-secondary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-label">{title}</div>
        <div className="truncate text-[12px] text-label-tertiary">{subtitle}</div>
      </div>
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          status ? 'bg-accent-green/20 text-accent-green' : 'bg-white/[0.08] text-label-tertiary',
        )}
      >
        {status ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[15px] text-label-secondary">{label}</span>
      <span className="tnum text-[15px] font-semibold text-label">{value}</span>
    </div>
  )
}
