import type { Category } from './types'

/**
 * Categorías por defecto. Los nombres de iconos corresponden a lucide-react
 * y se resuelven en components/ui/category-icon.tsx.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Comida', icon: 'UtensilsCrossed', color: '#FF9F0A', kind: 'expense' },
  { id: 'market', name: 'Mercado', icon: 'ShoppingCart', color: '#30D158', kind: 'expense' },
  { id: 'transport', name: 'Transporte', icon: 'Car', color: '#0A84FF', kind: 'expense' },
  { id: 'home', name: 'Hogar', icon: 'House', color: '#BF5AF2', kind: 'expense' },
  { id: 'health', name: 'Salud', icon: 'HeartPulse', color: '#FF375F', kind: 'expense' },
  { id: 'fun', name: 'Ocio', icon: 'Clapperboard', color: '#5E5CE6', kind: 'expense' },
  { id: 'subs', name: 'Suscripciones', icon: 'Repeat', color: '#40C8E0', kind: 'expense' },
  { id: 'shopping', name: 'Compras', icon: 'ShoppingBag', color: '#FF453A', kind: 'expense' },
  { id: 'education', name: 'Educación', icon: 'GraduationCap', color: '#FFD60A', kind: 'expense' },
  { id: 'services', name: 'Servicios', icon: 'Zap', color: '#FF9F0A', kind: 'expense' },
  { id: 'other', name: 'Otros', icon: 'Ellipsis', color: '#98989F', kind: 'expense' },
  { id: 'salary', name: 'Salario', icon: 'Wallet', color: '#30D158', kind: 'income' },
  { id: 'freelance', name: 'Freelance', icon: 'Laptop', color: '#0A84FF', kind: 'income' },
  { id: 'returns', name: 'Rendimientos', icon: 'TrendingUp', color: '#BF5AF2', kind: 'income' },
]

export const categoryById = (id: string) =>
  DEFAULT_CATEGORIES.find((c) => c.id === id) ?? DEFAULT_CATEGORIES[10]

export interface Institution {
  name: string
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
  { name: 'Bancolombia', color: '#FDDA24', fg: '#1A1A1A', short: 'BC', logo: 'bancolombia' },
  { name: 'Davivienda', color: '#ED1C24', short: 'DV' },
  { name: 'BBVA', color: '#004481', short: 'BB' },
  { name: 'Banco de Bogotá', color: '#00489A', short: 'BdB' },
  { name: 'Scotiabank Colpatria', color: '#EC111A', short: 'SC' },

  // Neobancos y billeteras
  { name: 'Nequi', color: '#DA0081', short: 'N', logo: 'nequi' },
  { name: 'Daviplata', color: '#ED1C24', short: 'DP', logo: 'daviplata' },
  { name: 'Nu', color: '#820AD1', short: 'nu', logo: 'nu' },
  { name: 'Lulo Bank', color: '#00D1B0', fg: '#0A2B26', short: 'LB' },
  { name: 'Dale!', color: '#10395E', short: 'd!', logo: 'dale' },
  { name: 'Ualá', color: '#F2F2F7', fg: '#1B1B4B', short: 'uá', logo: 'uala' },

  // Rappi
  { name: 'RappiPay', color: '#FF441F', short: 'RP' },
  { name: 'RappiCard', color: '#141414', short: 'RC', logo: 'rappicard' },
  { name: 'Rappi', color: '#FF441F', short: 'R', logo: 'rappi' },

  // Pagos
  { name: 'Bold', color: '#4B21C9', short: 'B', logo: 'bold' },

  // Inversión y cripto
  { name: 'Trii', color: '#00A868', short: 'tr', logo: 'trii' },
  { name: 'Tyba', color: '#116466', short: 'ty', logo: 'tyba' },
  { name: 'ARQ', color: '#EFEDE3', fg: '#141414', short: 'ARQ', logo: 'arq' },
  { name: 'Insights', color: '#141414', fg: '#C6F432', short: 'In', logo: 'insights' },
  { name: 'Littio', color: '#1B2A4A', short: 'Li', logo: 'littio' },
  { name: 'Lemon Cash', color: '#0FD65C', fg: '#0A2B14', short: 'LC', logo: 'lemon-cash' },
  { name: 'Uphold', color: '#49CC68', fg: '#0A2B14', short: 'U', logo: 'uphold' },

  { name: 'Efectivo', color: '#30D158', fg: '#0A2B14', short: '$' },
]

/** Busca una entidad por nombre; útil para reconstruir el badge desde una cuenta. */
export const institutionByName = (name: string) =>
  CO_INSTITUTIONS.find((i) => i.name === name)
