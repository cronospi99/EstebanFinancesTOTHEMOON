-- ===========================================================================
--  Finanzas — esquema de base de datos
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ===========================================================================
--  Modelo de seguridad: cada fila pertenece a un usuario (user_id) y Row Level
--  Security garantiza que nadie —ni siquiera con la llave anónima— pueda leer
--  o escribir filas ajenas. Es lo que hace que la app sea realmente privada.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Cuentas (bancos, neobancos, efectivo)
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  institution text not null default '',
  type        text not null default 'checking'
              check (type in ('checking','savings','credit','cash','investment')),
  balance     numeric(16,2) not null default 0,
  currency    text not null default 'COP' check (currency in ('COP','USD')),
  color       text not null default '#0A84FF',
  -- Rendimiento efectivo anual en % (0 a 100).
  apy         numeric(6,3),
  -- Bolsillos: subdivisiones de la cuenta. Van como jsonb y no en tabla
  -- aparte porque no existen sin su cuenta y siempre se leen con ella.
  pockets     jsonb not null default '[]'::jsonb,
  -- Solo tarjetas de crédito.
  credit_limit      numeric(16,2),
  installments      integer,
  installments_paid integer,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Transacciones
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  account_id  uuid references public.accounts (id) on delete set null,
  -- Bolsillo dentro de la cuenta; es un id del jsonb, no una clave foránea.
  pocket_id   text,
  category_id text not null default 'other',
  amount      numeric(16,2) not null check (amount >= 0),
  type        text not null default 'expense' check (type in ('expense','income','transfer')),
  description text not null default '',
  occurred_at timestamptz not null default now(),
  currency    text check (currency in ('COP','USD')),
  created_at  timestamptz not null default now()
);

-- El dashboard siempre consulta "mis movimientos, más recientes primero".
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Presupuestos mensuales por categoría
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category_id text not null,
  amount      numeric(16,2) not null check (amount >= 0),
  created_at  timestamptz not null default now(),
  -- Un solo presupuesto por categoría y usuario.
  unique (user_id, category_id)
);

-- ---------------------------------------------------------------------------
-- Posiciones de inversión
-- ---------------------------------------------------------------------------
create table if not exists public.holdings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  symbol     text not null,
  name       text not null default '',
  quantity   numeric(20,8) not null default 0,
  avg_cost   numeric(16,4) not null default 0,
  asset_type text not null default 'stock' check (asset_type in ('stock','etf','crypto','fx','cdt')),
  currency   text not null default 'USD' check (currency in ('COP','USD')),
  -- Plataforma donde está la posición (ARQ, Trii, Insights…).
  account_id uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Metas de ahorro
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  target     numeric(16,2) not null default 0,
  saved      numeric(16,2) not null default 0,
  currency   text not null default 'COP' check (currency in ('COP','USD')),
  deadline   date,
  color      text not null default '#0A84FF',
  account_id uuid references public.accounts (id) on delete set null,
  pocket_id  text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Operaciones de inversión (compras y ventas)
-- ---------------------------------------------------------------------------
--  El libro de operaciones es la fuente de verdad de una posición: la cantidad
--  y el coste promedio de `holdings` se recalculan a partir de él. Guardar solo
--  la posición, como antes, hacía imposible consultar el historial o corregir
--  una compra mal tecleada.
create table if not exists public.trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  symbol      text not null,
  name        text not null default '',
  side        text not null default 'buy' check (side in ('buy','sell')),
  quantity    numeric(20,8) not null check (quantity > 0),
  price       numeric(16,4) not null default 0,
  currency    text not null default 'USD' check (currency in ('COP','USD')),
  asset_type  text not null default 'stock' check (asset_type in ('stock','etf','crypto','fx','cdt')),
  account_id  uuid references public.accounts (id) on delete set null,
  -- Operación sintética que representa una posición anterior al libro.
  opening     boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- El historial siempre se lee por símbolo y de más reciente a más antiguo.
create index if not exists trades_user_symbol_idx
  on public.trades (user_id, symbol, occurred_at desc);

-- ===========================================================================
--  Row Level Security
-- ===========================================================================
alter table public.accounts     enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;
alter table public.holdings     enable row level security;
alter table public.goals        enable row level security;
alter table public.trades       enable row level security;

-- Una política por tabla que cubre select/insert/update/delete.
-- `using` filtra lo que se puede leer; `with check` valida lo que se escribe.
do $$
declare
  t text;
begin
  foreach t in array array['accounts','transactions','budgets','holdings','goals','trades'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ===========================================================================
--  user_id automático
-- ===========================================================================
--  Sin esto, el cliente tendría que enviar user_id en cada insert y un olvido
--  se convertiría en un error de RLS. El trigger lo rellena desde la sesión.
create or replace function public.set_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['accounts','transactions','budgets','holdings','goals','trades'] loop
    execute format('drop trigger if exists set_user_id_trg on public.%I', t);
    execute format(
      'create trigger set_user_id_trg
         before insert on public.%I
         for each row execute function public.set_user_id()', t);
  end loop;
end $$;

-- ===========================================================================
--  Tiempo real (opcional)
--  Permite que la app reciba cambios al instante en otros dispositivos.
-- ===========================================================================
-- Idempotente: volver a ejecutar este archivo no debe fallar con
-- "table is already member of publication".
do $$
declare
  t text;
begin
  -- En Supabase la publicación ya existe; fuera de Supabase puede no estar.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach t in array array['transactions','accounts'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ===========================================================================
--  Migración desde la primera versión del esquema
--  Estas sentencias no hacen nada si las columnas ya existen, así que el
--  archivo se puede volver a ejecutar sobre una base ya creada.
-- ===========================================================================
alter table public.accounts     add column if not exists apy numeric(6,3);
alter table public.accounts     add column if not exists pockets jsonb not null default '[]'::jsonb;
alter table public.accounts     add column if not exists credit_limit numeric(16,2);
alter table public.accounts     add column if not exists installments integer;
alter table public.accounts     add column if not exists installments_paid integer;
alter table public.transactions add column if not exists pocket_id text;
alter table public.transactions add column if not exists currency text;
alter table public.holdings     add column if not exists account_id uuid references public.accounts (id) on delete set null;

-- El tipo de activo gana 'cdt'; hay que rehacer la restricción.
alter table public.holdings drop constraint if exists holdings_asset_type_check;
alter table public.holdings add constraint holdings_asset_type_check
  check (asset_type in ('stock','etf','crypto','fx','cdt'));

-- Metas de ahorro (añadido después de la primera versión).
create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  target     numeric(16,2) not null default 0,
  saved      numeric(16,2) not null default 0,
  currency   text not null default 'COP' check (currency in ('COP','USD')),
  deadline   date,
  color      text not null default '#0A84FF',
  account_id uuid references public.accounts (id) on delete set null,
  pocket_id  text,
  created_at timestamptz not null default now()
);
alter table public.goals enable row level security;
drop policy if exists "own rows" on public.goals;
create policy "own rows" on public.goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists set_user_id_trg on public.goals;
create trigger set_user_id_trg before insert on public.goals
  for each row execute function public.set_user_id();

-- El upsert de presupuestos necesita esta restricción con nombre.
alter table public.budgets drop constraint if exists budgets_user_id_category_id_key;
alter table public.budgets add constraint budgets_user_id_category_id_key unique (user_id, category_id);

-- ===========================================================================
--  Bolsillos virtuales: dinero asignado a un presupuesto desde una cuenta
-- ===========================================================================
--  El saldo de la cuenta NO se toca al asignar. La cuenta sigue valiendo lo
--  que dice el banco, y el dinero asignado solo deja de estar "libre": es una
--  etiqueta sobre dinero que ya estaba ahí, no un movimiento.
--
--  Por eso esto es una tabla y no una columna en `budgets`: un presupuesto
--  puede fondearse desde varias cuentas, y hay que saber cuánto salió de cada
--  una para poder restarlo del disponible de esa cuenta y solo de esa.
--
--  El gasto real sí mueve las dos cosas, pero por vías distintas: la
--  transacción baja el saldo de la cuenta (como cualquier gasto) y consume lo
--  asignado al presupuesto de su categoría. Aquí no se registra nada.
create table if not exists public.budget_allocations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category_id text not null,
  -- La cuenta de la que sale. Si se borra la cuenta, la asignación pierde su
  -- origen pero no su importe: borrarla en cascada falsearía el presupuesto.
  account_id  uuid references public.accounts (id) on delete set null,
  -- Negativo permitido a propósito: así se retira dinero de un bolsillo
  -- añadiendo una fila, y el historial de asignaciones queda entero.
  amount      numeric(16,2) not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists budget_allocations_user_cat_idx
  on public.budget_allocations (user_id, category_id);
create index if not exists budget_allocations_user_acc_idx
  on public.budget_allocations (user_id, account_id);

alter table public.budget_allocations enable row level security;
drop policy if exists "own rows" on public.budget_allocations;
create policy "own rows" on public.budget_allocations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists set_user_id_trg on public.budget_allocations;
create trigger set_user_id_trg before insert on public.budget_allocations
  for each row execute function public.set_user_id();

-- ---------------------------------------------------------------------------
-- Topes diarios
-- ---------------------------------------------------------------------------
-- Por categoría, junto a su presupuesto del mes: son la misma decisión vista a
-- dos plazos («500.000 al mes» y «no más de 40.000 en un día»).
alter table public.budgets add column if not exists daily_cap numeric(16,2)
  check (daily_cap is null or daily_cap >= 0);

-- Y uno global, que no cuelga de ninguna categoría. Una fila por usuario.
create table if not exists public.settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  daily_cap  numeric(16,2) check (daily_cap is null or daily_cap >= 0),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;
drop policy if exists "own rows" on public.settings;
create policy "own rows" on public.settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists set_user_id_trg on public.settings;
create trigger set_user_id_trg before insert on public.settings
  for each row execute function public.set_user_id();

-- ===========================================================================
--  Transferencias entre cuentas
-- ===========================================================================
--  El tipo 'transfer' existía en la restricción desde el principio, pero no
--  había dónde escribir el destino, así que una transferencia solo restaba de
--  la cuenta de origen y el dinero desaparecía.
--
--  Va en la misma fila y no en dos: partirla en un gasto y un ingreso obliga a
--  mantener las dos mitades sincronizadas al editar y al borrar, y basta con
--  que una se pierda para que aparezca —o se esfume— dinero.
alter table public.transactions
  add column if not exists to_account_id uuid references public.accounts (id) on delete set null;
alter table public.transactions
  add column if not exists to_pocket_id text;

-- Una transferencia sin destino no es una transferencia, y un destino igual al
-- origen no mueve nada. Las dos cosas se cuelan solas desde un formulario.
alter table public.transactions drop constraint if exists transactions_transfer_check;
alter table public.transactions add constraint transactions_transfer_check check (
  type <> 'transfer'
  or (to_account_id is not null and to_account_id is distinct from account_id)
);
