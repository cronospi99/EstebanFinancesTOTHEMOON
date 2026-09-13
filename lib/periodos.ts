/**
 * Los períodos por los que se miran los gastos.
 *
 * Un mes natural es el corte por defecto porque así llegan los extractos, pero
 * no responde todo: «cuánto llevo esta semana» se pregunta un jueves, y «en qué
 * se me fue el año» en diciembre. Cada período es un rango con nombre, y todo
 * lo demás de la pantalla —el donut, las categorías, la lista— se filtra igual.
 *
 * Los límites van en hora local, no UTC. Con UTC, un gasto del primero de mes a
 * las 8 de la mañana en Colombia cae en el mes anterior, y el resumen de enero
 * empieza con una compra de diciembre.
 */

export type Periodo = 'semana' | 'mes' | 'trimestre' | 'semestre' | 'año'

export const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'semestre', label: 'Semestre' },
  { value: 'año', label: 'Año' },
]

export interface Rango {
  /** Inclusivo, a las 00:00 locales. */
  desde: Date
  /** Exclusivo: el instante en que empieza el período siguiente. */
  hasta: Date
  /** Cómo se llama este rango en pantalla. */
  etiqueta: string
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const dia = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()].slice(0, 3)}`

/**
 * El rango de un período, `desplazamiento` posiciones atrás.
 *
 * Con 0 es el período en curso, con -1 el anterior. Se cuenta hacia atrás y no
 * hacia delante porque no hay gastos en el futuro que mirar.
 */
export function rangoPeriodo(periodo: Periodo, desplazamiento = 0, ahora = new Date()): Rango {
  const y = ahora.getFullYear()
  const m = ahora.getMonth()

  if (periodo === 'semana') {
    // La semana empieza el lunes: getDay() da 0 para el domingo, que aquí es
    // el último día, no el primero.
    const diaSemana = (ahora.getDay() + 6) % 7
    const desde = new Date(y, m, ahora.getDate() - diaSemana + desplazamiento * 7)
    const hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 7)
    const ultimo = new Date(hasta.getTime() - 1)
    return {
      desde,
      hasta,
      etiqueta: desplazamiento === 0 ? 'Esta semana' : `${dia(desde)} – ${dia(ultimo)}`,
    }
  }

  if (periodo === 'mes') {
    const desde = new Date(y, m + desplazamiento, 1)
    const hasta = new Date(y, m + desplazamiento + 1, 1)
    const mismoAño = desde.getFullYear() === y
    return {
      desde,
      hasta,
      etiqueta: mismoAño ? MESES[desde.getMonth()] : `${MESES[desde.getMonth()]} ${desde.getFullYear()}`,
    }
  }

  if (periodo === 'trimestre') {
    const inicio = Math.floor(m / 3) * 3 + desplazamiento * 3
    const desde = new Date(y, inicio, 1)
    const hasta = new Date(y, inicio + 3, 1)
    const n = Math.floor(desde.getMonth() / 3) + 1
    return { desde, hasta, etiqueta: `${n}.º trimestre ${desde.getFullYear()}` }
  }

  if (periodo === 'semestre') {
    const inicio = Math.floor(m / 6) * 6 + desplazamiento * 6
    const desde = new Date(y, inicio, 1)
    const hasta = new Date(y, inicio + 6, 1)
    const n = Math.floor(desde.getMonth() / 6) + 1
    return { desde, hasta, etiqueta: `${n}.º semestre ${desde.getFullYear()}` }
  }

  const desde = new Date(y + desplazamiento, 0, 1)
  const hasta = new Date(y + desplazamiento + 1, 0, 1)
  return { desde, hasta, etiqueta: String(desde.getFullYear()) }
}

/** Si una fecha cae dentro del rango. */
export const enRango = (iso: string, r: Rango) => {
  const t = new Date(iso).getTime()
  return t >= r.desde.getTime() && t < r.hasta.getTime()
}
