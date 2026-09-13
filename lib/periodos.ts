import { anioMes, diaEn, diaSemana, hoyEnZona, primeroDeMes, sumarDias } from './zona'

/**
 * Los períodos por los que se miran los gastos.
 *
 * Un mes natural es el corte por defecto porque así llegan los extractos, pero
 * no responde todo: «cuánto llevo esta semana» se pregunta un jueves, y «en qué
 * se me fue el año» en diciembre. Cada período es un rango con nombre, y todo
 * lo demás de la pantalla —el donut, las categorías, la lista— se filtra igual.
 *
 * Los rangos se llevan en días sueltos («2026-09-14») y no en instantes, y la
 * comparación es de texto. Parece un rodeo y es justo lo contrario: un día en
 * la zona del usuario no empieza a la misma hora que en la del servidor, así
 * que preguntar «¿qué día es este gasto para él?» y comparar días es la única
 * forma de que un gasto de las once de la noche caiga en el día que lo hizo.
 * Además las fechas ISO ordenan bien como texto, así que comparar es directo.
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
  /** Primer día incluido, «2026-09-14». */
  desde: string
  /** Último día incluido. Inclusivo, que es como se lee un rango de fechas. */
  hasta: string
  /** Cómo se llama este rango en pantalla. */
  etiqueta: string
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const corto = (dia: string) => {
  const [, m, d] = dia.split('-').map(Number)
  return `${d} de ${MESES[m - 1].slice(0, 3)}`
}

/**
 * El rango de un período, `desplazamiento` posiciones atrás.
 *
 * Con 0 es el período en curso, con -1 el anterior. Se cuenta hacia atrás y no
 * hacia delante porque no hay gastos en el futuro que mirar.
 */
export function rangoPeriodo(periodo: Periodo, desplazamiento = 0, hoy = hoyEnZona()): Rango {
  const [anio, mes] = anioMes(hoy)

  if (periodo === 'semana') {
    // La semana empieza el lunes. `diaSemana` da 0 para el lunes justamente
    // para que esta resta no tenga que corregir nada.
    const desde = sumarDias(hoy, -diaSemana(hoy) + desplazamiento * 7)
    const hasta = sumarDias(desde, 6)
    return {
      desde,
      hasta,
      etiqueta: desplazamiento === 0 ? 'Esta semana' : `${corto(desde)} – ${corto(hasta)}`,
    }
  }

  if (periodo === 'mes') {
    const desde = primeroDeMes(anio, mes + desplazamiento)
    const hasta = sumarDias(primeroDeMes(anio, mes + desplazamiento + 1), -1)
    const [a, m] = anioMes(desde)
    return { desde, hasta, etiqueta: a === anio ? MESES[m - 1] : `${MESES[m - 1]} ${a}` }
  }

  if (periodo === 'trimestre') {
    const inicio = Math.floor((mes - 1) / 3) * 3 + 1 + desplazamiento * 3
    const desde = primeroDeMes(anio, inicio)
    const hasta = sumarDias(primeroDeMes(anio, inicio + 3), -1)
    const [a, m] = anioMes(desde)
    return { desde, hasta, etiqueta: `${Math.floor((m - 1) / 3) + 1}.º trimestre ${a}` }
  }

  if (periodo === 'semestre') {
    const inicio = Math.floor((mes - 1) / 6) * 6 + 1 + desplazamiento * 6
    const desde = primeroDeMes(anio, inicio)
    const hasta = sumarDias(primeroDeMes(anio, inicio + 6), -1)
    const [a, m] = anioMes(desde)
    return { desde, hasta, etiqueta: `${Math.floor((m - 1) / 6) + 1}.º semestre ${a}` }
  }

  const desde = primeroDeMes(anio + desplazamiento, 1)
  const hasta = sumarDias(primeroDeMes(anio + desplazamiento + 1, 1), -1)
  return { desde, hasta, etiqueta: String(anio + desplazamiento) }
}

/** Si un movimiento cae dentro del rango, mirado desde la zona del usuario. */
export const enRango = (iso: string, r: Rango) => {
  const dia = diaEn(iso)
  return dia >= r.desde && dia <= r.hasta
}
