'use client'

import { useState } from 'react'
import { Check, Database, DollarSign, RefreshCw, ShieldCheck, User, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { useFinance } from '@/lib/store'
import { useProfileName } from '@/lib/use-profile'
import { formatKeypad, parseKeypad } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { cn, haptic } from '@/lib/utils'

export default function SettingsPage() {
  const { synced, transactions, accounts, holdings, resetDemo, fx, fxRate } = useFinance()
  const { name, setName } = useProfileName()
  const [editTasa, setEditTasa] = useState(false)
  const [tasaDraft, setTasaDraft] = useState('')

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
        <CardHeader title="Almacenamiento" />
        <Card className="divide-y divide-hairline overflow-hidden">
          <Row
            icon={<Database size={17} />}
            title="Supabase"
            subtitle={
              isSupabaseConfigured
                ? synced
                  ? 'Conectado y sincronizando'
                  : 'Configurado — falta iniciar sesión'
                : 'Sin configurar (Modo Demo)'
            }
            status={isSupabaseConfigured && synced}
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
        Los precios de mercado provienen de Yahoo Finance a través de un proxy en el
        servidor. Ninguna llave de API se expone en el navegador.
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
