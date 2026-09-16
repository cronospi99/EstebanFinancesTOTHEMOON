-- ===========================================================================
--  Ingresos recurrentes
-- ===========================================================================
--  El sueldo, el arriendo que cobras, la mensualidad del cliente fijo.
--
--  Es el espejo de una suscripción y comparte su forma a propósito: un ancla,
--  un ciclo y un importe. La diferencia es hacia dónde va el dinero, y por eso
--  no se metió como una suscripción de importe negativo: los totales de
--  «cuánto se me va al mes» se habrían llenado de cifras que entran, y la
--  pantalla de suscripciones existe justo para responder lo contrario.
--
--  Para qué hace falta: la proyección de liquidez. Sin saber qué entra, un
--  saldo proyectado a 90 días solo puede bajar, y una app que le dice a
--  cualquiera que en tres meses estará en cero no sirve para decidir nada. La
--  quincena del 30 es lo que hace que un mes apretado no sea un problema.
--
--  No genera movimientos por su cuenta, a diferencia de las suscripciones. Un
--  cobro que no llegó se corrige con un toque; un sueldo que la app da por
--  recibido y no llegó deja el saldo mintiendo hacia arriba, que es el lado
--  peligroso de equivocarse.
-- ===========================================================================

create table if not exists public.recurring_incomes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- De qué es: «Salario», «Arriendo del apartamento», «Cliente X».
  name        text not null,
  amount      numeric(16,2) not null default 0 check (amount >= 0),
  currency    text not null default 'COP' check (currency in ('COP','USD')),
  -- Los mismos cinco ciclos de las suscripciones. Que el catálogo sea el mismo
  -- no es casualidad: la quincena es un ciclo de verdad, y va como 'quincenal'
  -- porque «cada 15 días» y «dos veces al mes» no son lo mismo en un mes de 31.
  cycle       text not null default 'mensual'
              check (cycle in ('semanal','quincenal','mensual','trimestral','semestral','anual')),
  -- Un día en que entró —o va a entrar—. De aquí sale todo lo demás.
  anchor_at   date not null default current_date,
  -- En qué cuenta cae. Sin ella el ingreso suma al total proyectado pero no se
  -- puede decir en qué cuenta estará ese dinero.
  account_id  uuid references public.accounts (id) on delete set null,
  -- Se apaga sin borrarse: un contrato que terminó deja de proyectarse pero su
  -- historia explica los ingresos de los meses anteriores.
  active      boolean not null default true,
  note        text,
  color       text not null default '#30D158',
  created_at  timestamptz not null default now()
);

create index if not exists recurring_incomes_user_idx
  on public.recurring_incomes (user_id, active, anchor_at);

alter table public.recurring_incomes enable row level security;

drop policy if exists "own rows" on public.recurring_incomes;
create policy "own rows" on public.recurring_incomes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_user_id_trg on public.recurring_incomes;
create trigger set_user_id_trg
  before insert on public.recurring_incomes
  for each row execute function public.set_user_id();

notify pgrst, 'reload schema';
