import type { Category } from './types'

/**
 * Categorías por defecto. Los nombres de iconos corresponden a lucide-react
 * y se resuelven en components/ui/category-icon.tsx.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  // ---- Gastos: día a día ---------------------------------------------------
  { id: 'food', name: 'Restaurantes', icon: 'UtensilsCrossed', color: '#FF9F0A', kind: 'expense', group: 'Diario' },
  { id: 'market', name: 'Mercado', icon: 'ShoppingCart', color: '#30D158', kind: 'expense', group: 'Diario' },
  { id: 'delivery', name: 'Domicilios', icon: 'Bike', color: '#FF6B35', kind: 'expense', group: 'Diario' },
  { id: 'coffee', name: 'Café', icon: 'Coffee', color: '#A0785A', kind: 'expense', group: 'Diario' },
  { id: 'drinks', name: 'Bares', icon: 'Wine', color: '#C2407A', kind: 'expense', group: 'Diario' },

  // ---- Gastos: transporte --------------------------------------------------
  { id: 'transport', name: 'Transporte', icon: 'Car', color: '#0A84FF', kind: 'expense', group: 'Transporte' },
  { id: 'fuel', name: 'Gasolina', icon: 'Fuel', color: '#FF453A', kind: 'expense', group: 'Transporte' },
  { id: 'parking', name: 'Parqueadero', icon: 'SquareParking', color: '#5E9BD6', kind: 'expense', group: 'Transporte' },
  { id: 'transit', name: 'Transporte público', icon: 'TrainFront', color: '#40C8E0', kind: 'expense', group: 'Transporte' },

  // ---- Gastos: hogar -------------------------------------------------------
  { id: 'home', name: 'Arriendo', icon: 'House', color: '#BF5AF2', kind: 'expense', group: 'Hogar' },
  { id: 'utilities', name: 'Servicios', icon: 'Zap', color: '#FFD60A', kind: 'expense', group: 'Hogar' },
  { id: 'internet', name: 'Internet', icon: 'Wifi', color: '#5E5CE6', kind: 'expense', group: 'Hogar' },
  { id: 'phone', name: 'Celular', icon: 'Smartphone', color: '#64D2FF', kind: 'expense', group: 'Hogar' },
  { id: 'repairs', name: 'Reparaciones', icon: 'Wrench', color: '#8E8E93', kind: 'expense', group: 'Hogar' },

  // ---- Gastos: salud -------------------------------------------------------
  { id: 'health', name: 'Salud', icon: 'HeartPulse', color: '#FF375F', kind: 'expense', group: 'Salud' },
  { id: 'pharmacy', name: 'Farmacia', icon: 'Pill', color: '#FF6482', kind: 'expense', group: 'Salud' },
  { id: 'gym', name: 'Gimnasio', icon: 'Dumbbell', color: '#32D74B', kind: 'expense', group: 'Salud' },
  { id: 'insurance', name: 'Seguros', icon: 'ShieldCheck', color: '#0A84FF', kind: 'expense', group: 'Salud' },
  { id: 'beauty', name: 'Cuidado personal', icon: 'Scissors', color: '#FF9AC1', kind: 'expense', group: 'Salud' },

  // ---- Gastos: ocio --------------------------------------------------------
  { id: 'fun', name: 'Ocio', icon: 'Clapperboard', color: '#5E5CE6', kind: 'expense', group: 'Ocio' },
  { id: 'cinema', name: 'Cine', icon: 'Popcorn', color: '#FF9F0A', kind: 'expense', group: 'Ocio' },
  { id: 'games', name: 'Videojuegos', icon: 'Gamepad2', color: '#BF5AF2', kind: 'expense', group: 'Ocio' },
  { id: 'events', name: 'Eventos', icon: 'Ticket', color: '#FF375F', kind: 'expense', group: 'Ocio' },
  { id: 'travel', name: 'Viajes', icon: 'Plane', color: '#40C8E0', kind: 'expense', group: 'Ocio' },
  { id: 'hotel', name: 'Hoteles', icon: 'Hotel', color: '#5AC8FA', kind: 'expense', group: 'Ocio' },
  { id: 'subs', name: 'Suscripciones', icon: 'Repeat', color: '#40C8E0', kind: 'expense', group: 'Ocio' },

  // ---- Gastos: compras -----------------------------------------------------
  { id: 'shopping', name: 'Compras', icon: 'ShoppingBag', color: '#FF453A', kind: 'expense', group: 'Compras' },
  { id: 'clothes', name: 'Ropa', icon: 'Shirt', color: '#FF6B9D', kind: 'expense', group: 'Compras' },
  { id: 'tech', name: 'Tecnología', icon: 'Laptop', color: '#8E8E93', kind: 'expense', group: 'Compras' },
  { id: 'gifts', name: 'Regalos', icon: 'Gift', color: '#FF375F', kind: 'expense', group: 'Compras' },
  { id: 'pets', name: 'Mascotas', icon: 'PawPrint', color: '#AC8E68', kind: 'expense', group: 'Compras' },

  // ---- Gastos: formación ---------------------------------------------------
  { id: 'education', name: 'Educación', icon: 'GraduationCap', color: '#FFD60A', kind: 'expense', group: 'Formación' },
  { id: 'books', name: 'Libros', icon: 'BookOpen', color: '#D6A75E', kind: 'expense', group: 'Formación' },

  // ---- Gastos: financiero --------------------------------------------------
  { id: 'fees', name: 'Comisiones', icon: 'Receipt', color: '#8E8E93', kind: 'expense', group: 'Financiero' },
  { id: 'interest', name: 'Intereses', icon: 'Percent', color: '#FF453A', kind: 'expense', group: 'Financiero' },
  { id: 'taxes', name: 'Impuestos', icon: 'Landmark', color: '#98989F', kind: 'expense', group: 'Financiero' },
  { id: 'installment', name: 'Cuota tarjeta', icon: 'CreditCard', color: '#FF9F0A', kind: 'expense', group: 'Financiero' },
  { id: 'donation', name: 'Donaciones', icon: 'HandCoins', color: '#32D74B', kind: 'expense', group: 'Financiero' },
  { id: 'other', name: 'Otros', icon: 'Ellipsis', color: '#98989F', kind: 'expense', group: 'Financiero' },

  // ---- Ingresos ------------------------------------------------------------
  { id: 'salary', name: 'Salario', icon: 'Wallet', color: '#30D158', kind: 'income', group: 'Trabajo' },
  { id: 'freelance', name: 'Freelance', icon: 'Briefcase', color: '#0A84FF', kind: 'income', group: 'Trabajo' },
  { id: 'bonus', name: 'Bonificación', icon: 'Award', color: '#FFD60A', kind: 'income', group: 'Trabajo' },
  { id: 'sales', name: 'Ventas', icon: 'Banknote', color: '#32D74B', kind: 'income', group: 'Trabajo' },
  { id: 'returns', name: 'Rendimientos', icon: 'TrendingUp', color: '#BF5AF2', kind: 'income', group: 'Inversión' },
  { id: 'cashback', name: 'Cashback', icon: 'BadgePercent', color: '#FF9F0A', kind: 'income', group: 'Inversión' },
  { id: 'dividends', name: 'Dividendos', icon: 'ChartPie', color: '#5E5CE6', kind: 'income', group: 'Inversión' },
  { id: 'rent-income', name: 'Arriendos', icon: 'Building2', color: '#40C8E0', kind: 'income', group: 'Inversión' },
  { id: 'refund', name: 'Reembolso', icon: 'Undo2', color: '#64D2FF', kind: 'income', group: 'Otros' },
  { id: 'gift-income', name: 'Regalo', icon: 'Gift', color: '#FF375F', kind: 'income', group: 'Otros' },
  { id: 'other-income', name: 'Otros ingresos', icon: 'Ellipsis', color: '#98989F', kind: 'income', group: 'Otros' },
]

export const categoryById = (id: string) =>
  DEFAULT_CATEGORIES.find((c) => c.id === id) ?? DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1]

/** Agrupa por `group` conservando el orden de declaración. */
export function categoriesByGroup(kind: 'expense' | 'income') {
  const map = new Map<string, Category[]>()
  DEFAULT_CATEGORIES.filter((c) => c.kind === kind).forEach((c) => {
    map.set(c.group, [...(map.get(c.group) ?? []), c])
  })
  return [...map.entries()]
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
  { name: 'RappiPay', group: 'Pagos', color: '#FF441F', short: 'RP', logo: 'rappi' },

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

/** Busca una entidad por nombre; útil para reconstruir el badge desde una cuenta. */
export const institutionByName = (name: string) =>
  CO_INSTITUTIONS.find((i) => i.name === name)
