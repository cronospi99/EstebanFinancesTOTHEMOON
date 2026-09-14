-- ===========================================================================
--  Cruce y ajuste de cuentas en los abonos a deudas
-- ===========================================================================
--  Una deuda entre personas no siempre se salda pasando plata. Se salda
--  pagándole algo a la otra persona con la tarjeta, o cruzando una compra que
--  ya se hizo, o perdonando un pedazo. Hasta ahora un abono era un importe y
--  una fecha, y eso solo cubría el caso más simple.
-- ===========================================================================

alter table public.debt_payments
  -- De dónde salió el dinero. Puede ser una tarjeta: pagarle a alguien con la
  -- tarjeta no es dejar de deber, es cambiar de acreedor, y las dos mitades
  -- tienen que moverse. Si la cuenta se borra, el abono se queda sin origen
  -- pero no se borra: lo que se pagó, se pagó.
  add column if not exists account_id uuid references public.accounts (id) on delete set null,
  -- Un movimiento que ya existía y se cruza contra la deuda. Es el caso que no
  -- cabía: la compra ya está registrada, y crear otra la cobraría dos veces.
  add column if not exists transaction_id uuid references public.transactions (id) on delete set null;

-- Un abono en negativo es un cargo: la deuda sube. Pasa de verdad —el otro
-- puso algo más, o alguien apuntó mal— y sin esto no había forma de corregirlo
-- salvo rehacer la deuda entera.
alter table public.debt_payments drop constraint if exists debt_payments_amount_check;
alter table public.debt_payments add constraint debt_payments_amount_check check (amount <> 0);

-- Los abonos de una cuenta se consultan al borrarla, para saber cuáles quedan
-- sin origen.
create index if not exists debt_payments_account_idx
  on public.debt_payments (user_id, account_id);

-- PostgREST guarda el esquema en memoria: sin este aviso, las dos columnas
-- nuevas no existen para la API hasta que se reinicie, y el primer abono que
-- las use falla con un «column not found» que no se parece en nada a la causa.
notify pgrst, 'reload schema';
