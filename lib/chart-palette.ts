/**
 * Paleta categórica para las gráficas, sobre superficie oscura (#0E0E10).
 *
 * Es la reserva, no la primera opción: donde cada porción tiene una entidad
 * detrás manda su color de marca (ver `brand-color.ts`). Esta paleta cubre lo
 * que no lo tiene —categorías de gasto, «Otros»— y las marcas acromáticas o
 * repetidas, que son las que no se pueden usar tal cual: RappiCard es #141414,
 * que sobre negro desaparece, y Davivienda y Daviplata comparten el rojo.
 *
 * Generada en OKLCH dentro de la banda L 0,48–0,67 y validada: banda de
 * luminosidad, suelo de croma, separación para daltonismo (peor par adyacente
 * ΔE 13,3 en deuteranopia) y contraste contra el fondo. El orden es fijo: la
 * porción n-ésima siempre lleva el color n-ésimo, así un filtro que cambie el
 * número de porciones no repinta las que quedan.
 */
export const CHART_COLORS = [
  '#0061CE', // azul
  '#E66A00', // naranja
  '#8044CB', // violeta
  '#00AF44', // verde
  '#BE0C32', // rojo
  '#00929F', // cian
  '#917200', // oliva
  '#7673FD', // índigo
] as const

/** Gris de "Otros": deliberadamente fuera de la paleta, no compite por identidad. */
export const CHART_REST = '#6B6B72'

export const chartColor = (i: number) => CHART_COLORS[i] ?? CHART_REST
