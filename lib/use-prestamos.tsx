'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, isSupabaseConfigured } from './supabase/client'
import { columnaEspacio, espacioActual, servidorConEspacios } from './espacio'
import { useFinance } from './store'
import { hoyEnZona } from './zona'
import { sumarMeses } from './suscripciones'
import { uid } from './utils'
import type { PagoPrestamo, Prestamo } from './prestamos'

/**
 * Los préstamos a clientes: sus datos y el candado que los guarda.
 *
 * Van aparte del store general a propósito. Son una función que la mayoría no
 * tiene —se desbloquea con un código, ver la migración de préstamos—, y
 * meterlos en el estado de todos obligaba a cargarlos, respaldarlos y
 * restaurarlos para quien nunca los va a ver. Aquí se cargan solo si la
 * función está abierta.
 *
 * El candado de verdad está en la base de datos: sin la función desbloqueada,
 * las políticas devuelven cero filas y rechazan cualquier escritura. Lo que
 * guarda este archivo es solo lo que se pinta.
 */

type Disponibilidad = 'cargando' | 'bloqueado' | 'desbloqueado' | 'sin-migracion'

interface PrestamosCtx {
  disponibilidad: Disponibilidad
  prestamos: Prestamo[]
  pagos: PagoPrestamo[]
  /** Por qué no se guardó lo último, si no se guardó. */
  error: string | null
  /** Modo Demo: no hay servidor que compruebe nada, así que el código es fijo. */
  esDemo: boolean
  desbloquear: (codigo: string) => Promise<{ ok: boolean; error?: string }>
  crearPrestamo: (p: Omit<Prestamo, 'id'>) => Promise<string>
  actualizarPrestamo: (id: string, patch: Partial<Omit<Prestamo, 'id'>>) => Promise<void>
  borrarPrestamo: (id: string) => Promise<void>
  registrarPago: (p: Omit<PagoPrestamo, 'id'>) => Promise<void>
  borrarPago: (id: string) => Promise<void>
}

const Ctx = createContext<PrestamosCtx | null>(null)

/** El código del Modo Demo: ahí no hay servidor que guarde códigos de verdad. */
export const CODIGO_DEMO = 'DEMO'

const CLAVE_FUNCIONES = 'eftm.funciones'
const clavePrestamos = () => `eftm.prestamos:${espacioActual()}`

/** Tres clientes de ejemplo para quien lo prueba sin cuenta. */
function demo(): { prestamos: Prestamo[]; pagos: PagoPrestamo[] } {
  const hoy = hoyEnZona()
  const hace = (meses: number, dias = 0) => {
    const d = new Date(sumarMeses(hoy, -meses) + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - dias)
    return d.toISOString().slice(0, 10)
  }
  const prestamos: Prestamo[] = [
    { id: 'dp1', cliente: 'Pedro Gómez', telefono: '3001234567', monto: 500_000, tasaMensual: 10, fecha: hace(2, 3) },
    { id: 'dp2', cliente: 'María Rincón', monto: 1_200_000, tasaMensual: 8, fecha: hace(3, 10), nota: 'Tienda de la esquina' },
    { id: 'dp3', cliente: 'Luis Torres', monto: 300_000, tasaMensual: 10, fecha: hace(2, 20) },
  ]
  const pagos: PagoPrestamo[] = [
    // Pedro: paga el interés del primer mes y en el segundo abona 100.000.
    { id: 'dq1', prestamoId: 'dp1', fecha: hace(1, 3), interes: 50_000, capital: 0 },
    { id: 'dq2', prestamoId: 'dp1', fecha: hace(0, 3), interes: 50_000, capital: 100_000 },
    // María: pagó el primer mes y dejó de pagar.
    { id: 'dq3', prestamoId: 'dp2', fecha: hace(2, 10), interes: 96_000, capital: 0 },
    // Luis: pagó el interés y devolvió todo en el corte.
    { id: 'dq4', prestamoId: 'dp3', fecha: hace(1, 20), interes: 30_000, capital: 0 },
    { id: 'dq5', prestamoId: 'dp3', fecha: hace(0, 20), interes: 30_000, capital: 300_000 },
  ]
  return { prestamos, pagos }
}

type Row = Record<string, unknown>
const rowAPrestamo = (r: Row): Prestamo => ({
  id: String(r.id),
  cliente: String(r.cliente),
  telefono: (r.telefono as string | null) ?? undefined,
  monto: Number(r.monto),
  tasaMensual: Number(r.tasa_mensual),
  fecha: String(r.fecha).slice(0, 10),
  nota: (r.nota as string | null) ?? undefined,
  archivado: Boolean(r.archivado),
})
const prestamoAFila = (p: Prestamo) => ({
  ...columnaEspacio(),
  id: p.id, cliente: p.cliente.trim(), telefono: p.telefono?.trim() || null,
  monto: p.monto, tasa_mensual: p.tasaMensual, fecha: p.fecha,
  nota: p.nota?.trim() || null, archivado: Boolean(p.archivado),
})
const parcheAFila = (p: Partial<Prestamo>) => {
  const r: Row = {}
  if (p.cliente !== undefined) r.cliente = p.cliente.trim()
  if ('telefono' in p) r.telefono = p.telefono?.trim() || null
  if (p.monto !== undefined) r.monto = p.monto
  if (p.tasaMensual !== undefined) r.tasa_mensual = p.tasaMensual
  if (p.fecha !== undefined) r.fecha = p.fecha
  if ('nota' in p) r.nota = p.nota?.trim() || null
  if (p.archivado !== undefined) r.archivado = p.archivado
  return r
}
const rowAPago = (r: Row): PagoPrestamo => ({
  id: String(r.id),
  prestamoId: String(r.prestamo_id),
  fecha: String(r.fecha).slice(0, 10),
  interes: Number(r.interes),
  capital: Number(r.capital),
  nota: (r.nota as string | null) ?? undefined,
})
const pagoAFila = (p: PagoPrestamo) => ({
  id: p.id, prestamo_id: p.prestamoId, fecha: p.fecha,
  interes: p.interes, capital: p.capital, nota: p.nota?.trim() || null,
})

/** El error de Postgres, dicho para quien lo va a leer. */
function motivo(error: unknown): string | null {
  if (!error) return null
  const e = error as { code?: string; message?: string }
  if (e.code === '42501' || /row-level security/i.test(e.message ?? '')) return 'la función no está desbloqueada en esta cuenta'
  if (e.code === '42P01' || e.code === 'PGRST205') return 'falta aplicar la migración de préstamos en Supabase'
  return e.message?.slice(0, 90) || 'el servidor rechazó el cambio'
}

export function PrestamosProvider({ children }: { children: React.ReactNode }) {
  const { ready, synced } = useFinance()
  // Con servidor solo si hay sesión sincronizada; si no, se guarda en el
  // teléfono, igual que el resto de la app en Modo Demo.
  const remoto = isSupabaseConfigured && synced
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>('cargando')
  const [prestamos, setPrestamos] = useState<Prestamo[]>([])
  const [pagos, setPagos] = useState<PagoPrestamo[]>([])
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!remoto) {
      let abierta = false
      try { abierta = (localStorage.getItem(CLAVE_FUNCIONES) ?? '').split(',').includes('prestamos') } catch { /* noop */ }
      if (!abierta) { setDisponibilidad('bloqueado'); return }
      try {
        const guardado = JSON.parse(localStorage.getItem(clavePrestamos()) || 'null')
        const datos = guardado ?? demo()
        setPrestamos(datos.prestamos ?? [])
        setPagos(datos.pagos ?? [])
      } catch {
        const datos = demo()
        setPrestamos(datos.prestamos)
        setPagos(datos.pagos)
      }
      setDisponibilidad('desbloqueado')
      return
    }

    const sb = createClient()
    if (!sb) return
    const funciones = await sb.from('funciones_desbloqueadas').select('funcion')
    if (funciones.error) {
      // La tabla no existe: la migración no se ha aplicado. Se dice así en
      // vez de ofrecer un código que no va a poder comprobarse.
      setDisponibilidad('sin-migracion')
      return
    }
    if (!(funciones.data ?? []).some((f) => f.funcion === 'prestamos')) {
      setDisponibilidad('bloqueado')
      return
    }
    let consultaPrestamos = sb.from('prestamos').select('*')
    if (servidorConEspacios()) consultaPrestamos = consultaPrestamos.eq('espacio', espacioActual())
    const [pr, pg] = await Promise.all([
      consultaPrestamos.order('fecha'),
      sb.from('prestamo_pagos').select('*').order('fecha'),
    ])
    if (pr.error || pg.error) {
      setError(motivo(pr.error ?? pg.error))
      setDisponibilidad('desbloqueado')
      return
    }
    const lista = (pr.data ?? []).map(rowAPrestamo)
    const ids = new Set(lista.map((p) => p.id))
    setPrestamos(lista)
    // Los pagos no llevan espacio: van con su préstamo.
    setPagos((pg.data ?? []).map(rowAPago).filter((x) => ids.has(x.prestamoId)))
    setError(null)
    setDisponibilidad('desbloqueado')
  }, [remoto])

  useEffect(() => {
    if (ready) void cargar()
  }, [ready, cargar])

  // En el teléfono se guarda cada cambio; con servidor, la copia es el servidor.
  const cargado = useRef(false)
  useEffect(() => {
    if (remoto || disponibilidad !== 'desbloqueado') return
    if (!cargado.current) { cargado.current = true; return }
    try { localStorage.setItem(clavePrestamos(), JSON.stringify({ prestamos, pagos })) } catch { /* noop */ }
  }, [remoto, disponibilidad, prestamos, pagos])

  const desbloquear = useCallback(async (codigo: string) => {
    const limpio = codigo.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!remoto) {
      if (limpio !== CODIGO_DEMO) return { ok: false, error: 'Código inválido' }
      try {
        const actuales = (localStorage.getItem(CLAVE_FUNCIONES) ?? '').split(',').filter(Boolean)
        localStorage.setItem(CLAVE_FUNCIONES, [...new Set([...actuales, 'prestamos'])].join(','))
      } catch { /* noop */ }
      await cargar()
      return { ok: true }
    }
    const sb = createClient()
    if (!sb) return { ok: false, error: 'Sin conexión con el servidor' }
    const r = await sb.rpc('desbloquear_funcion', { p_codigo: codigo })
    if (r.error) {
      return { ok: false, error: /inválido/i.test(r.error.message) ? 'Código inválido o ya usado' : (motivo(r.error) ?? 'No se pudo desbloquear') }
    }
    await cargar()
    return { ok: true }
  }, [remoto, cargar])

  const escribir = useCallback(async (op: () => PromiseLike<{ error: unknown }> | undefined) => {
    if (!remoto) return
    const r = await op()
    setError(motivo(r?.error))
  }, [remoto])

  const crearPrestamo = useCallback(async (p: Omit<Prestamo, 'id'>) => {
    const full: Prestamo = { ...p, id: uid() }
    setPrestamos((l) => [...l, full])
    await escribir(() => createClient()?.from('prestamos').insert(prestamoAFila(full)))
    return full.id
  }, [escribir])

  const actualizarPrestamo = useCallback(async (id: string, patch: Partial<Omit<Prestamo, 'id'>>) => {
    setPrestamos((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    await escribir(() => createClient()?.from('prestamos').update(parcheAFila(patch)).eq('id', id))
  }, [escribir])

  const borrarPrestamo = useCallback(async (id: string) => {
    setPrestamos((l) => l.filter((p) => p.id !== id))
    // En el servidor los pagos se van solos con el préstamo (on delete cascade).
    setPagos((l) => l.filter((x) => x.prestamoId !== id))
    await escribir(() => createClient()?.from('prestamos').delete().eq('id', id))
  }, [escribir])

  const registrarPago = useCallback(async (p: Omit<PagoPrestamo, 'id'>) => {
    const full: PagoPrestamo = { ...p, id: uid() }
    setPagos((l) => [...l, full])
    await escribir(() => createClient()?.from('prestamo_pagos').insert(pagoAFila(full)))
  }, [escribir])

  const borrarPago = useCallback(async (id: string) => {
    setPagos((l) => l.filter((x) => x.id !== id))
    await escribir(() => createClient()?.from('prestamo_pagos').delete().eq('id', id))
  }, [escribir])

  const value = useMemo<PrestamosCtx>(() => ({
    disponibilidad, prestamos, pagos, error, esDemo: !remoto,
    desbloquear, crearPrestamo, actualizarPrestamo, borrarPrestamo, registrarPago, borrarPago,
  }), [disponibilidad, prestamos, pagos, error, remoto,
      desbloquear, crearPrestamo, actualizarPrestamo, borrarPrestamo, registrarPago, borrarPago])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePrestamos() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePrestamos debe usarse dentro de <PrestamosProvider>')
  return ctx
}
