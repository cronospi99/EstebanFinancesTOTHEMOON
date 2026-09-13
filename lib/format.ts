/**
 * Formateo financiero para Colombia.
 *
 * El peso no usa decimales en el día a día, así que se omiten cuando la cifra
 * es redonda y se muestran solo si existen: "$ 45.900" pero "$ 45.900,50".
 * En dólares siempre van los dos decimales, que ahí sí son significativos.
 */
import type { Currency } from './types'
import { diaEn, hoyEnZona, sumarDias, zonaEfectiva } from './zona'

const copInt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const copDec = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Los dólares se prefijan «US$» a mano, no con el símbolo de Intl. En una app
// colombiana donde ahora se puede alternar la moneda, un «$» a secas es
// ambiguo justo donde más caro sale confundirse.
const usdNum = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const usd = { format: (v: number) => `${v < 0 ? '-' : ''}US$ ${usdNum.format(Math.abs(v))}` }

/** true si el valor tiene parte decimal significativa (más de un centavo). */
const hasCents = (v: number) => Math.abs(v - Math.round(v)) > 0.004

export function formatMoney(value: number, currency: Currency = 'COP') {
  if (currency === 'USD') return usd.format(value)
  return hasCents(value) ? copDec.format(value) : copInt.format(value)
}

export function formatCompact(value: number, currency: Currency = 'COP') {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (currency === 'USD') {
    if (abs >= 1000) return `${sign}US$ ${(abs / 1000).toFixed(1)}K`
    return usd.format(value)
  }
  if (abs >= 1_000_000_000) return `${sign}$ ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} MM`
  if (abs >= 1_000_000) return `${sign}$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')} M`
  if (abs >= 1_000) return `${sign}$ ${Math.round(abs / 1000)} K`
  return formatMoney(value, currency)
}

/**
 * Formatea lo que el usuario teclea, conservando la coma decimal a medio
 * escribir: "45900," debe seguir mostrándose con la coma, no perderla al
 * convertir a número.
 */
export function formatKeypad(raw: string) {
  if (!raw) return '0'
  const [ent, dec] = raw.split(',')
  const entero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(ent || '0'))
  return dec === undefined ? entero : `${entero},${dec}`
}

/** Convierte lo tecleado ("45.900,50" en crudo "45900,50") a número. */
export const parseKeypad = (raw: string) => Number((raw || '0').replace(',', '.')) || 0

/** Cantidad de activos: hasta 8 decimales, sin ceros de relleno. */
export function formatQuantity(q: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 8 }).format(q)
}

export function formatPercent(value: number, withSign = true, decimals = 2) {
  const sign = withSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals).replace('.', ',')} %`
}

/*
 * Las fechas se pintan en la zona del usuario, no en la del servidor ni en UTC.
 * Ver `zona.ts`: sin esto, un gasto de las once de la noche en Bogotá salía
 * fechado al día siguiente.
 */
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'short', timeZone: zonaEfectiva(),
  }).format(new Date(iso))
}

export function formatDayLabel(iso: string) {
  // Se comparan días, no instantes: dos momentos del mismo día son «Hoy»
  // aunque los separen veinte horas.
  const dia = diaEn(iso)
  const hoy = hoyEnZona()
  if (dia === hoy) return 'Hoy'
  if (dia === sumarDias(hoy, -1)) return 'Ayer'
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: zonaEfectiva(),
  }).format(new Date(iso))
}

export const monthKey = (d: Date | string = new Date()) => diaEn(d).slice(0, 7)

export const monthName = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: zonaEfectiva() }).format(d)

/**
 * Rendimiento mensual equivalente a una tasa efectiva anual.
 * (1 + EA)^(1/12) - 1, no EA/12: el interés compuesto no es lineal y dividir
 * entre doce sobreestima el rendimiento.
 */
export const monthlyFromApy = (apyPercent: number) =>
  Math.pow(1 + apyPercent / 100, 1 / 12) - 1
