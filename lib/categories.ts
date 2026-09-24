import type { Category } from './types'
import { espacioActual, type Espacio } from './espacio'

/**
 * Categorías por defecto. Los nombres de iconos corresponden a lucide-react
 * y se resuelven en components/ui/category-icon.tsx.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  // ---- Gastos: día a día ---------------------------------------------------
  { id: 'food', name: 'Restaurantes', icon: 'UtensilsCrossed', color: '#FF9F0A', kind: 'expense', group: 'Diario' , espacio: 'personal' },
  { id: 'market', name: 'Mercado', icon: 'ShoppingCart', color: '#30D158', kind: 'expense', group: 'Diario' , espacio: 'personal' },
  { id: 'delivery', name: 'Domicilios', icon: 'Bike', color: '#FF6B35', kind: 'expense', group: 'Diario' , espacio: 'personal' },
  { id: 'coffee', name: 'Café', icon: 'Coffee', color: '#A0785A', kind: 'expense', group: 'Diario' , espacio: 'personal' },
  { id: 'drinks', name: 'Bares', icon: 'Wine', color: '#C2407A', kind: 'expense', group: 'Diario' , espacio: 'personal' },
  { id: 'snacks', name: 'Mecato', icon: 'Cookie', color: '#E0A458', kind: 'expense', group: 'Diario' , espacio: 'personal' },
  { id: 'bakery', name: 'Panadería', icon: 'Croissant', color: '#D6A75E', kind: 'expense', group: 'Diario' , espacio: 'personal' },
  { id: 'tips', name: 'Propinas', icon: 'Coins', color: '#FFD60A', kind: 'expense', group: 'Diario' , espacio: 'personal' },

  // ---- Gastos: transporte --------------------------------------------------
  { id: 'transport', name: 'Transporte', icon: 'Car', color: '#0A84FF', kind: 'expense', group: 'Transporte' },
  { id: 'fuel', name: 'Gasolina', icon: 'Fuel', color: '#FF453A', kind: 'expense', group: 'Transporte' },
  { id: 'parking', name: 'Parqueadero', icon: 'SquareParking', color: '#5E9BD6', kind: 'expense', group: 'Transporte' },
  { id: 'transit', name: 'Transporte público', icon: 'TrainFront', color: '#40C8E0', kind: 'expense', group: 'Transporte' },
  { id: 'taxi', name: 'Taxi y apps', icon: 'CarTaxiFront', color: '#FFD60A', kind: 'expense', group: 'Transporte' },
  { id: 'tolls', name: 'Peajes', icon: 'Milestone', color: '#98989F', kind: 'expense', group: 'Transporte' },
  { id: 'car-service', name: 'Mantenimiento', icon: 'Cog', color: '#8E8E93', kind: 'expense', group: 'Transporte' },
  { id: 'car-fees', name: 'Impuestos y SOAT', icon: 'FileText', color: '#5E9BD6', kind: 'expense', group: 'Transporte' },

  // ---- Gastos: hogar -------------------------------------------------------
  { id: 'home', name: 'Arriendo', icon: 'House', color: '#BF5AF2', kind: 'expense', group: 'Hogar' , espacio: 'personal' },
  { id: 'utilities', name: 'Servicios públicos', icon: 'Zap', color: '#FFD60A', kind: 'expense', group: 'Hogar' , grupoNegocio: 'Operación' },
  { id: 'internet', name: 'Internet', icon: 'Wifi', color: '#5E5CE6', kind: 'expense', group: 'Hogar' , grupoNegocio: 'Operación' },
  { id: 'phone', name: 'Celular', icon: 'Smartphone', color: '#64D2FF', kind: 'expense', group: 'Hogar' , grupoNegocio: 'Operación' },
  { id: 'repairs', name: 'Reparaciones', icon: 'Wrench', color: '#8E8E93', kind: 'expense', group: 'Hogar' , grupoNegocio: 'Operación' },
  { id: 'water', name: 'Agua', icon: 'Droplet', color: '#64D2FF', kind: 'expense', group: 'Hogar' , grupoNegocio: 'Operación' },
  { id: 'gas', name: 'Gas', icon: 'Flame', color: '#FF9F0A', kind: 'expense', group: 'Hogar' , grupoNegocio: 'Operación' },
  { id: 'admin-fee', name: 'Administración', icon: 'Building', color: '#BF5AF2', kind: 'expense', group: 'Hogar' , grupoNegocio: 'Operación' },
  { id: 'cleaning', name: 'Aseo', icon: 'SprayCan', color: '#40C8E0', kind: 'expense', group: 'Hogar' , grupoNegocio: 'Operación' },
  { id: 'furniture', name: 'Muebles', icon: 'Sofa', color: '#AC8E68', kind: 'expense', group: 'Hogar' , grupoNegocio: 'Operación' },
  { id: 'laundry', name: 'Lavandería', icon: 'WashingMachine', color: '#5AC8FA', kind: 'expense', group: 'Hogar' , espacio: 'personal' },

  // ---- Gastos: salud -------------------------------------------------------
  { id: 'health', name: 'Salud', icon: 'HeartPulse', color: '#FF375F', kind: 'expense', group: 'Salud' , espacio: 'personal' },
  { id: 'pharmacy', name: 'Farmacia', icon: 'Pill', color: '#FF6482', kind: 'expense', group: 'Salud' , espacio: 'personal' },
  { id: 'gym', name: 'Gimnasio', icon: 'Dumbbell', color: '#32D74B', kind: 'expense', group: 'Salud' , espacio: 'personal' },
  { id: 'insurance', name: 'Seguros', icon: 'ShieldCheck', color: '#0A84FF', kind: 'expense', group: 'Salud' , grupoNegocio: 'Financiero' },
  { id: 'beauty', name: 'Cuidado personal', icon: 'Scissors', color: '#FF9AC1', kind: 'expense', group: 'Salud' , espacio: 'personal' },
  { id: 'dentist', name: 'Odontología', icon: 'Stethoscope', color: '#5AC8FA', kind: 'expense', group: 'Salud' , espacio: 'personal' },
  { id: 'optics', name: 'Óptica', icon: 'Glasses', color: '#98989F', kind: 'expense', group: 'Salud' , espacio: 'personal' },
  { id: 'therapy', name: 'Terapia', icon: 'Brain', color: '#BF5AF2', kind: 'expense', group: 'Salud' , espacio: 'personal' },

  // ---- Gastos: ocio --------------------------------------------------------
  { id: 'fun', name: 'Ocio', icon: 'Clapperboard', color: '#5E5CE6', kind: 'expense', group: 'Ocio' , espacio: 'personal' },
  { id: 'cinema', name: 'Cine', icon: 'Popcorn', color: '#FF9F0A', kind: 'expense', group: 'Ocio' , espacio: 'personal' },
  { id: 'games', name: 'Videojuegos', icon: 'Gamepad2', color: '#BF5AF2', kind: 'expense', group: 'Ocio' , espacio: 'personal' },
  { id: 'events', name: 'Eventos', icon: 'Ticket', color: '#FF375F', kind: 'expense', group: 'Ocio' , espacio: 'personal' },
  { id: 'travel', name: 'Viajes', icon: 'Plane', color: '#40C8E0', kind: 'expense', group: 'Ocio' , grupoNegocio: 'Operación' },
  { id: 'hotel', name: 'Hoteles', icon: 'Hotel', color: '#5AC8FA', kind: 'expense', group: 'Ocio' , grupoNegocio: 'Operación' },
  { id: 'subs', name: 'Suscripciones', icon: 'Repeat', color: '#40C8E0', kind: 'expense', group: 'Ocio' , grupoNegocio: 'Operación' },
  { id: 'sports', name: 'Deportes', icon: 'Volleyball', color: '#32D74B', kind: 'expense', group: 'Ocio' , espacio: 'personal' },
  { id: 'music', name: 'Música', icon: 'Music', color: '#FF375F', kind: 'expense', group: 'Ocio' , espacio: 'personal' },
  { id: 'hobbies', name: 'Pasatiempos', icon: 'Palette', color: '#FF9F0A', kind: 'expense', group: 'Ocio' , espacio: 'personal' },

  // ---- Gastos: compras -----------------------------------------------------
  { id: 'shopping', name: 'Compras', icon: 'ShoppingBag', color: '#FF453A', kind: 'expense', group: 'Compras' , espacio: 'personal' },
  { id: 'clothes', name: 'Ropa', icon: 'Shirt', color: '#FF6B9D', kind: 'expense', group: 'Compras' , espacio: 'personal' },
  { id: 'tech', name: 'Tecnología', icon: 'Laptop', color: '#8E8E93', kind: 'expense', group: 'Compras' , grupoNegocio: 'Operación' },
  { id: 'gifts', name: 'Regalos', icon: 'Gift', color: '#FF375F', kind: 'expense', group: 'Compras' , espacio: 'personal' },
  { id: 'pets', name: 'Mascotas', icon: 'PawPrint', color: '#AC8E68', kind: 'expense', group: 'Compras' , espacio: 'personal' },
  { id: 'shoes', name: 'Calzado', icon: 'Footprints', color: '#C2407A', kind: 'expense', group: 'Compras' , espacio: 'personal' },
  { id: 'kids', name: 'Niños', icon: 'Baby', color: '#FF9AC1', kind: 'expense', group: 'Compras' , espacio: 'personal' },
  { id: 'tools', name: 'Herramientas', icon: 'Hammer', color: '#8E8E93', kind: 'expense', group: 'Compras' , grupoNegocio: 'Operación' },

  // ---- Gastos: formación ---------------------------------------------------
  { id: 'education', name: 'Educación', icon: 'GraduationCap', color: '#FFD60A', kind: 'expense', group: 'Formación' , espacio: 'personal' },
  { id: 'books', name: 'Libros', icon: 'BookOpen', color: '#D6A75E', kind: 'expense', group: 'Formación' },
  { id: 'courses', name: 'Cursos', icon: 'MonitorPlay', color: '#0A84FF', kind: 'expense', group: 'Formación' },
  { id: 'languages', name: 'Idiomas', icon: 'Languages', color: '#40C8E0', kind: 'expense', group: 'Formación' , espacio: 'personal' },

  // ---- Gastos: personas y trámites -----------------------------------------
  { id: 'family', name: 'Familia', icon: 'Users', color: '#FF375F', kind: 'expense', group: 'Personas' , espacio: 'personal' },
  { id: 'legal', name: 'Trámites', icon: 'Stamp', color: '#98989F', kind: 'expense', group: 'Personas' , grupoNegocio: 'Financiero' },
  { id: 'shipping', name: 'Envíos', icon: 'Package', color: '#FF6B35', kind: 'expense', group: 'Personas' , grupoNegocio: 'Operación' },
  { id: 'work-expense', name: 'Gastos de trabajo', icon: 'Briefcase', color: '#0A84FF', kind: 'expense', group: 'Personas' , espacio: 'personal' },

  // ---- Gastos: financiero --------------------------------------------------
  { id: 'fees', name: 'Comisiones', icon: 'Receipt', color: '#8E8E93', kind: 'expense', group: 'Financiero' },
  { id: 'interest', name: 'Intereses', icon: 'Percent', color: '#FF453A', kind: 'expense', group: 'Financiero' },
  { id: 'taxes', name: 'Impuestos', icon: 'Landmark', color: '#98989F', kind: 'expense', group: 'Financiero' },
  { id: 'installment', name: 'Cuota tarjeta', icon: 'CreditCard', color: '#FF9F0A', kind: 'expense', group: 'Financiero' },
  { id: 'donation', name: 'Donaciones', icon: 'HandCoins', color: '#32D74B', kind: 'expense', group: 'Financiero' },
  { id: 'loan-payment', name: 'Cuota de préstamo', icon: 'Banknote', color: '#FF453A', kind: 'expense', group: 'Financiero' },
  // Plata que prestaste: sale de la cuenta pero no se gastó, va a volver.
  { id: 'loan-given', name: 'Préstamo a alguien', icon: 'HandCoins', color: '#FF9F0A', kind: 'expense', group: 'Financiero' },
  { id: 'to-savings', name: 'Paso a ahorro', icon: 'PiggyBank', color: '#30D158', kind: 'expense', group: 'Financiero' },
  { id: 'to-investment', name: 'Paso a inversión', icon: 'TrendingUp', color: '#BF5AF2', kind: 'expense', group: 'Financiero' },
  { id: 'withdrawal', name: 'Retiro en cajero', icon: 'Landmark', color: '#8E8E93', kind: 'expense', group: 'Financiero' },
  { id: 'other', name: 'Otros', icon: 'Ellipsis', color: '#98989F', kind: 'expense', group: 'Financiero' },

  // ---- Gastos: solo del negocio ---------------------------------------------
  // Lo que una persona no gasta y un negocio sí, todos los meses. Con las
  // compartidas de arriba —transporte, servicios, impuestos, comisiones— cubren
  // la caja de un negocio pequeño sin enseñarle «Mecato» ni «Mascotas».
  { id: 'biz-suppliers', name: 'Proveedores', icon: 'Truck', color: '#FF9F0A', kind: 'expense', group: 'Operación', espacio: 'negocio' },
  { id: 'biz-inventory', name: 'Inventario', icon: 'Boxes', color: '#AC8E68', kind: 'expense', group: 'Operación', espacio: 'negocio' },
  { id: 'biz-rent', name: 'Arriendo del local', icon: 'Store', color: '#BF5AF2', kind: 'expense', group: 'Operación', espacio: 'negocio' },
  { id: 'biz-marketing', name: 'Publicidad', icon: 'Megaphone', color: '#FF375F', kind: 'expense', group: 'Operación', espacio: 'negocio' },
  { id: 'biz-software', name: 'Software', icon: 'MonitorPlay', color: '#5E5CE6', kind: 'expense', group: 'Operación', espacio: 'negocio' },
  { id: 'biz-payroll', name: 'Nómina', icon: 'Users', color: '#30D158', kind: 'expense', group: 'Equipo', espacio: 'negocio' },
  // Salud, pensión, ARL y parafiscales: van aparte de la nómina porque se
  // pagan en otra fecha —la PILA— y es la cifra que más sorprende.
  { id: 'biz-social', name: 'Seguridad social', icon: 'ShieldCheck', color: '#0A84FF', kind: 'expense', group: 'Equipo', espacio: 'negocio' },
  // El contador, el abogado, el diseñador por proyecto.
  { id: 'biz-fees-pro', name: 'Honorarios', icon: 'Briefcase', color: '#64D2FF', kind: 'expense', group: 'Equipo', espacio: 'negocio' },
  { id: 'biz-iva', name: 'IVA', icon: 'Landmark', color: '#98989F', kind: 'expense', group: 'Impuestos', espacio: 'negocio' },
  { id: 'biz-retention', name: 'Retención en la fuente', icon: 'Receipt', color: '#8E8E93', kind: 'expense', group: 'Impuestos', espacio: 'negocio' },
  { id: 'biz-ica', name: 'ICA', icon: 'Building2', color: '#5E9BD6', kind: 'expense', group: 'Impuestos', espacio: 'negocio' },
  // Lo que el dueño saca para sí. Sale de la caja pero no es un gasto del
  // negocio: contarlo como tal hace parecer que el negocio pierde plata cuando
  // lo que pasa es que el dueño se está pagando.
  { id: 'biz-owner-draw', name: 'Retiro del dueño', icon: 'HandCoins', color: '#FFD60A', kind: 'expense', group: 'Socios', espacio: 'negocio' },

  // ---- Interna: no se ofrece en ningún selector ----------------------------
  { id: 'transfer', name: 'Transferencia', icon: 'ArrowLeftRight', color: '#64D2FF', kind: 'transfer', group: 'Financiero' },

  // ---- Ingresos ------------------------------------------------------------
  { id: 'salary', name: 'Salario', icon: 'Wallet', color: '#30D158', kind: 'income', group: 'Trabajo' , espacio: 'personal' },
  { id: 'freelance', name: 'Freelance', icon: 'Briefcase', color: '#0A84FF', kind: 'income', group: 'Trabajo' , espacio: 'personal' },
  { id: 'bonus', name: 'Bonificación', icon: 'Award', color: '#FFD60A', kind: 'income', group: 'Trabajo' , espacio: 'personal' },
  { id: 'sales', name: 'Ventas', icon: 'Banknote', color: '#32D74B', kind: 'income', group: 'Trabajo' , grupoNegocio: 'Ventas' },
  { id: 'returns', name: 'Rendimientos', icon: 'TrendingUp', color: '#BF5AF2', kind: 'income', group: 'Inversión' },
  { id: 'cashback', name: 'Cashback', icon: 'BadgePercent', color: '#FF9F0A', kind: 'income', group: 'Inversión' },
  { id: 'dividends', name: 'Dividendos', icon: 'ChartPie', color: '#5E5CE6', kind: 'income', group: 'Inversión' },
  { id: 'rent-income', name: 'Arriendos', icon: 'Building2', color: '#40C8E0', kind: 'income', group: 'Inversión' },
  { id: 'refund', name: 'Reembolso', icon: 'Undo2', color: '#64D2FF', kind: 'income', group: 'Otros' },
  { id: 'gift-income', name: 'Regalo', icon: 'Gift', color: '#FF375F', kind: 'income', group: 'Otros' , espacio: 'personal' },
  // Loterías, apuestas, rifas. Categoría propia y no «Otros ingresos» porque
  // es lo único que no se puede proyectar de ninguna manera: sin separarlo, un
  // golpe de suerte se promedia con el sueldo y la proyección del año entero
  // se apoya en que vuelva a tocar. Ver `lib/ingresos.ts`.
  { id: 'gambling', name: 'Juegos y azar', icon: 'Dices', color: '#FFD60A', kind: 'income', group: 'Otros' , espacio: 'personal' },
  { id: 'loan-income', name: 'Préstamo recibido', icon: 'Banknote', color: '#FF9F0A', kind: 'income', group: 'Otros' },
  // Lo contrario: te devolvieron lo que prestaste. No es un ingreso nuevo,
  // es plata tuya que vuelve, y por eso tiene su propia categoría.
  { id: 'loan-repaid', name: 'Préstamo devuelto', icon: 'HandCoins', color: '#30D158', kind: 'income', group: 'Otros' },
  { id: 'from-savings', name: 'Retiro de ahorro', icon: 'PiggyBank', color: '#30D158', kind: 'income', group: 'Otros' },
  { id: 'other-income', name: 'Otros ingresos', icon: 'Ellipsis', color: '#98989F', kind: 'income', group: 'Otros' },

  // ---- Ingresos: solo del negocio ------------------------------------------
  { id: 'biz-services', name: 'Servicios prestados', icon: 'Briefcase', color: '#0A84FF', kind: 'income', group: 'Ventas', espacio: 'negocio' },
  // Lo contrario del retiro: plata que ponen los socios. Entra en la caja,
  // pero no es una venta, y sumarla a las ventas inflaría lo que el negocio
  // gana.
  { id: 'biz-capital', name: 'Aporte de socios', icon: 'PiggyBank', color: '#30D158', kind: 'income', group: 'Socios', espacio: 'negocio' },
]

/** ¿Se ofrece esta categoría en el espacio abierto? */
export const esDelEspacio = (c: Category, espacio: Espacio) => !c.espacio || c.espacio === espacio

/**
 * Las categorías que se ofrecen para registrar, en el espacio abierto.
 *
 * Solo filtra lo que se OFRECE. Buscar una por su id (`categoryById`) sigue
 * encontrándolas todas: un movimiento viejo nunca se queda sin nombre.
 */
export function categoriasPara(kind: Category['kind'], espacio: Espacio = espacioActual()) {
  const lista = DEFAULT_CATEGORIES.filter((c) => c.kind === kind && esDelEspacio(c, espacio))
  // En el negocio van primero las suyas. La lista está declarada pensando en
  // una persona —transporte y mercado arriba— y sin esto la categoría por
  // defecto de un gasto del negocio era «Transporte» y no «Proveedores».
  // `sort` es estable: dentro de cada bloque se conserva el orden de arriba.
  return espacio === 'negocio'
    ? lista.sort((a, b) => Number(b.espacio === 'negocio') - Number(a.espacio === 'negocio'))
    : lista
}

/** Orden de los grupos en el negocio: primero lo que mueve la caja cada mes. */
const ORDEN_NEGOCIO = ['Operación', 'Equipo', 'Impuestos', 'Ventas', 'Socios', 'Transporte', 'Financiero', 'Formación']

/**
 * Categoría por id, con «Otros» de comodín.
 *
 * El comodín se nombra explícito y no se toma del final de la lista: bastaba
 * añadir una categoría nueva al final para que un id desconocido pasara a
 * mostrarse como lo que fuera que quedara de último —«Otros ingresos», por
 * ejemplo, para un gasto.
 */
const OTROS = DEFAULT_CATEGORIES.find((c) => c.id === 'other')!

export const categoryById = (id: string) =>
  DEFAULT_CATEGORIES.find((c) => c.id === id) ?? OTROS

/** Agrupa por `group` conservando el orden de declaración. */
export function categoriesByGroup(kind: 'expense' | 'income', espacio: Espacio = espacioActual()) {
  const map = new Map<string, Category[]>()
  // En el negocio, «Servicios públicos» no va bajo «Hogar».
  const grupo = (c: Category) => (espacio === 'negocio' && c.grupoNegocio) || c.group
  categoriasPara(kind, espacio).forEach((c) => {
    map.set(grupo(c), [...(map.get(grupo(c)) ?? []), c])
  })
  const grupos = [...map.entries()]
  if (espacio !== 'negocio') return grupos
  const lugar = (g: string) => (ORDEN_NEGOCIO.includes(g) ? ORDEN_NEGOCIO.indexOf(g) : ORDEN_NEGOCIO.length)
  return grupos.sort(([a], [b]) => lugar(a) - lugar(b))
}

export type InstitutionGroup = 'Banca tradicional' | 'Neobancos y billeteras' | 'Pagos' | 'Inversión y cripto' | 'Otros'

export interface Institution {
  name: string
  /** Agrupa el selector: con dos docenas, una lista plana no se navega. */
  group: InstitutionGroup
  /** Color de marca, usado como fondo del badge. */
  color: string
  /** Color del monograma. Blanco por defecto; se aclara en marcas claras. */
  fg?: string
  /** Monograma de 1-3 caracteres, usado cuando no hay logotipo. */
  short: string
  /** Archivo en /public/institutions. Si falta, se dibuja el monograma. */
  logo?: string
}

/**
 * Bancos, neobancos y apps financieras de uso común en Colombia.
 *
 * Se identifican por color de marca y monograma, no por el logotipo: los
 * logos son marcas registradas y habría que empaquetar cada archivo. El
 * monograma sobre el color correcto se reconoce de un vistazo y es lo que
 * hace Apple Wallet cuando no tiene el arte de la tarjeta.
 */
export const CO_INSTITUTIONS: Institution[] = [
  // Banca tradicional
  { name: 'Banco de Bogotá', group: 'Banca tradicional', color: '#00489A', short: 'BdB', logo: 'banco-bogota' },
  { name: 'Bancolombia', group: 'Banca tradicional', color: '#FDDA24', fg: '#1A1A1A', short: 'BC', logo: 'bancolombia' },
  { name: 'BBVA', group: 'Banca tradicional', color: '#004481', short: 'BB', logo: 'bbva' },
  { name: 'DaviBank', group: 'Banca tradicional', color: '#E30613', short: 'DB', logo: 'davibank' },
  { name: 'Davivienda', group: 'Banca tradicional', color: '#ED1C24', short: 'DV', logo: 'davivienda' },

  // Neobancos y billeteras
  { name: 'Dale!', group: 'Neobancos y billeteras', color: '#10395E', short: 'd!', logo: 'dale' },
  { name: 'Daviplata', group: 'Neobancos y billeteras', color: '#ED1C24', short: 'DP', logo: 'daviplata' },
  { name: 'Lulo Bank', group: 'Neobancos y billeteras', color: '#00D1B0', fg: '#0A2B26', short: 'LB', logo: 'lulo' },
  { name: 'Nequi', group: 'Neobancos y billeteras', color: '#DA0081', short: 'N', logo: 'nequi' },
  { name: 'Nu', group: 'Neobancos y billeteras', color: '#820AD1', short: 'nu', logo: 'nu' },
  { name: 'Ualá', group: 'Neobancos y billeteras', color: '#F2F2F7', fg: '#1B1B4B', short: 'uá', logo: 'uala' },

  // Pagos
  { name: 'Bold', group: 'Pagos', color: '#4B21C9', short: 'B', logo: 'bold' },
  { name: 'RappiCard', group: 'Pagos', color: '#141414', short: 'RC', logo: 'rappicard' },
  { name: 'RappiCuenta', group: 'Pagos', color: '#FF441F', short: 'RC', logo: 'rappi' },

  // Inversión y cripto
  { name: 'ARQ', group: 'Inversión y cripto', color: '#EFEDE3', fg: '#141414', short: 'ARQ', logo: 'arq' },
  { name: 'Insights', group: 'Inversión y cripto', color: '#141414', fg: '#C6F432', short: 'In', logo: 'insights' },
  { name: 'Lemon Cash', group: 'Inversión y cripto', color: '#0FD65C', fg: '#0A2B14', short: 'LC', logo: 'lemon-cash' },
  { name: 'Littio', group: 'Inversión y cripto', color: '#1B2A4A', short: 'Li', logo: 'littio' },
  { name: 'Trii', group: 'Inversión y cripto', color: '#00A868', short: 'tr', logo: 'trii' },
  { name: 'Tyba', group: 'Inversión y cripto', color: '#116466', short: 'ty', logo: 'tyba' },
  { name: 'Uphold', group: 'Inversión y cripto', color: '#49CC68', fg: '#0A2B14', short: 'U', logo: 'uphold' },

  // Otros
  { name: 'Efectivo', group: 'Otros', color: '#30D158', fg: '#0A2B14', short: '$', logo: 'efectivo' },
]

/** Orden de los grupos en el selector; dentro de cada uno, alfabético. */
export const INSTITUTION_GROUPS: InstitutionGroup[] =
  ['Banca tradicional', 'Neobancos y billeteras', 'Pagos', 'Inversión y cripto', 'Otros']

export function institutionsByGroup() {
  return INSTITUTION_GROUPS
    .map((g) => [g, CO_INSTITUTIONS
      .filter((i) => i.group === g)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))] as const)
    .filter(([, items]) => items.length > 0)
}

/**
 * Nombres que una entidad tuvo antes y que siguen guardados en cuentas.
 *
 * La lista de arriba es la verdad de hoy, pero el nombre viejo está escrito
 * dentro de cuentas y movimientos ya creados. Sin esta tabla, renombrar
 * «RappiPay» a «RappiCuenta» —que es la misma cuenta, solo que Rappi la llama
 * así— dejaba esas cuentas sin logotipo y sin color de un día para otro.
 *
 * Traducir al leer y no migrar los datos es a propósito: no hay que tocar
 * filas de nadie, y una cuenta creada hace meses se arregla sola al pintarse.
 */
const ALIAS: Record<string, string> = {
  RappiPay: 'RappiCuenta',
}

/** El nombre actual de una entidad, aunque se guardara con uno antiguo. */
export const institutionCanonicalName = (name: string) => ALIAS[name] ?? name

/** Busca una entidad por nombre; útil para reconstruir el badge desde una cuenta. */
export const institutionByName = (name: string) =>
  CO_INSTITUTIONS.find((i) => i.name === institutionCanonicalName(name))

/**
 * Plataformas donde se registran inversiones, en el orden en que se ofrecen.
 *
 * Es una lista cerrada y no se deriva de las cuentas que existan. Antes el
 * selector de plataforma ofrecía toda cuenta de ahorros o de inversión, así
 * que aparecían Nequi y Bancolombia —donde no se compran ETF— y faltaban las
 * corredoras para las que aún no se había creado una cuenta a mano.
 */
export const INVESTMENT_PLATFORMS = ['ARQ', 'Insights', 'Tyba', 'Trii'] as const

export const investmentPlatforms = () =>
  INVESTMENT_PLATFORMS.map((name) => institutionByName(name)).filter((i): i is Institution => Boolean(i))
