/**
 * Formateo financiero para Colombia.
 * El peso no usa decimales en el día a día, así que los omitimos por defecto:
 * "$ 45.900" se lee mucho más rápido que "$ 45.900,00" en una lista de gastos.
 */

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export function formatMoney(value: number, currency: 'COP' | 'USD' = 'COP') {
  return currency === 'USD' ? USD.format(value) : COP.format(value)
}

/**
 * Versión compacta para titulares grandes: $ 12,4 M en lugar de $ 12.400.000.
 * Solo se usa cuando la cifra completa no cabe o compite con la jerarquía visual.
 */
export function formatCompact(value: number, currency: 'COP' | 'USD' = 'COP') {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (currency === 'USD') return `${sign}$${(abs / 1000).toFixed(1)}K`
  if (abs >= 1_000_000_000) return `${sign}$ ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} MM`
  if (abs >= 1_000_000) return `${sign}$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')} M`
  if (abs >= 1_000) return `${sign}$ ${Math.round(abs / 1000)} K`
  return formatMoney(value, currency)
}

/** Agrupa miles mientras el usuario teclea en el keypad: 45900 -> "45.900" */
export function formatKeypad(digits: string) {
  if (!digits) return '0'
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(digits))
}

export function formatPercent(value: number, withSign = true) {
  const sign = withSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2).replace('.', ',')} %`
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(iso))
}

/** "Hoy" / "Ayer" / "12 mar" — como la app de Salud de Apple agrupa por día. */
export function formatDayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Hoy'
  if (same(d, yesterday)) return 'Ayer'
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(d)
}

export const monthKey = (d: Date | string = new Date()) => {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export const monthName = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(d)
