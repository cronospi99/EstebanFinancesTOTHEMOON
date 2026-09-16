'use client'

import { useState } from 'react'
import { Bell, BellOff, Loader2, Mail, Send } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { usePush } from '@/lib/use-push'
import { useAvisos, useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

const DIAS = [
  { valor: 0, etiqueta: 'El mismo día' },
  { valor: 1, etiqueta: 'Un día antes' },
  { valor: 3, etiqueta: 'Tres días antes' },
  { valor: 7, etiqueta: 'Una semana antes' },
]

/**
 * Recordatorios: de qué, cuándo y por dónde.
 *
 * El aviso que sirve es el que llega con la app cerrada, así que lo que se
 * configura aquí es un Web Push de verdad y no un mensaje dentro de la app. La
 * pantalla dice en qué paso está y qué hacer si falla, porque hay cuatro
 * puntos donde esto se rompe —sin service worker, sin llaves en el servidor,
 * sin permiso, sin instalar en iPhone— y el usuario no tiene por qué saber
 * cuál de los cuatro le tocó.
 */
export function AvisosCard() {
  const { settings, guardarAjustes } = useFinance()
  const { estado, ocupado, error, encender, apagar, probar } = usePush()
  const avisos = useAvisos()
  const [correo, setCorreo] = useState(settings.avisoEmail ?? '')

  const encendido = estado === 'encendido'
  const margen = settings.avisoDias ?? 1

  return (
    <Card className="p-4">
      {/* ---- El interruptor ---- */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          encendido ? 'bg-accent-green/15 text-accent-green' : 'bg-fill-3 text-label-secondary',
        )}>
          {encendido ? <Bell size={17} /> : <BellOff size={17} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-label">Avisos en este dispositivo</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-label-secondary">
            {estado === 'comprobando' && 'Comprobando…'}
            {estado === 'encendido' && 'Llegan aunque la app esté cerrada.'}
            {estado === 'apagado' && 'Te avisamos antes de un cobro, un corte o un vencimiento.'}
            {estado === 'bloqueado' && 'El navegador tiene los avisos bloqueados para este sitio. Se cambia en sus ajustes.'}
            {estado === 'sin-instalar' && 'En iPhone hay que instalar la app en la pantalla de inicio: compartir → «Añadir a inicio». Después vuelve aquí.'}
            {estado === 'no-soportado' && 'Este navegador no admite avisos del sistema.'}
            {estado === 'sin-configurar' && 'El servidor no tiene llaves VAPID configuradas. Ver VAPID_PUBLIC_KEY en .env.example.'}
          </p>
        </div>

        {(estado === 'apagado' || estado === 'encendido') && (
          <button
            onClick={() => { haptic(10); encendido ? apagar() : encender() }}
            disabled={ocupado}
            aria-pressed={encendido}
            className={cn(
              'press shrink-0 rounded-pill px-3 py-1.5 text-[13px] font-semibold transition-colors',
              encendido ? 'border border-hairline text-label-secondary' : 'bg-accent-blue text-white',
            )}
          >
            {ocupado ? <Loader2 size={14} className="animate-spin" /> : encendido ? 'Apagar' : 'Activar'}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-[12px] text-accent-orange">{error}</p>}

      {/* ---- Con cuánta antelación ---- */}
      <div className="mt-4 border-t border-hairline pt-3">
        <p className="mb-2 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Cuándo avisar
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DIAS.map((d) => (
            <button
              key={d.valor}
              onClick={() => { haptic(6); guardarAjustes({ avisoDias: d.valor }) }}
              aria-pressed={margen === d.valor}
              className={cn(
                'press rounded-pill px-3 py-1.5 text-[13px] transition-colors',
                margen === d.valor ? 'bg-fill-4 font-medium text-label' : 'border border-hairline text-label-secondary',
              )}
            >
              {d.etiqueta}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-snug text-label-tertiary">
          Un día antes es lo que deja hacer algo: mover plata de otra cuenta, cancelar
          una prueba, o aprovechar que la tarjeta acaba de cortar.
        </p>
      </div>

      {/* ---- Qué avisar ---- */}
      <div className="mt-3 space-y-0.5 border-t border-hairline pt-3">
        <Interruptor
          etiqueta="Cobros de suscripciones"
          activo={settings.avisarSuscripciones !== false}
          onChange={(v) => guardarAjustes({ avisarSuscripciones: v })}
        />
        <Interruptor
          etiqueta="Cortes y pagos de tarjetas"
          activo={settings.avisarTarjetas !== false}
          onChange={(v) => guardarAjustes({ avisarTarjetas: v })}
        />
        <Interruptor
          etiqueta="Deudas con plazo"
          activo={settings.avisarDeudas !== false}
          onChange={(v) => guardarAjustes({ avisarDeudas: v })}
        />
      </div>

      {/* ---- Correo o teléfono ---- */}
      <div className="mt-3 border-t border-hairline pt-3">
        <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          <Mail size={12} /> También por correo o SMS
        </label>
        <input
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          onBlur={() => guardarAjustes({ avisoEmail: correo.trim() })}
          placeholder="tu@correo.com o +573001234567"
          inputMode="email"
          className="w-full rounded-xl border border-hairline bg-fill-2 px-4 py-2.5 text-[15px]
                     text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />
        <p className="mt-1.5 text-[12px] leading-snug text-label-tertiary">
          Un correo llega siempre, también sin la app instalada. Con un número en
          formato internacional se manda SMS, pero solo de lo urgente —un pago que
          vence hoy—, porque cada mensaje cuesta. Los dos canales necesitan estar
          configurados en el servidor.
        </p>
      </div>

      {/* ---- Prueba y vista previa ---- */}
      {encendido && (
        <button
          onClick={() => { haptic(10); probar() }}
          disabled={ocupado}
          className="press mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-hairline
                     py-2.5 text-[14px] font-medium text-accent-blue"
        >
          <Send size={14} /> Mandarme uno de prueba
        </button>
      )}

      {avisos.length > 0 && (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
            Lo que se avisaría ahora
          </p>
          <div className="space-y-1.5">
            {avisos.slice(0, 4).map((a) => (
              <div key={a.id} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-snug text-label">{a.titulo}</p>
                  <p className="text-[12px] leading-snug text-label-secondary">{a.cuerpo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function Interruptor({
  etiqueta, activo, onChange,
}: {
  etiqueta: string
  activo: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => { haptic(6); onChange(!activo) }}
      role="switch"
      aria-checked={activo}
      className="press flex w-full items-center justify-between gap-3 py-2 text-left"
    >
      <span className="text-[14.5px] text-label">{etiqueta}</span>
      <span className={cn(
        'relative h-[26px] w-[44px] shrink-0 rounded-pill transition-colors',
        activo ? 'bg-accent-green' : 'bg-fill-3',
      )}>
        <span className={cn(
          'absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all',
          activo ? 'left-[21px]' : 'left-[3px]',
        )} />
      </span>
    </button>
  )
}
