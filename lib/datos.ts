/**
 * Sacar los datos y meterlos: exportación, respaldo e importación de extractos.
 *
 * Tres cosas distintas que comparten este archivo porque comparten el
 * problema: convertir entre lo que la app guarda y lo que entiende una hoja de
 * cálculo.
 *
 *  · EXPORTAR a CSV — para mirar el año en Excel, para pasárselo a un contador,
 *    para la declaración de renta.
 *  · RESPALDAR en JSON — la copia completa y reversible. El CSV pierde
 *    información —los bolsillos, las asignaciones, los enlaces entre un abono
 *    y su movimiento— y por eso no sirve como respaldo.
 *  · IMPORTAR un extracto — el CSV que descarga cualquier banco, con el paso
 *    de decir qué columna es cuál, porque no hay dos bancos que lo escriban
 *    igual.
 *
 * ---------------------------------------------------------------------------
 * Por qué CSV y no .xlsx
 * ---------------------------------------------------------------------------
 * Escribir un .xlsx de verdad significa empaquetar un ZIP con varios XML, y
 * eso son cien kilobytes de biblioteca que se descargan en el móvil para algo
 * que se usa dos veces al año. Un CSV bien hecho lo abre Excel con doble clic,
 * lo abre Google Sheets, lo abre Numbers y lo lee cualquier contador.
 *
 * «Bien hecho» aquí quiere decir tres cosas concretas, y las tres salieron de
 * archivos que se abrían mal:
 *
 *  1. Punto y coma como separador. Excel en español interpreta la coma como
 *     separador decimal, así que con comas mete «45» y «900» en dos columnas.
 *  2. BOM al principio. Sin él, Excel en Windows lee el UTF-8 como si fuera
 *     Latin-1 y «Suscripción» sale «SuscripciÃ³n».
 *  3. Números con coma decimal y sin separador de miles. Con el punto de
 *     miles, Excel en español convierte «1.250.000» en el número 1,25.
 */
import { categoryById } from './categories'
import type {
  Account, Budget, BudgetAllocation, Currency, Debt, DebtPayment, Goal, Holding,
  RecurringIncome, Settings, Subscription, Trade, Transaction, TxType,
} from './types'
import { hoyEnZona } from './zona'

/* ===========================================================================
 *  Escribir CSV
 * ======================================================================== */

export const SEPARADOR = ';'

/**
 * Un valor, listo para meter en una celda.
 *
 * Se entrecomilla solo cuando hace falta —separador, comillas o salto de línea
 * dentro— porque un CSV con todo entrecomillado es ilegible si alguien lo abre
 * en un editor de texto, que es justo lo que uno hace cuando algo salió mal.
 */
function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') {
    // Coma decimal y sin miles: ver la nota de la cabecera.
    return Number.isInteger(valor) ? String(valor) : String(valor).replace('.', ',')
  }
  const texto = String(valor)
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function aCsv(cabeceras: string[], filas: unknown[][]): string {
  const lineas = [cabeceras.join(SEPARADOR), ...filas.map((f) => f.map(celda).join(SEPARADOR))]
  // El BOM va antes de todo, incluido el «sep=»: Excel lo busca en el byte cero.
  return `﻿${lineas.join('\r\n')}\r\n`
}

/** Descarga un texto como archivo. Sin servidor: el navegador ya sabe hacerlo. */
export function descargar(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Sin esto, el blob se queda en memoria hasta que se cierre la pestaña.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ===========================================================================
 *  Exportar movimientos
 * ======================================================================== */

/**
 * Todo lo que la app guarda de una persona.
 *
 * Las dos primeras son obligatorias porque sin ellas no hay nada que exportar
 * ni nada que validar al restaurar; el resto puede faltar —un respaldo hecho
 * antes de que existiera una tabla no la trae— y restaurar deja lo que haya
 * sin tocar lo demás.
 */
export interface DatosExport {
  accounts: Account[]
  transactions: Transaction[]
  subscriptions?: Subscription[]
  debts?: Debt[]
  debtPayments?: DebtPayment[]
  holdings?: Holding[]
  trades?: Trade[]
  goals?: Goal[]
  allocations?: BudgetAllocation[]
  recurringIncomes?: RecurringIncome[]
  budgets?: Budget[]
  settings?: Settings
}

const CABECERAS_TX = [
  'Fecha', 'Tipo', 'Categoría', 'Descripción', 'Comercio', 'Monto', 'Moneda',
  'Monto en COP', 'TRM del día', 'Cuenta', 'Entidad', 'Cuenta destino', 'Origen',
  'Sin confirmar', 'Id',
]

const NOMBRE_TIPO: Record<TxType, string> = {
  expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia',
}

/**
 * Los movimientos, una fila cada uno.
 *
 * Va la cifra original y la convertida a pesos, no una de las dos. La original
 * es la que cuadra con el extracto del banco y la de pesos es la que sirve para
 * sumar; dar solo una obliga a rehacer la otra a mano, que es justo el trabajo
 * que esto viene a ahorrar.
 */
export function movimientosACsv(datos: DatosExport, fxRate: number): string {
  const cuenta = (id?: string) => datos.accounts.find((a) => a.id === id)

  const filas = [...datos.transactions]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((t) => {
      const c = cuenta(t.accountId)
      const moneda: Currency = t.currency ?? c?.currency ?? 'COP'
      const tasa = moneda === 'USD' ? (t.fxRate ?? fxRate) : 0
      const enCop = moneda === 'USD' ? (tasa > 0 ? Math.round(t.amount * tasa) : null) : t.amount

      return [
        t.occurredAt.slice(0, 10),
        NOMBRE_TIPO[t.type],
        categoryById(t.categoryId).name,
        t.description,
        t.merchant ?? '',
        t.amount,
        moneda,
        enCop,
        tasa || '',
        c?.name ?? '',
        c?.institution ?? '',
        cuenta(t.toAccountId)?.name ?? '',
        t.source ?? 'manual',
        t.pending ? 'sí' : '',
        t.id,
      ]
    })

  return aCsv(CABECERAS_TX, filas)
}

/** Las cuentas con su saldo, que es lo que se declara a 31 de diciembre. */
export function cuentasACsv(datos: DatosExport, fxRate: number): string {
  const filas = datos.accounts.map((a) => {
    const total = a.balance + (a.pockets ?? []).reduce((s, p) => s + p.balance, 0)
    return [
      a.name, a.institution, a.type, total, a.currency,
      a.currency === 'USD' ? (fxRate > 0 ? Math.round(total * fxRate) : null) : total,
      a.apy ?? '', a.creditLimit ?? '', a.periodStartDay ?? '', a.statementDay ?? '', a.dueDay ?? '',
    ]
  })
  return aCsv(
    ['Cuenta', 'Entidad', 'Tipo', 'Saldo', 'Moneda', 'Saldo en COP', 'E.A. %', 'Cupo', 'Inicio del período', 'Día de corte', 'Día de pago'],
    filas,
  )
}

/* ===========================================================================
 *  Respaldo completo
 * ======================================================================== */

export const VERSION_RESPALDO = 1

export interface Respaldo {
  version: number
  /** Cuándo se hizo. Sirve para saber qué copia es más nueva. */
  creadoEn: string
  app: string
  datos: DatosExport
}

export function crearRespaldo(datos: DatosExport): string {
  const respaldo: Respaldo = {
    version: VERSION_RESPALDO,
    creadoEn: new Date().toISOString(),
    app: 'EstebanFinances',
    datos,
  }
  // Con sangría: un respaldo se abre alguna vez a mano para comprobar algo, y
  // una sola línea de dos megas no se puede ni mirar. Ocupa un 20 % más y se
  // comprime a nada.
  return JSON.stringify(respaldo, null, 2)
}

/**
 * Lee un respaldo y devuelve lo que trae, o el motivo por el que no vale.
 *
 * Comprueba la forma antes de devolver nada. Un archivo equivocado —el CSV en
 * vez del JSON, el respaldo de otra app— restauraría un estado vacío encima de
 * los datos buenos, y eso no se deshace.
 */
export function leerRespaldo(texto: string): { datos: DatosExport; creadoEn: string } | { error: string } {
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    return { error: 'El archivo no es un JSON válido. ¿Seguro que es el respaldo y no el CSV?' }
  }

  const r = json as Partial<Respaldo>
  if (!r || typeof r !== 'object') return { error: 'El archivo está vacío o no tiene la forma esperada.' }
  if (r.app && r.app !== 'EstebanFinances') return { error: `El respaldo es de otra app (${r.app}).` }
  if (!r.datos || !Array.isArray(r.datos.accounts) || !Array.isArray(r.datos.transactions)) {
    return { error: 'Al respaldo le faltan las cuentas o los movimientos.' }
  }
  if (typeof r.version === 'number' && r.version > VERSION_RESPALDO) {
    return { error: 'El respaldo lo hizo una versión más nueva de la app. Actualiza antes de restaurar.' }
  }

  return { datos: r.datos, creadoEn: r.creadoEn ?? '' }
}

/* ===========================================================================
 *  Importar un extracto
 * ===========================================================================
 *  No hay dos bancos que exporten igual. Bancolombia manda el monto con signo
 *  en una sola columna; Davivienda parte débitos y créditos en dos; algunos
 *  escriben la fecha como 12/09/2026 y otros como 20260912. Y casi todos meten
 *  tres o cuatro líneas de encabezado con el logo y el número de cuenta antes
 *  de las columnas de verdad.
 *
 *  Por eso el lector no intenta adivinarlo todo: detecta lo que puede, lo
 *  propone, y deja que una persona confirme el mapeo. Adivinar mal sin
 *  preguntar significa importar seiscientos movimientos con el signo cambiado.
 * ------------------------------------------------------------------------ */

/**
 * Parte un CSV en filas y celdas, respetando las comillas.
 *
 * Escrito a mano y no con una expresión regular porque las comillas anidadas
 * —«"PAGO ""EL CORRAL"" CC"»— no se resuelven con una, y un extracto real las
 * trae en cuanto un comercio lleva comillas en el nombre.
 */
export function partirCsv(texto: string, separador: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let celdaActual = ''
  let entreComillas = false

  // El BOM que escribimos nosotros —y que escribe Excel— no es parte del dato.
  const t = texto.replace(/^﻿/, '')

  for (let i = 0; i < t.length; i++) {
    const c = t[i]

    if (entreComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') { celdaActual += '"'; i++ }
        else entreComillas = false
      } else {
        celdaActual += c
      }
      continue
    }

    if (c === '"') { entreComillas = true; continue }
    if (c === separador) { fila.push(celdaActual); celdaActual = ''; continue }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      fila.push(celdaActual)
      // Las líneas en blanco se tiran: los extractos vienen llenos de ellas.
      if (fila.some((x) => x.trim() !== '')) filas.push(fila)
      fila = []
      celdaActual = ''
      continue
    }
    celdaActual += c
  }

  fila.push(celdaActual)
  if (fila.some((x) => x.trim() !== '')) filas.push(fila)
  return filas
}

/**
 * Con qué carácter está separado el archivo.
 *
 * Se prueban los cuatro habituales y gana el que produzca más columnas de
 * forma consistente. Consistente es la palabra: un punto y coma suelto dentro
 * de una descripción daría una fila de tres columnas en un archivo de comas, y
 * contar apariciones a secas se dejaría engañar.
 */
export function detectarSeparador(texto: string): string {
  const muestra = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8)
  let mejor = ';'
  let mejorPuntaje = 0

  for (const sep of [';', ',', '\t', '|']) {
    const cuentas = muestra.map((l) => partirCsv(l, sep)[0]?.length ?? 0)
    const columnas = cuentas[0] ?? 0
    if (columnas < 2) continue
    const consistentes = cuentas.filter((c) => c === columnas).length
    const puntaje = consistentes * 10 + columnas
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = sep }
  }
  return mejor
}

export type Campo = 'fecha' | 'descripcion' | 'monto' | 'debito' | 'credito' | 'comercio' | 'referencia' | 'saldo'

export interface Mapeo {
  /** Índice de columna para cada campo. -1 = sin asignar. */
  [campo: string]: number
}

/** Cómo llama cada banco a cada cosa. En minúsculas y sin tildes. */
const NOMBRES: Record<Campo, string[]> = {
  fecha: ['fecha', 'fecha transaccion', 'fecha de transaccion', 'fecha operacion', 'date', 'fecha mov'],
  descripcion: ['descripcion', 'concepto', 'detalle', 'transaccion', 'description', 'observacion', 'movimiento'],
  monto: ['valor', 'monto', 'importe', 'amount', 'valor transaccion', 'vlr transaccion'],
  debito: ['debito', 'debitos', 'cargo', 'cargos', 'salida', 'retiro', 'egreso'],
  credito: ['credito', 'creditos', 'abono', 'abonos', 'entrada', 'consignacion', 'ingreso', 'deposito'],
  comercio: ['comercio', 'establecimiento', 'beneficiario', 'tercero', 'merchant'],
  referencia: ['referencia', 'ref', 'numero', 'documento', 'autorizacion', 'id'],
  saldo: ['saldo', 'balance', 'saldo final'],
}

const sinTildes = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Qué columna es cuál, propuesto a partir de los nombres.
 *
 * Coincidencia exacta primero y por contenido después: «fecha» exacta gana a
 * «fecha de corte», que contiene «fecha» pero no es la que se busca.
 */
export function detectarColumnas(cabeceras: string[]): Mapeo {
  const limpias = cabeceras.map(sinTildes)
  const mapeo: Mapeo = {}

  for (const [campo, alias] of Object.entries(NOMBRES) as [Campo, string[]][]) {
    let indice = limpias.findIndex((h) => alias.includes(h))
    if (indice < 0) {
      indice = limpias.findIndex((h) => h.length > 2 && alias.some((a) => h.includes(a)))
    }
    mapeo[campo] = indice
  }
  return mapeo
}

/**
 * Dónde empieza la tabla de verdad.
 *
 * Los extractos traen líneas de cabecera con el logo, el número de cuenta y el
 * período antes de la fila de nombres de columna. Se busca la primera fila que
 * parezca una cabecera —varias celdas con texto y alguna que suene a fecha o
 * valor— y si no aparece, se toma la primera.
 */
export function buscarCabecera(filas: string[][]): number {
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const fila = filas[i].map(sinTildes)
    if (fila.filter((c) => c.length > 1).length < 2) continue
    const tieneFecha = fila.some((c) => NOMBRES.fecha.includes(c) || c.includes('fecha'))
    const tieneValor = fila.some((c) =>
      [...NOMBRES.monto, ...NOMBRES.debito, ...NOMBRES.credito].some((a) => c.includes(a)))
    if (tieneFecha && tieneValor) return i
  }
  return 0
}

/**
 * Una fecha de extracto, en cualquiera de los formatos que usan.
 *
 * El caso ambiguo —12/09/2026— se lee como día/mes, que es Colombia. Da igual
 * cuántos bancos lo escriban al revés: el que importa es el del usuario, y ya
 * verá en la vista previa si las fechas salen raras.
 */
export function leerFecha(crudo: string): string | null {
  const t = (crudo ?? '').trim()
  if (!t) return null

  const iso = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const dmy = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (dmy) {
    const anio = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${anio}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }

  // Compacto: 20260912. Es lo que exportan algunos sistemas antiguos.
  const compacto = t.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compacto) return `${compacto[1]}-${compacto[2]}-${compacto[3]}`

  return null
}

/**
 * Un importe de extracto.
 *
 * Los paréntesis son negativos —convención contable que usan varios bancos— y
 * el signo puede ir delante o detrás. Se reutiliza el lector de números del
 * intérprete de SMS, que ya resuelve el punto y la coma.
 */
export function leerMonto(crudo: string): number {
  const t = (crudo ?? '').trim()
  if (!t) return 0
  const negativo = /^\(.*\)$/.test(t) || t.startsWith('-') || t.endsWith('-')
  const limpio = t.replace(/[()\s$]/g, '').replace(/^-|-$/g, '')

  const ultimaComa = limpio.lastIndexOf(',')
  const ultimoPunto = limpio.lastIndexOf('.')
  let entero = limpio
  let decimales = ''

  if (ultimaComa > ultimoPunto && /,\d{1,2}$/.test(limpio)) {
    entero = limpio.slice(0, ultimaComa); decimales = limpio.slice(ultimaComa + 1)
  } else if (ultimoPunto > ultimaComa && /\.\d{1,2}$/.test(limpio)) {
    entero = limpio.slice(0, ultimoPunto); decimales = limpio.slice(ultimoPunto + 1)
  }

  const n = Number(`${entero.replace(/[.,]/g, '')}.${decimales || '0'}`)
  if (!Number.isFinite(n)) return 0
  return negativo ? -n : n
}

export interface FilaImportada {
  /** El número de fila del archivo, para poder señalarla en la vista previa. */
  linea: number
  dia: string
  descripcion: string
  comercio?: string
  monto: number
  tipo: TxType
  categoryId: string
  /** Referencia del extracto; es lo que evita importar dos veces lo mismo. */
  externalId: string
  /** Por qué no se puede importar, si es que no se puede. */
  problema?: string
  /** Ya existe un movimiento con esa referencia. */
  duplicada?: boolean
}

/**
 * Convierte las filas del archivo en movimientos propuestos.
 *
 * Todo pasa por la vista previa antes de escribirse. La referencia de cada uno
 * se construye con la cuenta, la fecha, el importe y la descripción, así que
 * volver a importar el mismo extracto no duplica nada aunque el banco no dé
 * ningún identificador propio —y casi ninguno lo da—.
 */
export function prepararImportacion(opciones: {
  filas: string[][]
  mapeo: Mapeo
  accountId: string
  /** Invertir el signo: algunos bancos exportan los gastos en positivo. */
  invertir?: boolean
  /** Referencias que ya están registradas. */
  existentes?: Set<string>
  /** Para proponer categoría a partir de la descripción. */
  categorizar?: (texto: string, tipo: TxType) => string | null
}): FilaImportada[] {
  const { filas, mapeo, accountId, invertir, existentes, categorizar } = opciones
  const salida: FilaImportada[] = []

  const dato = (fila: string[], campo: Campo) => {
    const i = mapeo[campo]
    return i >= 0 && i < fila.length ? (fila[i] ?? '').trim() : ''
  }

  for (let k = 0; k < filas.length; k++) {
    const fila = filas[k]
    const dia = leerFecha(dato(fila, 'fecha'))
    const descripcion = dato(fila, 'descripcion') || dato(fila, 'comercio') || 'Movimiento importado'

    /*
     * El importe sale de una columna con signo o de dos separadas. Se admiten
     * las dos formas porque las dos existen, y con las dos columnas el signo
     * lo da la columna en la que esté el número, no el número.
     */
    let monto = 0
    if (mapeo.monto >= 0) {
      monto = leerMonto(dato(fila, 'monto'))
    } else {
      const debito = Math.abs(leerMonto(dato(fila, 'debito')))
      const credito = Math.abs(leerMonto(dato(fila, 'credito')))
      monto = credito > 0 ? credito : -debito
    }
    if (invertir) monto = -monto

    const tipo: TxType = monto >= 0 ? 'income' : 'expense'
    const absoluto = Math.abs(monto)
    const referencia = dato(fila, 'referencia')
    const externalId = referencia
      ? `csv:${accountId}:${referencia}`
      : `csv:${accountId}:${dia ?? '?'}:${absoluto}:${sinTildes(descripcion).slice(0, 24)}`

    const propuesta: FilaImportada = {
      linea: k + 1,
      dia: dia ?? '',
      descripcion,
      comercio: dato(fila, 'comercio') || undefined,
      monto: absoluto,
      tipo,
      categoryId: categorizar?.(descripcion, tipo) ?? (tipo === 'income' ? 'other-income' : 'other'),
      externalId,
      duplicada: existentes?.has(externalId),
    }

    if (!dia) propuesta.problema = 'No se entendió la fecha'
    else if (absoluto <= 0) propuesta.problema = 'El importe es cero o no se entendió'
    else if (dia > hoyEnZona()) propuesta.problema = 'La fecha está en el futuro'

    salida.push(propuesta)
  }

  return salida
}
