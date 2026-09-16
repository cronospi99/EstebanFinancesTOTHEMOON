'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, Smartphone, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/format'
import { cn, haptic } from '@/lib/utils'

/**
 * Atajos de iOS, webhooks y automatizaciones.
 *
 * Aquí se crea el token que deja registrar un gasto desde fuera de la app: un
 * atajo que lea el SMS del banco, un botón en la pantalla de inicio, una
 * automatización que se dispare al llegar un correo de la tarjeta.
 *
 * ---------------------------------------------------------------------------
 * El token se enseña una sola vez
 * ---------------------------------------------------------------------------
 * De la base de datos solo sale el hash SHA-256, nunca el token. Si alguien se
 * llevara la base entera no podría usar ninguno: del hash no se vuelve atrás.
 * El precio es que no se puede volver a consultar —hay que copiarlo en el
 * momento— y es el mismo trato que hacen GitHub y Stripe con sus llaves.
 *
 * El hash se calcula en el navegador con `crypto.subtle`, así que el token en
 * claro no llega ni siquiera al servidor de la app.
 */

interface Token {
  id: string
  nombre: string
  prefijo: string
  usos: number
  last_used_at: string | null
  created_at: string
}

const PREFIJO = 'eftm_'

/** 32 bytes al azar, en base64url. Sin ambigüedades al copiar y pegar. */
function generarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const base = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return PREFIJO + base
}

async function sha256(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto)
  const hash = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function AtajosCard() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [reciente, setReciente] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<'token' | 'url' | null>(null)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) { setCargando(false); return }
    const { data, error: fallo } = await supabase
      .from('ingest_tokens')
      .select('id, nombre, prefijo, usos, last_used_at, created_at')
      .eq('revoked', false)
      .order('created_at', { ascending: false })
    if (fallo) setError(/does not exist|schema cache/i.test(fallo.message)
      ? 'La tabla todavía no existe en tu proyecto de Supabase: falta aplicar la migración.'
      : fallo.message)
    else setTokens((data ?? []) as Token[])
    setCargando(false)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const crear = async () => {
    const supabase = createClient()
    if (!supabase) return
    haptic(10)
    setOcupado(true)
    setError(null)

    const token = generarToken()
    const { error: fallo } = await supabase.from('ingest_tokens').insert({
      token_hash: await sha256(token),
      // Los primeros caracteres tras el prefijo: lo justo para distinguir dos
      // tokens en una lista sin guardar ninguno entero.
      prefijo: token.slice(PREFIJO.length, PREFIJO.length + 6),
      nombre: 'Atajo de iOS',
    })

    setOcupado(false)
    if (fallo) { setError(fallo.message); return }
    setReciente(token)
    void cargar()
  }

  const revocar = async (id: string) => {
    const supabase = createClient()
    if (!supabase) return
    haptic([14, 30])
    // Se marca revocado en vez de borrarlo: así queda el rastro de que existió
    // y de cuándo se usó por última vez, que es lo que uno mira cuando algo
    // raro pasó.
    await supabase.from('ingest_tokens').update({ revoked: true }).eq('id', id)
    void cargar()
  }

  const copiar = async (texto: string, que: 'token' | 'url') => {
    try {
      await navigator.clipboard.writeText(texto)
      haptic([10, 24])
      setCopiado(que)
      setTimeout(() => setCopiado(null), 1600)
    } catch { /* sin permiso de portapapeles: queda seleccionable a mano */ }
  }

  const origen = typeof window !== 'undefined' ? window.location.origin : 'https://tu-app.vercel.app'
  const ejemplo = `${origen}/api/quick-add?token=${reciente ?? 'TU_TOKEN'}&amount=15000&category=food`

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fill-3 text-label-secondary">
          <Smartphone size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-label">Atajos y automatizaciones</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-label-secondary">
            Registra un gasto desde un atajo de iOS, desde Siri o desde cualquier cosa
            que sepa abrir una URL.
          </p>
        </div>
      </div>

      {/* ---- El token recién creado ---- */}
      {reciente && (
        <div className="mt-3 rounded-2xl border border-accent-green/30 bg-accent-green/[0.07] p-3">
          <p className="mb-2 text-[12.5px] font-semibold text-accent-green">
            Cópialo ahora: no se vuelve a mostrar.
          </p>
          <div className="mb-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-fill-2 px-2.5 py-2 font-mono text-[12px] text-label">
              {reciente}
            </code>
            <button
              onClick={() => copiar(reciente, 'token')}
              aria-label="Copiar el token"
              className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-green text-black"
            >
              {copiado === 'token' ? <Check size={15} strokeWidth={3} /> : <Copy size={15} />}
            </button>
          </div>
          <button
            onClick={() => copiar(ejemplo, 'url')}
            className="press w-full rounded-lg border border-hairline py-2 text-[12.5px] text-label-secondary"
          >
            {copiado === 'url' ? 'URL copiada' : 'Copiar una URL de ejemplo'}
          </button>
          <button
            onClick={() => setReciente(null)}
            className="press mt-1.5 w-full py-1 text-[12px] text-label-tertiary"
          >
            Ya lo guardé
          </button>
        </div>
      )}

      {/* ---- Los tokens vivos ---- */}
      {cargando ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-label-tertiary">
          <Loader2 size={13} className="animate-spin" /> Cargando…
        </p>
      ) : tokens.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-hairline pt-3">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 py-1.5">
              <KeyRound size={15} className="shrink-0 text-label-tertiary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[13px] text-label">
                  {PREFIJO}{t.prefijo}…
                </p>
                <p className="text-[11.5px] text-label-tertiary">
                  {t.usos > 0
                    ? `${t.usos} ${t.usos === 1 ? 'uso' : 'usos'}${t.last_used_at ? ` · último el ${formatDate(t.last_used_at)}` : ''}`
                    : `Creado el ${formatDate(t.created_at)} · sin usar`}
                </p>
              </div>
              <button
                onClick={() => revocar(t.id)}
                aria-label="Revocar este token"
                className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent-red"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-accent-orange">{error}</p>}

      <button
        onClick={crear}
        disabled={ocupado}
        className="press mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-hairline
                   py-2.5 text-[14px] font-medium text-accent-blue"
      >
        {ocupado ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
        Crear un token
      </button>

      <ComoSeUsa origen={origen} />
    </Card>
  )
}

/** Las instrucciones. Plegadas: se leen una vez y estorban el resto de la vida. */
function ComoSeUsa({ origen }: { origen: string }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      <button
        onClick={() => { haptic(6); setAbierto((v) => !v) }}
        className="press w-full text-left text-[13px] font-medium text-accent-blue"
      >
        {abierto ? 'Ocultar las instrucciones' : 'Cómo se conecta con Atajos'}
      </button>

      {abierto && (
        <div className="mt-2 space-y-3 text-[12.5px] leading-relaxed text-label-secondary">
          <div>
            <p className="mb-1 font-semibold text-label">Con la cifra ya sabida</p>
            <code className="block overflow-x-auto whitespace-pre rounded-lg bg-fill-2 p-2.5 font-mono text-[11px] text-label-secondary">
              {`${origen}/api/quick-add
  ?token=TU_TOKEN
  &amount=15000
  &category=food
  &account=Nequi`}
            </code>
            <p className="mt-1">
              En Atajos: «Obtener contenido de URL». Sirve para un botón de gasto
              fijo —el pasaje, el almuerzo— en la pantalla de inicio.
            </p>
          </div>

          <div>
            <p className="mb-1 font-semibold text-label">Desde el SMS del banco</p>
            <code className="block overflow-x-auto whitespace-pre rounded-lg bg-fill-2 p-2.5 font-mono text-[11px] text-label-secondary">
              {`POST ${origen}/api/quick-add
Authorization: Bearer TU_TOKEN
Content-Type: text/plain

<el texto del mensaje>`}
            </code>
            <p className="mt-1">
              La app lee el monto, el comercio y la categoría del propio mensaje. Con
              una automatización de «Cuando reciba un mensaje de tu banco», el gasto
              queda anotado sin tocar nada.
            </p>
          </div>

          <div>
            <p className="mb-1 font-semibold text-label">Lo que puede hacer el token</p>
            <p>
              Solo registrar movimientos. No puede leer saldos, ni borrar, ni ver nada
              de la cuenta. Si se filtra, lo peor que pasa es que alguien te anote
              gastos falsos; se revoca aquí y deja de servir al instante.
            </p>
          </div>

          <p className="text-label-tertiary">
            Ojo con una cosa: el token en la URL queda escrito en el historial y en
            los registros del servidor. Para algo sensible, mejor la forma con
            cabecera <code className="font-mono">Authorization</code>.
          </p>
        </div>
      )}
    </div>
  )
}
