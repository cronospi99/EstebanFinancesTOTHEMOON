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

/** Bancos y neobancos colombianos, con su color de marca aproximado. */
export const CO_INSTITUTIONS = [
  { name: 'Bancolombia', color: '#FDDA24' },
  { name: 'Nequi', color: '#DA0081' },
  { name: 'Daviplata', color: '#ED1C24' },
  { name: 'Davivienda', color: '#ED1C24' },
  { name: 'Nu', color: '#820AD1' },
  { name: 'Lulo Bank', color: '#00D1B0' },
  { name: 'BBVA', color: '#004481' },
  { name: 'Banco de Bogotá', color: '#00489A' },
  { name: 'Scotiabank Colpatria', color: '#EC111A' },
  { name: 'RappiPay', color: '#FF441F' },
  { name: 'Efectivo', color: '#30D158' },
]
