'use client'

import { useEffect, useState } from 'react'
import { Ban, Minus, Plus, Smartphone, Trash2, Undo2 } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/ui/money-input'
import { Segmented } from '@/components/ui/segmented'
import { ScrollStrip } from '@/components/ui/scroll-strip'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { ServiceBadge } from './service-badge'
import {
  CICLOS, OPERADORAS, SERVICIOS, colorDe, costeAnual, costeMensual, servicioPorNombre,
} from '@/lib/suscripciones'
import { formatMoney, parseKeypad } from '@/lib/format'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'
import { hoyEnZona } from '@/lib/zona'
import type { Currency, SubCycle, Subscription } from '@/lib/types'

export const COLORES_SUB = [
  '#0A84FF', '#E50914', '#1DB954', '#FF9F0A', '#BF5AF2', '#10A37F', '#FF375F', '#8E8E93',
]

/**
 * Los que más se repiten, para no tener que teclearlos.
 *
 * Ordenados por probabilidad, no alfabéticamente: la tira se recorre de
 * izquierda a derecha y lo que casi nadie tiene estorba en la primera pantalla.
 * Los que no están se escriben a mano, que es para lo que está el campo.
 */
const SUGERIDOS = ['Netflix', 'Spotify', 'YouTube Premium', 'iCloud+', 'Disney+', 'Max',
  'Prime Video', 'ChatGPT Plus', 'Claude', 'Microsoft 365', 'Google One', 'Canva',
  'Xbox Game Pass', 'PlayStation Plus', 'Crunchyroll', 'Rappi Pro', 'Gimnasio']

/**
 * La ficha del plan del celular, que no es un servicio sino una pregunta.
 *
 * El recibo del celular lo manda Claro o Movistar, no «Celular», y dentro de un
 * año lo que uno recuerda es de quién era la línea. Así que esta ficha no
 * rellena el nombre: abre el selector de operadoras y lo que se guarda es la
 * marca, con su logotipo y su color.
 */
const CELULAR = 'Plan de celular'

/**
 * Alta y edición de una suscripción.
 *
 * Con `sub` a `null` crea; con una, edita. El importe que se pide es el del
 * ciclo —lo que cobran cada vez— y no el prorrateo mensual: es lo que dice el
 * recibo y lo único que el usuario sabe sin hacer cuentas. El promedio lo
 * calcula la app y lo enseña debajo, que es justo al revés de como se pide en
 * casi todas partes.
 */
export function SubscriptionSheet({
  open, sub, indice, onClose,
}: {
  open: boolean
  sub: Subscription | null
  /** Cuántas hay ya, para elegir color al crear. */
  indice: number
  onClose: () => void
}) {
  const { accounts, addSubscription, updateSubscription, deleteSubscription } = useFinance()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('COP')
  const [cycle, setCycle] = useState<SubCycle>('mensual')
  const [anchorAt, setAnchorAt] = useState(hoyEnZona())
  const [accountId, setAccountId] = useState('')
  const [esPrueba, setEsPrueba] = useState(false)
  const [trialEndsAt, setTrialEndsAt] = useState('')
  const [comparten, setComparten] = useState(1)
  const [note, setNote] = useState('')
  const [color, setColor] = useState(COLORES_SUB[0])
  /** El color se sigue solo al elegir servicio hasta que alguien lo toca. */
  const [colorAMano, setColorAMano] = useState(false)
  /** Si está abierto el selector de operadoras. */
  const [eligiendoOperadora, setEligiendoOperadora] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  // Se recargan al abrir: la hoja se reutiliza entre suscripciones y entre
  // crear y editar, así que sin esto se editaría una con los datos de otra.
  useEffect(() => {
    if (!open) return
    setName(sub?.name ?? '')
    setAmount(sub ? String(Math.round(sub.amount)) : '')
    setCurrency(sub?.currency ?? 'COP')
    setCycle(sub?.cycle ?? 'mensual')
    setAnchorAt(sub?.anchorAt ?? hoyEnZona())
    setAccountId(sub?.accountId ?? '')
    setEsPrueba(Boolean(sub?.trialEndsAt))
    setTrialEndsAt(sub?.trialEndsAt ?? '')
    setComparten(Math.max(1, Math.round(sub?.sharedWith ?? 1)))
    setNote(sub?.note ?? '')
    setColor(sub?.color ?? COLORES_SUB[indice % COLORES_SUB.length])
    setColorAMano(Boolean(sub))
    // Al editar una línea de celular, el selector viene abierto: es el campo
    // que se vuelve a tocar, no el nombre.
    setEligiendoOperadora(servicioPorNombre(sub?.name ?? '')?.grupo === 'Telefonía')
    setConfirmarBorrado(false)
  }, [open, sub, indice])

  /** Elegir del catálogo rellena el nombre y, si nadie lo tocó, el color. */
  const elegirServicio = (nombre: string) => {
    haptic(6)
    setEligiendoOperadora(false)
    setName(nombre)
    const conocido = servicioPorNombre(nombre)
    if (conocido && !colorAMano) setColor(conocido.color)
  }

  const monto = parseKeypad(amount)
  const listo = Boolean(name.trim()) && monto > 0
  const previa = { amount: monto, cycle }
  const cuenta = accounts.find((a) => a.id === accountId)

  const guardar = () => {
    if (!listo) return
    haptic([14, 40, 22])
    const campos = {
      name: name.trim(),
      amount: monto,
      currency,
      cycle,
      anchorAt,
      accountId: accountId || undefined,
      trialEndsAt: esPrueba && trialEndsAt ? trialEndsAt : undefined,
      // Uno es «la pago yo solo», que es lo mismo que no repartirla: se guarda
      // vacío para que no haya dos formas de decir lo mismo.
      sharedWith: comparten > 1 ? comparten : undefined,
      cancelled: sub?.cancelled ?? false,
      note: note.trim() || undefined,
      color,
    }
    if (sub) updateSubscription(sub.id, campos)
    else addSubscription(campos)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <h2 className="mb-5 text-center text-[17px] font-semibold">
          {sub ? 'Editar suscripción' : 'Nueva suscripción'}
        </h2>

        {/* ---- Servicio ---------------------------------------------------- */}
        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Qué servicio
        </label>
        <ScrollStrip className="mb-2">
          {SUGERIDOS.map((nombre) => {
            const elegido = name.trim().toLowerCase() === nombre.toLowerCase()
            const servicio = SERVICIOS.find((s) => s.name === nombre)!
            return (
              <button
                key={nombre}
                onClick={() => elegirServicio(nombre)}
                className={cn(
                  'press flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 transition-colors',
                  elegido ? 'border-transparent bg-fill-4' : 'border-hairline',
                )}
              >
                <ServiceBadge sub={{ name: nombre, color: servicio.color }} size="sm" />
                <span className="text-[13px] font-medium text-label">{nombre}</span>
              </button>
            )
          })}

          {/* La última ficha no es un servicio: abre la lista de operadoras. */}
          <button
            onClick={() => { haptic(6); setEligiendoOperadora((v) => !v) }}
            aria-expanded={eligiendoOperadora}
            className={cn(
              'press flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 transition-colors',
              eligiendoOperadora ? 'border-transparent bg-fill-4' : 'border-hairline',
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#16161A] text-white ring-1 ring-white/10">
              <Smartphone size={17} strokeWidth={2.2} />
            </span>
            <span className="text-[13px] font-medium text-label">{CELULAR}</span>
          </button>
        </ScrollStrip>

        {eligiendoOperadora && (
          <div className="mb-2 rounded-xl border border-hairline bg-fill-1 p-3">
            <p className="mb-2 px-1 text-[12px] text-label-secondary">¿Con cuál operadora?</p>
            <div className="flex flex-wrap gap-2">
              {OPERADORAS.map((o) => (
                <button
                  key={o.name}
                  onClick={() => {
                    haptic(6)
                    setName(o.name)
                    if (!colorAMano) setColor(o.color)
                  }}
                  className={cn(
                    'press flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 transition-colors',
                    name === o.name ? 'border-transparent bg-fill-4' : 'border-hairline',
                  )}
                >
                  <ServiceBadge sub={{ name: o.name, color: o.color }} size="sm" />
                  <span className="text-[13px] font-medium text-label">{o.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="O escríbelo: el gimnasio, el parqueadero…" autoFocus={!sub}
          className="mb-4 w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-[16px]
                     text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />

        {/* ---- Importe y moneda -------------------------------------------- */}
        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Cuánto cobran cada vez
        </label>
        <MoneyInput
          value={amount} onChange={setAmount} currency={currency}
          placeholder={currency === 'USD' ? '20' : '44.900'} className="mb-3"
        />
        <Segmented
          id="moneda-sub" className="mb-4"
          value={currency} onChange={setCurrency}
          options={[
            { value: 'COP' as Currency, label: 'Pesos (COP)' },
            { value: 'USD' as Currency, label: 'Dólares (USD)' },
          ]}
        />

        {/* ---- Ciclo -------------------------------------------------------- */}
        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Cada cuánto
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {CICLOS.map((c) => (
            <button
              key={c.value}
              onClick={() => { haptic(6); setCycle(c.value) }}
              className={cn(
                'press rounded-pill border px-3.5 py-2 text-[13px] font-medium transition-colors',
                cycle === c.value
                  ? 'border-transparent bg-accent-blue text-white'
                  : 'border-hairline text-label-secondary',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        {/* El promedio, en el momento de teclearlo: es la cifra que cambia la
            decisión, y verla después de guardar ya no sirve de nada. */}
        {monto > 0 && cycle !== 'mensual' && (
          <p className="mb-4 px-1 text-[12px] text-label-tertiary">
            Son {formatMoney(Math.round(costeMensual(previa)), currency)} al mes en promedio
            {' '}y {formatMoney(Math.round(costeAnual(previa)), currency)} al año.
          </p>
        )}
        {monto > 0 && cycle === 'mensual' && (
          <p className="mb-4 px-1 text-[12px] text-label-tertiary">
            Son {formatMoney(Math.round(costeAnual(previa)), currency)} al año.
          </p>
        )}

        {/* ---- Próximo cobro ------------------------------------------------ */}
        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Próximo cobro
        </label>
        <input
          type="date" value={anchorAt} onChange={(e) => setAnchorAt(e.target.value)}
          className="mb-1 w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-[15px]
                     text-label focus:border-accent-blue/50 focus:outline-none"
        />
        <p className="mb-4 px-1 text-[12px] text-label-tertiary">
          Con esta fecha y el ciclo se calculan todas las siguientes, así que no
          hay que volver a tocarla nunca.
        </p>

        {/* ---- Medio de pago ------------------------------------------------ */}
        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Con qué se paga
        </label>
        <ScrollStrip className="mb-2">
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => { haptic(6); setAccountId(accountId === a.id ? '' : a.id) }}
              className={cn(
                'press flex shrink-0 items-center gap-2 rounded-xl border py-2 pl-2 pr-3 transition-colors',
                accountId === a.id ? 'border-transparent bg-fill-4' : 'border-hairline',
              )}
            >
              <InstitutionBadge institution={a.institution} color={a.color} size="xs" />
              <span className="text-[13px] font-medium text-label">{a.name}</span>
            </button>
          ))}
        </ScrollStrip>
        <p className="mb-4 px-1 text-[12px] leading-relaxed text-label-tertiary">
          {cuenta
            ? 'El día que toque, el cobro se anota solo en esta cuenta y solo tendrás que confirmarlo.'
            : 'Sin cuenta la suscripción cuenta igual en los totales, pero el cobro no se anota solo: no hay de dónde sacarlo.'}
        </p>

        {/* ---- Prueba gratis ------------------------------------------------ */}
        <Interruptor
          etiqueta="Es una prueba gratis"
          activo={esPrueba}
          onChange={(v) => {
            setEsPrueba(v)
            // Una prueba sin fecha no avisa de nada: se propone un mes, que es
            // lo que dura casi siempre.
            if (v && !trialEndsAt) setTrialEndsAt(anchorAt)
          }}
        />
        {esPrueba && (
          <>
            <input
              type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)}
              className="mb-1 mt-3 w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-[15px]
                         text-label focus:border-accent-blue/50 focus:outline-none"
            />
            <p className="px-1 text-[12px] text-label-tertiary">
              Hasta esa fecha no suma al gasto, pero sí a «podrías ahorrar»: es
              lo que te quitas de encima si la cancelas a tiempo.
            </p>
          </>
        )}

        {/* ---- Compartida ---------------------------------------------------- */}
        <div className="mb-4 mt-3 rounded-xl border border-hairline bg-fill-1 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] text-label">La comparten</p>
              <p className="mt-0.5 text-[12px] text-label-tertiary">
                Contándote a ti. La pagas tú entera.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Paso icono={<Minus size={15} />} onClick={() => setComparten((n) => Math.max(1, n - 1))} desactivado={comparten <= 1} etiqueta="Uno menos" />
              <span className="tnum w-7 text-center text-[17px] font-semibold text-label">{comparten}</span>
              <Paso icono={<Plus size={15} />} onClick={() => setComparten((n) => Math.min(20, n + 1))} etiqueta="Uno más" />
            </div>
          </div>
          {comparten > 1 && monto > 0 && (
            <p className="mt-2 text-[12px] text-label-tertiary">
              De tu bolsillo salen {formatMoney(Math.round(costeMensual(previa) / comparten), currency)} al
              mes; el resto te lo deben.
            </p>
          )}
        </div>

        {/* ---- Nota y color --------------------------------------------------- */}
        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Nota (opcional)
        </label>
        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Plan familiar con los primos"
          className="mb-4 w-full rounded-xl border border-hairline bg-fill-2 px-4 py-3 text-[16px]
                     text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
        />

        <label className="mb-2 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Color
        </label>
        <div className="mb-5 flex flex-wrap gap-2">
          {COLORES_SUB.map((c) => (
            <button
              key={c}
              onClick={() => { haptic(6); setColor(c); setColorAMano(true) }}
              aria-label={`Color ${c}`}
              className={cn(
                'h-9 w-9 rounded-full transition-transform',
                color === c ? 'scale-110 ring-2 ring-ring-sel' : 'opacity-70',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* La previa: la tarjeta tal cual va a quedar en la lista. */}
        {name.trim() && (
          <div
            className="mb-5 flex items-center gap-3 rounded-[22px] px-4 py-3"
            style={{ backgroundColor: colorDe({ name, color }) }}
          >
            <ServiceBadge sub={{ name, color }} />
            <span className="truncate text-[17px] font-bold" style={{ color: '#FFFFFF' }}>
              {name.trim()}
            </span>
          </div>
        )}

        <button
          onClick={guardar}
          disabled={!listo}
          className="press h-[52px] w-full rounded-2xl bg-accent-blue text-[17px] font-semibold text-white
                     shadow-glow disabled:bg-fill-2 disabled:text-label-tertiary disabled:shadow-none"
        >
          {sub ? 'Guardar' : 'Registrar suscripción'}
        </button>

        {sub && (
          <>
            {/* Cancelar no es borrar: lo que dejaste de pagar en marzo sigue
                explicando por qué el gasto de este año bajó. */}
            <button
              onClick={() => {
                haptic(8)
                updateSubscription(sub.id, { cancelled: !sub.cancelled })
                onClose()
              }}
              className="press mt-3 flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl
                         border border-hairline text-[15px] font-medium text-label-secondary"
            >
              {sub.cancelled ? <><Undo2 size={16} /> Volver a activarla</> : <><Ban size={16} /> Marcarla como cancelada</>}
            </button>

            {confirmarBorrado ? (
              <div className="mt-3 rounded-2xl border border-accent-red/30 bg-accent-red/[0.08] p-4">
                <p className="mb-3 text-center text-[13px] leading-relaxed text-label">
                  Desaparece de la lista y de los totales. Si solo dejaste de
                  pagarla, mejor márcala como cancelada.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmarBorrado(false)}
                    className="press flex-1 rounded-xl border border-hairline py-2.5 text-[14px] text-label-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { haptic([20, 40]); deleteSubscription(sub.id); onClose() }}
                    className="press flex-1 rounded-xl bg-accent-red py-2.5 text-[14px] font-semibold text-white"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { haptic(8); setConfirmarBorrado(true) }}
                className="press mt-3 flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl
                           border border-hairline text-[15px] font-medium text-accent-red"
              >
                <Trash2 size={16} />
                Eliminar
              </button>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}

function Interruptor({
  etiqueta, activo, onChange,
}: { etiqueta: string; activo: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => { haptic(6); onChange(!activo) }}
      className="press flex w-full items-center justify-between rounded-xl border border-hairline
                 bg-fill-1 px-4 py-3 text-left"
    >
      <span className="text-[15px] text-label">{etiqueta}</span>
      <span
        className={cn(
          'flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors',
          activo ? 'bg-accent-green' : 'bg-fill-4',
        )}
      >
        <span className={cn('h-5 w-5 rounded-full bg-white transition-transform', activo && 'translate-x-4')} />
      </span>
    </button>
  )
}

function Paso({
  icono, onClick, desactivado, etiqueta,
}: { icono: React.ReactNode; onClick: () => void; desactivado?: boolean; etiqueta: string }) {
  return (
    <button
      onClick={() => { haptic(6); onClick() }}
      disabled={desactivado}
      aria-label={etiqueta}
      className="press-icon flex h-8 w-8 items-center justify-center rounded-full border border-hairline
                 text-label disabled:opacity-35"
    >
      {icono}
    </button>
  )
}
