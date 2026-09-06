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

-- ===========================================================================
--  Row Level Security
-- ===========================================================================
alter table public.accounts     enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;
alter table public.holdings     enable row level security;

-- Una política por tabla que cubre select/insert/update/delete.
-- `using` filtra lo que se puede leer; `with check` valida lo que se escribe.
do $$
declare
  t text;
begin
  foreach t in array array['accounts','transactions','budgets','holdings'] loop
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
  foreach t in array array['accounts','transactions','budgets','holdings'] loop
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
alter table public.accounts     add column if not exists installments integer;
alter table public.accounts     add column if not exists installments_paid integer;
alter table public.transactions add column if not exists pocket_id text;
alter table public.transactions add column if not exists currency text;
alter table public.holdings     add column if not exists account_id uuid references public.accounts (id) on delete set null;

-- El tipo de activo gana 'cdt'; hay que rehacer la restricción.
alter table public.holdings drop constraint if exists holdings_asset_type_check;
alter table public.holdings add constraint holdings_asset_type_check
  check (asset_type in ('stock','etf','crypto','fx','cdt'));
