'use client'

import { AlertTriangle, CalendarDays, Clock, Coffee, Moon, Sun } from 'lucide-react'
import { formatKeypad, formatMoney, parseKeypad } from '@/lib/format'
import {
  RECARGO_NOCTURNO, SMMLV, TOPE_EXTRAS_SEMANA, franjaNocturna, horasDelMes,
  horasEfectivasDe, jornadaSemanal, recargoDominical, resumirNomina, type Turno,
} from '@/lib/nomina'
import { hoyEnZona } from '@/lib/zona'
import { cn, haptic } from '@/lib/utils'

const DIAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

/** Los descansos que existen de verdad. En horas, que es como se guardan. */
const DESCANSOS = [
  { v: 0, etiqueta: 'sin pausa' },
  { v: 0.25, etiqueta: '15 min' },
  { v: 0.5, etiqueta: '30 min' },
  { v: 0.75, etiqueta: '45 min' },
  { v: 1, etiqueta: '1 h' },
  { v: 1.5, etiqueta: '1 h 30' },
]

/** «19:30» a partir de 19.5, que es como se guardan las horas. */
const hhmm = (h: number) => {
  const horas = Math.floor(h) % 24
  const min = Math.round((h - Math.floor(h)) * 60)
  return `${String(horas).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
const desdeHhmm = (s: string): number => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) + (m || 0) / 60
}

/** «6,5 h» — con coma, que es como se escriben los decimales en español. */
const enHoras = (h: number) =>
  `${(Math.round(h * 100) / 100).toString().replace('.', ',')} h`

export interface DatosNomina {
  salarioBase?: number
  auxilioTransporte?: boolean
  cotiza?: boolean
  turnos?: Turno[]
  trabajaFestivos?: boolean
  pagaExtras?: boolean
}

/**
 * El sueldo como se pacta, y el sueldo como llega.
 *
 * Son dos cifras distintas y la app pedía solo una, así que cada quien metía
 * la que tuviera a mano: el bruto, y entonces la proyección iba inflada un 8 %
 * todos los meses; o el neto, y entonces no se podía estimar la prima, que se
 * calcula sobre el bruto. Aquí se pide el bruto —que es el que uno se sabe de
 * memoria— y se deriva todo lo demás.
 *
 * El desglose se enseña mientras se escribe y no detrás de un botón: la gracia
 * de esto no es guardar un número, es ver a dónde se va el 8 % y cuánto suma
 * el turno de noche, que son las dos cosas que nadie tiene calculadas.
 */
export function NominaForm({
  datos, onChange,
}: {
  datos: DatosNomina
  onChange: (d: DatosNomina) => void
}) {
  const hoy = hoyEnZona()
  const base = datos.salarioBase ?? 0
  const turnos = datos.turnos ?? []
  const resumen = base > 0 ? resumirNomina({
    base,
    auxilio: datos.auxilioTransporte,
    cotiza: datos.cotiza,
    turnos,
    trabajaFestivos: datos.trabajaFestivos,
    pagaExtras: datos.pagaExtras,
  }, hoy) : null

  const franja = franjaNocturna(hoy)

  const ponerTurno = (dia: number, campo: 'desde' | 'hasta' | 'descanso', valor: number) => {
    const otros = turnos.filter((t) => t.dia !== dia)
    const actual = turnos.find((t) => t.dia === dia) ?? { dia, desde: 8, hasta: 17 }
    onChange({ ...datos, turnos: [...otros, { ...actual, [campo]: valor }].sort((a, b) => a.dia - b.dia) })
  }

  const alternarDia = (dia: number) => {
    haptic(6)
    const existe = turnos.some((t) => t.dia === dia)
    // El turno nuevo copia el horario y el descanso del último: casi nadie
    // tiene seis días distintos, y así poner la semana entera son seis toques
    // en vez de seis toques y dieciocho campos.
    const modelo = turnos[turnos.length - 1]
    onChange({
      ...datos,
      turnos: existe
        ? turnos.filter((t) => t.dia !== dia)
        : [...turnos, modelo ? { ...modelo, dia } : { dia, desde: 8, hasta: 17, descanso: 1 }]
          .sort((a, b) => a.dia - b.dia),
    })
  }

  return (
    <div className="space-y-2.5">
      <label className="block">
        <span className="mb-1.5 block px-1 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          Sueldo pactado, sin descuentos
        </span>
        <div className="flex items-center gap-1.5 rounded-xl border border-hairline bg-fill-2 px-3 py-2.5">
          <span className="text-[16px] text-label-secondary">$</span>
          <input
            value={base ? formatKeypad(String(base)) : ''}
            inputMode="numeric"
            onChange={(e) => onChange({ ...datos, salarioBase: parseKeypad(e.target.value.replace(/[^\d,]/g, '')) || undefined })}
            placeholder={formatKeypad(String(SMMLV))}
            className="tnum w-full bg-transparent text-[18px] font-semibold text-label
                       placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
          />
        </div>
      </label>

      <div className="flex flex-wrap gap-1.5">
        <Interruptor
          activo={Boolean(datos.auxilioTransporte)}
          onClick={() => { haptic(6); onChange({ ...datos, auxilioTransporte: !datos.auxilioTransporte }) }}
          etiqueta="Con auxilio de transporte"
        />
        <Interruptor
          activo={datos.cotiza !== false}
          onClick={() => { haptic(6); onChange({ ...datos, cotiza: datos.cotiza === false }) }}
          etiqueta="Cotizo salud y pensión"
        />
      </div>

      {/* ---- El horario ------------------------------------------------- */}
      <div className="rounded-xl border border-hairline bg-fill-1 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-label-tertiary">
          <Clock size={12} /> Horario
        </p>
        <div className="mb-2 flex gap-1">
          {DIAS.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => alternarDia(i)}
              aria-pressed={turnos.some((t) => t.dia === i)}
              className={cn(
                'press h-8 flex-1 rounded-lg text-[12.5px] font-medium transition-colors',
                turnos.some((t) => t.dia === i)
                  ? 'bg-accent-blue text-white'
                  : 'border border-hairline text-label-tertiary',
              )}
            >
              {d}
            </button>
          ))}
        </div>

        {turnos.map((t) => (
          <div key={t.dia} className="py-1">
            <div className="flex items-center gap-1.5">
              <span className="w-4 shrink-0 text-[12.5px] text-label-secondary">{DIAS[t.dia]}</span>
              <input
                type="time"
                aria-label={`Entrada ${DIAS[t.dia]}`}
                value={hhmm(t.desde)}
                onChange={(e) => ponerTurno(t.dia, 'desde', desdeHhmm(e.target.value))}
                className="min-w-0 flex-1 rounded-lg border border-hairline bg-fill-2 px-1.5 py-1.5 text-[13px] text-label focus:outline-none"
              />
              <span className="shrink-0 text-[12px] text-label-tertiary">a</span>
              <input
                type="time"
                aria-label={`Salida ${DIAS[t.dia]}`}
                value={hhmm(t.hasta)}
                onChange={(e) => ponerTurno(t.dia, 'hasta', desdeHhmm(e.target.value))}
                className="min-w-0 flex-1 rounded-lg border border-hairline bg-fill-2 px-1.5 py-1.5 text-[13px] text-label focus:outline-none"
              />
            </div>
            {/* El descanso, en su propia línea y con el resultado al lado.
                Es el campo que corrige el error más caro —contar el almuerzo
                como trabajo— y enseñar ahí mismo las horas que quedan es lo
                que lo hace evidente sin tener que explicarlo. */}
            <div className="mt-1 flex items-center gap-1.5 pl-[22px]">
              <Coffee size={11} className="shrink-0 text-label-tertiary" />
              <select
                aria-label={`Descanso ${DIAS[t.dia]}`}
                value={String(t.descanso ?? 0)}
                onChange={(e) => ponerTurno(t.dia, 'descanso', Number(e.target.value))}
                className="rounded-lg border border-hairline bg-fill-2 px-1.5 py-1 text-[12px] text-label-secondary focus:outline-none"
              >
                {DESCANSOS.map((d) => (
                  <option key={d.v} value={String(d.v)}>{d.etiqueta}</option>
                ))}
              </select>
              <span className="tnum text-[12px] text-label-tertiary">
                → {enHoras(horasEfectivasDe(t))} de trabajo
              </span>
            </div>
          </div>
        ))}

        {turnos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-hairline pt-2">
            <Interruptor
              activo={Boolean(datos.trabajaFestivos)}
              onClick={() => { haptic(6); onChange({ ...datos, trabajaFestivos: !datos.trabajaFestivos }) }}
              etiqueta="Trabajo los festivos"
            />
            <Interruptor
              activo={Boolean(datos.pagaExtras)}
              onClick={() => { haptic(6); onChange({ ...datos, pagaExtras: !datos.pagaExtras }) }}
              etiqueta="Me pagan las horas extra"
            />
          </div>
        )}

        <p className="mt-1.5 text-[11.5px] leading-relaxed text-label-tertiary">
          Si la hora de salida es menor que la de entrada, el turno cruza la medianoche.
          La noche va de las {franja.inicio}:00 a las {franja.fin}:00 y paga un{' '}
          {Math.round(RECARGO_NOCTURNO * 100)} % más; el domingo y los festivos, un{' '}
          {Math.round(recargoDominical(hoy) * 100)} %. La jornada legal son{' '}
          {jornadaSemanal(hoy)} horas semanales. El descanso no cuenta como trabajo
          (art. 167 del CST): un turno de 8 a 5 con una hora de almuerzo son ocho
          horas, no nueve.
        </p>
      </div>

      {/* ---- Lo que sale de todo eso ------------------------------------ */}
      {resumen && (
        <div className="rounded-xl border border-hairline bg-fill-1 p-3">
          <Linea etiqueta="Sueldo pactado" valor={resumen.deducciones.base} />
          {resumen.deducciones.total > 0 ? (
            <>
              <Linea etiqueta="Salud (4 %)" valor={-resumen.deducciones.salud} tenue />
              <Linea etiqueta="Pensión (4 %)" valor={-resumen.deducciones.pension} tenue />
              {resumen.deducciones.fsp > 0 && (
                <Linea etiqueta="Fondo de solidaridad" valor={-resumen.deducciones.fsp} tenue />
              )}
            </>
          ) : (
            <p className="py-1 text-[12px] text-label-tertiary">
              Sin descuentos de nómina: en prestación de servicios los aportes van por tu
              cuenta y con otras reglas.
            </p>
          )}
          {resumen.deducciones.auxilio > 0 && (
            <Linea etiqueta="Auxilio de transporte" valor={resumen.deducciones.auxilio} tenue />
          )}

          {resumen.recargos && resumen.recargos.total > 0 && (
            <>
              {resumen.recargos.nocturno > 0 && (
                <Linea
                  etiqueta={`Recargo nocturno (${enHoras(resumen.recargos.horasNocturnas)}/sem)`}
                  valor={resumen.recargos.nocturno}
                  icono={<Moon size={11} />}
                />
              )}
              {resumen.recargos.dominical > 0 && (
                <Linea
                  etiqueta={`Dominical (${enHoras(resumen.recargos.horasDominicales)}/sem)`}
                  valor={resumen.recargos.dominical}
                  icono={<Sun size={11} />}
                />
              )}
              {resumen.recargos.festivo > 0 && (
                <Linea
                  etiqueta={`Festivos (${resumen.recargos.festivosAlAnio} al año)`}
                  valor={resumen.recargos.festivo}
                  icono={<CalendarDays size={11} />}
                />
              )}
              {resumen.recargos.extra > 0 && (
                <Linea
                  etiqueta={`Horas extra (${enHoras(resumen.recargos.horasExtra)}/sem)`}
                  valor={resumen.recargos.extra}
                />
              )}
            </>
          )}

          {/*
            Las horas de más que NO se están pagando.

            Van dichas y no escondidas. Antes se daban por pagadas al 125 % y
            eso inventaba, en un horario largo, casi la mitad del ingreso. Pero
            callarlas ahora sería el otro extremo: si de verdad se las pagan,
            hay un botón, y si no, aquí está lo que está regalando.
          */}
          {resumen.recargos && resumen.recargos.horasSobreJornada > 0 && !resumen.recargos.pagaExtras && (
            <Nota>
              Tu horario suma {enHoras(resumen.recargos.horasSemana)} a la semana,{' '}
              {enHoras(resumen.recargos.horasSobreJornada)} por encima de la jornada legal.
              No se están contando como extra porque no has dicho que te las paguen. Si te
              las pagan, márcalo arriba; si no, revisa los descansos.
            </Nota>
          )}
          {resumen.recargos && resumen.recargos.horasSobreTope > 0 && resumen.recargos.pagaExtras && (
            <Nota alerta>
              Solo se cuentan {TOPE_EXTRAS_SEMANA} horas extra a la semana: es el tope legal
              (Ley 2466 de 2025). Las otras {enHoras(resumen.recargos.horasSobreTope)} quedan
              fuera de la estimación porque, sin permiso del Ministerio, no se pagan como extra.
            </Nota>
          )}

          <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-hairline pt-1.5">
            <span className="text-[13.5px] font-semibold text-label">Te llega al mes</span>
            <span className="tnum text-[17px] font-bold text-accent-green">
              {formatMoney(resumen.mensual)}
            </span>
          </div>

          <div className="mt-1 flex items-baseline justify-between gap-2 text-[12px]">
            <span className="text-label-tertiary">Prima, cada junio y diciembre</span>
            <span className="tnum text-label-secondary">{formatMoney(resumen.prima)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="text-label-tertiary">Intereses de cesantías, en enero</span>
            <span className="tnum text-label-secondary">{formatMoney(resumen.interesesCesantias)}</span>
          </div>

          {resumen.recargos && (
            <p className="mt-2 text-[11px] leading-relaxed text-label-tertiary">
              La hora ordinaria te sale en {formatMoney(resumen.recargos.valorHora)}: es tu
              sueldo entre {horasDelMes(hoy)} horas, el divisor legal de la jornada de{' '}
              {resumen.recargos.jornadaLegal}. Los recargos son una estimación sobre un
              horario que se repite igual cada semana, con los festivos repartidos entre
              los doce meses; si un mes haces más turnos, entrará más.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Interruptor({
  activo, onClick, etiqueta,
}: {
  activo: boolean
  onClick: () => void
  etiqueta: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        'press rounded-pill border px-2.5 py-1 text-[12.5px] transition-colors',
        // Encendido con el azul de acento y no con un relleno gris: estos
        // interruptores mueven la cifra, y sobre el fondo de la tarjeta el
        // gris del estado activo no se distinguía del apagado.
        activo
          ? 'border-accent-blue/40 bg-accent-blue/15 font-medium text-accent-blue'
          : 'border-hairline text-label-secondary',
      )}
    >
      {etiqueta}
    </button>
  )
}

/** Una advertencia dentro del desglose: por qué una cifra no está ahí. */
function Nota({ children, alerta }: { children: React.ReactNode; alerta?: boolean }) {
  return (
    <div className={cn(
      'mt-1.5 flex items-start gap-1.5 rounded-lg p-2 text-[11.5px] leading-relaxed',
      alerta ? 'bg-accent-red/10 text-accent-red' : 'bg-fill-2 text-label-secondary',
    )}
    >
      <AlertTriangle size={12} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function Linea({
  etiqueta, valor, tenue, icono,
}: {
  etiqueta: string
  valor: number
  tenue?: boolean
  icono?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5 text-[12.5px]">
      <span className={cn('flex min-w-0 items-center gap-1 truncate', tenue ? 'text-label-tertiary' : 'text-label-secondary')}>
        {icono}{etiqueta}
      </span>
      <span className={cn('tnum shrink-0', valor < 0 ? 'text-accent-red' : 'text-label-secondary')}>
        {valor < 0 ? '−' : '+'}{formatMoney(Math.abs(valor))}
      </span>
    </div>
  )
}
