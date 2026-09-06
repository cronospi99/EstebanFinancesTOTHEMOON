'use client'

import { Check, Database, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { useFinance } from '@/lib/store'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { cn, haptic } from '@/lib/utils'

export default function SettingsPage() {
  const { synced, transactions, accounts, holdings, resetDemo } = useFinance()

  return (
    <div className="space-y-6 px-5">
      <PageHeader title="Ajustes" />

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
