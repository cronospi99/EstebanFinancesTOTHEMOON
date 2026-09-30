'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { CategoryIcon } from '@/components/ui/category-icon'
import { SpendDonut } from '@/components/expenses/spend-donut'
import { PeriodPicker } from '@/components/expenses/period-picker'
import { TransactionList } from '@/components/expenses/transaction-list'
import { SubscriptionsTeaser } from '@/components/subscriptions/subscriptions-teaser'
import { categoryById } from '@/lib/categories'
import { formatDate, formatMoney } from '@/lib/format'
import { enRango, rangoPeriodo, type Periodo } from '@/lib/periodos'
import { useFinance } from '@/lib/store'
import { cn, haptic } from '@/lib/utils'

type Vista = 'expense' | 'income'

/**
 * Gastos —o ingresos— por el período que se quiera.
 *
 * Antes era siempre el mes natural, que es como llegan los extractos pero no
 * responde todo: «cuánto llevo esta semana» se pregunta un jueves y «en qué se
 * me fue el año» en diciembre. El período elegido manda sobre todo lo de la
 * pantalla —el donut, las categorías, la lista— para que las cuatro cifras
 * hablen siempre del mismo tramo de tiempo.
 *
 * Los ingresos se miran con la misma pantalla y no con otra: la pregunta es
 * la misma dada vuelta —de dónde vino el dinero en vez de adónde se fue— y
 * con el mismo período, las mismas categorías con su histórico y la misma
 * lista, se comparan sin tener que aprender nada nuevo.
 */
export default function ExpensesPage() {
  const { transactions } = useFinance()
  const [vista, setVista] = useState<Vista>('expense')
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [desplazamiento, setDesplazamiento] = useState(0)
  const [abierta, setAbierta] = useState<string | null>(null)
  const esGasto = vista === 'expense'

  const rango = useMemo(() => rangoPeriodo(periodo, desplazamiento), [periodo, desplazamiento])

  const { enPeriodo, income, expense, porCategoria } = useMemo(() => {
    const enPeriodo = transactions.filter((t) => enRango(t.occurredAt, rango))
    let income = 0, expense = 0
    // Por categoría, del lado que se está mirando.
    const mapa = new Map<string, number>()
    for (const t of enPeriodo) {
      if (t.type === 'income') income += t.amount
      else if (t.type === 'expense') expense += t.amount
      if (t.type === vista) mapa.set(t.categoryId, (mapa.get(t.categoryId) ?? 0) + t.amount)
    }
    const porCategoria = [...mapa.entries()]
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount)
    return { enPeriodo, income, expense, porCategoria }
  }, [transactions, rango, vista])
  const total = esGasto ? expense : income

  /*
   * El histórico completo de cada categoría, sin filtrar por fecha.
   *
   * Es lo que se despliega al tocarla, y a propósito ignora el período: la
   * pregunta que lleva a tocar una categoría es «¿en qué se me va el dinero
   * aquí?», y la respuesta se corta si solo se enseña el mes en curso. La
   * cifra del período sigue arriba, en su fila.
   */
  const historial = useMemo(() => {
    const mapa = new Map<string, { total: number; movimientos: typeof transactions }>()
    for (const t of transactions) {
      if (t.type !== vista) continue
      const entrada = mapa.get(t.categoryId) ?? { total: 0, movimientos: [] }
      entrada.total += t.amount
      entrada.movimientos.push(t)
      mapa.set(t.categoryId, entrada)
    }
    for (const e of mapa.values()) {
      e.movimientos.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    }
    return mapa
  }, [transactions, vista])

  return (
    <div className="space-y-5 px-5">
      <PageHeader title={esGasto ? 'Gastos' : 'Ingresos'} />

      <Segmented<Vista>
        id="vista-gastos" className="-mt-2"
        value={vista}
        onChange={(v) => { setVista(v); setAbierta(null) }}
        options={[{ value: 'expense', label: 'Gastos' }, { value: 'income', label: 'Ingresos' }]}
      />

      {/* Lo que se cobra solo, arriba del todo: es gasto como el resto, pero
          del que nadie decide cada mes, y por eso es el que se olvida. Desde
          aquí se llega a su pantalla, que en el móvil no cabe en la barra. */}
      {esGasto && <SubscriptionsTeaser />}

      <Card className="p-5">
        <div className="mb-4">
          <PeriodPicker
            periodo={periodo} onPeriodo={setPeriodo}
            desplazamiento={desplazamiento} onDesplazamiento={setDesplazamiento}
            etiqueta={rango.etiqueta}
          />
        </div>

        {esGasto
          ? <SpendDonut data={porCategoria} total={expense} />
          : <SpendDonut data={porCategoria} total={income} etiqueta="Recibido"
              vacio="Sin ingresos en este período." restoId="other-income" />}

        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hairline pt-4">
          {/* Debajo va el otro lado: con los gastos, lo que entró; con los
              ingresos, lo que salió. El balance es el mismo en las dos. */}
          <div>
            <div className="text-[12px] text-label-secondary">{esGasto ? 'Ingresos' : 'Gastos'}</div>
            <div className={cn('tnum text-[16px] font-semibold', esGasto ? 'text-accent-green' : 'text-label')}>
              {formatMoney(esGasto ? income : expense)}
            </div>
          </div>
          <div>
            <div className="text-[12px] text-label-secondary">Balance</div>
            <div className={cn('tnum text-[16px] font-semibold', income - expense >= 0 ? 'text-label' : 'text-accent-red')}>
              {formatMoney(income - expense)}
            </div>
          </div>
        </div>
      </Card>

      <section>
        <CardHeader title="Por categoría" />
        <Card className="divide-y divide-hairline overflow-hidden">
          {porCategoria.map((row, i) => {
            const cat = categoryById(row.categoryId)
            const share = total ? (row.amount / total) * 100 : 0
            const abiertaEsta = abierta === row.categoryId
            const todo = historial.get(row.categoryId)

            return (
              <div key={row.categoryId} className="fila-entra" style={{ '--i': i } as React.CSSProperties}>
                <button
                  onClick={() => { haptic(6); setAbierta(abiertaEsta ? null : row.categoryId) }}
                  aria-expanded={abiertaEsta}
                  className="press-soft flex w-full items-center gap-3 px-4 py-3 text-left active:bg-fill-1"
                >
                  <CategoryIcon icon={cat.icon} color={cat.color} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-medium text-label">{cat.name}</span>
                      <span className={cn('tnum shrink-0 text-[14px] font-semibold', !esGasto && 'text-accent-green')}>
                        {formatMoney(row.amount)}
                      </span>
                    </div>
                    {/* Barra proporcional: comunica el peso relativo sin leer cifras */}
                    <div className="h-1.5 overflow-hidden rounded-full bg-fill-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${share}%` }}
                        transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                  <motion.span
                    animate={{ rotate: abiertaEsta ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 text-label-tertiary"
                  >
                    <ChevronDown size={16} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {abiertaEsta && todo && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-hairline bg-fill-1 px-4 py-2">
                        <p className="tnum mb-1 text-[11px] text-label-tertiary">
                          Todo el histórico · {todo.movimientos.length}{' '}
                          {todo.movimientos.length === 1 ? 'movimiento' : 'movimientos'} ·{' '}
                          {formatMoney(todo.total)}
                        </p>
                        {/* Con altura tope y scroll propio: una categoría de dos
                            años son cientos de filas, y empujar el resto de la
                            pantalla hasta el olvido no ayuda a nadie. */}
                        <ul className="max-h-[300px] divide-y divide-hairline overflow-y-auto">
                          {todo.movimientos.map((t) => (
                            <li key={t.id} className="flex items-center gap-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] text-label">{t.description || cat.name}</p>
                                <p className="text-[11px] text-label-tertiary">{formatDate(t.occurredAt)}</p>
                              </div>
                              <span className="tnum shrink-0 text-[13px] font-medium text-label">
                                {formatMoney(t.amount, t.currency)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {!porCategoria.length && (
            <div className="p-8 text-center text-[14px] text-label-secondary">
              {esGasto ? 'Sin gastos registrados en este período.' : 'Sin ingresos registrados en este período.'}
            </div>
          )}
        </Card>
      </section>

      <section>
        <CardHeader title="Movimientos" />
        {/* Con los ingresos, solo los ingresos: es el histórico que se vino
            a mirar. Con los gastos, todo, como siempre. */}
        <TransactionList transactions={esGasto ? enPeriodo : enPeriodo.filter((t) => t.type === 'income')} />
      </section>
    </div>
  )
}
