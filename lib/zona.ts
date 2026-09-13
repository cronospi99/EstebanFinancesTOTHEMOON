/**
 * En qué zona horaria vive el usuario.
 *
 * Todo lo que en esta app es «un día» —el día de un gasto, el resumen de hoy,
 * los límites de una semana o de un mes— depende de dónde esté el que la usa.
 * Sin fijar eso, un gasto de las once de la noche en Bogotá se registraba con
 * la fecha del día siguiente, porque `toISOString()` pasa a UTC antes de
 * recortar el día y a esa hora en UTC ya es mañana.
 *
 * Por defecto se toma la del teléfono, que acierta el 99 % de las veces. Se
 * puede fijar a mano desde Ajustes para los casos en que no: un viaje del que
 * no se quiere que se muevan las cuentas, un teléfono con la zona mal puesta,
 * o quien vive en una frontera horaria y prefiere cuadrar con su banco.
 *
 * El valor vive en un módulo y no en el contexto de React a propósito. Lo leen
 * los formateadores, que son funciones puras llamadas desde treinta sitios;
 * pasarles la zona por parámetro habría obligado a tocar todas esas llamadas y
 * a que cada una se acordara de hacerlo.
 */

export const ZONA_KEY = 'eftm.zona'

/** `null` = la del dispositivo. Se guarda así para que seguir al teléfono no se congele. */
let elegida: string | null = null

/** La zona del dispositivo, o Bogotá si el navegador no la sabe decir. */
export function zonaDelDispositivo(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'
  } catch {
    return 'America/Bogota'
  }
}

/** La que manda ahora mismo. */
export function zonaEfectiva(): string {
  return elegida ?? zonaDelDispositivo()
}

/** Qué eligió el usuario, o `null` si sigue al teléfono. */
export const zonaElegida = () => elegida

/** Comprueba que el navegador reconoce la zona antes de fijarla. */
export function zonaValida(zona: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zona })
    return true
  } catch {
    return false
  }
}

export function fijarZona(zona: string | null) {
  elegida = zona && zonaValida(zona) ? zona : null
  try {
    if (elegida) localStorage.setItem(ZONA_KEY, elegida)
    else localStorage.removeItem(ZONA_KEY)
  } catch { /* storage bloqueado */ }
}

/** Recupera la elección guardada. Se llama una vez, al arrancar la app. */
export function cargarZona() {
  try {
    const v = localStorage.getItem(ZONA_KEY)
    if (v && zonaValida(v)) elegida = v
  } catch { /* storage bloqueado */ }
}

/*
 * Las partes de una fecha, vistas desde la zona.
 *
 * Se sacan con Intl y no con los getters de Date porque los getters devuelven
 * la hora del dispositivo, que es justo lo que aquí no queremos dar por hecho.
 * El formato `en-CA` da «2026-09-13» directamente, que además es el mismo que
 * usan los `<input type="date">` y el que ordena bien como texto.
 */
const cacheDia = new Map<string, Intl.DateTimeFormat>()
const formateadorDia = (zona: string) => {
  let f = cacheDia.get(zona)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
    })
    cacheDia.set(zona, f)
  }
  return f
}

/** El día de una fecha en la zona del usuario, como «2026-09-13». */
export function diaEn(fecha: Date | string | number = new Date(), zona = zonaEfectiva()): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : new Date(fecha)
  if (Number.isNaN(d.getTime())) return ''
  return formateadorDia(zona).format(d)
}

/** El día de hoy en la zona del usuario. */
export const hoyEnZona = (zona = zonaEfectiva()) => diaEn(new Date(), zona)

/** Suma días a un día suelto, sin que el horario de verano lo mueva. */
export function sumarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  // A mediodía UTC: sumar días sobre una fecha anclada a medianoche puede
  // caerse al día anterior en las zonas que cambian la hora.
  const t = Date.UTC(a, m - 1, d, 12) + n * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/** Qué día de la semana cae un día suelto: 0 lunes … 6 domingo. */
export function diaSemana(dia: string): number {
  const [a, m, d] = dia.split('-').map(Number)
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7
}

/** El año y el mes (1-12) de un día suelto. */
export function anioMes(dia: string): [number, number] {
  const [a, m] = dia.split('-').map(Number)
  return [a, m]
}

/** El primer día de un mes, como «2026-09-01». Admite meses fuera de 1-12. */
export function primeroDeMes(anio: number, mes: number): string {
  const a = anio + Math.floor((mes - 1) / 12)
  const m = ((mes - 1) % 12 + 12) % 12 + 1
  return `${a}-${String(m).padStart(2, '0')}-01`
}

/**
 * El instante que hay que guardar para un día concreto.
 *
 * Registrar algo de ayer no debería fijarlo a las 00:00: se ordenaría antes que
 * todo lo demás de ese día. Se conserva la hora del reloj de ahora y se
 * desplaza el día.
 *
 * Se parte del instante real y se mueve por días enteros, en vez de construir
 * uno nuevo con las piezas de la fecha. Construirlo a mano guardaba un instante
 * que no era el de verdad —la hora local metida como si fuera UTC, cinco horas
 * corridas— y aunque el día salía bien, la hora quedaba mal para siempre.
 *
 * Para el día de hoy, que es el caso normal, se devuelve el ahora tal cual: sin
 * cuentas, sin nada que se pueda torcer.
 */
export function instanteEnDia(dia: string, zona = zonaEfectiva()): string {
  const ahora = new Date()
  const hoy = diaEn(ahora, zona)
  if (dia === hoy) return ahora.toISOString()

  const enDias = (a: string, b: string) =>
    Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000)

  let t = ahora.getTime() + enDias(dia, hoy) * 86_400_000
  // Un cambio de hora por el camino mueve el reloj una hora, y cerca de
  // medianoche eso basta para caer en el día de al lado. Se comprueba y se
  // corrige; una vuelta sobra, pero el tope evita cualquier bucle.
  for (let i = 0; i < 2; i++) {
    const sale = diaEn(t, zona)
    if (sale === dia) break
    t += enDias(dia, sale) * 86_400_000
  }
  return new Date(t).toISOString()
}

/**
 * El desfase de una zona, como «UTC−5». Para enseñarlo junto al nombre: «Bogotá»
 * no le dice a nadie si va a cuadrar con su banco, y «UTC−5» sí.
 */
export function desfaseDe(zona: string, fecha = new Date()): string {
  try {
    const partes = new Intl.DateTimeFormat('en', { timeZone: zona, timeZoneName: 'shortOffset' })
      .formatToParts(fecha)
    const nombre = partes.find((p) => p.type === 'timeZoneName')?.value ?? ''
    // Viene como «GMT-5»; se enseña con el signo tipográfico y sin «GMT».
    return nombre.replace('GMT', 'UTC').replace('-', '−') || 'UTC'
  } catch {
    return ''
  }
}

/** La hora de ahora en una zona, como «10:42 p. m.». Sirve para comprobarla de un vistazo. */
export function horaEn(zona: string, fecha = new Date()): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: zona, hour: 'numeric', minute: '2-digit',
    }).format(fecha)
  } catch {
    return ''
  }
}
