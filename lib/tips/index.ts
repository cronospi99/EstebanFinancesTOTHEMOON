import { AHORRO, PRESUPUESTO } from './part-1'
import { DEUDA, INVERSION } from './part-2'
import { COMPRAS, INGRESOS, PSICOLOGIA } from './part-3'
import { IMPUESTOS, LARGO_PLAZO, SEGUROS } from './part-4'
import { ERRORES, FAMILIA, NUMEROS } from './part-5'
import { CONSUMO, METODO, NEGOCIO } from './part-6'
import { MENTALIDAD, MERCADOS, MOMENTOS } from './part-7'

/**
 * 365 consejos de ahorro e inversión, uno por día del año.
 *
 * Se intercalan los temas en vez de agruparlos: leídos en orden, un mes
 * entero de consejos sobre impuestos cansa, mientras que alternar mantiene
 * la sensación de que cada día trae algo distinto.
 */
const TEMAS = [
  PRESUPUESTO, INVERSION, AHORRO, PSICOLOGIA, DEUDA, NUMEROS, CONSUMO,
  MENTALIDAD, INGRESOS, MERCADOS, METODO, LARGO_PLAZO, ERRORES, COMPRAS,
  SEGUROS, FAMILIA, MOMENTOS, IMPUESTOS, NEGOCIO,
]

function intercalar(listas: string[][]) {
  const salida: string[] = []
  const max = Math.max(...listas.map((l) => l.length))
  for (let i = 0; i < max; i++) {
    for (const lista of listas) if (lista[i]) salida.push(lista[i])
  }
  return salida
}

export const TIPS: string[] = intercalar(TEMAS)

/** Día del año, de 0 a 365. */
function diaDelAno(d = new Date()) {
  const inicio = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - inicio.getTime()) / 86_400_000)
}

/**
 * Consejo del día. Es determinista: el mismo día muestra el mismo consejo,
 * así que dos dispositivos del mismo usuario coinciden y no parece aleatorio
 * sin sentido. El año desplaza el índice para que 2027 no repita 2026.
 */
export function consejoDelDia(d = new Date()) {
  const idx = (diaDelAno(d) + d.getFullYear()) % TIPS.length
  return TIPS[idx]
}

export const consejoAlAzar = () => TIPS[Math.floor(Math.random() * TIPS.length)]
