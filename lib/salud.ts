/**
 * Salud financiera y la regla 50/30/20.
 *
 * La regla es de Elizabeth Warren y tiene la virtud de que se recuerda: de lo
 * que entra, la mitad para lo que no se puede dejar de pagar, un 30 % para lo
 * que uno elige, y un 20 % para ahorro e inversión. No es una ley —en una
 * ciudad donde el arriendo se come el 45 %, el 50 se queda corto y no es culpa
 * de nadie—, pero sirve para lo que sirve: ver de un vistazo si lo
 * prescindible se está comiendo lo que debería ir a otro lado.
 *
 * Lo que la app aporta es que nadie tiene que clasificar nada. Cada categoría
 * ya existe y ya se usa; aquí solo se dice a cuál de los tres grupos pertenece,
 * y la cuenta sale sola con los gastos que ya están registrados.
 *
 * Los casos de frontera existen y no se esconden: el gimnasio es salud para
 * quien va tres veces por semana y un recibo olvidado para quien no va; un
 * curso puede ser formación imprescindible o un capricho de enero. El reparto
 * de abajo es un punto de partida razonable y se puede cambiar categoría por
 * categoría, porque quien sabe si su gimnasio es una necesidad es su dueño.
 */
import { DEFAULT_CATEGORIES } from './categories'
import type { Transaction } from './types'

export type Grupo = 'necesidades' | 'deseos' | 'ahorro'

export const GRUPOS: { id: Grupo; nombre: string; objetivo: number; color: string; descripcion: string }[] = [
  {
    id: 'necesidades', nombre: 'Necesidades', objetivo: 50, color: '#0A84FF',
    descripcion: 'Lo que hay que pagar aunque el mes venga mal: techo, comida de casa, servicios, transporte, salud, cuotas.',
  },
  {
    id: 'deseos', nombre: 'Deseos', objetivo: 30, color: '#BF5AF2',
    descripcion: 'Lo que mejora la vida y se puede recortar sin que pase nada grave: restaurantes, ocio, ropa, viajes.',
  },
  {
    id: 'ahorro', nombre: 'Ahorro e inversión', objetivo: 20, color: '#30D158',
    descripcion: 'Lo que se aparta para después: ahorro, inversión, y lo que sencillamente no se gastó.',
  },
]

/**
 * A qué grupo va cada categoría de gasto.
 *
 * Criterio: necesidad es lo que, si dejas de pagarlo, te cambia la vida en
 * semanas —te quedas sin techo, sin luz, sin cómo llegar al trabajo, sin
 * medicinas— o lo que ya firmaste y no puedes dejar de pagar. Deseo es todo lo
 * demás que se consume. Ahorro es lo que sigue siendo tuyo después de moverlo.
 *
 * Tres decisiones que no son obvias y conviene dejar escritas:
 *
 *  · Mercado es necesidad y restaurantes es deseo. Comer hay que comer; comer
 *    fuera es una elección, y es justo la que más se desmadra sin que nadie se
 *    dé cuenta.
 *  · Las cuotas de tarjeta y de préstamo son necesidad. No porque comprar a
 *    cuotas lo fuera, sino porque a estas alturas ya no se puede no pagarlas.
 *  · Lo que prestas a alguien es ahorro, no gasto. Sale de la cuenta pero
 *    sigue siendo tuyo; contarlo como consumo castigaría a quien ayuda.
 */
export const GRUPO_POR_CATEGORIA: Record<string, Grupo> = {
  // Necesidades
  market: 'necesidades', transport: 'necesidades', fuel: 'necesidades', transit: 'necesidades',
  tolls: 'necesidades', 'car-service': 'necesidades', 'car-fees': 'necesidades', parking: 'necesidades',
  home: 'necesidades', utilities: 'necesidades', internet: 'necesidades', phone: 'necesidades',
  repairs: 'necesidades', water: 'necesidades', gas: 'necesidades', 'admin-fee': 'necesidades',
  cleaning: 'necesidades', laundry: 'necesidades', health: 'necesidades', pharmacy: 'necesidades',
  insurance: 'necesidades', dentist: 'necesidades', optics: 'necesidades', therapy: 'necesidades',
  education: 'necesidades', kids: 'necesidades', family: 'necesidades', legal: 'necesidades',
  taxes: 'necesidades', fees: 'necesidades', interest: 'necesidades', 'loan-payment': 'necesidades',
  installment: 'necesidades', 'work-expense': 'necesidades', shipping: 'necesidades',

  // Deseos
  food: 'deseos', delivery: 'deseos', coffee: 'deseos', drinks: 'deseos', snacks: 'deseos',
  bakery: 'deseos', tips: 'deseos', taxi: 'deseos', fun: 'deseos', cinema: 'deseos', games: 'deseos',
  events: 'deseos', travel: 'deseos', hotel: 'deseos', subs: 'deseos', sports: 'deseos',
  music: 'deseos', hobbies: 'deseos', shopping: 'deseos', clothes: 'deseos', tech: 'deseos',
  gifts: 'deseos', pets: 'deseos', shoes: 'deseos', tools: 'deseos', beauty: 'deseos',
  gym: 'deseos', books: 'deseos', courses: 'deseos', languages: 'deseos', donation: 'deseos',
  furniture: 'deseos', other: 'deseos',

  // Ahorro e inversión
  'to-savings': 'ahorro', 'to-investment': 'ahorro', 'loan-given': 'ahorro',
}

/**
 * El retiro en cajero no tiene grupo, y es a propósito.
 *
 * Sacar plata del cajero no es gastarla: es cambiarla de sitio. Contarlo como
 * consumo duplicaría todo lo que luego se pague en efectivo y se registre
 * aparte, y no contarlo deja fuera lo que nunca se registró. Se excluye del
 * reparto y se dice cuánto quedó fuera, que es lo único honesto.
 */
export const SIN_GRUPO = new Set(['withdrawal', 'transfer'])

const CLAVE_AJUSTES = 'eftm.salud.grupos'

/**
 * Reclasificaciones hechas por el usuario.
 *
 * En el dispositivo y no en la cuenta: es una preferencia de lectura, no un
 * dato financiero. Si se pierde al cambiar de teléfono vuelve el reparto por
 * defecto y ninguna cifra de dinero cambia —solo de qué color se pinta—, que
 * es un precio pequeño a cambio de no meter una tabla más.
 */
export function leerAjustes(): Record<string, Grupo> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CLAVE_AJUSTES)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function guardarAjuste(categoryId: string, grupo: Grupo | null) {
  try {
    const ajustes = leerAjustes()
    if (grupo) ajustes[categoryId] = grupo
    else delete ajustes[categoryId]
    localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes))
  } catch { /* storage bloqueado */ }
}

/** El grupo de una categoría, contando lo que el usuario haya cambiado. */
export function grupoDe(categoryId: string, ajustes: Record<string, Grupo> = {}): Grupo | null {
  if (SIN_GRUPO.has(categoryId)) return null
  return ajustes[categoryId] ?? GRUPO_POR_CATEGORIA[categoryId] ?? 'deseos'
}

/** Las categorías de gasto agrupadas, para la pantalla de ajustes del reparto. */
export function categoriasPorGrupo(ajustes: Record<string, Grupo> = {}) {
  const mapa: Record<Grupo, typeof DEFAULT_CATEGORIES> = { necesidades: [], deseos: [], ahorro: [] }
  for (const c of DEFAULT_CATEGORIES) {
    if (c.kind !== 'expense') continue
    const g = grupoDe(c.id, ajustes)
    if (g) mapa[g].push(c)
  }
  return mapa
}

export interface ParteGrupo {
  grupo: Grupo
  /** Lo gastado en el grupo, en pesos. */
  monto: number
  /** Qué porcentaje de los ingresos se llevó. */
  porcentaje: number
  /** Lo que la regla recomienda: 50, 30 o 20. */
  objetivo: number
  /** Cuánto se pasa (positivo) o cuánto le falta (negativo) respecto al objetivo, en pesos. */
  desvio: number
  /** Las categorías que más pesan dentro del grupo. */
  detalle: { categoryId: string; monto: number }[]
}

export interface Reparto {
  /** Los ingresos del período: la base sobre la que se reparte. */
  ingresos: number
  partes: Record<Grupo, ParteGrupo>
  /** Lo que se gastó en total, sin contar lo que se apartó. */
  gastado: number
  /** Retiros en efectivo y demás, que no entran en el reparto. */
  sinClasificar: number
  /** Sin ingresos registrados no hay porcentajes posibles. */
  vacio: boolean
}

/**
 * El reparto de un período.
 *
 * El ahorro incluye lo que sencillamente no se gastó, y esa decisión cambia el
 * resultado: sin ella, quien vive muy por debajo de sus medios pero deja el
 * dinero quieto en la cuenta —sin moverlo a ningún ahorro— aparecería con un
 * 0 % de ahorro y un aviso rojo, que es exactamente al revés de lo que está
 * haciendo. Lo que no se gastó es ahorro, esté donde esté.
 */
export function repartir(
  transacciones: Transaction[],
  fxRate: number,
  ajustes: Record<string, Grupo> = {},
): Reparto {
  const enPesos = (t: Transaction) =>
    t.currency === 'USD'
      // Con la tasa del día del movimiento si se guardó: la del gasto de marzo
      // es la de marzo, no la de hoy.
      ? (t.fxRate && t.fxRate > 0 ? t.amount * t.fxRate : fxRate > 0 ? t.amount * fxRate : 0)
      : t.amount

  let ingresos = 0
  let gastado = 0
  let sinClasificar = 0
  const montos: Record<Grupo, number> = { necesidades: 0, deseos: 0, ahorro: 0 }
  const detalles: Record<Grupo, Map<string, number>> = {
    necesidades: new Map(), deseos: new Map(), ahorro: new Map(),
  }

  for (const t of transacciones) {
    const v = enPesos(t)
    if (!v) continue
    if (t.type === 'income') {
      // Un préstamo recibido no es ingreso: es deuda que entra hoy y sale
      // después. Meterlo en la base haría parecer que se ahorra el mes en que
      // alguien te presta.
      if (t.categoryId === 'loan-income') continue
      ingresos += v
      continue
    }
    if (t.type !== 'expense') continue

    const g = grupoDe(t.categoryId, ajustes)
    if (!g) { sinClasificar += v; continue }
    gastado += v
    montos[g] += v
    detalles[g].set(t.categoryId, (detalles[g].get(t.categoryId) ?? 0) + v)
  }

  // Lo que entró y no se gastó también es ahorro. Nunca negativo: gastar más
  // de lo que entra no es «ahorro negativo», es endeudarse, y eso se ve en el
  // exceso de los otros dos grupos.
  const sobrante = Math.max(0, ingresos - gastado)
  montos.ahorro += sobrante
  if (sobrante > 0) detalles.ahorro.set('__sobrante', sobrante)

  const partes = {} as Record<Grupo, ParteGrupo>
  for (const g of GRUPOS) {
    const monto = montos[g.id]
    partes[g.id] = {
      grupo: g.id,
      monto,
      porcentaje: ingresos > 0 ? (monto / ingresos) * 100 : 0,
      objetivo: g.objetivo,
      desvio: monto - ingresos * (g.objetivo / 100),
      detalle: [...detalles[g.id].entries()]
        .map(([categoryId, m]) => ({ categoryId, monto: m }))
        .sort((a, b) => b.monto - a.monto),
    }
  }

  return { ingresos, partes, gastado, sinClasificar, vacio: ingresos <= 0 }
}

export interface Indicador {
  id: string
  nombre: string
  /** De 0 a 100. */
  puntos: number
  /** La cifra en bruto, ya formateada por quien la pinta. */
  valor: number
  /** Qué significa la cifra, en una frase. */
  lectura: string
  /** Qué hacer, si hay algo que hacer. */
  consejo?: string
}

export interface SaludFinanciera {
  /** De 0 a 100, la media ponderada de los indicadores. */
  puntaje: number
  nivel: 'frágil' | 'ajustada' | 'estable' | 'sólida'
  indicadores: Indicador[]
}

/** Interpola entre dos puntos: por debajo de `malo` son 0, por encima de `bueno` son 100. */
const escala = (v: number, malo: number, bueno: number) => {
  if (bueno === malo) return 50
  const t = (v - malo) / (bueno - malo)
  return Math.max(0, Math.min(100, Math.round(t * 100)))
}

export interface EntradaSalud {
  reparto: Reparto
  /** Saldo líquido de hoy, en pesos. */
  liquido: number
  /** Gasto mensual medio de los últimos meses, en pesos. */
  gastoMensual: number
  /** Lo que se debe a personas y en tarjetas, en pesos. */
  deuda: number
  /** Lo que se paga al mes por deudas y cuotas, en pesos. */
  cuotasMensuales: number
  /** Coste mensual de las suscripciones, en pesos. */
  suscripciones: number
}

/**
 * Cinco indicadores y un puntaje.
 *
 * Cada uno responde a una pregunta distinta y por eso se enseñan por separado
 * además de en el total: un puntaje de 62 no dice qué arreglar, y «tienes mes
 * y medio de colchón» sí.
 *
 * Los pesos no son iguales a propósito. El colchón de emergencia pesa más que
 * el resto porque es lo que decide si un imprevisto es un mal rato o una
 * deuda; la tasa de ahorro pesa lo mismo porque es lo único que construye el
 * colchón. El reparto 50/30/20 pesa menos: es una guía, no una meta.
 */
export function evaluarSalud(e: EntradaSalud): SaludFinanciera {
  const { reparto, liquido, gastoMensual, deuda, cuotasMensuales, suscripciones } = e
  const ingresos = reparto.ingresos

  const mesesDeColchon = gastoMensual > 0 ? liquido / gastoMensual : liquido > 0 ? 6 : 0
  const tasaAhorro = ingresos > 0 ? (reparto.partes.ahorro.monto / ingresos) * 100 : 0
  const cargaDeuda = ingresos > 0 ? (cuotasMensuales / ingresos) * 100 : 0
  const pesoSubs = ingresos > 0 ? (suscripciones / ingresos) * 100 : 0
  const excesoDeseos = reparto.partes.deseos.porcentaje

  const indicadores: Indicador[] = [
    {
      id: 'colchon',
      nombre: 'Colchón de emergencia',
      // Tres meses es el consejo clásico y seis el objetivo cómodo. Por debajo
      // de uno, cualquier imprevisto se paga con tarjeta.
      puntos: escala(mesesDeColchon, 0, 6),
      valor: mesesDeColchon,
      lectura: mesesDeColchon >= 6
        ? 'Tienes medio año de gastos cubierto sin tocar nada más.'
        : mesesDeColchon >= 3
          ? `Cubres ${mesesDeColchon.toFixed(1)} meses de gastos con lo líquido.`
          : mesesDeColchon >= 1
            ? `Solo cubres ${mesesDeColchon.toFixed(1)} meses. Un imprevisto grande iría a la tarjeta.`
            : 'Menos de un mes cubierto: hoy cualquier imprevisto es deuda.',
      consejo: mesesDeColchon < 3 ? 'Antes que invertir, llegar a tres meses de gastos en una cuenta que rinda.' : undefined,
    },
    {
      id: 'ahorro',
      nombre: 'Tasa de ahorro',
      puntos: escala(tasaAhorro, 0, 20),
      valor: tasaAhorro,
      lectura: ingresos > 0
        ? `Apartas el ${tasaAhorro.toFixed(0)} % de lo que entra.`
        : 'Sin ingresos registrados en el período.',
      consejo: tasaAhorro < 10 && ingresos > 0 ? 'Subir un punto al mes es más sostenible que un recorte de golpe.' : undefined,
    },
    {
      id: 'deuda',
      nombre: 'Carga de deuda',
      // La regla del 36 % es la que usan los bancos para prestar; por encima
      // del 40 % el sueldo ya está comprometido antes de llegar.
      puntos: escala(cargaDeuda, 40, 0),
      valor: cargaDeuda,
      lectura: cuotasMensuales > 0
        ? `Las cuotas se llevan el ${cargaDeuda.toFixed(0)} % de lo que entra.`
        : 'No tienes cuotas comprometidas.',
      consejo: cargaDeuda > 30 ? 'Por encima del 30 % el mes empieza a decidirse solo. Vale la pena atacar la deuda más cara primero.' : undefined,
    },
    {
      id: 'deseos',
      nombre: 'Gasto prescindible',
      puntos: escala(excesoDeseos, 50, 20),
      valor: excesoDeseos,
      lectura: ingresos > 0
        ? `Los deseos se llevan el ${excesoDeseos.toFixed(0)} % frente al 30 % de la regla.`
        : 'Sin ingresos registrados no hay porcentaje que calcular.',
      consejo: excesoDeseos > 40 ? 'Mirar las tres categorías de arriba del grupo suele bastar: ahí está casi todo.' : undefined,
    },
    {
      id: 'suscripciones',
      nombre: 'Peso de lo recurrente',
      // Por encima del 10 % de lo que entra, lo que se cobra solo manda sobre
      // el presupuesto más que las decisiones del mes.
      puntos: escala(pesoSubs, 15, 2),
      valor: pesoSubs,
      lectura: suscripciones > 0
        ? `Lo que se cobra solo es el ${pesoSubs.toFixed(1)} % de lo que entra.`
        : 'No tienes suscripciones activas.',
      consejo: pesoSubs > 8 ? 'Revisa las que no hayas abierto este mes: son las que nadie cancela.' : undefined,
    },
  ]

  const pesos: Record<string, number> = {
    colchon: 0.3, ahorro: 0.3, deuda: 0.2, deseos: 0.12, suscripciones: 0.08,
  }
  const puntaje = Math.round(
    indicadores.reduce((s, i) => s + i.puntos * (pesos[i.id] ?? 0), 0),
  )

  const nivel: SaludFinanciera['nivel'] =
    puntaje >= 80 ? 'sólida' : puntaje >= 60 ? 'estable' : puntaje >= 40 ? 'ajustada' : 'frágil'

  return { puntaje, nivel, indicadores }
}
