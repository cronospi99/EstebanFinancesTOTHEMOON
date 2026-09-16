import type { Subscription, SubCycle } from './types'
import { hoyEnZona, sumarDias, zonaEfectiva } from './zona'

/**
 * Lo que cuesta de verdad lo que se cobra solo.
 *
 * Una suscripción no se mira como un gasto. Un gasto se mira hacia atrás —en
 * qué se me fue— y una suscripción hacia adelante: qué me van a cobrar, cuándo
 * y cuánto suma todo esto al año. Esa última cifra es la que sorprende, y es
 * la que ninguna app enseña: nueve cobros pequeños que nadie recuerda haber
 * aceptado y que juntos valen más que el arriendo de una semana.
 *
 * Todo lo de aquí es aritmética pura sobre días sueltos («2026-09-19»), sin
 * `Date` de por medio más que para formatear. Un cobro cae un día, no a una
 * hora, y meter husos horarios en esto solo sirve para que el 1 de mes salga
 * el 31 del anterior en Bogotá.
 */

/** Cuántas veces al año cobra cada ciclo. De aquí sale el coste anual. */
export const COBROS_POR_ANIO: Record<SubCycle, number> = {
  semanal: 52,
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
}

/** Cuántos meses avanza cada ciclo. El semanal va por días, no por meses. */
const MESES_POR_CICLO: Record<Exclude<SubCycle, 'semanal'>, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

export const CICLOS: { value: SubCycle; label: string; corto: string }[] = [
  { value: 'semanal', label: 'Cada semana', corto: 'semanal' },
  { value: 'mensual', label: 'Cada mes', corto: 'mensual' },
  { value: 'trimestral', label: 'Cada 3 meses', corto: 'trimestral' },
  { value: 'semestral', label: 'Cada 6 meses', corto: 'semestral' },
  { value: 'anual', label: 'Cada año', corto: 'anual' },
]

/** Cómo se dice el ciclo en una frase: «un pago anual», «doce pagos al año». */
export const frasePagos = (cycle: SubCycle) => ({
  semanal: 'un pago cada semana',
  mensual: 'un pago al mes',
  trimestral: 'cuatro pagos al año',
  semestral: 'dos pagos al año',
  anual: 'un pago anual',
}[cycle])

const dias = (dia: string) => dia.split('-').map(Number)

/** Cuántos días trae un mes, contando los febreros bisiestos. */
const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate()

/**
 * Suma meses a un día suelto, recortando al último día del mes cuando hace
 * falta.
 *
 * Un cobro del 31 en un mes de 30 cae el 30, y eso es lo que hacen los bancos.
 * Lo que no hacen es quedarse ahí: el mes siguiente vuelve al 31. Por eso todo
 * se calcula siempre desde el ancla original y nunca encadenando un mes sobre
 * el anterior — encadenando, un cobro del 31 de enero acababa siendo del 28
 * para el resto de su vida.
 */
export function sumarMeses(dia: string, n: number): string {
  const [a, m, d] = dias(dia)
  const total = (m - 1) + n
  const anio = a + Math.floor(total / 12)
  const mes = ((total % 12) + 12) % 12 + 1
  const recortado = Math.min(d, diasDelMes(anio, mes))
  return `${anio}-${String(mes).padStart(2, '0')}-${String(recortado).padStart(2, '0')}`
}

/** Días completos entre dos días sueltos. Negativo si el segundo ya pasó. */
export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = dias(desde)
  const [a2, m2, d2] = dias(hasta)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000)
}

/**
 * Cuándo es el próximo cobro.
 *
 * Se calcula desde el ancla en vez de guardarse, y esa es toda la diferencia:
 * un «próximo cobro» guardado caduca en cuanto pasa la fecha, así que quien no
 * abre la app en dos meses vuelve a una pantalla que le anuncia cobros de
 * julio. Con el ancla y el ciclo, la fecha sigue saliendo bien dentro de un
 * año y sin que nadie tenga que mantenerla.
 *
 * Devuelve el propio día si hoy toca cobro: hoy todavía no ha pasado.
 */
export function proximoCobro(
  sub: Pick<Subscription, 'anchorAt' | 'cycle'>,
  desde: string = hoyEnZona(),
): string {
  const ancla = sub.anchorAt
  if (!ancla) return desde
  if (ancla >= desde) return ancla

  if (sub.cycle === 'semanal') {
    return sumarDias(ancla, Math.ceil(diasEntre(ancla, desde) / 7) * 7)
  }

  const paso = MESES_POR_CICLO[sub.cycle]
  const [a1, m1] = dias(ancla)
  const [a2, m2] = dias(desde)
  // Una estimación por meses y luego el ajuste fino: el recorte de fin de mes
  // puede dejar la estimación un ciclo corta, nunca más de uno.
  let k = Math.max(0, Math.floor(((a2 - a1) * 12 + (m2 - m1)) / paso))
  while (sumarMeses(ancla, k * paso) < desde) k++
  return sumarMeses(ancla, k * paso)
}

/** El cobro anterior al próximo. Sirve para saber desde cuándo corre el ciclo. */
export function cobroAnterior(
  sub: Pick<Subscription, 'anchorAt' | 'cycle'>,
  desde: string = hoyEnZona(),
): string {
  const proximo = proximoCobro(sub, desde)
  return sub.cycle === 'semanal' ? sumarDias(proximo, -7) : sumarMeses(proximo, -MESES_POR_CICLO[sub.cycle])
}

/** Lo que cuesta al año, en su moneda. */
export const costeAnual = (sub: Pick<Subscription, 'amount' | 'cycle'>) =>
  Math.max(0, sub.amount) * COBROS_POR_ANIO[sub.cycle]

/**
 * Lo que cuesta al mes en promedio, en su moneda.
 *
 * Promedio y no «lo que cobran este mes», que en una anual sería cero once
 * meses y un susto el doceavo. Repartido es la cifra con la que se puede
 * comparar una suscripción con otra y con lo que uno gana.
 */
export const costeMensual = (sub: Pick<Subscription, 'amount' | 'cycle'>) => costeAnual(sub) / 12

/** Entre cuántos se reparte, contándote. Nunca menos de uno. */
export const cuantosComparten = (sub: Pick<Subscription, 'sharedWith'>) =>
  Math.max(1, Math.round(sub.sharedWith ?? 1))

/** Lo que sale de tu bolsillo: el importe entre los que la comparten. */
export const tuParte = (sub: Pick<Subscription, 'amount' | 'cycle' | 'sharedWith'>) =>
  costeMensual(sub) / cuantosComparten(sub)

/** Lo que ponen los demás y que, hasta que te lo pasen, estás adelantando tú. */
export const parteAjena = (sub: Pick<Subscription, 'amount' | 'cycle' | 'sharedWith'>) =>
  costeMensual(sub) - tuParte(sub)

/** Una prueba gratis que todavía no ha terminado. */
export const enPrueba = (sub: Pick<Subscription, 'trialEndsAt'>, hoy: string = hoyEnZona()) =>
  Boolean(sub.trialEndsAt && sub.trialEndsAt >= hoy)

/** Cuenta en los totales: ni cancelada, ni todavía gratis. */
export const cobraDeVerdad = (sub: Subscription, hoy: string = hoyEnZona()) =>
  !sub.cancelled && !enPrueba(sub, hoy)

/**
 * Cómo se escribe la fecha de un cobro: «19 sep», «15 nov 2027».
 *
 * El año solo cuando no es este. Dentro del mismo año estorba —nadie apunta
 * «me cobran el 19 de septiembre de 2026»— y de un año para otro es justo el
 * dato que evita leer una anual como si fuera del mes que viene.
 *
 * Se le quitan los «de» y los puntos que mete el formateador. En una píldora
 * de dos centímetros, «25 de sept.» y «25 sept» dicen exactamente lo mismo y
 * el segundo cabe.
 */
export function fechaCobro(dia: string, hoy: string = hoyEnZona()): string {
  const [a, m, d] = dias(dia)
  if (!a) return ''
  const mismoAnio = a === Number(dias(hoy)[0])
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'short', ...(mismoAnio ? {} : { year: 'numeric' }), timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(a, m - 1, d)))
    .replace(/ de /g, ' ')
    .replace(/\./g, '')
}

/** «Hoy», «mañana», «en 5 días». Lo que se lee de un vistazo en la píldora. */
export function cuandoCobra(dia: string, hoy: string = hoyEnZona()): string {
  const faltan = diasEntre(hoy, dia)
  if (faltan <= 0) return 'Hoy'
  if (faltan === 1) return 'Mañana'
  if (faltan <= 6) return `En ${faltan} días`
  return `Cobra el ${fechaCobro(dia, hoy)}`
}

/* ===========================================================================
 *  Catálogo de servicios
 * ===========================================================================
 *  Para que la tarjeta salga con el color de la marca sin pedirle a nadie que
 *  elija un color. Se escribe «Netflix» y la tarjeta ya es roja.
 *
 *  Monograma y color, no logotipos: meter treinta PNG de marcas registradas en
 *  la app es un problema de licencias y doscientos kilobytes que se descargan
 *  para ver una lista. El color de marca ya identifica el servicio de un
 *  vistazo, que es para lo que está.
 * ------------------------------------------------------------------------ */

export interface Servicio {
  name: string
  color: string
  /** Color del texto sobre el color de marca. Negro en las marcas claras. */
  fg?: string
  /** Monograma de 1-3 letras. El respaldo cuando no hay logotipo. */
  short?: string
  /** Archivo en /public/services, sin extensión. Si falta, se pinta el monograma. */
  logo?: string
  grupo: 'Video' | 'Música' | 'Nube y trabajo' | 'Juegos' | 'IA' | 'Telefonía' | 'Otros'
}

export const SERVICIOS: Servicio[] = [
  // ---- Video ---------------------------------------------------------------
  { name: 'Netflix', color: '#E50914', short: 'N', logo: 'netflix', grupo: 'Video' },
  { name: 'Disney+', color: '#113CCF', short: 'D+', logo: 'disney', grupo: 'Video' },
  { name: 'Max', color: '#002BE7', short: 'M', logo: 'hbo-max', grupo: 'Video' },
  { name: 'Prime Video', color: '#00A8E1', short: 'PV', logo: 'prime-video', grupo: 'Video' },
  { name: 'YouTube Premium', color: '#FF0000', short: 'YT', logo: 'youtube', grupo: 'Video' },
  { name: 'Crunchyroll', color: '#F47521', short: 'CR', logo: 'crunchyroll', grupo: 'Video' },
  { name: 'Paramount+', color: '#0064FF', short: 'P+', logo: 'paramount', grupo: 'Video' },
  { name: 'Apple TV+', color: '#2A2A2E', short: 'TV', logo: 'apple', grupo: 'Video' },
  { name: 'Win Sports+', color: '#E30613', short: 'W+', grupo: 'Video' },

  // ---- Música --------------------------------------------------------------
  { name: 'Spotify', color: '#1DB954', short: 'S', logo: 'spotify', grupo: 'Música' },
  { name: 'Apple Music', color: '#FA243C', short: 'AM', logo: 'apple', grupo: 'Música' },
  { name: 'YouTube Music', color: '#FF0000', short: 'YM', logo: 'youtube', grupo: 'Música' },
  { name: 'Audible', color: '#F8991C', short: 'AU', logo: 'amazon', grupo: 'Música' },
  { name: 'Deezer', color: '#A238FF', short: 'DZ', grupo: 'Música' },

  // ---- Nube y trabajo ------------------------------------------------------
  { name: 'iCloud+', color: '#3693F3', short: 'iC', logo: 'icloud', grupo: 'Nube y trabajo' },
  { name: 'Google One', color: '#4285F4', short: 'G1', logo: 'google-one', grupo: 'Nube y trabajo' },
  { name: 'Google Drive', color: '#1FA463', short: 'GD', logo: 'google-drive', grupo: 'Nube y trabajo' },
  { name: 'Google Fotos', color: '#4285F4', short: 'GF', logo: 'google-photos', grupo: 'Nube y trabajo' },
  { name: 'Google Workspace', color: '#EA4335', short: 'GW', logo: 'gmail', grupo: 'Nube y trabajo' },
  { name: 'Microsoft 365', color: '#F25022', short: 'M365', logo: 'microsoft', grupo: 'Nube y trabajo' },
  { name: 'Dropbox', color: '#0061FF', short: 'DB', logo: 'dropbox', grupo: 'Nube y trabajo' },
  { name: 'Notion', color: '#2A2A2E', short: 'N', logo: 'notion', grupo: 'Nube y trabajo' },
  { name: 'Canva', color: '#00C4CC', short: 'C', logo: 'canva', grupo: 'Nube y trabajo' },
  { name: 'CapCut', color: '#2A2A2E', short: 'CC', logo: 'capcut', grupo: 'Nube y trabajo' },
  { name: 'Figma', color: '#A259FF', short: 'F', logo: 'figma', grupo: 'Nube y trabajo' },
  { name: 'Slack', color: '#4A154B', short: 'SL', logo: 'slack', grupo: 'Nube y trabajo' },
  { name: 'GitHub', color: '#24292F', short: 'GH', logo: 'github', grupo: 'Nube y trabajo' },
  { name: 'Trello', color: '#0052CC', short: 'TR', logo: 'trello', grupo: 'Nube y trabajo' },
  { name: 'LinkedIn Premium', color: '#0A66C2', short: 'in', logo: 'linkedin', grupo: 'Nube y trabajo' },
  { name: 'Adobe', color: '#EC1C24', short: 'A', grupo: 'Nube y trabajo' },

  // ---- Juegos --------------------------------------------------------------
  { name: 'Xbox Game Pass', color: '#107C10', short: 'XB', logo: 'xbox', grupo: 'Juegos' },
  { name: 'PlayStation Plus', color: '#0070D1', short: 'PS', logo: 'playstation', grupo: 'Juegos' },
  { name: 'Nintendo Switch Online', color: '#E60012', short: 'NS', logo: 'nintendo', grupo: 'Juegos' },
  { name: 'Discord Nitro', color: '#5865F2', short: 'DC', logo: 'discord', grupo: 'Juegos' },
  { name: 'GeForce Now', color: '#76B900', fg: '#1C1C1E', short: 'GFN', logo: 'nvidia', grupo: 'Juegos' },
  { name: 'Steam', color: '#1B2838', short: 'ST', logo: 'steam', grupo: 'Juegos' },
  { name: 'Epic Games', color: '#2A2A2E', short: 'EG', logo: 'epic-games', grupo: 'Juegos' },
  { name: 'Twitch', color: '#9146FF', short: 'TW', grupo: 'Juegos' },

  // ---- IA ------------------------------------------------------------------
  { name: 'ChatGPT Plus', color: '#10A37F', short: 'GPT', logo: 'openai', grupo: 'IA' },
  { name: 'Claude', color: '#D97757', short: 'C', logo: 'claude', grupo: 'IA' },
  { name: 'Google Gemini', color: '#4285F4', short: 'G', logo: 'google', grupo: 'IA' },
  { name: 'Perplexity', color: '#20808D', short: 'PX', grupo: 'IA' },

  /* ---- Telefonía ----------------------------------------------------------
   * El plan del celular es la suscripción que todo el mundo tiene y la única
   * que nadie llama suscripción. Va con la operadora por nombre y no como un
   * «Celular» genérico: el recibo lo manda Claro o Movistar, y dentro de un
   * año lo que uno recuerda es de quién era la línea, no que era «celular».
   */
  { name: 'Claro', color: '#DA291C', short: 'CL', logo: 'claro', grupo: 'Telefonía' },
  { name: 'Movistar', color: '#019DF4', short: 'MV', logo: 'movistar', grupo: 'Telefonía' },
  { name: 'Tigo', color: '#0033A1', short: 'TG', logo: 'tigo', grupo: 'Telefonía' },
  { name: 'WOM', color: '#7D00BE', short: 'WM', logo: 'wom', grupo: 'Telefonía' },
  { name: 'Virgin Mobile', color: '#E10A0A', short: 'VM', logo: 'virgin-mobile', grupo: 'Telefonía' },
  { name: 'ETB', color: '#6D2077', short: 'ETB', logo: 'etb', grupo: 'Telefonía' },
  { name: 'Éxito móvil', color: '#FFE000', fg: '#1C1C1E', short: 'EX', logo: 'exito-movil', grupo: 'Telefonía' },
  { name: 'Flash Mobile', color: '#E4002B', short: 'FM', logo: 'flash-mobile', grupo: 'Telefonía' },
  { name: 'uff móvil', color: '#00B2A9', short: 'UF', logo: 'uff', grupo: 'Telefonía' },
  { name: 'Tuya móvil', color: '#FF6B00', fg: '#1C1C1E', short: 'TY', logo: 'tuya-movil', grupo: 'Telefonía' },
  { name: 'Avantel', color: '#0072CE', short: 'AV', logo: 'avantel', grupo: 'Telefonía' },
  { name: 'DIRECTV', color: '#00A0DF', short: 'DTV', logo: 'directv', grupo: 'Telefonía' },
  { name: 'AT&T', color: '#009FDB', short: 'ATT', logo: 'att', grupo: 'Telefonía' },
  { name: 'T-Mobile', color: '#E20074', short: 'TM', logo: 't-mobile', grupo: 'Telefonía' },
  { name: 'Entel', color: '#0033A0', short: 'EN', logo: 'entel', grupo: 'Telefonía' },
  { name: 'Bitel', color: '#E30613', short: 'BT', logo: 'bitel', grupo: 'Telefonía' },
  { name: 'Personal', color: '#00A9E0', short: 'PE', logo: 'personal', grupo: 'Telefonía' },
  { name: 'Telcel', color: '#1B3C8C', short: 'TC', logo: 'telcel', grupo: 'Telefonía' },
  { name: 'O2', color: '#0019A5', short: 'O2', logo: 'o2', grupo: 'Telefonía' },
  { name: 'Orange', color: '#FF7900', fg: '#1C1C1E', short: 'OR', logo: 'orange', grupo: 'Telefonía' },
  { name: 'eSIM', color: '#48484A', short: 'SIM', logo: 'esim', grupo: 'Telefonía' },

  // ---- Otros ---------------------------------------------------------------
  { name: 'Amazon Prime', color: '#FF9900', fg: '#1C1C1E', short: 'AP', logo: 'amazon', grupo: 'Otros' },
  { name: 'Apple One', color: '#2A2A2E', short: 'A1', logo: 'apple', grupo: 'Otros' },
  { name: 'Rappi Pro', color: '#FF441F', short: 'RP', logo: 'rappi', grupo: 'Otros' },
  { name: 'Uber One', color: '#2A2A2E', short: 'U1', logo: 'uber', grupo: 'Otros' },
  { name: 'Uber Eats', color: '#06C167', fg: '#1C1C1E', short: 'UE', logo: 'uber-eats', grupo: 'Otros' },
  { name: 'Airbnb', color: '#FF5A5F', short: 'AB', logo: 'airbnb', grupo: 'Otros' },
  { name: 'Booking.com', color: '#003580', short: 'BK', logo: 'booking', grupo: 'Otros' },
  { name: 'WhatsApp', color: '#25D366', fg: '#1C1C1E', short: 'WA', logo: 'whatsapp', grupo: 'Otros' },
  { name: 'Telegram Premium', color: '#229ED9', short: 'TG', logo: 'telegram', grupo: 'Otros' },
  { name: 'X Premium', color: '#16181C', short: 'X', logo: 'x', grupo: 'Otros' },
  { name: 'Reddit Premium', color: '#FF4500', short: 'RD', logo: 'reddit', grupo: 'Otros' },
  { name: 'Instagram', color: '#E1306C', short: 'IG', logo: 'instagram', grupo: 'Otros' },
  { name: 'TikTok', color: '#2A2A2E', short: 'TT', logo: 'tiktok', grupo: 'Otros' },
  { name: 'Virgin Mobile', color: '#E10A0A', short: 'VM', logo: 'virgin-mobile', grupo: 'Otros' },
  { name: 'Duolingo', color: '#58CC02', fg: '#1C1C1E', short: 'DL', grupo: 'Otros' },
  { name: 'Truecaller', color: '#0A84FF', short: 'TC', grupo: 'Otros' },
  { name: 'Strava', color: '#FC4C02', short: 'ST', grupo: 'Otros' },
  { name: 'Gimnasio', color: '#FF9F0A', fg: '#1C1C1E', short: 'GYM', grupo: 'Otros' },
  { name: 'Seguro', color: '#5E5CE6', short: 'SG', grupo: 'Otros' },
  { name: 'Internet', color: '#BF5AF2', short: 'NET', grupo: 'Otros' },
]

const normaliza = (s: string) => s.trim().toLowerCase()

/** El servicio del catálogo que coincide con ese nombre, si alguno coincide. */
export const servicioPorNombre = (name: string) =>
  SERVICIOS.find((s) => normaliza(s.name) === normaliza(name))

/** Los servicios agrupados, conservando el orden en que están declarados. */
export function serviciosPorGrupo() {
  const mapa = new Map<Servicio['grupo'], Servicio[]>()
  for (const s of SERVICIOS) mapa.set(s.grupo, [...(mapa.get(s.grupo) ?? []), s])
  return [...mapa.entries()]
}

/**
 * El color con el que se pinta una suscripción.
 *
 * Manda el que tenga guardado —quien quiso ponerle otro, se lo puso— y si no,
 * el de la marca. El gris es para lo que no está en el catálogo y nadie tocó.
 */
export const colorDe = (sub: Pick<Subscription, 'name' | 'color'>) =>
  sub.color || servicioPorNombre(sub.name)?.color || '#8E8E93'

/** Las operadoras, para el selector que aparece al elegir el plan del celular. */
export const OPERADORAS = SERVICIOS.filter((s) => s.grupo === 'Telefonía')

/** El archivo del logotipo, si el servicio está en el catálogo y tiene uno. */
export const logoDe = (name: string) => servicioPorNombre(name)?.logo

/** El monograma de la insignia: el del catálogo, o las iniciales del nombre. */
export function monograma(name: string): string {
  const conocido = servicioPorNombre(name)
  if (conocido?.short) return conocido.short
  const palabras = name.trim().split(/\s+/).filter(Boolean)
  if (!palabras.length) return '?'
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()
  return (palabras[0][0] + palabras[1][0]).toUpperCase()
}

/**
 * Si el texto se lee mejor en negro que en blanco sobre ese fondo.
 *
 * Los verdes y amarillos de marca son claros de verdad —el verde de Duolingo
 * con letras blancas encima no se lee— y el catálogo no puede cubrir el color
 * que alguien elija a mano. La fórmula es la luminancia relativa de la WCAG,
 * que es la misma que decide si un contraste pasa o no.
 */
export function textoOscuro(hex: string): boolean {
  const limpio = hex.replace('#', '')
  if (limpio.length !== 6) return false
  const canal = (i: number) => {
    const v = parseInt(limpio.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4) > 0.45
}

/** El color del texto sobre la tarjeta: el del catálogo, o el que contraste. */
export const textoSobre = (sub: Pick<Subscription, 'name' | 'color'>) => {
  const fondo = colorDe(sub)
  const conocido = servicioPorNombre(sub.name)
  // El del catálogo solo vale mientras no le hayan cambiado el color a mano.
  if (conocido?.fg && (!sub.color || sub.color === conocido.color)) return conocido.fg
  return textoOscuro(fondo) ? '#1C1C1E' : '#FFFFFF'
}

/**
 * El mes en curso, para el encabezado: «SEPTIEMBRE 2026».
 *
 * Sin el «de» que mete el formateador: en versales y con el interletraje
 * abierto, «SEPTIEMBRE DE 2026» es un renglón que ya no cabe en un teléfono.
 */
export const mesEnCurso = (hoy: Date = new Date()) =>
  new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: zonaEfectiva() })
    .format(hoy)
    .replace(/ de /g, ' ')
    .toUpperCase()
