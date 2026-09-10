-- ===========================================================================
--  Deudas personales
-- ===========================================================================
--  Lo que le debes a una persona, no a un banco. Va aparte de las cuentas de
--  crédito porque el dato de partida es otro: una tarjeta tiene cupo, corte y
--  cuotas; un préstamo entre personas tiene a quién le debes, cuánto te
--  prestó, desde cuándo corre y qué interés pactaron —si es que pactaron
--  alguno, que entre conocidos suele ser ninguno—.
-- ===========================================================================

create table if not exists public.debts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- A quién. Texto libre: no hay lista de personas ni falta que hace.
  person     text not null,
  -- El monto prestado. Lo que se debe hoy no se guarda: se calcula con los
  -- abonos y la tasa, y guardarlo sería un segundo sitio donde equivocarse.
  principal  numeric(16,2) not null default 0 check (principal >= 0),
  currency   text not null default 'COP' check (currency in ('COP','USD')),
  -- Interés efectivo anual en %. Nulo = la deuda no genera intereses.
  -- Se guarda anual aunque se pacte mensual, como las tasas de las cuentas.
  rate       numeric(7,3) check (rate is null or rate >= 0),
  started_at date not null default current_date,
  due_date   date,
  note       text,
  color      text not null default '#FF453A',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Abonos
-- ---------------------------------------------------------------------------
--  Filas y no una columna `pagado` en la deuda: con interés, *cuándo* se pagó
--  cambia cuánto se debe hoy —cada abono baja el saldo sobre el que corre la
--  tasa— así que un total suelto no permitiría calcularlo. Y sin interés sigue
--  siendo lo que uno quiere ver: qué le ha ido dando y en qué fechas.
create table if not exists public.debt_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- En cascada: un abono sin su deuda no significa nada.
  debt_id     uuid not null references public.debts (id) on delete cascade,
  amount      numeric(16,2) not null check (amount > 0),
  occurred_at date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);

-- Los abonos siempre se leen los de una deuda, en orden de fecha.
create index if not exists debt_payments_user_debt_idx
  on public.debt_payments (user_id, debt_id, occurred_at);

-- ===========================================================================
--  Row Level Security y user_id automático
-- ===========================================================================
--  Igual que el resto de tablas: sin la política, la llave anónima —que viaja
--  en el navegador— podría leer las deudas de cualquiera.
alter table public.debts         enable row level security;
alter table public.debt_payments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['debts','debt_payments'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)', t);

    execute format('drop trigger if exists set_user_id_trg on public.%I', t);
    execute format(
      'create trigger set_user_id_trg
         before insert on public.%I
         for each row execute function public.set_user_id()', t);
  end loop;
end $$;
