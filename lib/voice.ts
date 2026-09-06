import { DEFAULT_CATEGORIES } from './categories'

/**
 * Interpretación de un dictado en español para registrar un movimiento.
 *
 * Reconoce importes escritos con dígitos ("45000", "45.000") y en palabras
 * ("cuarenta y cinco mil"), más los multiplicadores habituales al hablar de
 * dinero en Colombia: mil, millón, luca, palo.
 */

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, dieciséis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22,
  veintidós: 22, veintitres: 23, veintitrés: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintiséis: 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
}

const MULTIPLICADORES: Record<string, number> = {
  mil: 1000, miles: 1000, luca: 1000, lucas: 1000,
  millon: 1_000_000, millón: 1_000_000, millones: 1_000_000,
  palo: 1_000_000, palos: 1_000_000,
}

const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palabras que sugieren un ingreso en vez de un gasto. */
const INGRESO = ['ingreso', 'ingresos', 'me pagaron', 'recibi', 'cobre', 'cobré', 'salario', 'nomina', 'nómina', 'entrada', 'me entro', 'me entró']

/** Sinónimos habituales que no coinciden literalmente con el nombre de la categoría. */
const SINONIMOS: Record<string, string[]> = {
  food: ['comida', 'almuerzo', 'cena', 'desayuno', 'restaurante', 'crepes'],
  market: ['mercado', 'super', 'supermercado', 'exito', 'd1', 'ara', 'olimpica'],
  delivery: ['domicilio', 'domicilios', 'rappi', 'pedido'],
  coffee: ['cafe', 'tinto', 'juan valdez', 'starbucks'],
  transport: ['transporte', 'uber', 'didi', 'taxi', 'indriver'],
  fuel: ['gasolina', 'combustible', 'tanqueada'],
  transit: ['metro', 'bus', 'civica', 'transmilenio'],
  home: ['arriendo', 'renta', 'alquiler'],
  utilities: ['servicios', 'luz', 'agua', 'gas', 'epm'],
  internet: ['internet', 'wifi', 'claro', 'movistar'],
  phone: ['celular', 'plan', 'recarga'],
  health: ['salud', 'medico', 'doctor', 'eps'],
  pharmacy: ['farmacia', 'droguería', 'drogueria', 'farmatodo', 'cruz verde'],
  gym: ['gimnasio', 'gym', 'smart fit'],
  fun: ['ocio', 'salida', 'fiesta'],
  cinema: ['cine', 'pelicula'],
  clothes: ['ropa', 'zapatos', 'zara'],
  tech: ['tecnologia', 'computador', 'celular nuevo'],
  subs: ['suscripcion', 'netflix', 'spotify', 'disney'],
  salary: ['salario', 'nomina', 'sueldo', 'quincena'],
  freelance: ['freelance', 'proyecto'],
}

export interface Dictado {
  amount: number | null
  categoryId: string | null
  type: 'expense' | 'income'
  note: string
}

export function interpretarDictado(texto: string): Dictado {
  const t = normalizar(texto)

  // ---- Importe -------------------------------------------------------------
  let amount: number | null = null

  // Primero en dígitos, que es lo que suele devolver el reconocedor.
  const digitos = t.match(/\d[\d.,]*/)
  if (digitos) {
    // "45.000" son miles en español; "45,50" son decimales.
    const crudo = digitos[0].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
    const n = Number(crudo)
    if (!Number.isNaN(n) && n > 0) amount = n
  }

  // Multiplicador dicho aparte: "45 mil", "2 millones".
  const palabras = t.split(/\s+/)
  for (let i = 0; i < palabras.length; i++) {
    const mult = MULTIPLICADORES[palabras[i]]
    if (mult && amount !== null && amount < mult) { amount *= mult; break }
  }

  // Sin dígitos, se intenta en palabras: "cuarenta y cinco mil".
  if (amount === null) {
    let total = 0, parcial = 0, visto = false
    for (const w of palabras) {
      if (w === 'y') continue
      if (UNIDADES[w] !== undefined) { parcial += UNIDADES[w]; visto = true; continue }
      const mult = MULTIPLICADORES[w]
      if (mult) {
        total += (parcial || 1) * mult
        parcial = 0
        visto = true
      }
    }
    const suma = total + parcial
    if (visto && suma > 0) amount = suma
  }

  // ---- Tipo ----------------------------------------------------------------
  const type: 'expense' | 'income' = INGRESO.some((k) => t.includes(normalizar(k))) ? 'income' : 'expense'

  // ---- Categoría -----------------------------------------------------------
  let categoryId: string | null = null
  let mejor = 0
  for (const cat of DEFAULT_CATEGORIES.filter((c) => c.kind === type)) {
    const claves = [normalizar(cat.name), ...(SINONIMOS[cat.id] ?? []).map(normalizar)]
    for (const k of claves) {
      // La coincidencia más larga gana: "mercado" antes que "cad" dentro de otra.
      if (k.length > 2 && t.includes(k) && k.length > mejor) { mejor = k.length; categoryId = cat.id }
    }
  }

  // ---- Nota ----------------------------------------------------------------
  // Se conserva el dictado íntegro: es la mejor descripción disponible y el
  // usuario ve exactamente lo que se entendió.
  const note = texto.trim()

  return { amount, categoryId, type, note }
}
