-- ===========================================================================
--  Suscripciones
-- ===========================================================================
--  Lo que se cobra solo, mes tras mes, sin que nadie decida nada.
--
--  Va aparte de los movimientos porque la pregunta es otra. Un movimiento se
--  mira hacia atrás —en qué se me fue— y una suscripción hacia adelante: qué
--  me van a cobrar, cuándo, y cuánto suma todo esto al año. Esa última cifra
--  es la que sorprende: nueve cobros pequeños que nadie recuerda haber
--  aceptado y que juntos valen más que el arriendo de una semana.
-- ===========================================================================

create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Cómo se llama el servicio: Netflix, iCloud+, el gimnasio. Texto libre;
  -- el catálogo de la app solo sirve para pintarlo con su color.
  name        text not null,
  -- Lo que cobran cada ciclo, en su moneda. No el prorrateo mensual: ese se
  -- calcula, y guardarlo sería un segundo sitio donde equivocarse.
  amount      numeric(16,2) not null default 0 check (amount >= 0),
  currency    text not null default 'COP' check (currency in ('COP','USD')),
  cycle       text not null default 'mensual'
              check (cycle in ('semanal','mensual','trimestral','semestral','anual')),
  -- Un día en el que cobraron —o van a cobrar—. De aquí sale todo lo demás.
  --
  -- Un ancla y no «el próximo cobro»: el próximo cobro caduca en cuanto pasa
  -- la fecha, así que quien no abre la app en dos meses volvería a una
  -- pantalla anunciando cobros de julio. Con el ancla y el ciclo, la fecha se
  -- calcula siempre y sigue saliendo bien dentro de un año.
  anchor_at   date not null default current_date,
  -- Con qué se paga. Si la cuenta se borra, la suscripción se queda sin medio
  -- de pago pero no se borra: te la van a seguir cobrando igual.
  account_id  uuid references public.accounts (id) on delete set null,
  -- Si es una prueba gratis, cuándo deja de serlo. El agujero clásico: la
  -- prueba de un mes que nadie cancela y que lleva cobrando desde marzo.
  trial_ends_at date,
  -- Entre cuántos se reparte, contándote a ti. Un plan familiar de cuatro no
  -- cuesta lo que dice la factura.
  shared_with int check (shared_with is null or shared_with >= 1),
  -- Cancelada: se conserva por historial, pero ya no cuenta en los totales.
  cancelled   boolean not null default false,
  note        text,
  color       text not null default '#0A84FF',
  created_at  timestamptz not null default now()
);

-- Siempre se leen las de un usuario, y casi siempre las que siguen vivas.
create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, cancelled, anchor_at);

-- ===========================================================================
--  Row Level Security y user_id automático
-- ===========================================================================
--  Igual que el resto de tablas: sin la política, la llave anónima —que viaja
--  en el navegador— podría leer las suscripciones de cualquiera.
alter table public.subscriptions enable row level security;

drop policy if exists "own rows" on public.subscriptions;
create policy "own rows" on public.subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_user_id_trg on public.subscriptions;
create trigger set_user_id_trg
  before insert on public.subscriptions
  for each row execute function public.set_user_id();

-- PostgREST guarda el esquema en memoria: sin este aviso la tabla no existe
-- para la API hasta que se reinicie, y la primera suscripción que se registre
-- falla con un «relation not found» que no se parece en nada a la causa.
notify pgrst, 'reload schema';
