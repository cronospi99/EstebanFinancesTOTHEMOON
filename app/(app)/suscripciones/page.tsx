'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, CreditCard, Plus, Repeat, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ScrollStrip } from '@/components/ui/scroll-strip'
import { ServiceBadge } from '@/components/subscriptions/service-badge'
import { SubscriptionCard } from '@/components/subscriptions/subscription-card'
import { SubscriptionSheet } from '@/components/subscriptions/subscription-sheet'
import { SubscriptionsSummary } from '@/components/subscriptions/subscriptions-summary'
import { cuandoCobra, fechaCobro, mesEnCurso } from '@/lib/suscripciones'
import { formatMoney } from '@/lib/format'
import { useFinance, useSuscripciones, useSuscripcionesResumen, type SubConCobro } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import type { Subscription } from '@/lib/types'

type Filtro = 'todas' | 'moneda' | 'pruebas' | 'compartidas'

const FILTROS: { value: Filtro; label: string; cumple: (s: SubConCobro) => boolean }[] = [
  { value: 'todas', label: 'Todas', cumple: () => true },
  // «Otra moneda» y no «dólares» porque lo que importa no es cuál es, sino que
  // no es en la que uno piensa: un cobro en dólares sube solo cuando sube el
  // dólar, sin que nadie lo haya subido.
  { value: 'moneda', label: 'Otra moneda', cumple: (s) => s.sub.currency !== 'COP' },
  { value: 'pruebas', label: 'Pruebas', cumple: (s) => s.prueba },
  { value: 'compartidas', label: 'Compartidas', cumple: (s) => s.compartida },
]

/**
 * Suscripciones: lo que se cobra solo.
 *
 * Tiene pantalla propia y no es una categoría de gastos más porque la pregunta
 * es otra. Un gasto se mira hacia atrás —en qué se me fue— y una suscripción
 * hacia adelante: qué me van a cobrar, cuándo, y cuánto suma todo esto al año.
 * Esa última cifra es la que sorprende y la que ninguna lista de movimientos
 * enseña: nueve cobros pequeños que nadie recuerda haber aceptado y que juntos
 * valen más que el arriendo de una semana.
 *
 * En el móvil las tarjetas van apiladas como una baraja, solapándose: con seis
 * o siete servicios, una lista suelta obliga a desplazar dos pantallas para
 * contarlas, y lo que uno quiere es verlas todas de golpe. En escritorio sobra
 * ancho, así que se despliegan en rejilla con todo a la vista y el resumen se
 * queda fijo al lado, que es donde el ojo lo busca en una pantalla grande.
 */
export default function SubscriptionsPage() {
  const items = useSuscripciones()
  const resumen = useSuscripcionesResumen()
  const { suscripcionesError, synced, registrarCobro } = useFinance()

  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [hoja, setHoja] = useState(false)
  const [editando, setEditando] = useState<Subscription | null>(null)

  const visibles = useMemo(
    () => items.filter(FILTROS.find((f) => f.value === filtro)!.cumple),
    [items, filtro],
  )
  const deHoy = useMemo(() => items.filter((i) => i.cobraHoy), [items])
  /** Los próximos cobros, para el carril del escritorio. */
  const proximos = useMemo(
    () => items.filter((i) => !i.sub.cancelled && !i.cobraHoy).slice(0, 6),
    [items],
  )

  const abrirNueva = () => { haptic(6); setEditando(null); setHoja(true) }
  const abrirEdicion = (sub: Subscription) => { haptic(6); setEditando(sub); setHoja(true) }

  return (
    <div className="px-5 pb-6 lg:px-0">
      {/* ---- Encabezado --------------------------------------------------- */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="pt-safe mb-4 flex items-start justify-between gap-3 pt-6 lg:pt-0"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-label-tertiary">
            {mesEnCurso()}
          </p>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em]">
            Mis suscripciones
          </h1>
        </div>
        <button
          onClick={abrirNueva}
          aria-label="Nueva suscripción"
          className="press mt-1 flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-fill-2 px-3.5
                     text-[14px] font-semibold text-accent-blue lg:bg-accent-blue lg:text-white lg:shadow-glow"
        >
          <Plus size={17} strokeWidth={2.6} />
          <span className="hidden sm:inline">Nueva</span>
        </button>
      </motion.header>

      {/* Si el servidor las rechaza, decirlo: sin el aviso el fallo es
          invisible —se registra, se ve, y a la carga siguiente no está—. */}
      {synced && suscripcionesError && (
        <div className="mb-4 flex gap-2.5 rounded-2xl border border-accent-orange/25 bg-accent-orange/[0.08] px-4 py-3">
          <TriangleAlert size={17} className="mt-0.5 shrink-0 text-accent-orange" />
          <div>
            <p className="text-[13px] font-semibold text-accent-orange">
              Las suscripciones no se están guardando en tu cuenta
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-label-secondary">
              {suscripcionesError}. Lo que registres se queda en este teléfono
              hasta que se arregle. Si acabas de desplegar, falta aplicar la
              migración
              <code className="mx-1 rounded bg-white/10 px-1 py-0.5 text-[11px]">suscripciones</code>
              en Supabase.
            </p>
          </div>
        </div>
      )}

      {!items.length ? (
        <VacioTotal onNueva={abrirNueva} />
      ) : (
        <>
          {/* ---- Filtros ---------------------------------------------------- */}
          <ScrollStrip className="mb-4">
            {FILTROS.map((f) => {
              const cuantas = items.filter(f.cumple).length
              const activo = filtro === f.value
              // Un filtro que no deja nada no se ofrece: pulsarlo para ver una
              // pantalla vacía no es información, es un callejón.
              if (!cuantas && f.value !== 'todas') return null
              return (
                <button
                  key={f.value}
                  onClick={() => { haptic(6); setFiltro(f.value) }}
                  className={cn(
                    'press shrink-0 rounded-pill px-4 py-2 text-[14px] font-semibold transition-colors',
                    activo
                      ? 'bg-label text-ink'
                      : 'border border-hairline bg-fill-1 text-label-secondary',
                  )}
                >
                  {f.label}
                  {f.value !== 'todas' && <span className="ml-1.5 opacity-60">{cuantas}</span>}
                </button>
              )
            })}
          </ScrollStrip>

          {/* ---- Los que cobran hoy ----------------------------------------- */}
          {deHoy.length > 0 && (
            <Card className="mb-4 p-4">
              <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-label">
                <CalendarClock size={15} className="text-accent-orange" />
                {deHoy.length === 1 ? 'Hoy te cobran una' : `Hoy te cobran ${deHoy.length}`}
              </p>
              <p className="mb-3 text-[12px] leading-relaxed text-label-secondary">
                La app no inventa movimientos que el banco no ha hecho. Cuando
                te llegue el mensaje, anótalo aquí y sale de su cuenta.
              </p>
              <ul className="space-y-2">
                {deHoy.map((i) => (
                  <li key={i.sub.id} className="flex items-center gap-2.5">
                    <ServiceBadge sub={i.sub} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-label">{i.sub.name}</span>
                      <span className="tnum block text-[11px] text-label-tertiary">
                        {fechaCobro(i.cobro)} · {formatMoney(i.sub.amount, i.sub.currency)}
                      </span>
                    </span>
                    <button
                      onClick={() => { haptic([14, 40, 22]); registrarCobro(i.sub.id) }}
                      className="press shrink-0 rounded-xl border border-hairline bg-fill-1 px-3 py-1.5
                                 text-[13px] font-medium text-accent-blue"
                    >
                      {i.sub.accountId ? 'Anotar' : 'Listo'}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start lg:gap-6">
            {/* ---- La baraja (móvil) / la rejilla (escritorio) -------------- */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-4">
              {visibles.map((item, i) => (
                <div
                  key={item.sub.id}
                  className={cn('relative', i > 0 && '-mt-4 lg:mt-0')}
                  // Las de abajo por encima de las de arriba, y la desplegada
                  // sobre todas: si no, el solapamiento le come el detalle.
                  style={{ zIndex: abierta === item.sub.id ? 50 : i + 1 }}
                >
                  <SubscriptionCard
                    item={item}
                    abierta={abierta === item.sub.id}
                    onToggle={() => setAbierta((a) => (a === item.sub.id ? null : item.sub.id))}
                    onEditar={() => abrirEdicion(item.sub)}
                  />
                </div>
              ))}

              {!visibles.length && (
                <Card className="p-6 text-center lg:col-span-full">
                  <p className="text-[14px] text-label-secondary">
                    Ninguna suscripción con ese filtro.
                  </p>
                </Card>
              )}
            </div>

            {/* ---- El carril: resumen y lo que viene ------------------------ */}
            <aside className="mt-4 space-y-4 lg:sticky lg:top-4 lg:mt-0">
              <SubscriptionsSummary resumen={resumen} />

              {/* Solo en escritorio: en el móvil la baraja ya es el calendario
                  —está ordenada por fecha— y repetirlo debajo sería la misma
                  lista dos veces. */}
              {proximos.length > 0 && (
                <Card className="hidden p-4 lg:block">
                  <p className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-label-tertiary">
                    <Repeat size={13} /> Lo que viene
                  </p>
                  <ul className="space-y-2.5">
                    {proximos.map((i) => (
                      <li key={i.sub.id} className="flex items-center gap-2.5">
                        <ServiceBadge sub={i.sub} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-label">{i.sub.name}</span>
                          <span className="block text-[11px] text-label-tertiary">{cuandoCobra(i.cobro)}</span>
                        </span>
                        <span className="tnum shrink-0 text-[14px] font-semibold text-label">
                          {formatMoney(i.sub.amount, i.sub.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </aside>
          </div>
        </>
      )}

      <SubscriptionSheet
        open={hoja} sub={editando} indice={items.length}
        onClose={() => setHoja(false)}
      />
    </div>
  )
}

function VacioTotal({ onNueva }: { onNueva: () => void }) {
  return (
    <Card className="p-8 text-center">
      <CreditCard size={22} className="mx-auto mb-2 text-label-tertiary" />
      <p className="text-[15px] font-medium text-label">Nada se te cobra solo todavía</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-label-secondary">
        Anota lo que se renueva sin que nadie decida nada —la música, la nube,
        el gimnasio— y la app te dice cuándo cobran y, sobre todo, cuánto suma
        todo eso al año. Esa cifra es la que sorprende.
      </p>
      <button
        onClick={onNueva}
        className="press mt-3 rounded-xl border border-hairline bg-fill-1 px-4 py-2 text-[14px] font-medium text-accent-blue"
      >
        Registrar la primera
      </button>
    </Card>
  )
}
