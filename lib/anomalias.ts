/**
 * Detección de anomalías y gastos fantasma.
 *
 * Todo lo demás en la app responde a preguntas que alguien se hace. Esto es lo
 * contrario: lo que uno no pregunta porque no sabe que hay algo que preguntar.
 * El cobro duplicado que pasó el martes, la suscripción que subió de precio
 * sin avisar, los ocho mil pesos mensuales de una prueba que terminó en marzo,
 * la semana en que los restaurantes se dispararon sin que hubiera nada que
 * celebrar.
 *
 * Son cosas pequeñas, y esa es justamente la razón de que duren años: ninguna
 * es lo bastante grande como para que alguien la note revisando el extracto.
 *
 * Dos reglas de diseño, porque un detector que se equivoca mucho se ignora
 * entero y deja de servir para nada:
 *
 *  1. Nada se marca sin una cifra que lo sostenga. «Gastaste más en comida» no
 *     es un aviso; «gastaste un 68 % más que tu semana típica, 140.000 pesos
 *     de diferencia» sí, porque se puede comprobar.
 *  2. Hace falta historia. Con tres semanas de datos, cualquier semana es
 *     atípica. Cada detector dice cuánta historia necesita y se calla hasta
 *     tenerla.
 */
import { categoryById } from './categories'
import { formatMoney } from './format'
import type { Subscription, Transaction } from './types'
import { hoyEnZona, sumarDias } from './zona'

export type TipoAnomalia = 'duplicado' | 'disparada' | 'fantasma' | 'subida' | 'atipico'

export interface Anomalia {
  id: string
  tipo: TipoAnomalia
  /** 'alta' se enseña sola; 'media' y 'baja', en la lista. */
  severidad: 'alta' | 'media' | 'baja'
  titulo: string
  detalle: string
  /** Lo que está en juego, en pesos. Sirve para ordenar. */
  monto: number
  /** Los movimientos implicados, para poder ir a verlos. */
  transacciones: Transaction[]
  /** Qué se puede hacer, cuando hay algo que hacer. */
  accion?: string
}

/** A pesos, con la tasa del día del movimiento si se guardó. */
const enPesos = (t: Transaction, fxRate: number) =>
  t.currency === 'USD'
    ? (t.fxRate && t.fxRate > 0 ? t.amount * t.fxRate : fxRate > 0 ? t.amount * fxRate : 0)
    : t.amount

/**
 * El nombre por el que se reconoce un cobro.
 *
 * Los bancos escriben el mismo comercio de cinco maneras —«PAYU*NETFLIX»,
 * «NETFLIX.COM», «Netflix 3 de mayo»— y sin normalizar no hay forma de ver que
 * son lo mismo. Se quitan los prefijos de pasarela, los números, las fechas y
 * los signos, y queda la palabra que sirve para agrupar.
 */
export function claveComercio(t: Pick<Transaction, 'merchant' | 'description'>): string {
  const base = (t.merchant || t.description || '').toLowerCase()
  return base
    .replace(/\b(payu|pse|compra|pago|debito|débito|credito|crédito|tarj|ref|aut)\b/g, ' ')
    .replace(/[^a-záéíóúñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
}

/** La mediana de una lista. Vacía = 0. */
function mediana(xs: number[]): number {
  if (!xs.length) return 0
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

/**
 * Dos cobros iguales, en la misma cuenta y con pocos días de diferencia.
 *
 * El caso clásico: el datáfono que no dio comprobante y el cajero pasó la
 * tarjeta otra vez. También el botón de pagar tocado dos veces, y la
 * suscripción que cobra el mes y al día siguiente vuelve a cobrarlo.
 *
 * El importe tiene que ser idéntico al peso. Con tolerancia, dos cafés del
 * mismo sitio en la misma semana salían marcados como duplicado, y un aviso
 * falso al día enseña a ignorar todos los avisos. Que dos cobros distintos
 * coincidan al peso exacto en cuatro días pasa, pero es raro, y cuando pasa el
 * aviso es fácil de descartar de un vistazo.
 */
function duplicados(txs: Transaction[], fxRate: number, hoy: string): Anomalia[] {
  const ventana = sumarDias(hoy, -35)
  const recientes = txs.filter((t) => t.type === 'expense' && t.occurredAt.slice(0, 10) >= ventana)

  const grupos = new Map<string, Transaction[]>()
  for (const t of recientes) {
    // Cuenta + importe exacto: es lo que define «el mismo cobro otra vez».
    const clave = `${t.accountId}|${t.amount}|${t.currency ?? 'COP'}`
    grupos.set(clave, [...(grupos.get(clave) ?? []), t])
  }

  const salida: Anomalia[] = []
  for (const [clave, lista] of grupos) {
    if (lista.length < 2) continue
    const ordenados = [...lista].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

    for (let i = 1; i < ordenados.length; i++) {
      const a = ordenados[i - 1]
      const b = ordenados[i]
      const dias = Math.round(
        (Date.parse(b.occurredAt.slice(0, 10)) - Date.parse(a.occurredAt.slice(0, 10))) / 86_400_000,
      )
      if (dias > 4) continue
      // Dos cobros de la misma suscripción el mismo día ya los evita quien los
      // anota; si aun así llegan, son un duplicado de verdad y entran.
      const monto = enPesos(b, fxRate)
      if (monto < 3_000) continue // por debajo de eso, el aviso molesta más de lo que ayuda

      salida.push({
        id: `dup:${clave}:${b.id}`,
        tipo: 'duplicado',
        severidad: monto >= 50_000 ? 'alta' : 'media',
        titulo: 'Dos cobros iguales',
        detalle: dias === 0
          ? `${formatMoney(monto)} dos veces el mismo día en la misma cuenta.`
          : `${formatMoney(monto)} dos veces en ${dias} ${dias === 1 ? 'día' : 'días'}, en la misma cuenta.`,
        monto,
        transacciones: [a, b],
        accion: 'Si fue un error del comercio, se puede reclamar: el banco pide el comprobante.',
      })
    }
  }
  return salida
}

/**
 * Una categoría que se disparó esta semana.
 *
 * Se compara con la mediana de las ocho semanas anteriores y no con la media:
 * la cena de cumpleaños de hace un mes subiría la media y escondería la semana
 * mala de ahora. Hace falta un mínimo de historia y un salto que valga la pena
 * mirar —en porcentaje y en pesos—: un 300 % más en propinas son nueve mil
 * pesos y no es noticia.
 */
function categoriasDisparadas(txs: Transaction[], fxRate: number, hoy: string): Anomalia[] {
  const SEMANAS = 8
  const inicioSemana = sumarDias(hoy, -6)
  const inicioHistoria = sumarDias(inicioSemana, -7 * SEMANAS)

  const estaSemana = new Map<string, { total: number; txs: Transaction[] }>()
  const historia = new Map<string, number[]>()

  for (const t of txs) {
    if (t.type !== 'expense') continue
    const dia = t.occurredAt.slice(0, 10)
    if (dia > hoy || dia < inicioHistoria) continue
    const v = enPesos(t, fxRate)
    if (!v) continue

    if (dia >= inicioSemana) {
      const e = estaSemana.get(t.categoryId) ?? { total: 0, txs: [] }
      e.total += v
      e.txs.push(t)
      estaSemana.set(t.categoryId, e)
    } else {
      // A qué semana hacia atrás pertenece, de 0 a SEMANAS-1.
      const k = Math.floor((Date.parse(inicioSemana) - Date.parse(dia)) / (7 * 86_400_000))
      const arr = historia.get(t.categoryId) ?? Array(SEMANAS).fill(0)
      if (k >= 0 && k < SEMANAS) arr[k] += v
      historia.set(t.categoryId, arr)
    }
  }

  const salida: Anomalia[] = []
  for (const [categoryId, { total, txs: lista }] of estaSemana) {
    const semanas = historia.get(categoryId)
    // Sin cuatro semanas de historia con gasto, cualquier semana es atípica.
    if (!semanas || semanas.filter((s) => s > 0).length < 4) continue

    const tipica = mediana(semanas)
    if (tipica <= 0) continue

    const exceso = total - tipica
    const pct = (exceso / tipica) * 100
    // Las dos condiciones a la vez: un 40 % de subida sobre una base pequeña
    // no importa, y veinte mil pesos sobre una base grande tampoco.
    if (pct < 35 || exceso < 40_000) continue

    const cat = categoryById(categoryId)
    salida.push({
      id: `disp:${categoryId}:${hoy}`,
      tipo: 'disparada',
      severidad: pct >= 100 ? 'alta' : 'media',
      titulo: `${cat.name}: ${Math.round(pct)} % más esta semana`,
      detalle: `Llevas ${formatMoney(total)} frente a los ${formatMoney(tipica)} de una semana normal. Son ${formatMoney(exceso)} de diferencia.`,
      monto: exceso,
      transacciones: [...lista].sort((a, b) => b.amount - a.amount).slice(0, 5),
    })
  }
  return salida
}

/**
 * Un cobro que se repite todos los meses y que no está en suscripciones.
 *
 * El gasto fantasma de verdad: el mismo comercio, el mismo importe, tres meses
 * seguidos, y nadie lo registró nunca como suscripción porque nadie se acuerda
 * de haberlo aceptado. Tres repeticiones y no dos: dos pueden ser casualidad
 * —dos veces el mismo mercado por el mismo valor—, tres ya es un cargo
 * automático.
 */
function fantasmas(txs: Transaction[], subs: Subscription[], fxRate: number, hoy: string): Anomalia[] {
  const desde = sumarDias(hoy, -190)
  const conocidas = new Set(
    subs.map((s) => s.name.toLowerCase().replace(/[^a-záéíóúñ\s]/g, ' ').replace(/\s+/g, ' ').trim()),
  )

  const grupos = new Map<string, Transaction[]>()
  for (const t of txs) {
    if (t.type !== 'expense' || t.subscriptionId) continue
    const dia = t.occurredAt.slice(0, 10)
    if (dia < desde || dia > hoy) continue
    const nombre = claveComercio(t)
    if (nombre.length < 3) continue
    if (conocidas.has(nombre)) continue
    // Importe redondeado a mil: un cobro recurrente puede variar unos pesos
    // por el IVA o por la tasa del día, y partirlo en dos grupos lo escondería.
    const clave = `${nombre}|${Math.round(enPesos(t, fxRate) / 1000)}`
    grupos.set(clave, [...(grupos.get(clave) ?? []), t])
  }

  const salida: Anomalia[] = []
  for (const [clave, lista] of grupos) {
    if (lista.length < 3) continue
    const ordenados = [...lista].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

    // Tienen que caer en meses distintos y con una separación de mes, no tres
    // compras de la misma semana.
    const meses = new Set(ordenados.map((t) => t.occurredAt.slice(0, 7)))
    if (meses.size < 3) continue

    const ultimo = ordenados[ordenados.length - 1]
    // Si el último cobro tiene más de 70 días, ya no está vivo.
    if (ultimo.occurredAt.slice(0, 10) < sumarDias(hoy, -70)) continue

    const mensual = enPesos(ultimo, fxRate)
    salida.push({
      id: `fan:${clave}`,
      tipo: 'fantasma',
      severidad: mensual * 12 >= 240_000 ? 'alta' : 'media',
      titulo: `«${ultimo.merchant || ultimo.description}» te cobra todos los meses`,
      detalle: `${meses.size} cobros de unos ${formatMoney(mensual)} y no está en tus suscripciones. Al año son ${formatMoney(mensual * 12)}.`,
      monto: mensual * 12,
      transacciones: ordenados.slice(-4).reverse(),
      accion: 'Regístralo como suscripción para verlo venir, o cancélalo si ya no lo usas.',
    })
  }
  return salida
}

/**
 * Una suscripción que subió de precio.
 *
 * Se compara el último cobro con el anterior del mismo servicio. Las subidas
 * de las plataformas de streaming llegan sin correo y con una diferencia que
 * por sí sola no llama la atención: dos mil pesos más al mes son veinticuatro
 * mil al año, y al tercer servicio que hace lo mismo ya es una cuenta.
 */
function subidas(txs: Transaction[], subs: Subscription[], fxRate: number, hoy: string): Anomalia[] {
  const desde = sumarDias(hoy, -400)
  const porSub = new Map<string, Transaction[]>()

  for (const t of txs) {
    if (!t.subscriptionId || t.type !== 'expense') continue
    if (t.occurredAt.slice(0, 10) < desde) continue
    porSub.set(t.subscriptionId, [...(porSub.get(t.subscriptionId) ?? []), t])
  }

  const salida: Anomalia[] = []
  for (const [subId, lista] of porSub) {
    if (lista.length < 2) continue
    const ordenados = [...lista].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    const ultimo = ordenados[ordenados.length - 1]
    const previo = ordenados[ordenados.length - 2]

    const a = enPesos(previo, fxRate)
    const b = enPesos(ultimo, fxRate)
    if (a <= 0 || b <= a) continue

    const pct = ((b - a) / a) * 100
    // Un 3 % puede ser la tasa del día en una suscripción en dólares, no una
    // subida de precio. A partir del 8 % ya es una decisión del proveedor.
    if (pct < 8) continue

    const sub = subs.find((s) => s.id === subId)
    salida.push({
      id: `sub:${subId}:${ultimo.id}`,
      tipo: 'subida',
      severidad: pct >= 25 ? 'alta' : 'baja',
      titulo: `${sub?.name ?? ultimo.description} subió ${Math.round(pct)} %`,
      detalle: `Pasó de ${formatMoney(a)} a ${formatMoney(b)}. Al año son ${formatMoney((b - a) * 12)} más.`,
      monto: (b - a) * 12,
      transacciones: [ultimo, previo],
    })
  }
  return salida
}

/**
 * Un movimiento suelto muy por encima de lo normal en su categoría.
 *
 * No es un error por sí mismo —a veces uno compra una nevera— pero es lo que
 * explica un mes raro, y verlo arriba ahorra el rato de buscarlo en la lista.
 * Se pide bastante historia y un salto grande, porque aquí la tentación de
 * marcar de más es máxima.
 */
function atipicos(txs: Transaction[], fxRate: number, hoy: string): Anomalia[] {
  const desde = sumarDias(hoy, -30)
  const historia = new Map<string, number[]>()
  const recientes: Transaction[] = []

  for (const t of txs) {
    if (t.type !== 'expense' || t.subscriptionId) continue
    const dia = t.occurredAt.slice(0, 10)
    if (dia > hoy) continue
    const v = enPesos(t, fxRate)
    if (!v) continue
    if (dia >= desde) recientes.push(t)
    else historia.set(t.categoryId, [...(historia.get(t.categoryId) ?? []), v])
  }

  const salida: Anomalia[] = []
  for (const t of recientes) {
    const previos = historia.get(t.categoryId)
    if (!previos || previos.length < 8) continue
    const tipico = mediana(previos)
    if (tipico <= 0) continue
    const v = enPesos(t, fxRate)
    if (v < tipico * 4 || v - tipico < 150_000) continue

    const cat = categoryById(t.categoryId)
    salida.push({
      id: `atip:${t.id}`,
      tipo: 'atipico',
      severidad: 'baja',
      titulo: `Un gasto grande en ${cat.name}`,
      detalle: `${formatMoney(v)} frente a los ${formatMoney(tipico)} que sueles gastar de una vez en esta categoría.`,
      monto: v,
      transacciones: [t],
    })
  }
  return salida
}

/**
 * Todo lo que haya que mirar, de lo más caro a lo menos.
 *
 * Ordenado por severidad y luego por dinero en juego: un duplicado de
 * doscientos mil va antes que una subida de tres mil al mes, aunque la subida
 * dure más. Se recorta a doce: una lista más larga que eso ya no se lee.
 */
export function detectarAnomalias(
  transactions: Transaction[],
  subscriptions: Subscription[],
  fxRate: number,
  hoy: string = hoyEnZona(),
): Anomalia[] {
  const orden = { alta: 0, media: 1, baja: 2 }
  return [
    ...duplicados(transactions, fxRate, hoy),
    ...categoriasDisparadas(transactions, fxRate, hoy),
    ...fantasmas(transactions, subscriptions, fxRate, hoy),
    ...subidas(transactions, subscriptions, fxRate, hoy),
    ...atipicos(transactions, fxRate, hoy),
  ]
    .sort((a, b) => orden[a.severidad] - orden[b.severidad] || b.monto - a.monto)
    .slice(0, 12)
}

const CLAVE_DESCARTADAS = 'eftm.anomalias.descartadas'

/**
 * Los avisos que el usuario ya miró y descartó.
 *
 * En el dispositivo, igual que el reparto de grupos: es lo que uno ya sabe, no
 * un dato financiero. Y con fecha, para que la lista no crezca sin fin: a los
 * noventa días se olvidan, que para entonces la anomalía ya no está en la
 * ventana de ningún detector.
 */
export function leerDescartadas(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = JSON.parse(localStorage.getItem(CLAVE_DESCARTADAS) || '{}') as Record<string, string>
    const limite = sumarDias(hoyEnZona(), -90)
    return Object.fromEntries(Object.entries(raw).filter(([, dia]) => dia >= limite))
  } catch {
    return {}
  }
}

export function descartar(id: string) {
  try {
    const actual = leerDescartadas()
    actual[id] = hoyEnZona()
    localStorage.setItem(CLAVE_DESCARTADAS, JSON.stringify(actual))
  } catch { /* storage bloqueado */ }
}
