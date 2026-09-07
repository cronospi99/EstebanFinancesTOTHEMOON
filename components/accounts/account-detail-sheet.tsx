'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { BadgePercent, Calculator, Check, CreditCard, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { InstitutionBadge } from '@/components/ui/institution-badge'
import { formatKeypad, formatMoney, formatPercent, monthlyFromApy, parseKeypad } from '@/lib/format'
import { accountTotal, useCashback, useFinance, useSaldoConMovimientos } from '@/lib/store'
import type { Account } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'

const POCKET_COLORS = ['#0A84FF', '#30D158', '#BF5AF2', '#FF9F0A', '#FF375F', '#40C8E0']

export function AccountDetailSheet({
  account, onClose,
}: {
  account: Account | null
  onClose: () => void
}) {
  const {
    addPocket, updatePocket, deletePocket, deleteAccount, updateAccount,
    aplicarMovimientosAlSaldo, fxRate,
  } = useFinance()
  const [adding, setAdding] = useState(false)
  const [pName, setPName] = useState('')
  const [pAmount, setPAmount] = useState('')
  const [pApy, setPApy] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Edición en sitio: el rendimiento cambia (los bancos lo ajustan) y hasta
  // ahora había que borrar la cuenta y volver a crearla para corregirlo.
  const [editApy, setEditApy] = useState(false)
  const [apyDraft, setApyDraft] = useState('')
  const [editPocket, setEditPocket] = useState<string | null>(null)
  const [pDraft, setPDraft] = useState({ name: '', balance: '', apy: '' })
  const [editSaldo, setEditSaldo] = useState(false)
  const [saldoDraft, setSaldoDraft] = useState('')
  const [saldoNeg, setSaldoNeg] = useState(false)
  const [editCupo, setEditCupo] = useState(false)
  const [cupoDraft, setCupoDraft] = useState('')
  const [cuadrando, setCuadrando] = useState(false)

  // Los hooks se llaman antes del retorno temprano: no pueden ir condicionados.
  const cashback = useCashback(account?.id)
  const cuadre = useSaldoConMovimientos(account?.id)

  if (!account) return null

  const cur = account.currency
  const total = accountTotal(account)
  const pockets = account.pockets ?? []
  const monthly = account.apy ? account.balance * monthlyFromApy(account.apy) : 0

  async function handleAddPocket() {
    if (!pName.trim() || !account) return
    haptic([14, 40])
    await addPocket(account.id, {
      name: pName.trim(),
      balance: parseKeypad(pAmount),
      apy: pApy ? parseKeypad(pApy) : undefined,
      color: POCKET_COLORS[pockets.length % POCKET_COLORS.length],
    })
    setPName(''); setPAmount(''); setPApy(''); setAdding(false)
  }

  return (
    <Sheet open={Boolean(account)} onClose={onClose}>
      <div className="px-5 pb-8 pt-1">
        <div className="mb-5 flex items-center gap-3">
          <InstitutionBadge institution={account.institution} color={account.color} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[19px] font-semibold">{account.name}</h2>
            <p className="text-[13px] text-label-secondary">
              {account.institution}
              {cur === 'USD' && ' · USD'}
            </p>
          </div>
        </div>

        {/* Saldo, editable. El saldo real se desvía del calculado —una compra
            que no se registró, un cobro del banco— y sin poder corregirlo a
            mano la app deja de cuadrar con la realidad. */}
        <div className="mb-5 rounded-2xl border border-hairline bg-white/[0.04] p-4">
          {editSaldo ? (
            <>
              <p className="mb-2 text-[12px] text-label-secondary">
                {pockets.length > 0 ? 'Saldo general (sin bolsillos)' : 'Saldo'}
              </p>
              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={() => { haptic(6); setSaldoNeg((n) => !n) }}
                  aria-label={saldoNeg ? 'Cambiar a positivo' : 'Cambiar a negativo'}
                  className={cn(
                    'press flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[18px] font-bold',
                    saldoNeg ? 'border-transparent bg-accent-red text-white' : 'border-hairline text-label-secondary',
                  )}
                >
                  −
                </button>
                <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-hairline bg-white/[0.06] px-3 py-2">
                  <span className="text-[16px] text-label-secondary">{cur === 'USD' ? 'US$' : '$'}</span>
                  <input
                    autoFocus value={saldoDraft ? formatKeypad(saldoDraft) : ''} inputMode="decimal"
                    onChange={(e) => setSaldoDraft(e.target.value.replace(/[^\d,]/g, ''))}
                    placeholder="0"
                    className="tnum w-full bg-transparent text-[20px] font-semibold text-label placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditSaldo(false)}
                  className="press flex-1 rounded-xl border border-hairline py-2.5 text-[14px] text-label-secondary">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    haptic([14, 30])
                    const v = parseKeypad(saldoDraft)
                    updateAccount(account.id, { balance: saldoNeg ? -v : v })
                    setEditSaldo(false)
                  }}
                  className="press flex-1 rounded-xl bg-accent-blue py-2.5 text-[14px] font-semibold text-white">
                  Guardar saldo
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => {
                haptic(6)
                setSaldoDraft(String(Math.abs(account.balance)).replace('.', ','))
                setSaldoNeg(account.balance < 0)
                setEditSaldo(true)
              }}
              className="w-full text-left"
            >
              <p className="mb-1 flex items-center gap-1.5 text-[12px] text-label-secondary">
                Saldo total <Pencil size={11} className="text-label-tertiary" />
              </p>
              <p className={cn('tnum text-[30px] font-bold leading-none', total < 0 ? 'text-accent-red' : 'text-label')}>
                {formatMoney(total, cur)}
              </p>
            </button>
          )}
          {cur === 'USD' && (
            <p className="tnum mt-1 text-[13px] text-label-tertiary">≈ {formatMoney(total * fxRate)}</p>
          )}
          {pockets.length > 0 && (
            <p className="tnum mt-2 border-t border-hairline pt-2 text-[12px] text-label-tertiary">
              General {formatMoney(account.balance, cur)} · Bolsillos{' '}
              {formatMoney(total - account.balance, cur)}
            </p>
          )}
        </div>

        {/*
          Cuadrar el saldo con los movimientos.
          Hasta hace poco registrar un movimiento no tocaba el saldo de su
          cuenta en el servidor, así que muchos saldos se quedaron en la cifra
          del día que se creó la cuenta. Esto los pone al día de una vez.

          No se presenta como una alarma sino como una herramienta, y a
          propósito: el código no puede saber qué movimientos ya están
          reflejados en el saldo, así que quien decide es quien conoce sus
          cuentas. Por eso enseña antes la cifra que quedaría.
        */}
        {cuadre && cuadre.movimientos > 0 && (
          <div className={cn(
            'mb-5 rounded-2xl border px-4 py-3',
            cuadrando ? 'border-accent-orange/30 bg-accent-orange/[0.08]' : 'border-hairline bg-white/[0.04]',
          )}>
            {cuadrando ? (
              <>
                <p className="text-[13px] font-semibold text-label">Cuadrar con los movimientos</p>
                <p className="tnum mt-2 text-[15px] text-label-secondary">
                  {formatMoney(cuadre.actual, cur)}
                  {' → '}
                  <span className={cn('font-semibold', cuadre.propuesto < 0 ? 'text-accent-red' : 'text-label')}>
                    {formatMoney(cuadre.propuesto, cur)}
                  </span>
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-label-tertiary">
                  Suma al saldo guardado los {cuadre.movimientos} movimientos de esta cuenta.
                  Hazlo una sola vez: repetirlo los contaría dos veces.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setCuadrando(false)}
                    className="press h-10 flex-1 rounded-xl border border-hairline text-[14px] font-medium text-label-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      haptic([14, 40, 22])
                      aplicarMovimientosAlSaldo(account!.id).catch(() => {})
                      setCuadrando(false)
                    }}
                    className="press h-10 flex-1 rounded-xl bg-accent-orange text-[14px] font-semibold text-black"
                  >
                    Aplicar
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => { haptic(6); setCuadrando(true) }}
                className="flex w-full items-center gap-3 text-left"
              >
                <Calculator size={16} className="shrink-0 text-label-tertiary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-label">Cuadrar con los movimientos</p>
                  <p className="text-[12px] text-label-tertiary">
                    Si el saldo se quedó atrás, aplica aquí los {cuadre.movimientos} registrados.
                  </p>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Rendimiento, editable. No aplica a tarjetas de crédito: esas cobran
            intereses, no los pagan. */}
        {account.type !== 'credit' && (
        <div className={cn(
          'mb-5 rounded-2xl border px-4 py-3',
          account.apy ? 'border-accent-green/25 bg-accent-green/[0.08]' : 'border-hairline bg-white/[0.04]',
        )}>
          {editApy ? (
            <div>
              <p className="mb-2 text-[12px] text-label-secondary">Rendimiento E.A.</p>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-1 rounded-xl border border-hairline bg-white/[0.06] px-3 py-2">
                  <input
                    autoFocus value={apyDraft} inputMode="decimal"
                    onChange={(e) => setApyDraft(e.target.value.replace(/[^\d,]/g, '').slice(0, 6))}
                    placeholder="11,5"
                    className="tnum w-full bg-transparent text-[18px] font-semibold text-label placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
                  />
                  <span className="text-[15px] text-label-secondary">%</span>
                </div>
                <button
                  onClick={() => { haptic([14, 30]); updateAccount(account.id, { apy: apyDraft ? parseKeypad(apyDraft) : undefined }); setEditApy(false) }}
                  aria-label="Guardar rendimiento"
                  className="press flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue text-white"
                >
                  <Check size={17} />
                </button>
                <button
                  onClick={() => setEditApy(false)} aria-label="Cancelar"
                  className="press flex h-10 w-10 items-center justify-center rounded-xl border border-hairline text-label-secondary"
                >
                  <X size={17} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { haptic(6); setApyDraft(account.apy ? String(account.apy).replace('.', ',') : ''); setEditApy(true) }}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <p className="flex items-center gap-1.5 text-[12px] text-label-secondary">
                  Rendimiento E.A. <Pencil size={11} className="text-label-tertiary" />
                </p>
                {account.apy ? (
                  <p className="tnum text-[18px] font-semibold text-accent-green">{formatPercent(account.apy, false)}</p>
                ) : (
                  <p className="text-[15px] font-medium text-accent-blue">Añadir tasa</p>
                )}
              </div>
              {account.apy ? (
                <div className="text-right">
                  <p className="text-[12px] text-label-secondary">Estimado al mes</p>
                  <p className="tnum text-[15px] font-semibold text-label">+{formatMoney(monthly, cur)}</p>
                </div>
              ) : null}
            </button>
          )}
        </div>
        )}

        {/* Cupo de la tarjeta */}
        {account.type === 'credit' && (
          <div className="mb-5 rounded-2xl border border-hairline bg-white/[0.04] p-4">
            {editCupo ? (
              <>
                <p className="mb-2 text-[12px] text-label-secondary">Cupo total</p>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-hairline bg-white/[0.06] px-3 py-2">
                    <span className="text-[16px] text-label-secondary">{cur === 'USD' ? 'US$' : '$'}</span>
                    <input
                      autoFocus value={cupoDraft ? formatKeypad(cupoDraft) : ''} inputMode="decimal"
                      onChange={(e) => setCupoDraft(e.target.value.replace(/[^\d,]/g, ''))}
                      placeholder="0"
                      className="tnum w-full bg-transparent text-[18px] font-semibold text-label placeholder:font-normal placeholder:text-label-tertiary focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => { haptic([14, 30]); updateAccount(account.id, { creditLimit: cupoDraft ? parseKeypad(cupoDraft) : undefined }); setEditCupo(false) }}
                    aria-label="Guardar cupo"
                    className="press flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue text-white"
                  >
                    <Check size={17} />
                  </button>
                  <button
                    onClick={() => setEditCupo(false)} aria-label="Cancelar"
                    className="press flex h-10 w-10 items-center justify-center rounded-xl border border-hairline text-label-secondary"
                  >
                    <X size={17} />
                  </button>
                </div>
              </>
            ) : account.creditLimit ? (
              (() => {
                // La deuda se guarda en negativo; el cupo usado es su magnitud.
                const usado = Math.abs(Math.min(account.balance, 0))
                const disponible = Math.max(account.creditLimit - usado, 0)
                const uso = account.creditLimit > 0 ? usado / account.creditLimit : 0
                // Por encima del 30 % el uso empieza a pesar en el historial
                // crediticio; el color lo señala antes de que sea un problema.
                const tono = uso > 0.7 ? '#FF453A' : uso > 0.3 ? '#FF9F0A' : '#30D158'
                return (
                  <>
                    <button onClick={() => { haptic(6); setCupoDraft(String(account.creditLimit).replace('.', ',')); setEditCupo(true) }}
                      className="mb-2 flex w-full items-baseline justify-between text-left">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium text-label">
                        <CreditCard size={13} className="text-label-tertiary" /> Cupo
                        <Pencil size={11} className="text-label-tertiary" />
                      </span>
                      <span className="tnum text-[13px] text-label-secondary">
                        {formatMoney(usado, cur)} de {formatMoney(account.creditLimit, cur)}
                      </span>
                    </button>
                    <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${Math.min(uso, 1) * 100}%` }}
                        transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                        className="h-full rounded-full" style={{ backgroundColor: tono }}
                      />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="tnum text-[13px] font-semibold" style={{ color: tono }}>
                        {Math.round(uso * 100)} % usado
                      </span>
                      <span className="tnum text-[13px] text-label">
                        Disponible {formatMoney(disponible, cur)}
                      </span>
                    </div>
                  </>
                )
              })()
            ) : (
              <button onClick={() => { haptic(6); setCupoDraft(''); setEditCupo(true) }}
                className="flex w-full items-center justify-between text-left">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-label">
                  <CreditCard size={13} className="text-label-tertiary" /> Cupo total
                </span>
                <span className="text-[14px] font-medium text-accent-blue">Añadir</span>
              </button>
            )}
          </div>
        )}

        {/* Cashback recibido en esta cuenta */}
        {cashback.total > 0 && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-accent-orange/25 bg-accent-orange/[0.08] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-orange/15 text-accent-orange">
              <BadgePercent size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-label-secondary">Cashback recibido</p>
              <p className="tnum text-[15px] font-semibold text-label">{formatMoney(cashback.total, cur)}</p>
            </div>
            {cashback.esteMes > 0 && (
              <span className="tnum shrink-0 rounded-pill bg-accent-orange/15 px-2.5 py-1 text-[12px] font-semibold text-accent-orange">
                +{formatMoney(cashback.esteMes, cur)} este mes
              </span>
            )}
          </div>
        )}

        {/* Cuotas de tarjeta */}
        {account.type === 'credit' && account.installments ? (
          <div className="mb-5 rounded-2xl border border-hairline bg-white/[0.04] p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[13px] font-medium text-label">Cuotas</p>
              <p className="tnum text-[13px] text-label-secondary">
                {account.installmentsPaid ?? 0} de {account.installments}
              </p>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((account.installmentsPaid ?? 0) / account.installments) * 100}%` }}
                transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                className="h-full rounded-full bg-accent-orange"
              />
            </div>
            <p className="tnum mb-3 text-[12px] text-label-tertiary">
              Cuota aproximada {formatMoney(Math.round(Math.abs(account.balance) / account.installments), cur)} al mes
            </p>
            <button
              onClick={() => {
                haptic(10)
                updateAccount(account.id, {
                  installmentsPaid: Math.min((account.installmentsPaid ?? 0) + 1, account.installments!),
                })
              }}
              disabled={(account.installmentsPaid ?? 0) >= account.installments}
              className="press w-full rounded-xl border border-hairline bg-white/[0.05] py-2.5 text-[14px]
                         font-medium text-accent-blue disabled:opacity-40"
            >
              Marcar cuota pagada
            </button>
          </div>
        ) : null}

        {/* Bolsillos */}
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-label-tertiary">Bolsillos</h3>
          {!adding && (
            <button onClick={() => { haptic(6); setAdding(true) }} className="flex items-center gap-1 text-[13px] font-medium text-accent-blue">
              <Plus size={14} /> Añadir
            </button>
          )}
        </div>

        {pockets.length === 0 && !adding && (
          <div className="mb-4 rounded-2xl border border-hairline bg-white/[0.03] p-5 text-center">
            <Wallet size={20} className="mx-auto mb-2 text-label-tertiary" />
            <p className="text-[13px] text-label-secondary">
              Aún no hay bolsillos en esta cuenta.
            </p>
          </div>
        )}

        {pockets.length > 0 && (
          <div className="mb-4 divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-white/[0.04]">
            {pockets.map((p) => editPocket === p.id ? (
              <div key={p.id} className="space-y-2 px-4 py-3">
                <input
                  value={pDraft.name} onChange={(e) => setPDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Nombre" autoFocus
                  className="w-full rounded-lg border border-hairline bg-white/[0.06] px-3 py-2 text-[15px] text-label focus:outline-none"
                />
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center gap-1 rounded-lg border border-hairline bg-white/[0.06] px-3 py-2">
                    <span className="text-[14px] text-label-secondary">{cur === 'USD' ? 'US$' : '$'}</span>
                    <input
                      value={pDraft.balance ? formatKeypad(pDraft.balance) : ''}
                      onChange={(e) => setPDraft((d) => ({ ...d, balance: e.target.value.replace(/[^\d,]/g, '') }))}
                      inputMode="decimal" placeholder="0"
                      className="tnum w-full bg-transparent text-[15px] font-semibold text-label focus:outline-none"
                    />
                  </div>
                  <div className="flex w-[100px] items-center gap-1 rounded-lg border border-hairline bg-white/[0.06] px-3 py-2">
                    <input
                      value={pDraft.apy} onChange={(e) => setPDraft((d) => ({ ...d, apy: e.target.value.replace(/[^\d,]/g, '').slice(0, 5) }))}
                      inputMode="decimal" placeholder="E.A."
                      className="tnum w-full bg-transparent text-[15px] font-semibold text-label placeholder:font-normal focus:outline-none"
                    />
                    <span className="text-[13px] text-label-secondary">%</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditPocket(null)}
                    className="press flex-1 rounded-lg border border-hairline py-2 text-[13px] text-label-secondary">
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      haptic([14, 30])
                      updatePocket(account.id, p.id, {
                        name: pDraft.name.trim() || p.name,
                        balance: parseKeypad(pDraft.balance),
                        apy: pDraft.apy ? parseKeypad(pDraft.apy) : undefined,
                      })
                      setEditPocket(null)
                    }}
                    className="press flex-1 rounded-lg bg-accent-blue py-2 text-[13px] font-semibold text-white">
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? '#98989F' }} />
                <button
                  onClick={() => {
                    haptic(6)
                    setPDraft({
                      name: p.name,
                      balance: String(p.balance).replace('.', ','),
                      apy: p.apy ? String(p.apy).replace('.', ',') : '',
                    })
                    setEditPocket(p.id)
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="flex items-center gap-1.5 truncate text-[15px] font-medium text-label">
                    {p.name} <Pencil size={11} className="shrink-0 text-label-tertiary" />
                  </p>
                  {p.apy ? (
                    <p className="tnum text-[12px] text-accent-green">{formatPercent(p.apy, false)} E.A.</p>
                  ) : null}
                </button>
                <span className="tnum shrink-0 text-[15px] font-semibold">{formatMoney(p.balance, cur)}</span>
                <button
                  onClick={() => { haptic([16, 30]); deletePocket(account.id, p.id) }}
                  aria-label={`Eliminar bolsillo ${p.name}`}
                  className="press shrink-0 p-1 text-label-tertiary"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {adding && (
          <div className="mb-4 space-y-2 rounded-2xl border border-hairline bg-white/[0.04] p-4">
            <input
              value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Nombre del bolsillo" autoFocus
              className="w-full rounded-xl border border-hairline bg-white/[0.05] px-3 py-2.5 text-[15px]
                         text-label placeholder:text-label-tertiary focus:border-accent-blue/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-hairline bg-white/[0.05] px-3 py-2.5">
                <span className="text-[15px] text-label-secondary">{cur === 'USD' ? 'US$' : '$'}</span>
                <input
                  value={pAmount ? formatKeypad(pAmount) : ''}
                  onChange={(e) => setPAmount(e.target.value.replace(/[^\d,]/g, ''))}
                  placeholder="0" inputMode="decimal"
                  className="tnum w-full bg-transparent text-[15px] font-semibold text-label placeholder:text-label-tertiary focus:outline-none"
                />
              </div>
              <div className="flex w-[110px] items-center gap-1 rounded-xl border border-hairline bg-white/[0.05] px-3 py-2.5">
                <input
                  value={pApy} onChange={(e) => setPApy(e.target.value.replace(/[^\d,]/g, '').slice(0, 5))}
                  placeholder="E.A." inputMode="decimal"
                  className="tnum w-full bg-transparent text-[15px] font-semibold text-label placeholder:text-label-tertiary focus:outline-none"
                />
                <span className="text-[14px] text-label-secondary">%</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setAdding(false); setPName(''); setPAmount(''); setPApy('') }}
                className="press flex-1 rounded-xl border border-hairline py-2.5 text-[14px] text-label-secondary">
                Cancelar
              </button>
              <button onClick={handleAddPocket} disabled={!pName.trim()}
                className="press flex-1 rounded-xl bg-accent-blue py-2.5 text-[14px] font-semibold text-white disabled:opacity-40">
                Crear bolsillo
              </button>
            </div>
          </div>
        )}

        {/* Eliminar cuenta */}
        {!confirmDelete ? (
          <button onClick={() => { haptic(8); setConfirmDelete(true) }}
            className="press w-full rounded-2xl border border-hairline py-3 text-[14px] font-medium text-accent-red">
            Eliminar cuenta
          </button>
        ) : (
          <div className="rounded-2xl border border-accent-red/30 bg-accent-red/[0.08] p-4">
            <p className="mb-3 text-center text-[13px] leading-relaxed text-label">
              Se borrarán también sus movimientos y bolsillos. No se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="press flex-1 rounded-xl border border-hairline py-2.5 text-[14px] text-label-secondary">
                Cancelar
              </button>
              <button onClick={() => { haptic([20, 40]); deleteAccount(account.id); onClose() }}
                className="press flex-1 rounded-xl bg-accent-red py-2.5 text-[14px] font-semibold text-white">
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
