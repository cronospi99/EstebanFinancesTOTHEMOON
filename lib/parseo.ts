/**
 * Lectura de una notificación de banco, un SMS o el texto de una factura.
 *
 * Es el motor que comparten cuatro entradas distintas y que por eso vive
 * aparte de todas ellas: el atajo de iOS que reenvía el SMS, el correo del
 * banco, la foto de una factura después de pasarla por OCR y el pegado a mano.
 * Todas acaban siendo lo mismo —un texto en español con una cifra dentro— y
 * tener un solo sitio donde se interpreta significa que mejorar el
 * reconocimiento del Éxito lo arregla en los cuatro a la vez.
 *
 * El objetivo no es acertar siempre, que es imposible: los bancos colombianos
 * escriben sus avisos de veinte maneras distintas y ninguna está documentada.
 * El objetivo es acertar lo suficiente como para que quede un formulario
 * relleno que se confirma con un toque, y decir con qué confianza lo hizo para
 * que lo dudoso se revise en vez de guardarse a ciegas.
 *
 * Nada de esto adivina la cuenta ni escribe nada por su cuenta: devuelve una
 * propuesta. Quien decide es quien toca el botón.
 */
import { DEFAULT_CATEGORIES } from './categories'
import type { Currency, TxType } from './types'

const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/* ===========================================================================
 *  El importe
 * ===========================================================================
 *  La parte difícil, y no por el formato sino por la elección: un SMS del
 *  banco trae tres cifras —el monto, el cupo disponible y a veces los últimos
 *  cuatro dígitos de la tarjeta— y elegir la equivocada anota un gasto de tres
 *  millones por un café.
 *
 *  La regla es tomar la que va justo detrás de una marca de dinero («$»,
 *  «COP», «por») y descartar explícitamente lo que viene detrás de «cupo»,
 *  «saldo» o «disponible». Si no hay ninguna marca, se toma la mayor de las
 *  candidatas plausibles, que empíricamente es el monto.
 * ------------------------------------------------------------------------ */

/**
 * Lo que nunca es el monto de la compra, por más que sea la cifra más grande.
 *
 * Cada entrada de aquí salió de un aviso real que se leía mal. «Te quedan
 * $412.300» es el saldo después de la compra y era la cifra que Nequi hacía
 * anotar; el NIT de una factura son nueve dígitos con puntos que se leían como
 * novecientos millones de pesos.
 */
const TRAS_PALABRA_PROHIBIDA =
  /(cupo|saldo|disponible|limite|límite|avance|total acumulado|te quedan|quedan|restante|nit|c\.?c\.?|cedula|cédula|referencia|autorizacion|autorización)[^.]{0,30}$/i

/**
 * Convierte «1.234.567,89» o «1,234,567.89» a número.
 *
 * Los dos formatos conviven en los avisos reales: el banco escribe en formato
 * colombiano y una factura de un servicio extranjero, en inglés. Se distingue
 * por cuál de los dos separadores va último: el que esté más a la derecha y
 * tenga uno o dos dígitos detrás es el decimal.
 */
export function aNumero(crudo: string): number {
  const limpio = crudo.replace(/[^\d.,]/g, '')
  if (!limpio) return 0

  const ultimaComa = limpio.lastIndexOf(',')
  const ultimoPunto = limpio.lastIndexOf('.')

  let entero = limpio
  let decimales = ''

  if (ultimaComa > ultimoPunto && /,\d{1,2}$/.test(limpio)) {
    entero = limpio.slice(0, ultimaComa)
    decimales = limpio.slice(ultimaComa + 1)
  } else if (ultimoPunto > ultimaComa && /\.\d{1,2}$/.test(limpio)) {
    entero = limpio.slice(0, ultimoPunto)
    decimales = limpio.slice(ultimoPunto + 1)
  }

  const n = Number(`${entero.replace(/[.,]/g, '')}.${decimales || '0'}`)
  return Number.isFinite(n) ? n : 0
}

interface Candidata { valor: number; peso: number; orden: number }

function montoDe(texto: string): { monto: number; moneda: Currency } {
  const moneda: Currency = /\b(usd|us\$|dolar|dólar|dollars?)\b/i.test(texto) ? 'USD' : 'COP'
  const candidatas: Candidata[] = []

  // Cada cifra del texto, con el trozo que la precede para poder juzgarla.
  const re = /(total(?:\s+a\s+pagar)?|valor|monto|por|\$|cop|usd|us\$)?\s*\$?\s*(\d[\d.,]*)/gi
  let m: RegExpExecArray | null
  let orden = 0
  while ((m = re.exec(texto))) {
    const antes = texto.slice(Math.max(0, m.index - 40), m.index + (m[1]?.length ?? 0))
    if (TRAS_PALABRA_PROHIBIDA.test(antes)) continue

    const valor = aNumero(m[2])
    if (valor <= 0) continue

    /*
     * Una cifra de cuatro dígitos sin marca de dinero casi siempre es el año,
     * los últimos dígitos de la tarjeta o una hora. Se admite igual pero con
     * el peso más bajo, para que cualquier otra candidata le gane.
     */
    const pareceTarjeta = /(\*{2,}|terminada|final|ending)\s*\d*$/i.test(antes)
    if (pareceTarjeta) continue

    /*
     * Tres niveles, y el de arriba es el que arregla las facturas: «TOTAL A
     * PAGAR» gana a las líneas de artículos aunque alguna sea mayor, porque en
     * un tiquete la cifra buena está siempre nombrada.
     */
    const marca = (m[1] ?? '').toLowerCase()
    const peso = /total|valor|monto|por/.test(marca) ? 3 : marca ? 2 : /^\d{4}$/.test(m[2]) ? 0 : 1
    candidatas.push({ valor, peso, orden: orden++ })
  }

  if (!candidatas.length) return { monto: 0, moneda }

  /*
   * A igualdad de peso manda la que aparece antes, no la más grande.
   *
   * Es lo contrario de lo que parece razonable y sale de cómo escriben los
   * bancos: el aviso empieza por lo que pasó —«Pagaste $23.500»— y sigue con
   * el contexto —«te quedan $412.300»—. Quedándose con la mayor, media
   * Colombia anotaba su saldo como si fuera la compra.
   */
  candidatas.sort((a, b) => b.peso - a.peso || a.orden - b.orden)
  return { monto: candidatas[0].valor, moneda }
}

/* ===========================================================================
 *  Qué clase de movimiento es
 * ======================================================================== */

/** Lo que dice un aviso cuando entra dinero. */
const ENTRA = [
  'abono', 'abonaron', 'consignacion', 'consignaron', 'recibiste', 'recibió', 'recibio',
  'te enviaron', 'te transfirieron', 'nomina', 'nómina', 'deposito', 'depósito',
  'reversion', 'reversión', 'devolucion', 'devolución', 'reembolso', 'ingreso',
]

/** Lo que dice cuando sale. Va después: «pago de nómina» sale, no entra. */
const SALE = [
  'compra', 'pago', 'pagaste', 'retiro', 'retiraste', 'transferencia a', 'enviaste',
  'debito', 'débito', 'cargo', 'cobro', 'avance', 'consumo',
]

function tipoDe(t: string): TxType {
  // «Transferencia» a secas es ambigua y sale con más frecuencia de la que
  // entra, así que la resuelve la preposición: «transferencia a» sale,
  // «transferencia de» entra.
  if (/transferencia\s+de\b/.test(t)) return 'income'
  const iEntra = ENTRA.reduce((p, k) => { const i = t.indexOf(k); return i >= 0 && (p < 0 || i < p) ? i : p }, -1)
  const iSale = SALE.reduce((p, k) => { const i = t.indexOf(k); return i >= 0 && (p < 0 || i < p) ? i : p }, -1)
  if (iEntra >= 0 && (iSale < 0 || iEntra < iSale)) return 'income'
  return 'expense'
}

/* ===========================================================================
 *  El comercio
 * ======================================================================== */

/**
 * Basura que los bancos y las pasarelas cuelan delante del nombre real.
 *
 * Sin quitarla, el comercio de media Colombia se llama «PAYU» y todas las
 * suscripciones parecen la misma.
 */
const PREFIJOS = /^(payu|pse|mercpago|mercadopago|pagos?|compra|tx|ref|epayco|wompi|nequi|pay|sq|sumup|redeban|credibanco)[\s*_-]+/i

/** De dónde sale el nombre, en orden de fiabilidad. */
const PATRONES_COMERCIO: RegExp[] = [
  /(?:comercio|establecimiento|negocio)[:\s]+([^\n.,;]{3,40})/i,
  /(?:compra|pago|consumo|cargo)\s+(?:por\s+[^\s]+\s+)?en\s+([^\n.,;]{3,40})/i,
  /\ben\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .*&'-]{2,39})\b/,
  /(?:de|a)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .*&'-]{3,39})\b/,
]

/**
 * Donde termina el nombre del comercio y empieza el resto del aviso.
 *
 * Sin esto, «compra en EXITO ENVIGADO el 12/09/2026 desde su cuenta» se
 * guardaba entero como nombre del comercio. Los avisos siguen con la fecha,
 * la cuenta o la tarjeta, y todas esas continuaciones empiezan por una de
 * estas palabras.
 */
const FIN_DEL_NOMBRE = /\s+(?:el|del|desde|con|por|a las|hoy|ayer|su|tu|cuenta|tarjeta|ref|autorizacion|autorización)\b.*$/i

/** Palabras que no son un comercio aunque caigan en el patrón. */
const NO_ES_COMERCIO = /^(tu|su|la|el|los|las|cuenta|tarjeta|ahorros|corriente|credito|crédito|bancolombia|davivienda|nequi|bbva|nu|banco|cop|usd|hoy|ayer)\b/i

function comercioDe(texto: string): string | null {
  for (const re of PATRONES_COMERCIO) {
    const m = texto.match(re)
    if (!m) continue
    const crudo = m[1]
      .replace(PREFIJOS, '')
      .replace(FIN_DEL_NOMBRE, '')
      // La puntuación del final se la come el patrón y no es parte del nombre.
      .replace(/[\s.,;:*-]+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (crudo.length < 3 || NO_ES_COMERCIO.test(crudo)) continue
    // Los bancos escriben en mayúsculas sostenidas; se pasa a capitalizado
    // porque «EXITO COLOMBIA SA» en una lista grita y no aporta nada.
    return crudo.length > 4 && crudo === crudo.toUpperCase()
      ? crudo.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())
      : crudo
  }
  return null
}

/* ===========================================================================
 *  La categoría
 * ===========================================================================
 *  Por nombre de comercio, que es lo único que trae un SMS. La lista está
 *  hecha de cadenas colombianas porque es donde vive quien usa esto: sin
 *  «Éxito», «D1» y «Ara» no se acierta ni el mercado, que es la categoría más
 *  frecuente de todas.
 * ------------------------------------------------------------------------ */

const COMERCIOS: Record<string, string[]> = {
  market: ['exito', 'carulla', 'jumbo', 'olimpica', 'd1', 'ara', 'justo & bueno', 'metro', 'makro', 'euro', 'zapatoca', 'la vaquita', 'consumo', 'surtimax', 'colsubsidio super'],
  food: ['crepes', 'frisby', 'el corral', 'mcdonald', 'burger', 'kfc', 'subway', 'presto', 'sierra nevada', 'andres carne', 'wok', 'sushi', 'pizza', 'restaurante', 'hamburgue', 'tostao'],
  delivery: ['rappi', 'didi food', 'ifood', 'domicilios'],
  coffee: ['juan valdez', 'starbucks', 'oma', 'tostao'],
  drinks: ['bar ', 'cerveceria', 'cervecería', 'bbc', 'licores', 'dislicores'],
  transport: ['uber', 'didi', 'cabify', 'indriver', 'beat'],
  fuel: ['terpel', 'texaco', 'primax', 'biomax', 'esso', 'mobil', 'estacion de servicio'],
  transit: ['transmilenio', 'civica', 'cívica', 'metro de medellin', 'tullave'],
  parking: ['parqueadero', 'city parking', 'parking'],
  pharmacy: ['farmatodo', 'cruz verde', 'la rebaja', 'copidrogas', 'drogueria', 'droguería', 'locatel'],
  health: ['colsanitas', 'sura', 'compensar', 'eps', 'clinica', 'clínica', 'laboratorio'],
  gym: ['smart fit', 'bodytech', 'stark', 'gimnasio', 'spinning center'],
  utilities: ['epm', 'emcali', 'afinia', 'air-e', 'vanti', 'codensa', 'enel', 'acueducto', 'triple a'],
  internet: ['claro', 'movistar', 'tigo', 'etb', 'wom', 'directv', 'une'],
  phone: ['recarga', 'virgin mobile', 'avantel'],
  subs: ['netflix', 'spotify', 'disney', 'hbo', 'max', 'prime video', 'apple.com/bill', 'icloud', 'youtube premium', 'openai', 'anthropic', 'claude', 'canva', 'adobe', 'microsoft', 'google one', 'dropbox', 'crunchyroll', 'paramount'],
  shopping: ['falabella', 'homecenter', 'alkosto', 'ktronix', 'mercadolibre', 'mercado libre', 'amazon', 'temu', 'shein', 'linio', 'panamericana'],
  clothes: ['zara', 'h&m', 'bershka', 'pull&bear', 'arturo calle', 'studio f', 'koaj', 'gef', 'americanino'],
  tech: ['apple store', 'samsung', 'xiaomi', 'compumax'],
  cinema: ['cine colombia', 'cinemark', 'royal films', 'procinal'],
  games: ['steam', 'playstation', 'xbox', 'nintendo', 'epic games', 'riot'],
  travel: ['avianca', 'latam', 'wingo', 'viva', 'satena', 'despegar', 'booking', 'airbnb'],
  withdrawal: ['cajero', 'retiro en cajero', 'atm', 'servibanca'],
  fees: ['cuota de manejo', 'comision', 'comisión', '4x1000', 'gmf'],
  taxes: ['dian', 'impuesto', 'predial', 'secretaria de hacienda'],
  education: ['universidad', 'colegio', 'icetex', 'matricula', 'matrícula'],
  pets: ['agrocampo', 'veterinaria', 'petco'],
  beauty: ['peluqueria', 'peluquería', 'barberia', 'barbería', 'spa'],
  salary: ['nomina', 'nómina', 'pago de salario', 'sueldo'],
}

/**
 * Una clave aparece en el texto como palabra, no como trozo de otra.
 *
 * Buscando por `includes` a secas, «cajero automatico» se categorizaba como
 * café: dentro de «aut-oma-tico» está «oma», que es una cadena de cafeterías.
 * El límite tiene que ser de palabra, y no vale `\b` de JavaScript porque
 * muchas claves llevan espacios o símbolos («mercado libre», «apple.com/bill»).
 */
const apareceComoPalabra = (texto: string, clave: string) => {
  let desde = 0
  for (;;) {
    const i = texto.indexOf(clave, desde)
    if (i < 0) return false
    const antes = i === 0 ? ' ' : texto[i - 1]
    const despues = texto[i + clave.length] ?? ' '
    if (!/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(despues)) return true
    desde = i + 1
  }
}

function categoriaDe(texto: string, tipo: TxType): string | null {
  const t = normalizar(texto)
  let mejor: { id: string; largo: number } | null = null

  for (const [id, claves] of Object.entries(COMERCIOS)) {
    const cat = DEFAULT_CATEGORIES.find((c) => c.id === id)
    if (!cat || cat.kind !== tipo) continue
    for (const k of claves) {
      const clave = normalizar(k).trim()
      // La coincidencia más larga gana: «mercado libre» antes que «mercado».
      if (apareceComoPalabra(t, clave) && (!mejor || clave.length > mejor.largo)) {
        mejor = { id, largo: clave.length }
      }
    }
  }
  return mejor?.id ?? null
}

/* ===========================================================================
 *  La cuenta y la fecha
 * ======================================================================== */

const BANCOS: [RegExp, string][] = [
  [/bancolombia/i, 'Bancolombia'],
  [/nequi/i, 'Nequi'],
  [/daviplata/i, 'Daviplata'],
  [/davivienda/i, 'Davivienda'],
  [/davibank/i, 'DaviBank'],
  [/\bbbva\b/i, 'BBVA'],
  [/banco de bogot[áa]/i, 'Banco de Bogotá'],
  [/lulo/i, 'Lulo Bank'],
  [/\bnu\b|nubank/i, 'Nu'],
  [/ual[áa]/i, 'Ualá'],
  [/rappicard/i, 'RappiCard'],
  [/rappi ?(pay|cuenta)/i, 'RappiCuenta'],
  [/\bdale!?\b/i, 'Dale!'],
]

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
}

/**
 * La fecha que trae el texto, como día suelto, o null.
 *
 * Reconoce «12/09/2026», «2026-09-12» y «12 de septiembre». El formato
 * ambiguo —12/09— se lee como día/mes, que es lo que usa Colombia; leerlo al
 * revés fecharía media factura en diciembre.
 */
export function fechaDe(texto: string): string | null {
  const iso = texto.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const dmy = texto.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2}|\d{2})\b/)
  if (dmy) {
    const anio = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${anio}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }

  const letras = normalizar(texto).match(/\b(\d{1,2})\s+de\s+([a-z]{3})[a-z]*\.?\s*(?:de\s*)?(20\d{2})?/)
  if (letras && MESES[letras[2]]) {
    const anio = letras[3] ?? String(new Date().getFullYear())
    return `${anio}-${String(MESES[letras[2]]).padStart(2, '0')}-${letras[1].padStart(2, '0')}`
  }
  return null
}

export interface Lectura {
  monto: number
  moneda: Currency
  tipo: TxType
  /** El comercio, si se reconoció. */
  comercio: string | null
  /** Categoría propuesta. Null = que elija quien confirme. */
  categoryId: string | null
  /** Entidad del aviso, para casar con una cuenta existente. */
  institucion: string | null
  /** Los últimos cuatro dígitos de la tarjeta, si venían. */
  ultimos4: string | null
  /** Día del movimiento, si el texto lo traía. */
  dia: string | null
  /**
   * De 0 a 1. Por debajo de 0,5 la interfaz debe pedir confirmación explícita
   * en vez de dejar el botón de guardar a un toque.
   */
  confianza: number
  /** Lo que se leyó, recortado. Sirve de descripción y para depurar. */
  texto: string
}

/**
 * Lee un texto y propone un movimiento.
 *
 * La confianza sube con cada pieza reconocida y baja cuando algo no cuadra.
 * No es una probabilidad de nada: es una forma de ordenar «esto está claro» y
 * «esto mejor míralo», que es la única distinción que la interfaz necesita.
 */
export function leerTexto(entrada: string): Lectura {
  const texto = (entrada ?? '').slice(0, 2000).trim()
  const t = normalizar(texto)

  const { monto, moneda } = montoDe(texto)
  const tipo = tipoDe(t)
  const comercio = comercioDe(texto)
  const categoryId = categoriaDe(texto, tipo)
  const institucion = BANCOS.find(([re]) => re.test(texto))?.[1] ?? null
  const ultimos4 = texto.match(/(?:\*{2,}|terminada en|final|termina en)\s*(\d{4})\b/i)?.[1] ?? null
  const dia = fechaDe(texto)

  let confianza = 0
  if (monto > 0) confianza += 0.45
  if (comercio) confianza += 0.2
  if (categoryId) confianza += 0.15
  if (institucion) confianza += 0.1
  if (/compra|pago|abono|consignacion|retiro|transferencia|cargo/.test(t)) confianza += 0.1
  // Un monto redondo de cuatro cifras sin nada más alrededor probablemente sea
  // un año o un número de referencia, no dinero.
  if (monto > 0 && monto < 1000 && moneda === 'COP') confianza -= 0.25

  return {
    monto,
    moneda,
    tipo,
    comercio,
    categoryId,
    institucion,
    ultimos4,
    dia,
    confianza: Math.max(0, Math.min(1, Number(confianza.toFixed(2)))),
    texto: texto.slice(0, 300),
  }
}

/**
 * La descripción que se guarda.
 *
 * El comercio si lo hay; si no, el texto recortado a algo que quepa en una
 * lista. Nunca el texto entero: un SMS de banco son doscientos caracteres de
 * los cuales ciento ochenta son el aviso legal.
 */
export function descripcionDe(l: Lectura): string {
  if (l.comercio) return l.comercio
  const limpio = l.texto.replace(/\s+/g, ' ').trim()
  return limpio.length > 60 ? `${limpio.slice(0, 57)}…` : limpio || 'Movimiento'
}
